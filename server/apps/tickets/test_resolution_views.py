from unittest.mock import patch

from bson import ObjectId
from django.test import SimpleTestCase
from django.urls import resolve
from rest_framework.test import APIRequestFactory

from apps.tickets import views


class ResolutionViewTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_ticket_response_route_is_registered(self):
        match = resolve("/api/tickets/TKT-001/responses/")

        self.assertEqual(
            match.func,
            views.get_ticket_responses_view,
        )

    def test_requester_cannot_read_internal_response_data(self):
        request = self.factory.get(
            "/api/tickets/TKT-001/responses/"
        )

        with patch.object(
            views,
            "_get_authenticated_user",
            return_value=({"role": "User"}, None),
        ):
            response = views.get_ticket_responses_view(
                request,
                ticket_id="TKT-001",
            )

        self.assertEqual(response.status_code, 403)

    def test_response_serializer_uses_persisted_citation_metadata(self):
        response_id = ObjectId()
        article_id = ObjectId()
        citation = {
            "article_id": article_id,
            "article_title": "VPN Troubleshooting",
            "heading_path": "VPN > Connection timeout",
            "chunk_index": 2,
            "snippet": "Verify the corporate VPN gateway status.",
            "step_order": 1,
            "retrieval_rank": 1,
        }
        response_document = {
            "_id": response_id,
            "ticket_number": "TKT-001",
            "status": "DRAFT",
            "sufficient_context": True,
            "summary": "Check the VPN gateway.",
            "steps": [],
            "sources": [f"[SOURCE:{article_id}#2]"],
            "escalation_recommended": False,
            "escalation_reason": None,
            "confidence": 0.85,
            "confidence_parts": {},
        }

        with patch.object(
            views.response_citations_collection,
            "find",
        ) as find_citations:
            find_citations.return_value.sort.return_value = [
                citation
            ]

            serialized = views._serialize_resolution_response(
                response_document
            )

        self.assertEqual(serialized["citations"][0]["article_id"], str(article_id))
        self.assertEqual(serialized["citations"][0]["section"], "VPN > Connection timeout")
        self.assertEqual(serialized["citations"][0]["source"], f"[SOURCE:{article_id}#2]")

    def test_agent_can_read_persisted_draft_and_refusal_state(self):
        response_id = ObjectId()
        ticket_object_id = ObjectId()
        response_document = {
            "_id": response_id,
            "ticket_id": ticket_object_id,
            "ticket_number": "TKT-001",
            "status": "DRAFT",
            "sufficient_context": False,
            "summary": "No supported resolution is available.",
            "steps": [],
            "sources": [],
            "escalation_recommended": True,
            "escalation_reason": "No matching published knowledge.",
            "confidence": 0.0,
            "confidence_parts": {},
            "steps_dropped": 1,
        }
        request = self.factory.get("/api/tickets/TKT-001/responses/")

        with patch.object(
            views,
            "_get_authenticated_user",
            return_value=({"_id": ObjectId(), "role": "Agent"}, None),
        ), patch.object(
            views.tickets_collection,
            "find_one",
            return_value={"_id": ticket_object_id, "ticket_id": "TKT-001"},
        ), patch.object(
            views.ticket_responses_collection,
            "find",
        ) as find_responses, patch.object(
            views,
            "_get_response_citations",
            return_value=[],
        ):
            find_responses.return_value.sort.return_value = [response_document]
            response = views.get_ticket_responses_view(
                request,
                ticket_id="TKT-001",
            )

        self.assertEqual(response.status_code, 200)
        draft = response.data["responses"][0]
        self.assertEqual(draft["status"], "DRAFT")
        self.assertFalse(draft["sufficient_context"])
        self.assertEqual(draft["steps"], [])
        self.assertTrue(draft["escalation_recommended"])
        self.assertEqual(draft["steps_dropped"], 1)

    def test_requester_cannot_generate_resolution(self):
        user_id = ObjectId()
        request = self.factory.post(
            "/api/tickets/TKT-001/generate-resolution/",
            {},
            format="json",
            HTTP_AUTHORIZATION="Bearer test-token",
        )

        with patch.object(
            views,
            "AccessToken",
            return_value={"user_id": str(user_id)},
        ), patch.object(
            views.users_collection,
            "find_one",
            return_value={"_id": user_id, "role": "User"},
        ), patch.object(
            views.tickets_collection,
            "find_one",
            return_value={"_id": ObjectId(), "ticket_id": "TKT-001"},
        ), patch.object(views, "generate_and_persist_resolution") as generate:
            response = views.generate_resolution_view(
                request,
                ticket_id="TKT-001",
            )

        self.assertEqual(response.status_code, 403)
        generate.assert_not_called()

    def test_agent_generation_returns_draft_response(self):
        user_id = ObjectId()
        response_id = ObjectId()
        request = self.factory.post(
            "/api/tickets/TKT-001/generate-resolution/",
            {},
            format="json",
            HTTP_AUTHORIZATION="Bearer test-token",
        )
        ticket = {
            "_id": ObjectId(),
            "ticket_id": "TKT-001",
            "category": "VPN",
            "severity": "Medium",
            "classification": {},
        }
        generated = {
            "_id": response_id,
            "ticket_number": "TKT-001",
            "status": "DRAFT",
            "sufficient_context": True,
            "summary": "Check the approved VPN setup.",
            "steps": [{"order": 1, "instruction": "Confirm the VPN gateway."}],
            "escalation_recommended": False,
            "escalation_reason": None,
            "confidence": 0.82,
            "confidence_parts": {"retrieval": 0.82},
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
            views.tickets_collection,
            "find_one",
            return_value=ticket,
        ), patch.object(
            views,
            "generate_and_persist_resolution",
            return_value=generated,
        ) as generate:
            response = views.generate_resolution_view(
                request,
                ticket_id="TKT-001",
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["response"]["id"], str(response_id))
        self.assertEqual(response.data["response"]["status"], "DRAFT")
        generate.assert_called_once_with(
            ticket=ticket,
            classification_confidence=0.0,
        )

    def test_existing_draft_prevents_duplicate_generation(self):
        user_id = ObjectId()
        response_id = ObjectId()
        request = self.factory.post(
            "/api/tickets/TKT-001/generate-resolution/",
            {},
            format="json",
            HTTP_AUTHORIZATION="Bearer test-token",
        )

        with patch.object(
            views,
            "AccessToken",
            return_value={"user_id": str(user_id)},
        ), patch.object(
            views.users_collection,
            "find_one",
            return_value={"_id": user_id, "role": "Agent"},
        ), patch.object(
            views.tickets_collection,
            "find_one",
            return_value={
                "_id": ObjectId(),
                "ticket_id": "TKT-001",
                "resolution_status": "DRAFT",
                "latest_response_id": response_id,
            },
        ), patch.object(views, "generate_and_persist_resolution") as generate:
            response = views.generate_resolution_view(
                request,
                ticket_id="TKT-001",
            )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data["latest_response_id"], str(response_id))
        generate.assert_not_called()

    def test_accept_endpoint_invokes_review_service_as_agent(self):
        reviewer_id = ObjectId()
        response_id = ObjectId()
        request = self.factory.post(
            f"/api/tickets/responses/{response_id}/accept/",
            {},
            format="json",
        )

        with patch.object(
            views,
            "_get_authenticated_user",
            return_value=({"_id": reviewer_id, "role": "Agent"}, None),
        ), patch.object(
            views,
            "accept_response",
            return_value={"_id": response_id, "ticket_number": "TKT-001", "status": "SENT"},
        ) as accept:
            response = views.accept_resolution_view(
                request,
                response_id=str(response_id),
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["response"]["status"], "SENT")
        accept.assert_called_once_with(response_id=str(response_id), reviewer_id=reviewer_id)

    def test_edit_send_requires_a_step_list(self):
        response_id = ObjectId()
        request = self.factory.post(
            f"/api/tickets/responses/{response_id}/edit-send/",
            {"summary": "Edited resolution", "steps": "not-a-list"},
            format="json",
        )

        with patch.object(
            views,
            "_get_authenticated_user",
            return_value=({"_id": ObjectId(), "role": "Agent"}, None),
        ):
            response = views.edit_send_resolution_view(
                request,
                response_id=str(response_id),
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["message"], "steps must be a list.")

    def test_edit_send_and_reject_use_real_review_contracts(self):
        reviewer_id = ObjectId()
        response_id = ObjectId()
        edited_steps = [{"order": 1, "instruction": "Confirm the VPN gateway."}]
        edit_request = self.factory.post(
            f"/api/tickets/responses/{response_id}/edit-send/",
            {"summary": "Edited resolution", "steps": edited_steps},
            format="json",
        )
        reject_request = self.factory.post(
            f"/api/tickets/responses/{response_id}/reject/",
            {"reason": "Needs a different support path."},
            format="json",
        )

        with patch.object(
            views,
            "_get_authenticated_user",
            return_value=({"_id": reviewer_id, "role": "Agent"}, None),
        ), patch.object(
            views,
            "edit_and_send_response",
            return_value={"_id": response_id, "ticket_number": "TKT-001", "status": "EDITED_SENT"},
        ) as edit_send, patch.object(
            views,
            "reject_response",
            return_value={
                "_id": response_id,
                "ticket_number": "TKT-001",
                "status": "REJECTED",
                "reject_reason": "Needs a different support path.",
            },
        ) as reject:
            edit_response = views.edit_send_resolution_view(
                edit_request,
                response_id=str(response_id),
            )
            reject_response = views.reject_resolution_view(
                reject_request,
                response_id=str(response_id),
            )

        self.assertEqual(edit_response.status_code, 200)
        self.assertEqual(edit_response.data["response"]["status"], "EDITED_SENT")
        edit_send.assert_called_once_with(
            response_id=str(response_id),
            reviewer_id=reviewer_id,
            edited_summary="Edited resolution",
            edited_steps=edited_steps,
        )
        self.assertEqual(reject_response.status_code, 200)
        self.assertEqual(reject_response.data["response"]["reject_reason"], "Needs a different support path.")
        reject.assert_called_once_with(
            response_id=str(response_id),
            reviewer_id=reviewer_id,
            reason="Needs a different support path.",
        )

    def test_feedback_endpoint_persists_authenticated_feedback(self):
        user_id = ObjectId()
        response_id = ObjectId()
        feedback_id = ObjectId()
        request = self.factory.post(
            f"/api/tickets/responses/{response_id}/feedback/",
            {"was_helpful": True, "comment": "Resolved my issue.", "resolved_ticket": True},
            format="json",
        )

        with patch.object(
            views,
            "_get_authenticated_user",
            return_value=({"_id": user_id, "role": "User"}, None),
        ), patch.object(
            views,
            "submit_feedback",
            return_value={"_id": feedback_id},
        ) as submit_feedback:
            response = views.resolution_feedback_view(
                request,
                response_id=str(response_id),
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["feedback_id"], str(feedback_id))
        submit_feedback.assert_called_once_with(
            response_id=str(response_id),
            user_id=user_id,
            was_helpful=True,
            comment="Resolved my issue.",
            resolved_ticket=True,
            user_role="User",
        )

    def test_requester_can_get_sent_resolution_response(self):
        user_id = ObjectId()
        response_id = ObjectId()
        ticket_id = ObjectId()
        response_doc = {
            "_id": response_id,
            "ticket_id": ticket_id,
            "ticket_number": "IT-2026-000001",
            "status": "SENT",
            "summary": "Sample resolution",
            "steps": [],
            "sources": [],
            "confidence": 0.9,
        }
        ticket_doc = {
            "_id": ticket_id,
            "ticket_id": "IT-2026-000001",
            "requester": {"user_id": str(user_id)},
        }
        request = self.factory.get(f"/api/tickets/responses/{response_id}/")

        with patch.object(
            views,
            "_get_authenticated_user",
            return_value=({"_id": user_id, "role": "User"}, None),
        ), patch.object(
            views,
            "get_response_for_review",
            return_value=response_doc,
        ), patch.object(
            views.tickets_collection,
            "find_one",
            return_value=ticket_doc,
        ), patch.object(
            views,
            "_get_response_citations",
            return_value=[],
        ):
            response = views.get_resolution_response_view(
                request,
                response_id=str(response_id),
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], str(response_id))
        self.assertEqual(response.data["status"], "SENT")

    def test_feedback_ownership_error_returns_forbidden(self):
        user_id = ObjectId()
        response_id = ObjectId()
        request = self.factory.post(
            f"/api/tickets/responses/{response_id}/feedback/",
            {"was_helpful": True, "comment": "", "resolved_ticket": True},
            format="json",
        )

        with patch.object(
            views,
            "_get_authenticated_user",
            return_value=({"_id": user_id, "role": "User"}, None),
        ), patch.object(
            views,
            "submit_feedback",
            side_effect=ValueError("You can only submit feedback for your own tickets."),
        ):
            response = views.resolution_feedback_view(
                request,
                response_id=str(response_id),
            )

        self.assertEqual(response.status_code, 403)
        self.assertIn("own tickets", response.data["message"])

    def test_feedback_duplicate_error_returns_conflict(self):
        user_id = ObjectId()
        response_id = ObjectId()
        request = self.factory.post(
            f"/api/tickets/responses/{response_id}/feedback/",
            {"was_helpful": True, "comment": "", "resolved_ticket": True},
            format="json",
        )

        with patch.object(
            views,
            "_get_authenticated_user",
            return_value=({"_id": user_id, "role": "User"}, None),
        ), patch.object(
            views,
            "submit_feedback",
            side_effect=ValueError("Feedback has already been submitted for this resolution."),
        ):
            response = views.resolution_feedback_view(
                request,
                response_id=str(response_id),
            )

        self.assertEqual(response.status_code, 409)
        self.assertIn("already been submitted", response.data["message"])
