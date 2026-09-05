"""
M3 Real Escalation Agent implementation.
Formulates structured escalation details when Validation determines a ticket resolution
is not eligible for automatic resolution.
Preserves read-only M1 severity/priority and validation failure context.
Never modifies M1 classification/severity/priority fields or M2 RAG pipeline.
"""
from typing import Dict, Any, List
from .interfaces import BaseAgent


class EscalationAgent(BaseAgent):
    """
    Real M3 Escalation Agent.
    Evaluates validation output, failure reasons, and read-only M1 ticket context
    to produce a structured escalation package for human support routing.
    Does NOT hardcode user/agent IDs or perform external notification/Jira calls.
    """
    agent_name = "EscalationAgent"

    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        ticket = input_data.get("ticket") or {}
        if not isinstance(ticket, dict):
            ticket = {}

        diagnosis = input_data.get("diagnosis") or {}
        resolution = input_data.get("resolution") or {}
        validation = input_data.get("validation") or {}

        # Extract read-only M1 ticket fields safely
        ticket_id = str(ticket.get("ticket_id", "")).strip()
        subject = (ticket.get("subject") or "").strip()
        category = (ticket.get("category") or "").strip()
        subcategory = (ticket.get("subcategory") or "").strip()
        severity = (ticket.get("severity") or "").strip()
        priority = (ticket.get("priority") or "").strip()

        # Extract validation reasons & limitations
        val_reasons = validation.get("reasons") or input_data.get("validation_reasons") or []
        if not isinstance(val_reasons, list):
            val_reasons = [str(val_reasons)]

        blocking_limitations = validation.get("blocking_limitations") or []
        if not isinstance(blocking_limitations, list):
            blocking_limitations = []

        escalation_reason = input_data.get("escalation_reason") or ""

        # Formulate primary reason
        if val_reasons:
            primary_reason = val_reasons[0]
        elif escalation_reason:
            primary_reason = str(escalation_reason)
        else:
            primary_reason = "Resolution validation failed or composite confidence score below threshold requirement."

        recommended_action = "Escalate for manual support team review and troubleshooting."

        return {
            "status": "SUCCESS",
            "confidence": 1.0,
            "escalation": {
                "escalation_required": True,
                "reason": primary_reason,
                "priority_context": priority,
                "severity_context": severity,
                "ticket_info": {
                    "ticket_id": ticket_id,
                    "subject": subject,
                    "category": category,
                    "subcategory": subcategory,
                },
                "validation_failure_reasons": val_reasons,
                "recommended_action": recommended_action,
            }
        }

