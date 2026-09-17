from django.urls import path

from .jira_views import (
    create_jira_ticket_view,
    get_jira_ticket_view,
    update_jira_ticket_view,
    sync_jira_ticket_view,
)


urlpatterns = [
    path(
        "tickets/",
        create_jira_ticket_view,
        name="jira-ticket-create",
    ),
    path(
        "tickets/<str:ticket_id>/",
        get_jira_ticket_view,
        name="jira-ticket-get",
    ),
    path(
        "tickets/<str:ticket_id>/update/",
        update_jira_ticket_view,
        name="jira-ticket-update",
    ),
    path(
        "sync/",
        sync_jira_ticket_view,
        name="jira-ticket-sync",
    ),
]