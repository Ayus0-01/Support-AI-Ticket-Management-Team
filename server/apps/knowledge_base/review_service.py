from datetime import datetime, timezone
import difflib
import logging

from apps.agents.email_service import (
    send_resolution_email,
    send_not_solved_email,
    send_resolved_email,
)

logger = logging.getLogger(__name__)

from .persistence import (
    get_ticket_response,
    update_ticket_response_status,
    update_ticket_resolution_state,
    create_resolution_feedback,
    _to_object_id,
)

from AIticket.db import (
    tickets_collection,
    ticket_responses_collection,
    resolution_feedback_collection,
)


from apps.tickets.services import (
    add_ticket_comment,
    transition_ticket_status,
    auto_assign_ticket,
)
from apps.notifications.services import create_notification


def get_response_for_review(
    *,
    response_id,
):
    return get_ticket_response(
        response_id=response_id
    )


def send_manual_resolution(
    *,
    ticket_id,
    reviewer_id,
    summary,
):
    summary = (summary or "").strip()
    if not summary:
        raise ValueError("Manual resolution cannot be empty.")

    ticket = tickets_collection.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise ValueError("Ticket not found.")

    now = datetime.now(timezone.utc)

    response_doc = {
        "ticket_id": ticket["_id"],
        "ticket_number": ticket.get("ticket_id"),
        "sufficient_context": True,
        "summary": summary,
        "steps": [],
        "sources": [],
        "escalation_recommended": False,
        "escalation_reason": None,
        "steps_generated": 0,
        "steps_dropped": 0,
        "dropped_details": [],
        "confidence": None,
        "confidence_parts": {},
        "retrieval_log_id": None,
        "queries_used": [],
        "chunks_retrieved": 0,
        "model": None,
        "prompt_version": None,
        "embedding_model": None,
        "tokens_in": None,
        "tokens_out": None,
        "latency_ms": None,
        "status": "SENT",
        "reviewed_by_id": _to_object_id(reviewer_id),
        "reviewed_at": now,
        "edit_diff": None,
        "reject_reason": None,
        "source": "MANUAL",
        "created_at": now,
    }

    insert_result = ticket_responses_collection.insert_one(response_doc)
    inserted_id = insert_result.inserted_id

    update_ticket_resolution_state(
        ticket_id=ticket["_id"],
        resolution_status="SENT",
        response_id=inserted_id,
    )

    if ticket.get("status") == "Open":
        transition_ticket_status(
            ticket_id=ticket["ticket_id"],
            new_status="In Progress",
            actor_user_id=reviewer_id,
        )

    add_ticket_comment(
        ticket_id=ticket["ticket_id"],
        author_user_id=reviewer_id,
        comment=summary,
        visibility="PUBLIC",
        source="MANUAL",
    )

    created_response = get_ticket_response(
        response_id=inserted_id
    )

    try:
        send_resolution_email(
            ticket=ticket,
            response=created_response,
        )
    except Exception as email_err:
        logger.warning(
            f"Resolution notification email failed: {email_err}"
        )

    return created_response


def accept_response(
    *,
    response_id,
    reviewer_id,
):
    response = get_ticket_response(
        response_id=response_id
    )

    if not response:
        raise ValueError(
            "Response not found."
        )

    if response.get("status") != "DRAFT":
        raise ValueError(
            "Only DRAFT responses can be accepted."
        )

    now = datetime.now(
        timezone.utc
    )

    update_ticket_response_status(
        response_id=response_id,
        status="SENT",
        reviewed_by_id=reviewer_id,
        reviewed_at=now,
    )

    update_ticket_resolution_state(
        ticket_id=response["ticket_id"],
        resolution_status="SENT",
        response_id=response_id,
    )

    ticket = tickets_collection.find_one(
        {
            "_id": response["ticket_id"]
        }
    )

    if ticket and ticket.get(
        "status"
    ) == "Open":
        transition_ticket_status(
            ticket_id=ticket["ticket_id"],
            new_status="In Progress",
            actor_user_id=reviewer_id,
        )

    steps_text = "\n".join(
        [
            f"{step.get('order')}. "
            f"{step.get('instruction')}"
            for step in response.get(
                "steps",
                [],
            )
        ]
    )

    comment = (
        f"{response.get('summary', '')}\n\n"
        f"{steps_text}"
    ).strip()

    add_ticket_comment(
        ticket_id=response.get(
            "ticket_number"
        ),
        author_user_id=reviewer_id,
        comment=comment,
        visibility="PUBLIC",
        source="AI",
    )

    if ticket:
        try:
            send_resolution_email(
                ticket=ticket,
                response=response,
            )
        except Exception as email_err:
            logger.warning(
                f"Resolution notification email failed: {email_err}"
            )

    return get_ticket_response(
        response_id=response_id
    )


def reject_response(
    *,
    response_id,
    reviewer_id,
    reason,
):
    response = get_ticket_response(
        response_id=response_id
    )

    if not response:
        raise ValueError(
            "Response not found."
        )

    if response.get("status") != "DRAFT":
        raise ValueError(
            "Only DRAFT responses can be rejected."
        )

    reason = (
        reason or ""
    ).strip()

    if not reason:
        raise ValueError(
            "Reject reason is required."
        )

    now = datetime.now(
        timezone.utc
    )

    update_ticket_response_status(
        response_id=response_id,
        status="REJECTED",
        reviewed_by_id=reviewer_id,
        reviewed_at=now,
        reject_reason=reason,
    )

    update_ticket_resolution_state(
        ticket_id=response["ticket_id"],
        resolution_status="REJECTED",
    )

    return get_ticket_response(
        response_id=response_id
    )


def edit_and_send_response(
    *,
    response_id,
    reviewer_id,
    edited_summary,
    edited_steps,
):
    response = get_ticket_response(
        response_id=response_id
    )

    if not response:
        raise ValueError(
            "Response not found."
        )

    if response.get("status") != "DRAFT":
        raise ValueError(
            "Only DRAFT responses can be edited and sent."
        )

    edited_summary = (
        edited_summary or ""
    ).strip()

    if not edited_summary:
        raise ValueError(
            "Edited summary is required."
        )

    edited_steps = (
        edited_steps or []
    )

    original_text = (
        response.get("summary", "")
        + "\n"
        + "\n".join(
            step.get(
                "instruction",
                "",
            )
            for step in response.get(
                "steps",
                [],
            )
        )
    )

    edited_text = (
        edited_summary
        + "\n"
        + "\n".join(
            step.get(
                "instruction",
                "",
            )
            for step in edited_steps
        )
    )

    edit_diff = list(
        difflib.unified_diff(
            original_text.splitlines(),
            edited_text.splitlines(),
            lineterm="",
        )
    )

    now = datetime.now(
        timezone.utc
    )

    ticket_response_update = {
        "summary": edited_summary,
        "steps": edited_steps,
    }

    ticket_responses_collection.update_one(
        {
            "_id": response["_id"]
        },
        {
            "$set": {
                **ticket_response_update,
            }
        },
    )

    update_ticket_response_status(
        response_id=response_id,
        status="EDITED_SENT",
        reviewed_by_id=reviewer_id,
        reviewed_at=now,
        edit_diff=edit_diff,
    )

    update_ticket_resolution_state(
        ticket_id=response["ticket_id"],
        resolution_status="EDITED_SENT",
        response_id=response_id,
    )

    ticket = tickets_collection.find_one(
        {
            "_id": response["ticket_id"]
        }
    )

    if ticket and ticket.get(
        "status"
    ) == "Open":
        transition_ticket_status(
            ticket_id=ticket["ticket_id"],
            new_status="In Progress",
            actor_user_id=reviewer_id,
        )

    steps_text = "\n".join(
        [
            f"{step.get('order')}. "
            f"{step.get('instruction')}"
            for step in edited_steps
        ]
    )

    comment = (
        f"{edited_summary}\n\n"
        f"{steps_text}"
    ).strip()

    add_ticket_comment(
        ticket_id=response.get(
            "ticket_number"
        ),
        author_user_id=reviewer_id,
        comment=comment,
        visibility="PUBLIC",
        source="AI",
    )

    return get_ticket_response(
        response_id=response_id
    )


def submit_feedback(
    *,
    response_id,
    user_id,
    was_helpful,
    comment="",
    user_role="User",
):
    response = get_ticket_response(
        response_id=response_id
    )

    if not response:
        raise ValueError(
            "Response not found."
        )

    ticket = tickets_collection.find_one(
        {
            "_id": response["ticket_id"]
        }
    )

    if not ticket:
        raise ValueError(
            "Ticket not found."
        )

    # 1. Authorization: Only ticket requester or Agent/Admin may submit feedback
    requester_id = str((ticket.get("requester") or {}).get("user_id", ""))
    is_owner = requester_id == str(user_id)
    is_staff = user_role in {"Agent", "Admin"}

    if not is_owner and not is_staff:
        raise ValueError(
            "You can only submit feedback for your own tickets."
        )

    # 2. Sent Resolution Only: Requesters may only confirm/reject SENT or EDITED_SENT resolutions
    if is_owner and response.get("status") not in {"SENT", "EDITED_SENT"}:
        raise ValueError(
            "Feedback can only be submitted for sent resolutions."
        )

    # 3. Duplicate Protection
    existing_feedback = resolution_feedback_collection.find_one(
        {
            "response_id": response["_id"],
            "user_id": _to_object_id(user_id),
        }
    )
    if existing_feedback:
        raise ValueError(
            "Feedback has already been submitted for this resolution."
        )

    # 4. A requester may confirm that the resolution helped, but only an
    # Agent/Admin can explicitly change the ticket status through the existing
    # status-transition workflow.
    requester_confirmed = is_owner and bool(was_helpful)

    # 5. Create Feedback Record
    feedback = create_resolution_feedback(
        response_id=response_id,
        ticket_id=response["ticket_id"],
        user_id=user_id,
        was_helpful=was_helpful,
        comment=comment,
        resolved_ticket=requester_confirmed,
    )

    # 6. Workflow State & Timeline Update
    comment_text = (comment or "").strip()

    if requester_confirmed:
        # Customer acceptance is an explicit confirmation of the AI solution.
        # Complete the ticket through the normal status-transition/audit path.
        update_ticket_resolution_state(
            ticket_id=ticket["_id"],
            resolution_status="CONFIRMED",
            response_id=response["_id"],
        )

        if ticket.get("status") == "Open":
            transition_ticket_status(
                ticket_id=ticket["ticket_id"],
                new_status="In Progress",
                actor_user_id=user_id,
            )

        current_status = tickets_collection.find_one({"_id": ticket["_id"]})
        if current_status and current_status.get("status") == "In Progress":
            transition_ticket_status(
                ticket_id=ticket["ticket_id"],
                new_status="Resolved",
                actor_user_id=user_id,
                resolution_summary=response.get("summary", "AI resolution confirmed by customer."),
            )

                    # Send resolved notification after the ticket is actually resolved.
        try:
            resolved_ticket = tickets_collection.find_one(
                {"_id": ticket["_id"]}
            )

            resolved_email_result = send_resolved_email(
                ticket=resolved_ticket or ticket,
                resolution=response,
            )

            log_activity(
                ticket_id=ticket["ticket_id"],
                action="RESOLVED_EMAIL_SENT",
                details="Ticket resolved notification email processed.",
                actor="Resolution Workflow",
                agent_name="ReviewService",
                status=resolved_email_result.get("status", "UNKNOWN"),
                metadata={
                    "email_result": resolved_email_result,
                },
            )

        except Exception as email_error:
            log_activity(
                ticket_id=ticket["ticket_id"],
                action="RESOLVED_EMAIL_FAILED",
                details=f"Resolved notification email failed: {email_error}",
                actor="Resolution Workflow",
                agent_name="ReviewService",
                status="FAILED",
            )

        timeline_comment = (
            f"Requester confirmed the AI resolution solved the issue. Ticket resolved. Feedback: {comment_text}"
            if comment_text
            else "Requester confirmed the AI resolution solved the issue. Ticket resolved."
        )
        add_ticket_comment(
            ticket_id=ticket["ticket_id"],
            author_user_id=user_id,
            comment=timeline_comment,
            visibility="PUBLIC",
            source="HUMAN",
        )
    elif is_owner:
        # NO / NOT SOLVED: Keep ticket in In Progress and mark as USER_REJECTED
        update_ticket_resolution_state(
            ticket_id=ticket["_id"],
            resolution_status="USER_REJECTED",
            response_id=response["_id"],
        )

        timeline_comment = (
            f"Requester reported resolution did not solve the issue. Feedback: {comment_text}"
            if comment_text
            else "Requester reported resolution did not solve the issue."
        )
        add_ticket_comment(
            ticket_id=ticket["ticket_id"],
            author_user_id=user_id,
            comment=timeline_comment,
            visibility="PUBLIC",
            source="HUMAN",
        )

        # Customer rejection immediately enters the human-support routing
        # path. If all suitable agents are at capacity, it remains queued.
        assigned_ticket = auto_assign_ticket(
            ticket_id=ticket["ticket_id"],
            actor_username="Customer Rejection Router",
        )
        if assigned_ticket:
            add_ticket_comment(
                ticket_id=ticket["ticket_id"],
                author_user_id="SYSTEM",
                comment=f"Ticket routed to support agent {assigned_ticket.get('assignee')} after customer rejected the AI resolution.",
                visibility="INTERNAL",
                source="AUTO_ASSIGNMENT",
            )

            try:
                assigned_agent = assigned_ticket.get("assignee")

                if assigned_agent:
                    create_notification(
                        recipient=assigned_agent,
                        title="Customer Rejected AI Resolution",
                        message=(
                            f"Customer rejected the AI resolution for "
                            f"ticket {ticket['ticket_id']}. "
                            "Please review and resolve the ticket."
                        ),
                        notification_type="warning",
                        ticket_id=ticket["ticket_id"],
                    )
            except Exception as notification_error:
                logger.warning(
                    "Customer rejection notification failed for %s: %s",
                    ticket["ticket_id"],
                    notification_error,
                )

        try:
            send_not_solved_email(
                ticket=ticket,
                feedback=feedback,
            )
        except Exception as email_err:
            logger.warning(
                f"Not-solved notification email failed: {email_err}"
            )


    updated_ticket = tickets_collection.find_one({"_id": response["ticket_id"]})

    return {
        "feedback": feedback,
        "ticket": updated_ticket,
    }
