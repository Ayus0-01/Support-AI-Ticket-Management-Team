"""
M3 Resolution Generation Agent implementation.
Consumes ticket context + Diagnosis Agent output + Knowledge Retrieval Agent evidence (from M2 RAG).
Generates structured troubleshooting steps, citations, summary, and limitations.
Handles empty evidence / LLM failures safely without fabricating solutions.
"""
import json
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional
from decouple import config

from .interfaces import BaseAgent

OLLAMA_URL = config("OLLAMA_URL", default="http://localhost:11434/api/generate")
MODEL_NAME = config("OLLAMA_MODEL", default="qwen3:4b")
REQUEST_TIMEOUT = config("OLLAMA_TIMEOUT", default=120, cast=int)  # Timeout in seconds for LLM call



def _call_llm(prompt: str, timeout: int = REQUEST_TIMEOUT) -> Optional[str]:
    """
    Calls the local LLM via Ollama API returning raw string response.
    Returns None if service is unavailable or times out.
    """
    payload = json.dumps({
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "think": False,
        "format": "json",
    }).encode("utf-8")


    request = urllib.request.Request(
        OLLAMA_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            data = json.loads(response.read().decode("utf-8"))
            return data.get("response", "")
    except Exception:
        return None


def _build_resolution_prompt(
    subject: str,
    description: str,
    category: str,
    subcategory: str,
    diagnosis: Dict[str, Any],
    packed_context: str,
    sources: List[Dict[str, Any]],
) -> str:
    source_guide = "\n".join([
        f"- {s.get('source_marker')}: {s.get('title')}"
        for s in sources if isinstance(s, dict)
    ])

    return f"""You are an expert IT Support Resolution Agent.
Generate a grounded, step-by-step resolution based ONLY on the provided Technical Diagnosis and Knowledge Base Evidence.

TICKET:
- Subject: {subject}
- Description: {description}
- Category: {category} / {subcategory}

DIAGNOSIS:
- Problem: {diagnosis.get('problem_understanding', 'N/A')}
- Affected System: {diagnosis.get('affected_system', 'Unknown')}
- Likely Causes: {', '.join(diagnosis.get('likely_causes', []))}

KNOWLEDGE BASE EVIDENCE:
{packed_context}

AVAILABLE CITATION MARKERS:
{source_guide}

INSTRUCTIONS:
1. Provide actionable troubleshooting steps in sequential order.
2. Embed the relevant citation marker (e.g., [SOURCE:KB-101#1]) after steps supported by the Knowledge Base.
3. If information is missing, explicitly list it in 'missing_information'.
4. Do NOT fabricate information not present in the Knowledge Base Evidence.

Return a JSON object with EXACTLY this structure:
{{
  "summary": "<concise summary of the resolution>",
  "troubleshooting_steps": [
    "<Step 1 with source marker if applicable>",
    "<Step 2 with source marker if applicable>"
  ],
  "missing_information": ["<missing item 1 if any>"],
  "limitations": ["<limitation 1 if any>"],
  "confidence": <float between 0.0 and 1.0>
}}

Output ONLY valid JSON.
"""


def _generate_no_evidence_resolution(
    subject: str,
    diagnosis: Dict[str, Any],
    reason: str = "No relevant knowledge-base context was retrieved."
) -> Dict[str, Any]:
    """
    Generates safe refusal output when no useful M2 KB evidence is available.
    Does NOT invent technical steps.
    """
    return {
        "status": "NO_EVIDENCE",
        "confidence": 0.0,
        "resolution": {
            "summary": f"Insufficient knowledge-base context to auto-resolve ticket '{subject}'.",
            "troubleshooting_steps": [],
            "sources": [],
            "missing_information": ["Approved Knowledge Base Article for this specific issue"],
            "limitations": ["Cannot generate resolution without verified documentation"],
            "confidence": 0.0,
            "refusal_reason": reason,
        }
    }


def _generate_fallback_resolution(
    subject: str,
    sources: List[Dict[str, Any]],
    reason: str = "AI service timeout or connection failure"
) -> Dict[str, Any]:
    """
    Generates safe degraded output when AI service fails.
    Uses basic structured template from retrieved sources without hallucinating.
    """
    steps = []
    if sources:
        for idx, src in enumerate(sources, 1):
            marker = src.get("source_marker", "")
            title = src.get("title", "KB Article")
            steps.append(f"{idx}. Refer to {title} {marker} for troubleshooting guidance.")

    return {
        "status": "DEGRADED",
        "confidence": 0.40,
        "resolution": {
            "summary": f"Standard resolution guidance for '{subject}'.",
            "troubleshooting_steps": steps if steps else ["1. Contact Tier-2 support team."],
            "sources": sources,
            "missing_information": ["AI-generated personalized resolution synthesis"],
            "limitations": ["LLM service unavailable; displaying raw source guidance"],
            "confidence": 0.40,
            "degraded_reason": reason,
        }
    }


class ResolutionAgent(BaseAgent):
    """
    Real M3 Resolution Generation Agent.
    Consumes M1 ticket context, Diagnosis Agent output, and M2 Knowledge Retrieval Agent evidence.
    Generates grounded resolutions with citations.
    Does NOT modify M1 classification/severity/priority fields or M2 RAG pipeline.
    """
    agent_name = "ResolutionAgent"

    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        subject = (input_data.get("subject") or "").strip()
        description = (input_data.get("description") or "").strip()
        category = (input_data.get("category") or "").strip()
        subcategory = (input_data.get("subcategory") or "").strip()

        diagnosis = input_data.get("diagnosis") or {}
        retrieved_evidence = input_data.get("retrieved_evidence") or []
        packed_context = input_data.get("packed_context", "")
        sources = input_data.get("sources") or []

        # Reconstruct sources list from retrieved_evidence if sources key is not explicitly provided
        if not sources and retrieved_evidence:
            sources = [
                {
                    "article_id": item.get("article_id"),
                    "chunk_index": item.get("chunk_index"),
                    "title": item.get("title", item.get("article_title", "")),
                    "source_marker": item.get("source_marker", f"[SOURCE:{item.get('article_id')}#{item.get('chunk_index')}]"),
                }
                for item in retrieved_evidence
                if isinstance(item, dict)
            ]

        # Handle empty/no evidence safely
        if not retrieved_evidence and not packed_context:
            return _generate_no_evidence_resolution(subject=subject, diagnosis=diagnosis)

        prompt = _build_resolution_prompt(
            subject=subject,
            description=description,
            category=category,
            subcategory=subcategory,
            diagnosis=diagnosis,
            packed_context=packed_context,
            sources=sources,
        )

        raw_response = _call_llm(prompt)

        if not raw_response:
            return _generate_fallback_resolution(subject=subject, sources=sources)

        try:
            parsed = json.loads(raw_response)

            summary = str(parsed.get("summary", "")).strip()
            troubleshooting_steps = parsed.get("troubleshooting_steps", [])
            if not isinstance(troubleshooting_steps, list):
                troubleshooting_steps = [str(troubleshooting_steps)]

            missing_information = parsed.get("missing_information", [])
            if not isinstance(missing_information, list):
                missing_information = [str(missing_information)]

            limitations = parsed.get("limitations", [])
            if not isinstance(limitations, list):
                limitations = [str(limitations)]

            try:
                confidence = float(parsed.get("confidence", 0.80))
                confidence = max(0.0, min(1.0, confidence))
            except (ValueError, TypeError):
                confidence = 0.80

            if not summary:
                summary = f"Resolution generated for ticket '{subject}'."

            return {
                "status": "SUCCESS",
                "confidence": confidence,
                "resolution": {
                    "summary": summary,
                    "troubleshooting_steps": troubleshooting_steps,
                    "sources": sources,
                    "missing_information": missing_information,
                    "limitations": limitations,
                    "confidence": confidence,
                }
            }

        except (json.JSONDecodeError, TypeError, KeyError):
            return _generate_fallback_resolution(
                subject=subject,
                sources=sources,
                reason="Invalid JSON response from AI service"
            )
