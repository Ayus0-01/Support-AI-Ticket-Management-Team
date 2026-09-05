"""
M3 Diagnosis Agent implementation.
Analyzes existing ticket details along with M1 classification, severity, and priority outputs.
Produces structured diagnosis results (problem understanding, affected system, likely causes, missing info, confidence).
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


def _build_diagnosis_prompt(
    subject: str,
    description: str,
    category: str,
    subcategory: str,
    severity: str,
    priority: str,
) -> str:
    return f"""You are an expert IT Support Diagnosis Agent.
Analyze the following IT support ticket and provide a structured technical diagnosis.

TICKET DETAILS:
- Subject: {subject}
- Description: {description}
- Category: {category}
- Sub-category: {subcategory}
- Severity: {severity}
- Priority: {priority}

INSTRUCTIONS:
Return a JSON object with EXACTLY the following structure:
{{
  "problem_understanding": "<detailed summary of what the user is experiencing>",
  "affected_system": "<identified system, application, or service, or 'Unknown' if not determinable>",
  "likely_causes": ["<cause 1>", "<cause 2>"],
  "missing_information": ["<missing detail 1 if any>", "<missing detail 2 if any>"],
  "confidence": <float between 0.0 and 1.0 representing diagnosis certainty>
}}

Output ONLY valid JSON.
"""


def _generate_fallback_diagnosis(
    subject: str,
    description: str,
    category: str,
    subcategory: str,
    severity: str,
    priority: str,
    reason: str = "LLM unavailable or invalid output"
) -> Dict[str, Any]:
    """
    Generates a safe degraded diagnosis output when AI service fails or information is missing.
    Does NOT modify M1 classification, severity, or priority.
    """
    affected = subcategory if subcategory else (category if category else "General System")
    missing = []
    if len(description.strip()) < 15:
        missing.append("Detailed error messages or steps to reproduce")

    return {
        "status": "DEGRADED",
        "confidence": 0.50,
        "diagnosis": {
            "problem_understanding": f"Ticket regarding '{subject}': {description}",
            "affected_system": affected,
            "likely_causes": [
                f"Potential issue within {affected} service",
                "User configuration or environment variance"
            ],
            "missing_information": missing,
            "confidence": 0.50,
            "degraded_reason": reason,
        }
    }


class DiagnosisAgent(BaseAgent):
    """
    Real M3 Diagnosis Agent.
    Consumes M1 ticket context and produces a structured diagnosis.
    Never alters existing ticket classification, severity, or priority.
    """
    agent_name = "DiagnosisAgent"

    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        subject = (input_data.get("subject") or "").strip()
        description = (input_data.get("description") or "").strip()
        category = (input_data.get("category") or "").strip()
        subcategory = (input_data.get("subcategory") or "").strip()
        severity = (input_data.get("severity") or "").strip()
        priority = (input_data.get("priority") or "").strip()

        # Handle missing or insufficient ticket information
        if not subject and not description:
            return {
                "status": "DEGRADED",
                "confidence": 0.20,
                "diagnosis": {
                    "problem_understanding": "Insufficient ticket information provided.",
                    "affected_system": "Unknown",
                    "likely_causes": ["Undetermined due to empty description"],
                    "missing_information": ["Subject", "Description", "Error logs"],
                    "confidence": 0.20,
                }
            }

        prompt = _build_diagnosis_prompt(
            subject=subject,
            description=description,
            category=category,
            subcategory=subcategory,
            severity=severity,
            priority=priority,
        )

        raw_response = _call_llm(prompt)

        if not raw_response:
            return _generate_fallback_diagnosis(
                subject=subject,
                description=description,
                category=category,
                subcategory=subcategory,
                severity=severity,
                priority=priority,
                reason="AI service timeout or connection failure"
            )

        try:
            # Parse JSON output from LLM
            parsed = json.loads(raw_response)
            
            problem_understanding = str(parsed.get("problem_understanding", "")).strip()
            affected_system = str(parsed.get("affected_system", "Unknown")).strip()
            likely_causes = parsed.get("likely_causes", [])
            if not isinstance(likely_causes, list):
                likely_causes = [str(likely_causes)]
            
            missing_information = parsed.get("missing_information", [])
            if not isinstance(missing_information, list):
                missing_information = [str(missing_information)]

            try:
                confidence = float(parsed.get("confidence", 0.75))
                confidence = max(0.0, min(1.0, confidence))
            except (ValueError, TypeError):
                confidence = 0.75

            if not problem_understanding:
                problem_understanding = f"Issue: {subject}"

            return {
                "status": "SUCCESS",
                "confidence": confidence,
                "diagnosis": {
                    "problem_understanding": problem_understanding,
                    "affected_system": affected_system if affected_system else "Unknown",
                    "likely_causes": likely_causes,
                    "missing_information": missing_information,
                    "confidence": confidence,
                }
            }

        except (json.JSONDecodeError, TypeError, KeyError):
            return _generate_fallback_diagnosis(
                subject=subject,
                description=description,
                category=category,
                subcategory=subcategory,
                severity=severity,
                priority=priority,
                reason="Invalid JSON output format from AI service"
            )
