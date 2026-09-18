"""
M3 Email Integration API Views.

Provides API endpoints for:
- Ticket created notifications
- AI resolution notifications
- Escalation notifications
- Resolved notifications
- Email log retrieval
"""

from typing import Any, Dict

from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from .email_service import (
    send_ticket_created_email,
    send_resolution_email,
    send_escalation_email,
    send_resolved_email,
)

from AIticket.db import email_logs_collection


def _get_request_data(request) -> Dict[str, Any]:
    """
    Safely returns request data as a dictionary.
    """
    if isinstance(request.data, dict):
        return dict(request.data)

    return {}


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def send_ticket_created_email_view(request):
    """
    POST /api/email/ticket-created/

    Sends a ticket-created notification.
    """

    data = _get_request_data(request)

    ticket = data.get("ticket") or data.get("ticket_info") or {}

    if not isinstance(ticket, dict):
        return Response(
            {"message": "ticket must be an object."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    recipient_email = data.get("recipient_email")

    result = send_ticket_created_email(
        ticket=ticket,
        recipient_email=recipient_email,
    )

    return Response(
        result,
        status=(
            status.HTTP_200_OK
            if result.get("status") in {"SUCCESS", "UNCONFIGURED"}
            else status.HTTP_502_BAD_GATEWAY
        ),
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def send_resolution_email_view(request):
    """
    POST /api/email/resolution/

    Sends an AI-resolution notification to the requester.
    """

    data = _get_request_data(request)

    ticket = data.get("ticket") or data.get("ticket_info") or {}
    response_data = data.get("response") or data.get("resolution") or {}

    if not isinstance(ticket, dict):
        return Response(
            {"message": "ticket must be an object."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not isinstance(response_data, dict):
        return Response(
            {"message": "response must be an object."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    recipient_email = data.get("recipient_email")

    result = send_resolution_email(
        ticket=ticket,
        response=response_data,
        recipient_email=recipient_email,
    )

    return Response(
        result,
        status=(
            status.HTTP_200_OK
            if result.get("status") in {"SUCCESS", "UNCONFIGURED"}
            else status.HTTP_502_BAD_GATEWAY
        ),
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def send_escalation_email_view(request):
    """
    POST /api/email/escalation/

    Sends an escalation notification to the support team.
    """

    data = _get_request_data(request)

    result = send_escalation_email(
        escalation_input=data,
        recipient_email=data.get("recipient_email"),
    )

    return Response(
        result,
        status=(
            status.HTTP_200_OK
            if result.get("status") in {"SUCCESS", "UNCONFIGURED"}
            else status.HTTP_502_BAD_GATEWAY
        ),
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def send_resolved_email_view(request):
    """
    POST /api/email/resolved/

    Sends a final resolved notification to the requester.
    """

    data = _get_request_data(request)

    ticket = data.get("ticket") or data.get("ticket_info") or {}
    resolution = data.get("resolution") or data.get("response") or {}

    if not isinstance(ticket, dict):
        return Response(
            {"message": "ticket must be an object."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not isinstance(resolution, dict):
        return Response(
            {"message": "resolution must be an object."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    result = send_resolved_email(
        ticket=ticket,
        resolution=resolution,
        recipient_email=data.get("recipient_email"),
    )

    return Response(
        result,
        status=(
            status.HTTP_200_OK
            if result.get("status") in {"SUCCESS", "UNCONFIGURED"}
            else status.HTTP_502_BAD_GATEWAY
        ),
    )


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def get_email_logs_view(request, ticket_id):
    """
    GET /api/email/logs/<ticket_id>/

    Returns email history for a ticket.
    """

    try:
        logs = list(
            email_logs_collection.find(
                {"ticket_id": ticket_id}
            ).sort(
                "created_at",
                -1,
            )
        )

        safe_logs = []

        for log in logs:
            safe_logs.append(
                {
                    "id": str(log.get("_id")),
                    "ticket_id": log.get("ticket_id"),
                    "email_type": log.get("email_type"),
                    "recipient": log.get("recipient"),
                    "subject": log.get("subject"),
                    "status": log.get("status"),
                    "sent": log.get("sent", False),
                    "reason": log.get("reason"),
                    "created_at": (
                        log.get("created_at").isoformat()
                        if log.get("created_at")
                        else None
                    ),
                }
            )

        return Response(
            {
                "ticket_id": ticket_id,
                "count": len(safe_logs),
                "logs": safe_logs,
            },
            status=status.HTTP_200_OK,
        )

    except Exception as e:
        return Response(
            {
                "ticket_id": ticket_id,
                "logs": [],
                "message": "Failed to retrieve email logs.",
                "error": str(e),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )