from django.urls import path

from .views import (
    ticket_taxonomy_view,
    create_ticket_view,
    get_tickets_view,
    get_ticket_detail_view,
    check_duplicates_view,
    preview_classify_view,
    agent_queue_view,
    classification_override_view,
    transition_ticket_status_view,
    add_ticket_comment_view,
    ticket_timeline_view,
    generate_resolution_view,
    get_ticket_responses_view,
    get_resolution_response_view,
    accept_resolution_view,
    edit_send_resolution_view,
    reject_resolution_view,
    resolution_feedback_view,
    send_manual_resolution_view,
)


urlpatterns = [
    path(
        "taxonomy/",
        ticket_taxonomy_view,
        name="ticket-taxonomy",
    ),

    path(
        "",
        create_ticket_view,
        name="create-ticket"
    ),

    path(
        "my/",
        get_tickets_view,
        name="my-tickets"
    ),

    path(
        "check-duplicates/",
        check_duplicates_view,
        name="check-duplicates"
    ),
    path(
        "preview-classify/",
        preview_classify_view,
        name="preview-classify"
    ),

    path(
        "queue/",
        agent_queue_view,
        name="agent-queue"
    ),

    path(
        "classifications/<str:ticket_id>/",
        classification_override_view,
        name="classification-override",
    ),

    path(
        "responses/<str:response_id>/",
        get_resolution_response_view,
        name="get-resolution-response",
    ),

    path(
        "<str:ticket_id>/responses/",
        get_ticket_responses_view,
        name="get-ticket-responses",
    ),

    path(
        "responses/<str:response_id>/accept/",
        accept_resolution_view,
        name="accept-resolution",
    ),

    path(
        "responses/<str:response_id>/edit-send/",
        edit_send_resolution_view,
        name="edit-send-resolution",
    ),

    path(
        "responses/<str:response_id>/reject/",
        reject_resolution_view,
        name="reject-resolution",
    ),

    path(
        "responses/<str:response_id>/feedback/",
        resolution_feedback_view,
        name="resolution-feedback",
    ),

    path(
        "<str:ticket_id>/generate-resolution/",
        generate_resolution_view,
        name="generate-resolution",
    ),

    path(
        "<str:ticket_id>/manual-resolution/",
        send_manual_resolution_view,
        name="send-manual-resolution",
    ),

    path(
        "<str:ticket_id>/status/",
        transition_ticket_status_view,
        name="ticket-status-transition",
    ),

    path(
        "<str:ticket_id>/comments/",
        add_ticket_comment_view,
        name="add-ticket-comment",
    ),

    path(
        "<str:ticket_id>/timeline/",
        ticket_timeline_view,
        name="ticket-timeline",
    ),

    path(
        "<str:ticket_id>/",
        get_ticket_detail_view,
        name="ticket-detail"
    ),
    
]
