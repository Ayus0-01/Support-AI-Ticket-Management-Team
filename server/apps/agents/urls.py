"""
URL routing configuration for M3 Multi-Agent Engine API.
"""
from django.urls import path
from .views import (
    execute_m3_workflow_view,
    get_m3_workflow_status_view,
    get_m3_activity_logs_view,
)

urlpatterns = [
    path("tickets/<str:ticket_id>/execute/", execute_m3_workflow_view, name="m3-workflow-execute-path"),
    path("workflows/execute/", execute_m3_workflow_view, name="m3-workflow-execute-body"),
    path("tickets/<str:ticket_id>/workflow/", get_m3_workflow_status_view, name="m3-workflow-status"),
    path("tickets/<str:ticket_id>/activity-logs/", get_m3_activity_logs_view, name="m3-ticket-activity-logs"),
    path("workflows/<str:workflow_id>/activity-logs/", get_m3_activity_logs_view, name="m3-workflow-activity-logs"),
]
