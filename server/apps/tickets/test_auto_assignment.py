from datetime import datetime, timezone
from unittest.mock import patch
from bson import ObjectId
from django.test import SimpleTestCase

from apps.tickets import services


class AutoAssignmentWorkloadTests(SimpleTestCase):
    def test_auto_assigns_to_agent_with_lowest_workload(self):
        """
        Verify that new customer tickets are assigned to the active agent with the lowest workload.
        Example: Agent A (5 active), Agent B (2 active), Agent C (1 active), Agent D (4 active).
        New ticket should be assigned to Agent C.
        """
        agents = [
            {"_id": ObjectId(), "username": "agent_a", "email": "a@example.com", "role": "Agent", "is_active": True},
            {"_id": ObjectId(), "username": "agent_b", "email": "b@example.com", "role": "Agent", "is_active": True},
            {"_id": ObjectId(), "username": "agent_c", "email": "c@example.com", "role": "Agent", "is_active": True},
            {"_id": ObjectId(), "username": "agent_d", "email": "d@example.com", "role": "Agent", "is_active": True},
        ]

        # 5 active for agent_a, 2 for agent_b, 1 for agent_c, 4 for agent_d
        tickets = (
            [{"assignee": "agent_a", "status": "Open", "ticket_id": f"TKT-A-{i}"} for i in range(5)]
            + [{"assignee": "agent_b", "status": "Open", "ticket_id": f"TKT-B-{i}"} for i in range(2)]
            + [{"assignee": "agent_c", "status": "Open", "ticket_id": "TKT-C-0"}]
            + [{"assignee": "agent_d", "status": "In Progress", "ticket_id": f"TKT-D-{i}"} for i in range(4)]
        )

        with patch.object(services.users_collection, "find", return_value=agents), patch.object(
            services.tickets_collection, "find", return_value=tickets
        ), patch.object(services, "assign_ticket", side_effect=lambda tid, uname, actor: {"ticket_id": tid, "assignee": uname}):
            workload = services.get_agents_workload()
            workload_dict = {w["username"]: w["active_tickets_count"] for w in workload}
            self.assertEqual(workload_dict["agent_a"], 5)
            self.assertEqual(workload_dict["agent_b"], 2)
            self.assertEqual(workload_dict["agent_c"], 1)
            self.assertEqual(workload_dict["agent_d"], 4)

            assigned = services.auto_assign_ticket("TKT-NEW-001")
            self.assertIsNotNone(assigned)
            self.assertEqual(assigned["assignee"], "agent_c")

    def test_resolved_and_closed_tickets_excluded_from_workload(self):
        """
        Verify that Resolved and Closed tickets do not count towards active workload.
        """
        agents = [
            {"_id": ObjectId(), "username": "agent_a", "email": "a@example.com", "role": "Agent", "is_active": True},
            {"_id": ObjectId(), "username": "agent_b", "email": "b@example.com", "role": "Agent", "is_active": True},
        ]
        # Agent A has 3 tickets but 2 are Resolved/Closed -> Active workload = 1
        # Agent B has 2 active tickets -> Active workload = 2
        tickets = [
            {"assignee": "agent_a", "status": "Open", "ticket_id": "T1"},
            {"assignee": "agent_a", "status": "Resolved", "ticket_id": "T2"},
            {"assignee": "agent_a", "status": "Closed", "ticket_id": "T3"},
            {"assignee": "agent_b", "status": "Open", "ticket_id": "T4"},
            {"assignee": "agent_b", "status": "In Progress", "ticket_id": "T5"},
        ]

        with patch.object(services.users_collection, "find", return_value=agents), patch.object(
            services.tickets_collection, "find", return_value=tickets
        ), patch.object(services, "assign_ticket", side_effect=lambda tid, uname, actor: {"ticket_id": tid, "assignee": uname}):
            workload = services.get_agents_workload()
            workload_dict = {w["username"]: w["active_tickets_count"] for w in workload}
            self.assertEqual(workload_dict["agent_a"], 1)
            self.assertEqual(workload_dict["agent_b"], 2)

            assigned = services.auto_assign_ticket("TKT-NEW-002")
            self.assertEqual(assigned["assignee"], "agent_a")

    def test_inactive_agents_never_receive_tickets(self):
        """
        Verify that inactive agents (is_active=False) are ignored during auto-assignment.
        """
        agents = [
            {"_id": ObjectId(), "username": "inactive_agent", "email": "i@example.com", "role": "Agent", "is_active": False},
            {"_id": ObjectId(), "username": "active_agent", "email": "act@example.com", "role": "Agent", "is_active": True},
        ]
        tickets = []

        with patch.object(services.users_collection, "find", return_value=agents), patch.object(
            services.tickets_collection, "find", return_value=tickets
        ), patch.object(services, "assign_ticket", side_effect=lambda tid, uname, actor: {"ticket_id": tid, "assignee": uname}):
            assigned = services.auto_assign_ticket("TKT-NEW-003")
            self.assertEqual(assigned["assignee"], "active_agent")

    def test_safe_creation_when_no_active_agents_exist(self):
        """
        Verify that if no active agents are available, auto-assignment safely returns None
        without breaking ticket creation.
        """
        agents = []
        tickets = []

        with patch.object(services.users_collection, "find", return_value=agents), patch.object(
            services.tickets_collection, "find", return_value=tickets
        ):
            assigned = services.auto_assign_ticket("TKT-NEW-004")
            self.assertIsNone(assigned)

    def test_handles_mixed_datetime_and_string_timestamps(self):
        """
        Verify that auto_assign_ticket correctly handles mixed ISO string and datetime object timestamps without raising TypeError.
        """
        agents = [
            {"_id": ObjectId(), "username": "agent_a", "email": "a@example.com", "role": "Agent", "is_active": True},
            {"_id": ObjectId(), "username": "agent_b", "email": "b@example.com", "role": "Agent", "is_active": True},
        ]
        tickets = [
            {"assignee": "agent_a", "status": "Open", "ticket_id": "T1", "created_at": "2026-09-17T10:00:00+00:00"},
            {"assignee": "agent_b", "status": "Open", "ticket_id": "T2", "created_at": datetime.now(timezone.utc)},
        ]

        with patch.object(services.users_collection, "find", return_value=agents), patch.object(
            services.tickets_collection, "find", return_value=tickets
        ), patch.object(services, "assign_ticket", side_effect=lambda tid, uname, actor: {"ticket_id": tid, "assignee": uname}):
            assigned = services.auto_assign_ticket("TKT-NEW-005")
            self.assertIsNotNone(assigned)
