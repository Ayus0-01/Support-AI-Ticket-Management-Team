"""
M3 Jira Integration API Views.

Provides API endpoints for:
- Creating Jira issues
- Getting Jira issue details
- Updating Jira issues
- Synchronizing Jira status with SupportPilot tickets
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

from .jira_service import (
    create_jira_issue,
    get_jira_issue,
    update_jira_issue,
    sync_jira_status_for_ticket,
)


def _get_request_data(request) -> Dict[str, Any]:
    """Safely return request data as a dictionary."""
    if isinstance(request.data, dict):
        return dict(request.data)

    return {}


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def create_jira_ticket_view(request):
    """
    POST /api/jira/tickets/

    Creates a Jira issue for a SupportPilot ticket.
    """

    data = _get_request_data(request)

    ticket = data.get("ticket") or data.get("ticket_info") or {}

    if not isinstance(ticket, dict):
        return Response(
            {"message": "ticket must be an object."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    result = create_jira_issue(ticket)

    return Response(
        result,
        status=(
            status.HTTP_200_OK
            if result.get("status") in {"SUCCESS", "EXISTS"}
            else status.HTTP_502_BAD_GATEWAY
        ),
    )


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def get_jira_ticket_view(request, ticket_id):
    """
    GET /api/jira/tickets/<ticket_id>/

    Retrieves Jira information mapped to a SupportPilot ticket.
    """

    result = get_jira_issue(ticket_id)

    return Response(
        result,
        status=(
            status.HTTP_200_OK
            if result.get("status") == "SUCCESS"
            else status.HTTP_404_NOT_FOUND
        ),
    )


@api_view(["PUT", "PATCH"])
@authentication_classes([])
@permission_classes([AllowAny])
def update_jira_ticket_view(request, ticket_id):
    """
    PUT/PATCH /api/jira/tickets/<ticket_id>/

    Updates the mapped Jira issue.
    """

    data = _get_request_data(request)

    result = update_jira_issue(
        ticket_id=ticket_id,
        update_data=data,
    )

    return Response(
        result,
        status=(
            status.HTTP_200_OK
            if result.get("status") == "SUCCESS"
            else status.HTTP_502_BAD_GATEWAY
        ),
    )


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
def sync_jira_ticket_view(request):
    """
    POST /api/jira/sync/

    Synchronizes Jira status with the SupportPilot ticket.
    """

    data = _get_request_data(request)

    ticket_id = (
        data.get("ticket_id")
        or data.get("ticket_number")
    )

    if not ticket_id:
        return Response(
            {"message": "ticket_id is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    result = sync_jira_status_for_ticket(ticket_id)

    return Response(
        result,
        status=(
            status.HTTP_200_OK
            if result.get("status") == "SUCCESS"
            else status.HTTP_502_BAD_GATEWAY
        ),
    )