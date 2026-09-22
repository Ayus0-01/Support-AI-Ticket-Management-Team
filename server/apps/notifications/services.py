from datetime import datetime, timezone
from typing import Any, Dict, Optional

from bson import ObjectId
from pymongo import ReturnDocument

from AIticket.db import db


notifications_collection = db["notifications"]


def _make_json_safe(value: Any) -> Any:
    """
    Convert MongoDB values into JSON-safe Python values.
    """

    if isinstance(value, ObjectId):
        return str(value)

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, dict):
        return {
            str(key): _make_json_safe(item)
            for key, item in value.items()
        }

    if isinstance(value, list):
        return [
            _make_json_safe(item)
            for item in value
        ]

    return value


def create_notification(
    recipient: str,
    title: str,
    message: str,
    notification_type: str = "info",
    ticket_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create an in-app notification for a user.
    """

    notification = {
        "recipient": recipient,
        "title": title,
        "message": message,
        "type": notification_type,
        "ticket_id": ticket_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc),
    }

    result = notifications_collection.insert_one(
        notification
    )

    notification["_id"] = result.inserted_id

    return _make_json_safe(notification)


def get_user_notifications(
    recipient: str,
    limit: int = 50,
) -> list:
    """
    Get the latest notifications for a user.
    """

    notifications = list(
        notifications_collection.find(
            {
                "recipient": recipient,
            }
        )
        .sort("created_at", -1)
        .limit(limit)
    )

    return _make_json_safe(notifications)


def mark_notification_as_read(
    notification_id: str,
    recipient: str,
) -> Optional[Dict[str, Any]]:
    """
    Mark one notification as read.

    The recipient check prevents one user from marking
    another user's notification as read.
    """

    try:
        object_id = ObjectId(notification_id)
    except Exception:
        return None

    result = notifications_collection.find_one_and_update(
        {
            "_id": object_id,
            "recipient": recipient,
        },
        {
            "$set": {
                "is_read": True,
            }
        },
        return_document=ReturnDocument.AFTER,
    )

    if not result:
        return None

    return _make_json_safe(result)


def mark_all_notifications_as_read(
    recipient: str,
) -> int:
    """
    Mark all notifications belonging to a user as read.
    """

    result = notifications_collection.update_many(
        {
            "recipient": recipient,
            "is_read": False,
        },
        {
            "$set": {
                "is_read": True,
            }
        },
    )

    return result.modified_count