from datetime import datetime, timezone
from unittest.mock import patch

from bson import ObjectId
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from apps.tickets import views


class AgentQueueViewTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_queue_serializes_ticket_without_internal_object_ids(self):
        user_id = ObjectId()
        request = self.factory.get(
            "/api/tickets/queue/",
            HTTP_AUTHORIZATION="Bearer test-token",
        )
        queued_ticket = {
            "_id": str(ObjectId()),
            "ticket_id": "TKT-QUEUE-001",
            "subject": "VPN cannot connect",
            "description": "The approved client times out on connection.",
            "requester": {"username": "requester", "email": "requester@example.com"},
            "category": "VPN",
            "subcategory": "Connection failure",
            "status": "Open",
            "priority": {"value": "P2", "reason": "Work blocked"},
            "severity": "HIGH",
            "sla": {"first_response_due": datetime.now(timezone.utc)},
            "queue": "Network",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "latest_response_id": ObjectId(),
        }

        with patch.object(
            views,
            "AccessToken",
            return_value={"user_id": str(user_id)},
        ), patch.object(
            views.users_collection,
            "find_one",
            return_value={"_id": user_id, "role": "Agent"},
        ), patch.object(
            views,
            "get_agent_queue",
            return_value=[queued_ticket],
        ):
            response = views.agent_queue_view(request)
            response.render()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["tickets"][0]["ticket_id"], "TKT-QUEUE-001")
        self.assertEqual(response.data["tickets"][0]["priority"], "P2")
        self.assertIsInstance(
            response.data["tickets"][0]["latest_response_id"],
            str,
        )

