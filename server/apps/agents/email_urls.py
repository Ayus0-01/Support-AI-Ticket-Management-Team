"""
URL routing configuration for M3 Email Integration API.
"""

from django.urls import path

from .email_views import (
    send_ticket_created_email_view,
    send_resolution_email_view,
    send_escalation_email_view,
    send_resolved_email_view,
    get_email_logs_view,
)


urlpatterns = [
    path(
        "ticket-created/",
        send_ticket_created_email_view,
        name="email-ticket-created",
    ),
    path(
        "resolution/",
        send_resolution_email_view,
        name="email-resolution",
    ),
    path(
        "escalation/",
        send_escalation_email_view,
        name="email-escalation",
    ),
    path(
        "resolved/",
        send_resolved_email_view,
        name="email-resolved",
    ),
    path(
        "logs/<str:ticket_id>/",
        get_email_logs_view,
        name="email-logs",
    ),
]