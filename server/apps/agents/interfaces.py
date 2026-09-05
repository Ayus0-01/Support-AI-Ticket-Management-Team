"""
M3 Agent Interfaces and Implementations for Multi-Agent Orchestrator.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List


class BaseAgent(ABC):
    """
    Base interface for all M3 agents.
    """
    agent_name: str = "BaseAgent"

    @abstractmethod
    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes the agent logic with given input parameters.
        Returns a dictionary containing output_data and confidence score.
        """
        pass


class DiagnosisAgentStub(BaseAgent):
    agent_name = "DiagnosisAgent"

    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "status": "SUCCESS",
            "confidence": 0.85,
            "diagnosis": {
                "problem_understanding": "Stub Diagnosis: Identified probable configuration error based on ticket description.",
                "affected_system": input_data.get("category", "General"),
                "likely_causes": ["Misconfigured settings", "Network access rule"],
                "missing_information": [],
                "confidence": 0.85,
            }
        }


class KnowledgeRetrievalAgentStub(BaseAgent):
    agent_name = "KnowledgeRetrievalAgent"

    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "status": "SUCCESS",
            "confidence": 1.0,
            "retrieved_evidence": input_data.get("existing_m2_context", [])
        }


class ResolutionAgentStub(BaseAgent):
    agent_name = "ResolutionAgent"

    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "status": "SUCCESS",
            "confidence": 0.80,
            "resolution": {
                "troubleshooting_steps": [
                    "1. Verify account credentials and access permissions.",
                    "2. Restart connection module or refresh session token.",
                    "3. Contact system administrator if issue persists."
                ],
                "summary": "Stub Resolution: Standard troubleshooting procedure provided."
            }
        }


class ValidationAgentStub(BaseAgent):
    agent_name = "ValidationAgent"

    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        confidence = input_data.get("override_confidence", 0.85)
        is_valid = confidence >= 0.70
        return {
            "status": "SUCCESS",
            "confidence": confidence,
            "validation": {
                "is_valid": is_valid,
                "confidence_score": confidence,
                "reason": "Groundedness check passed" if is_valid else "Confidence score below threshold."
            }
        }


class EscalationAgentStub(BaseAgent):
    agent_name = "EscalationAgent"

    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "status": "SUCCESS",
            "confidence": 1.0,
            "escalation": {
                "escalated": True,
                "reason": input_data.get("escalation_reason", "Low resolution confidence"),
                "assigned_team": "Tier-2 Technical Support",
            }
        }


def __getattr__(name: str):
    if name == "DiagnosisAgent":
        from .diagnosis import DiagnosisAgent
        return DiagnosisAgent
    elif name == "KnowledgeRetrievalAgent":
        from .knowledge_retrieval import KnowledgeRetrievalAgent
        return KnowledgeRetrievalAgent
    elif name == "ResolutionAgent":
        from .resolution import ResolutionAgent
        return ResolutionAgent
    elif name == "ValidationAgent":
        from .validation import ValidationAgent
        return ValidationAgent
    elif name == "EscalationAgent":
        from .escalation import EscalationAgent
        return EscalationAgent
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")


