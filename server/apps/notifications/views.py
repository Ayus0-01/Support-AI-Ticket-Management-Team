from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from bson import ObjectId
from rest_framework_simplejwt.tokens import AccessToken

from AIticket.db import users_collection

from .services import (
    get_user_notifications,
    mark_notification_as_read,
    mark_all_notifications_as_read,
)


def _get_authenticated_user(request):
    auth_header = request.headers.get(
        "Authorization"
    )

    if not auth_header:
        return None, Response(
            {
                "message": "Authorization header missing."
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        parts = auth_header.split(" ")

        if len(parts) != 2 or parts[0] != "Bearer":
            raise ValueError()

        access_token = AccessToken(parts[1])

        user_id = access_token["user_id"]

        user = users_collection.find_one(
            {
                "_id": ObjectId(user_id)
            }
        )

        if not user:
            return None, Response(
                {
                    "message": "User not found."
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return user, None

    except Exception:
        return None, Response(
            {
                "message": "Invalid or expired token."
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )


@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def notifications_list_view(request):
    """
    Return notifications belonging to the current user.
    """

    user, error = _get_authenticated_user(request)

    if error:
        return error

    notifications = get_user_notifications(
        recipient=user["username"]
    )

    unread_count = sum(
        1
        for notification in notifications
        if not notification.get("is_read", False)
    )

    return Response(
        {
            "notifications": notifications,
            "unread_count": unread_count,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["PATCH"])
@authentication_classes([])
@permission_classes([AllowAny])
def mark_notification_read_view(
    request,
    notification_id,
):
    """
    Mark one notification as read.
    """

    user, error = _get_authenticated_user(request)

    if error:
        return error

    notification = mark_notification_as_read(
        notification_id=notification_id,
        recipient=user["username"],
    )

    if not notification:
        return Response(
            {
                "message": "Notification not found."
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response(
        {
            "message": "Notification marked as read.",
            "notification": notification,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["PATCH"])
@authentication_classes([])
@permission_classes([AllowAny])
def mark_all_notifications_read_view(request):
    """
    Mark all notifications belonging to the current user as read.
    """

    user, error = _get_authenticated_user(request)

    if error:
        return error

    updated_count = mark_all_notifications_as_read(
        recipient=user["username"]
    )

    return Response(
        {
            "message": "All notifications marked as read.",
            "updated_count": updated_count,
        },
        status=status.HTTP_200_OK,
    )