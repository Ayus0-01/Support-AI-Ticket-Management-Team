from django.urls import path

from .views import (
    notifications_list_view,
    mark_notification_read_view,
    mark_all_notifications_read_view,
)


urlpatterns = [
    path(
        "",
        notifications_list_view,
        name="notifications-list",
    ),
    path(
        "mark-all-read/",
        mark_all_notifications_read_view,
        name="notifications-mark-all-read",
    ),
    path(
        "<str:notification_id>/read/",
        mark_notification_read_view,
        name="notification-mark-read",
    ),
]