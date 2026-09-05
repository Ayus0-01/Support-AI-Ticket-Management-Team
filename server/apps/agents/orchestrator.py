"""
Multi-Agent Orchestrator for M3 Workflow Coordination.
Coordinates specialized agents across Diagnosis -> Knowledge Retrieval -> Resolution -> Validation -> Auto Resolution OR Escalation.
"""
from typing import Dict, Any, List, Optional
from AIticket.db import tickets_collection
from .models import (
    agent_workflows_collection,
    agent_executions_collection,
    activity_logs_collection,
    generate_uuid,
    get_utc_now,
)
from .interfaces import (
    BaseAgent,
    DiagnosisAgent,
    DiagnosisAgentStub,
    KnowledgeRetrievalAgent,
    KnowledgeRetrievalAgentStub,
    ResolutionAgent,
    ResolutionAgentStub,
    ValidationAgent,
    ValidationAgentStub,
    EscalationAgent,
    EscalationAgentStub,
)
from .jira_service import create_jira_issue
from .email_service import send_escalation_email



def log_activity(
    ticket_id: str,
    action: str,
    details: str,
    actor: str = "System/Orchestrator",
    workflow_id: Optional[str] = None,
    agent_name: Optional[str] = None,
    status: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Records an entry in the activity_logs collection.
    Captures workflow ID, ticket ID, agent/stage, event/action, status, timestamp, actor, and relevant metadata.
    """
    log_entry = {
        "log_id": generate_uuid(),
        "workflow_id": workflow_id,
        "ticket_id": ticket_id,
        "agent_name": agent_name,
        "stage": agent_name,
        "action": action,
        "status": status or "SUCCESS",
        "details": details,
        "actor": actor,
        "metadata": metadata or {},
        "timestamp": get_utc_now(),
    }
    activity_logs_collection.insert_one(log_entry)
    log_entry.pop("_id", None)
    return log_entry



def start_workflow(
    ticket_id: str,
    ticket_data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Initializes a new M3 Multi-Agent Workflow for an existing ticket.
    Consumes M1/M2 ticket context. Never creates a new ticket.
    """
    if not ticket_data:
        ticket_data = tickets_collection.find_one({"ticket_id": ticket_id})

    if not ticket_data:
        raise ValueError(f"Cannot start workflow: Existing ticket '{ticket_id}' not found.")

    workflow_id = f"wf_{generate_uuid()[:8]}"
    now = get_utc_now()

    workflow_doc = {
        "workflow_id": workflow_id,
        "ticket_id": ticket_id,
        "workflow_status": "IN_PROGRESS",
        "current_agent": "DiagnosisAgent",
        "started_at": now,
        "completed_at": None,
        "final_confidence": 0.0,
        "diagnosis": None,
        "retrieved_evidence": [],
        "resolution": None,
        "validation": None,
    }

    agent_workflows_collection.insert_one(workflow_doc)
    workflow_doc.pop("_id", None)

    log_activity(
        ticket_id=ticket_id,
        action="WORKFLOW_STARTED",
        details=f"Multi-agent workflow initialized with ID {workflow_id}.",
        actor="Multi-Agent Orchestrator",
        workflow_id=workflow_id,
        agent_name="Orchestrator",
        status="IN_PROGRESS",
        metadata={"workflow_id": workflow_id, "ticket_id": ticket_id},
    )

    return workflow_doc


def record_agent_execution(
    workflow_id: str,
    agent_name: str,
    input_data: Dict[str, Any],
    output_data: Dict[str, Any],
    status: str = "SUCCESS",
    confidence: float = 1.0,
) -> Dict[str, Any]:
    """
    Records an individual agent step execution within a workflow.
    """
    execution_id = f"exec_{generate_uuid()[:8]}"
    now = get_utc_now()

    execution_doc = {
        "execution_id": execution_id,
        "workflow_id": workflow_id,
        "agent_name": agent_name,
        "input_data": input_data,
        "output_data": output_data,
        "status": status,
        "confidence": confidence,
        "started_at": now,
        "completed_at": now,
    }

    agent_executions_collection.insert_one(execution_doc)
    execution_doc.pop("_id", None)

    # Update workflow state with current agent and progress
    agent_workflows_collection.update_one(
        {"workflow_id": workflow_id},
        {"$set": {
            "current_agent": agent_name,
            "updated_at": now,
        }}
    )

    return execution_doc


def get_workflow_by_ticket(ticket_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves the workflow state for a given ticket.
    """
    workflow = agent_workflows_collection.find_one(
        {"ticket_id": ticket_id},
        sort=[("started_at", -1)]
    )
    if workflow:
        workflow.pop("_id", None)
    return workflow


def get_workflow_executions(workflow_id: str) -> List[Dict[str, Any]]:
    """
    Retrieves all agent execution steps for a specific workflow.
    """
    executions = list(
        agent_executions_collection.find(
            {"workflow_id": workflow_id},
            sort=[("started_at", 1)]
        )
    )
    for item in executions:
        item.pop("_id", None)
    return executions


def get_activity_logs(
    ticket_id: Optional[str] = None,
    workflow_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Retrieves activity log entries from activity_logs_collection for a given ticket or workflow.
    """
    query: Dict[str, Any] = {}
    if ticket_id:
        query["ticket_id"] = ticket_id
    if workflow_id:
        query["workflow_id"] = workflow_id

    logs = list(
        activity_logs_collection.find(query, sort=[("timestamp", 1)])
    )
    for log in logs:
        log.pop("_id", None)
    return logs


def execute_orchestration_pipeline(
    ticket_id: str,
    ticket_data: Optional[Dict[str, Any]] = None,
    agent_overrides: Optional[Dict[str, BaseAgent]] = None,
    confidence_threshold: float = 0.70,
) -> Dict[str, Any]:
    """
    Executes the M3 Multi-Agent Orchestration Pipeline for an existing ticket.
    
    Target Flow:
    Existing Ticket -> M1 context -> M2 RAG context -> Orchestrator -> Diagnosis ->
    Knowledge Retrieval -> Resolution -> Validation -> Auto Resolution OR Escalation
    """
    if not ticket_data:
        ticket_data = tickets_collection.find_one({"ticket_id": ticket_id})

    if not ticket_data:
        raise ValueError(f"Cannot execute orchestration: Existing ticket '{ticket_id}' not found.")

    # Initialize workflow state
    workflow = start_workflow(ticket_id=ticket_id, ticket_data=ticket_data)
    workflow_id = workflow["workflow_id"]

    # Register stage agents (stubs by default, overridable by actual implementations)
    agents: Dict[str, BaseAgent] = {
        "DiagnosisAgent": DiagnosisAgent(),
        "KnowledgeRetrievalAgent": KnowledgeRetrievalAgent(),
        "ResolutionAgent": ResolutionAgent(),
        "ValidationAgent": ValidationAgent(),
        "EscalationAgent": EscalationAgent(),
    }
    if agent_overrides:
        agents.update(agent_overrides)

    # If ticket record lacks M1 outputs, invoke real M1 classification pipeline
    if not ticket_data.get("severity") or not ticket_data.get("subcategory"):
        from apps.tickets.classification.pipeline import classify_ticket
        m1_res = classify_ticket(
            subject=ticket_data.get("subject", ""),
            description=ticket_data.get("description", ""),
        )
        if not ticket_data.get("category"):
            ticket_data["category"] = m1_res["category"]["value"]
        if not ticket_data.get("subcategory"):
            ticket_data["subcategory"] = m1_res["subcategory"]["value"]
        if not ticket_data.get("severity"):
            ticket_data["severity"] = m1_res["severity"]["value"]
        if not ticket_data.get("priority"):
            ticket_data["priority"] = m1_res["priority"]["value"]

    # Context extracted from existing M1/M2 ticket record
    m1_m2_context = {
        "ticket_id": ticket_id,
        "subject": ticket_data.get("subject", ""),
        "description": ticket_data.get("description", ""),
        "category": ticket_data.get("category", ""),
        "subcategory": ticket_data.get("subcategory") or ticket_data.get("sub_category", ""),
        "severity": ticket_data.get("severity", ""),
        "priority": ticket_data.get("priority", ""),
        "existing_m2_context": ticket_data.get("retrieved_knowledge", []),
    }

    # --- Stage 1: Diagnosis ---
    diag_agent = agents["DiagnosisAgent"]
    diag_input = {**m1_m2_context}
    diag_output = diag_agent.run(diag_input)
    record_agent_execution(
        workflow_id=workflow_id,
        agent_name=diag_agent.agent_name,
        input_data=diag_input,
        output_data=diag_output.get("diagnosis", {}),
        status=diag_output.get("status", "SUCCESS"),
        confidence=diag_output.get("confidence", 1.0),
    )
    agent_workflows_collection.update_one(
        {"workflow_id": workflow_id},
        {"$set": {"diagnosis": diag_output.get("diagnosis"), "current_agent": "KnowledgeRetrievalAgent"}}
    )
    log_activity(
        ticket_id=ticket_id,
        action="AGENT_DIAGNOSIS_COMPLETED",
        details=f"Diagnosis finished with confidence {diag_output.get('confidence', 0.8)}.",
        actor="DiagnosisAgent",
        workflow_id=workflow_id,
        agent_name="DiagnosisAgent",
        status=diag_output.get("status", "SUCCESS"),
        metadata={
            "confidence": diag_output.get("confidence", 1.0),
            "problem_understanding": diag_output.get("diagnosis", {}).get("problem_understanding"),
            "affected_system": diag_output.get("diagnosis", {}).get("affected_system"),
        },
    )

    # --- Stage 2: Knowledge Retrieval ---
    ret_agent = agents["KnowledgeRetrievalAgent"]
    ret_input = {
        **m1_m2_context,
        "diagnosis": diag_output.get("diagnosis", {}),
    }
    ret_output = ret_agent.run(ret_input)
    record_agent_execution(
        workflow_id=workflow_id,
        agent_name=ret_agent.agent_name,
        input_data=ret_input,
        output_data={"retrieved_evidence": ret_output.get("retrieved_evidence", [])},
        status=ret_output.get("status", "SUCCESS"),
        confidence=ret_output.get("confidence", 1.0),
    )
    agent_workflows_collection.update_one(
        {"workflow_id": workflow_id},
        {"$set": {"retrieved_evidence": ret_output.get("retrieved_evidence", []), "current_agent": "ResolutionAgent"}}
    )
    log_activity(
        ticket_id=ticket_id,
        action="AGENT_RETRIEVAL_COMPLETED",
        details=f"Knowledge retrieval found {len(ret_output.get('retrieved_evidence', []))} evidence chunks.",
        actor="KnowledgeRetrievalAgent",
        workflow_id=workflow_id,
        agent_name="KnowledgeRetrievalAgent",
        status=ret_output.get("status", "SUCCESS"),
        metadata={
            "confidence": ret_output.get("confidence", 1.0),
            "evidence_count": len(ret_output.get("retrieved_evidence", [])),
        },
    )

    # --- Stage 3: Resolution ---
    res_agent = agents["ResolutionAgent"]
    res_input = {
        **m1_m2_context,
        "diagnosis": diag_output.get("diagnosis", {}),
        "retrieved_evidence": ret_output.get("retrieved_evidence", []),
    }
    res_output = res_agent.run(res_input)
    record_agent_execution(
        workflow_id=workflow_id,
        agent_name=res_agent.agent_name,
        input_data=res_input,
        output_data=res_output.get("resolution", {}),
        status=res_output.get("status", "SUCCESS"),
        confidence=res_output.get("confidence", 1.0),
    )
    agent_workflows_collection.update_one(
        {"workflow_id": workflow_id},
        {"$set": {"resolution": res_output.get("resolution"), "current_agent": "ValidationAgent"}}
    )
    log_activity(
        ticket_id=ticket_id,
        action="AGENT_RESOLUTION_COMPLETED",
        details=f"Resolution generation finished with status {res_output.get('status')}.",
        actor="ResolutionAgent",
        workflow_id=workflow_id,
        agent_name="ResolutionAgent",
        status=res_output.get("status", "SUCCESS"),
        metadata={
            "confidence": res_output.get("confidence", 1.0),
            "resolution_status": res_output.get("status"),
        },
    )

    # --- Stage 4: Validation ---
    val_agent = agents["ValidationAgent"]
    val_input = {
        **m1_m2_context,
        "diagnosis": diag_output.get("diagnosis", {}),
        "retrieved_evidence": ret_output.get("retrieved_evidence", []),
        "resolution": res_output,
        "confidence_threshold": confidence_threshold,
    }
    val_output = val_agent.run(val_input)
    val_details = val_output.get("validation", {})
    val_confidence = float(val_output.get("confidence", 0.0))
    is_valid = bool(val_details.get("is_valid", False))

    record_agent_execution(
        workflow_id=workflow_id,
        agent_name=val_agent.agent_name,
        input_data=val_input,
        output_data=val_details,
        status=val_output.get("status", "SUCCESS"),
        confidence=val_confidence,
    )
    agent_workflows_collection.update_one(
        {"workflow_id": workflow_id},
        {"$set": {"validation": val_details, "final_confidence": val_confidence}}
    )
    log_activity(
        ticket_id=ticket_id,
        action="AGENT_VALIDATION_COMPLETED",
        details=f"Validation finished with confidence {val_confidence}.",
        actor="ValidationAgent",
        workflow_id=workflow_id,
        agent_name="ValidationAgent",
        status=val_output.get("status", "SUCCESS"),
        metadata={
            "confidence": val_confidence,
            "is_valid": is_valid,
            "reasons": val_details.get("reasons", []),
            "blocking_limitations": val_details.get("blocking_limitations", []),
        },
    )

    # --- Stage 5 Decision: Auto Resolution OR Escalation ---
    now = get_utc_now()
    if is_valid and val_confidence >= confidence_threshold:
        agent_workflows_collection.update_one(
            {"workflow_id": workflow_id},
            {"$set": {
                "workflow_status": "COMPLETED",
                "auto_resolve_eligible": True,
                "requires_escalation": False,
                "completed_at": now,
            }}
        )
        log_activity(
            ticket_id=ticket_id,
            action="AUTO_RESOLUTION_APPROVED",
            details="Workflow completed successfully with high confidence.",
            actor="Multi-Agent Orchestrator",
            workflow_id=workflow_id,
            agent_name="ValidationAgent",
            status="COMPLETED",
            metadata={
                "final_confidence": val_confidence,
                "auto_resolve_eligible": True,
            },
        )
    else:
        # Run real EscalationAgent when validation fails / requires escalation
        esc_agent = agents["EscalationAgent"]
        esc_input = {
            "ticket": m1_m2_context,
            "diagnosis": diag_output.get("diagnosis", {}),
            "retrieved_evidence": ret_output.get("retrieved_evidence", []),
            "resolution": res_output.get("resolution", {}),
            "validation": val_details,
            "escalation_reason": f"Validation rejected auto-resolution (confidence {val_confidence} below threshold {confidence_threshold})",
        }
        esc_output = esc_agent.run(esc_input)
        esc_data = esc_output.get("escalation") or {}

        # Invoke Jira Integration Service layer for escalated tickets
        jira_result = create_jira_issue(esc_input)
        esc_data["jira_result"] = jira_result
        esc_input["jira_result"] = jira_result

        # Invoke Email Integration Service layer for escalated tickets
        email_result = send_escalation_email(esc_input)
        esc_data["email_result"] = email_result

        record_agent_execution(
            workflow_id=workflow_id,
            agent_name=esc_agent.agent_name,
            input_data=esc_input,
            output_data=esc_data,
            status=esc_output.get("status", "SUCCESS"),
            confidence=esc_output.get("confidence", 1.0),
        )

        agent_workflows_collection.update_one(
            {"workflow_id": workflow_id},
            {"$set": {
                "workflow_status": "ESCALATED",
                "auto_resolve_eligible": False,
                "requires_escalation": True,
                "escalation": esc_data,
                "jira_result": jira_result,
                "email_result": email_result,
                "completed_at": now,
            }}
        )
        log_activity(
            ticket_id=ticket_id,
            action="WORKFLOW_ESCALATED",
            details=f"Workflow escalated. Jira status: {jira_result.get('status')}, Email status: {email_result.get('status')}.",
            actor="Multi-Agent Orchestrator",
            workflow_id=workflow_id,
            agent_name="EscalationAgent",
            status="ESCALATED",
            metadata={
                "escalation_reason": esc_data.get("reason"),
                "jira_status": jira_result.get("status"),
                "jira_issue_key": jira_result.get("jira_issue_key"),
                "email_status": email_result.get("status"),
            },
        )

    # Return updated workflow doc
    final_workflow = agent_workflows_collection.find_one({"workflow_id": workflow_id})
    if final_workflow:
        final_workflow.pop("_id", None)
    return final_workflow
