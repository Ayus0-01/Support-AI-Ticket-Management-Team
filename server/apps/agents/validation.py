"""
M3 Validation Agent / Confidence Gate implementation.
Evaluates Resolution Agent output, groundedness against retrieved M2 evidence,
citation consistency, and composite confidence before approving auto-resolution.
"""
from typing import Dict, Any, List, Optional
from .interfaces import BaseAgent


class ValidationAgent(BaseAgent):
    """
    Real M3 Validation Agent / Confidence Gate.
    Evaluates groundedness, citation consistency, resolution quality, and composite confidence.
    Determines if a ticket workflow is eligible for auto-resolution or requires escalation.
    Never modifies M1 classification/severity/priority fields or M2 RAG pipeline.
    """
    agent_name = "ValidationAgent"

    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        resolution_input = input_data.get("resolution") or {}
        diagnosis = input_data.get("diagnosis") or {}
        retrieved_evidence = input_data.get("retrieved_evidence") or input_data.get("ticket", {}).get("existing_m2_context", [])
        confidence_threshold = float(input_data.get("confidence_threshold", 0.70))

        # Check if caller supplied direct override confidence (for testing / manual gate)
        override_confidence = input_data.get("override_confidence")

        reasons: List[str] = []
        blocking_limitations: List[str] = []

        # Extract resolution structure
        res_status = str(resolution_input.get("status", "")).upper()
        res_confidence = float(resolution_input.get("confidence", 0.0))
        diag_confidence = float(diagnosis.get("confidence", 0.80)) if isinstance(diagnosis, dict) else 0.80

        inner_res = resolution_input.get("resolution") if isinstance(resolution_input.get("resolution"), dict) else resolution_input
        summary = str(inner_res.get("summary", "")).strip() if isinstance(inner_res, dict) else ""
        steps = inner_res.get("troubleshooting_steps", []) if isinstance(inner_res, dict) else []
        if not isinstance(steps, list):
            steps = [str(steps)]
        
        sources = inner_res.get("sources", []) if isinstance(inner_res, dict) else []
        if not isinstance(sources, list):
            sources = []

        missing_info = inner_res.get("missing_information", []) if isinstance(inner_res, dict) else []
        if not isinstance(missing_info, list):
            missing_info = []

        limitations = inner_res.get("limitations", []) if isinstance(inner_res, dict) else []
        if not isinstance(limitations, list):
            limitations = []

        # Rule 1 & 7: Failed, degraded, or missing resolution cannot auto-resolve
        if res_status in ("NO_EVIDENCE", "FAILED", "DEGRADED") or not res_status:
            reasons.append(f"Resolution status '{res_status or 'MISSING'}' is not eligible for automatic resolution.")
            return {
                "status": "SUCCESS",
                "confidence": 0.0,
                "validation": {
                    "is_valid": False,
                    "auto_resolve_eligible": False,
                    "confidence_score": 0.0,
                    "groundedness_ratio": 0.0,
                    "reasons": reasons,
                    "citation_check_passed": False,
                    "blocking_limitations": [f"Resolution status not SUCCESS: {res_status}"],
                }
            }

        # Rule 2: Resolution content must exist
        if not summary or not steps:
            reasons.append("Resolution is missing summary or troubleshooting steps.")
            return {
                "status": "SUCCESS",
                "confidence": 0.0,
                "validation": {
                    "is_valid": False,
                    "auto_resolve_eligible": False,
                    "confidence_score": 0.0,
                    "groundedness_ratio": 0.0,
                    "reasons": reasons,
                    "citation_check_passed": False,
                    "blocking_limitations": ["Empty summary or troubleshooting steps"],
                }
            }

        # Rule 3 & 4: Groundedness and citation consistency check
        known_markers = set()
        for src in sources:
            if isinstance(src, dict) and src.get("source_marker"):
                known_markers.add(src.get("source_marker"))
        for ev in retrieved_evidence:
            if isinstance(ev, dict) and ev.get("source_marker"):
                known_markers.add(ev.get("source_marker"))

        cited_steps_count = 0
        valid_citations_count = 0
        for step in steps:
            step_str = str(step)
            if "[SOURCE:" in step_str:
                cited_steps_count += 1
                if any(marker in step_str for marker in known_markers) or not known_markers:
                    valid_citations_count += 1

        groundedness_ratio = 1.0 if not steps else (valid_citations_count / len(steps))
        citation_check_passed = bool(sources) or (cited_steps_count > 0 and valid_citations_count == cited_steps_count)

        if not citation_check_passed and not sources:
            reasons.append("Resolution steps contain no source citations or verified evidence references.")

        # Rule 5: Check for blocking missing information or limitations
        for item in missing_info:
            item_str = str(item)
            if "Approved Knowledge Base" in item_str or "Critical" in item_str:
                blocking_limitations.append(item_str)
                reasons.append(f"Blocking missing information: {item_str}")

        for item in limitations:
            item_str = str(item)
            if "LLM service unavailable" in item_str or "Cannot generate" in item_str:
                blocking_limitations.append(item_str)
                reasons.append(f"Blocking limitation: {item_str}")

        # Rule 6: Composite confidence calculation
        if override_confidence is not None:
            composite_confidence = float(override_confidence)
        else:
            composite_confidence = round(
                0.3 * diag_confidence + 0.4 * res_confidence + 0.3 * groundedness_ratio, 2
            )

        # Final Validation Decision
        is_valid = (
            res_status == "SUCCESS" and
            bool(summary) and
            bool(steps) and
            composite_confidence >= confidence_threshold and
            not blocking_limitations and
            (bool(sources) or groundedness_ratio > 0)
        )

        if is_valid:
            reasons.append(f"Validation passed with composite confidence {composite_confidence} (threshold {confidence_threshold}).")
        else:
            if composite_confidence < confidence_threshold:
                reasons.append(f"Composite confidence {composite_confidence} below threshold {confidence_threshold}.")

        return {
            "status": "SUCCESS",
            "confidence": composite_confidence,
            "validation": {
                "is_valid": is_valid,
                "auto_resolve_eligible": is_valid,
                "confidence_score": composite_confidence,
                "groundedness_ratio": groundedness_ratio,
                "reasons": reasons,
                "citation_check_passed": citation_check_passed,
                "blocking_limitations": blocking_limitations,
            }
        }
