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
from .email_service import (
    send_escalation_email,
    send_resolution_email,
)
from apps.knowledge_base.persistence import (
    create_retrieval_log,
    create_ticket_response,
    create_response_citations,
    mark_ticket_resolution_generated,
    update_ticket_response_status,
    update_ticket_resolution_state,
)
from apps.tickets.services import auto_assign_ticket, transition_ticket_status



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
        "packed_context": ret_output.get("packed_context", ""),
        "sources": ret_output.get("sources", []),
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
        # High-confidence M3 result becomes the customer-facing resolution.
        # Keep the response in the same M2 persistence model so the existing
        # customer UI, citations and feedback flow can consume it safely.
        raw_resolution = res_output.get("resolution") or {}
        raw_steps = raw_resolution.get("troubleshooting_steps") or []
        normalized_steps = []
        for index, raw_step in enumerate(raw_steps, start=1):
            if isinstance(raw_step, dict):
                instruction = str(raw_step.get("instruction") or raw_step.get("text") or "").strip()
                sources = raw_step.get("sources") or []
            else:
                instruction = str(raw_step).strip()
                import re
                sources = re.findall(r"\[SOURCE:[^\]]+\]", instruction)
            if instruction:
                normalized_steps.append({
                    "order": index,
                    "instruction": instruction,
                    "sources": sources,
                    "requires_approval": False,
                })

        retrieval_results = ret_output.get("retrieved_evidence", [])
        retrieval_log = create_retrieval_log(
            ticket_id=ticket_data.get("_id"),
            queries_used=ret_output.get("queries_used", []),
            chunks_retrieved=len(retrieval_results),
            results=retrieval_results,
        )
        response_payload = {
            "sufficient_context": True,
            "summary": str(raw_resolution.get("summary") or "AI resolution generated successfully.").strip(),
            "steps": normalized_steps,
            "sources": ret_output.get("sources", []),
            "escalation_recommended": False,
            "escalation_reason": None,
            "confidence": val_confidence,
            "confidence_parts": {
                "diagnosis": float(diag_output.get("confidence", 0.0) or 0.0),
                "resolution": float(res_output.get("confidence", 0.0) or 0.0),
                "groundedness": float(val_details.get("groundedness_ratio", 0.0) or 0.0),
            },
        }
        response_doc = create_ticket_response(
            ticket=ticket_data,
            resolution=response_payload,
            retrieval_log=retrieval_log,
            queries_used=ret_output.get("queries_used", []),
            model="qwen3:4b",
            prompt_version="m3-resolution.v1",
        )
        create_response_citations(
            response=response_doc,
            retrieval_results=retrieval_results,
        )
        mark_ticket_resolution_generated(
            ticket_id=ticket_data.get("_id"),
            response_id=response_doc["_id"],
        )
        update_ticket_response_status(
            response_id=response_doc["_id"],
            status="SENT",
            reviewed_at=get_utc_now(),
        )
        update_ticket_resolution_state(
            ticket_id=ticket_data.get("_id"),
            resolution_status="SENT",
            response_id=response_doc["_id"],
        )

                # Send AI resolution notification to the customer
        try:
            resolution_email_result = send_resolution_email(
                ticket=ticket_data,
                response=response_doc,
)
            
            log_activity(
                ticket_id=ticket_id,
                action="RESOLUTION_EMAIL_SENT",
                details="AI resolution email notification processed.",
                actor="Multi-Agent Orchestrator",
                workflow_id=workflow_id,
                agent_name="ResolutionAgent",
                status=resolution_email_result.get("status", "UNKNOWN"),
                metadata={
                    "email_result": resolution_email_result,
                },
            )
        except Exception as email_error:
            log_activity(
                ticket_id=ticket_id,
                action="RESOLUTION_EMAIL_FAILED",
                details=f"AI resolution email failed: {email_error}",
                actor="Multi-Agent Orchestrator",
                workflow_id=workflow_id,
                agent_name="ResolutionAgent",
                status="FAILED",
            )
        # A customer-facing AI solution is now waiting for confirmation.
        # Move Open -> In Progress so accepting the solution can complete it.
        current_ticket = tickets_collection.find_one({"ticket_id": ticket_id})
        if current_ticket and current_ticket.get("status") == "Open":
            transition_ticket_status(
                ticket_id=ticket_id,
                new_status="In Progress",
                actor_user_id="AI_ORCHESTRATOR",
            )

        agent_workflows_collection.update_one(
            {"workflow_id": workflow_id},
            {"$set": {
                "workflow_status": "COMPLETED",
                "auto_resolve_eligible": True,
                "requires_escalation": False,
                "customer_response_id": response_doc["_id"],
                "customer_response_status": "SENT",
                "completed_at": now,
            }}
        )
        log_activity(
            ticket_id=ticket_id,
            action="AUTO_RESOLUTION_SENT_TO_CUSTOMER",
            details="High-confidence multi-agent resolution was sent to the customer for confirmation.",
            actor="Multi-Agent Orchestrator",
            workflow_id=workflow_id,
            agent_name="ValidationAgent",
            status="COMPLETED",
            metadata={
                "final_confidence": val_confidence,
                "auto_resolve_eligible": True,
                "response_id": str(response_doc["_id"]),
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

        # Keep the agent that was assigned BEFORE AI processing started.
        # Only assign a new agent if the ticket somehow has no assignee.
        current_ticket = tickets_collection.find_one(
            {"ticket_id": ticket_id}
        )

        existing_assignee = (
            current_ticket.get("assignee")
            if current_ticket
            else None
        )

        if existing_assignee:
            esc_data["assigned_agent"] = existing_assignee
            esc_data["assignment_status"] = "ASSIGNED"
        else:
            assigned_ticket = auto_assign_ticket(
                ticket_id=ticket_id,
                actor_username="Multi-Agent Orchestrator",
            )

            if assigned_ticket:
                esc_data["assigned_agent"] = assigned_ticket.get(
                    "assignee"
                )
                esc_data["assignment_status"] = "ASSIGNED"
            else:
                esc_data["assigned_agent"] = None
                esc_data["assignment_status"] = "QUEUED"

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
