"""
Unit tests for M3 Multi-Agent Orchestrator, Diagnosis Agent, and Knowledge Retrieval Agent.
"""
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory
from unittest.mock import patch, MagicMock
from bson import ObjectId
import json

from apps.agents.orchestrator import (
    start_workflow,
    record_agent_execution,
    get_workflow_by_ticket,
    get_workflow_executions,
    get_activity_logs,
    execute_orchestration_pipeline,
    log_activity,
)
from apps.agents.interfaces import (
    DiagnosisAgent,
    KnowledgeRetrievalAgent,
    DiagnosisAgentStub,
    KnowledgeRetrievalAgentStub,
    ResolutionAgentStub,
    ValidationAgentStub,
    EscalationAgentStub,
)
from apps.agents.diagnosis import (
    DiagnosisAgent,
    _build_diagnosis_prompt,
    _generate_fallback_diagnosis,
)
from apps.agents.knowledge_retrieval import KnowledgeRetrievalAgent
from apps.agents.resolution import ResolutionAgent
from apps.agents.validation import ValidationAgent


class KnowledgeRetrievalAgentTests(SimpleTestCase):
    """
    Focused tests for M3 Knowledge Retrieval Agent.
    Reuses existing M2 retrieval implementation (apps.knowledge_base.ticket_retrieval.retrieve_for_ticket).
    """

    @patch("apps.agents.knowledge_retrieval.retrieve_for_ticket")
    def test_1_retrieval_agent_calls_existing_m2_capability(self, mock_retrieve_for_ticket):
        mock_retrieve_for_ticket.return_value = {
            "ticket_id": "TCK-6001",
            "queries": ["VPN setup guide", "VPN troubleshooting"],
            "results": [
                {
                    "article_id": "KB-101",
                    "chunk_index": 1,
                    "article_title": "VPN Configuration Guide",
                    "heading_path": "Overview > Troubleshooting",
                    "content": "To fix VPN error 800, check firewall port 1723.",
                    "rerank_score": 0.92,
                }
            ],
            "context": "[SOURCE:KB-101#1]\nTitle: VPN Configuration Guide\n---\nTo fix VPN error 800, check firewall port 1723."
        }

        agent = KnowledgeRetrievalAgent()
        input_data = {
            "ticket_id": "TCK-6001",
            "subject": "VPN Error 800",
            "description": "Cannot connect to VPN",
            "category": "Network",
            "subcategory": "VPN",
            "severity": "HIGH",
            "priority": "P1",
            "diagnosis": {"affected_system": "VPN Gateway"}
        }

        output = agent.run(input_data)

        self.assertEqual(output["status"], "SUCCESS")
        self.assertEqual(output["confidence"], 1.0)
        mock_retrieve_for_ticket.assert_called_once()
        call_args = mock_retrieve_for_ticket.call_args[1]
        self.assertEqual(call_args["ticket"]["subject"], "VPN Error 800")
        self.assertEqual(call_args["ticket"]["affected_system"], "VPN Gateway")

    @patch("apps.agents.knowledge_retrieval.retrieve_for_ticket")
    def test_2_m2_results_converted_to_m3_retrieval_result(self, mock_retrieve):
        mock_retrieve.return_value = {
            "ticket_id": "TCK-6002",
            "queries": ["WiFi issue"],
            "results": [
                {
                    "article_id": "KB-202",
                    "chunk_index": 0,
                    "article_title": "Wi-Fi Connectivity SOP",
                    "heading_path": "Setup",
                    "content": "Reset network adapter settings.",
                    "rerank_score": 0.88,
                }
            ],
            "context": "Packed Context String"
        }

        agent = KnowledgeRetrievalAgent()
        output = agent.run({"ticket_id": "TCK-6002", "subject": "Wi-Fi Issue"})

        self.assertEqual(output["status"], "SUCCESS")
        self.assertEqual(len(output["retrieved_evidence"]), 1)
        self.assertEqual(output["packed_context"], "Packed Context String")
        self.assertEqual(output["retrieved_evidence"][0]["article_id"], "KB-202")

    @patch("apps.agents.knowledge_retrieval.retrieve_for_ticket")
    def test_3_source_citation_information_preserved(self, mock_retrieve):
        mock_retrieve.return_value = {
            "ticket_id": "TCK-6003",
            "queries": ["Email sync"],
            "results": [
                {
                    "article_id": "KB-303",
                    "chunk_index": 2,
                    "article_title": "Outlook Exchange Sync",
                    "heading_path": "Sync Fix",
                    "content": "Clear OST cache.",
                    "rerank_score": 0.95,
                }
            ],
            "context": "[SOURCE:KB-303#2]\nTitle: Outlook Exchange Sync"
        }

        agent = KnowledgeRetrievalAgent()
        output = agent.run({"ticket_id": "TCK-6003", "subject": "Email sync issue"})

        self.assertEqual(len(output["sources"]), 1)
        source = output["sources"][0]
        self.assertEqual(source["article_id"], "KB-303")
        self.assertEqual(source["chunk_index"], 2)
        self.assertEqual(source["source_marker"], "[SOURCE:KB-303#2]")

    @patch("apps.agents.knowledge_retrieval.retrieve_for_ticket")
    def test_4_no_relevant_knowledge_handled_safely(self, mock_retrieve):
        mock_retrieve.return_value = {
            "ticket_id": "TCK-6004",
            "queries": ["Unknown alien technology error"],
            "results": [],
            "context": ""
        }

        agent = KnowledgeRetrievalAgent()
        output = agent.run({"ticket_id": "TCK-6004", "subject": "Alien code error"})

        self.assertEqual(output["status"], "NO_EVIDENCE")
        self.assertEqual(output["confidence"], 0.0)
        self.assertEqual(output["retrieved_evidence"], [])
        self.assertEqual(output["packed_context"], "")
        self.assertEqual(output["sources"], [])

    @patch("apps.agents.knowledge_retrieval.retrieve_for_ticket")
    def test_5_m2_failure_handled_safely(self, mock_retrieve):
        # Simulate M2 DB connection or pipeline exception
        mock_retrieve.side_effect = Exception("MongoDB connection timeout")

        agent = KnowledgeRetrievalAgent()
        output = agent.run({"ticket_id": "TCK-6005", "subject": "Test error"})

        self.assertEqual(output["status"], "FAILED")
        self.assertEqual(output["confidence"], 0.0)
        self.assertEqual(output["retrieved_evidence"], [])
        self.assertIn("MongoDB connection timeout", output["error_message"])

    @patch("apps.agents.knowledge_retrieval.retrieve_for_ticket")
    def test_6_m1_fields_remain_unchanged(self, mock_retrieve):
        mock_retrieve.return_value = {"results": [], "context": "", "queries": []}

        agent = KnowledgeRetrievalAgent()
        m1_context = {
            "ticket_id": "TCK-6006",
            "subject": "Printer Offline",
            "description": "Printer on 2nd floor not responding",
            "category": "Hardware",
            "subcategory": "Printer",
            "severity": "LOW",
            "priority": "P3",
        }

        m1_copy = dict(m1_context)
        agent.run(m1_copy)

        self.assertEqual(m1_copy["category"], m1_context["category"])
        self.assertEqual(m1_copy["subcategory"], m1_context["subcategory"])
        self.assertEqual(m1_copy["severity"], m1_context["severity"])
        self.assertEqual(m1_copy["priority"], m1_context["priority"])

    def test_7_no_second_rag_implementation_created(self):
        # Verify KnowledgeRetrievalAgent directly references retrieve_for_ticket from apps.knowledge_base.ticket_retrieval
        from apps.agents.knowledge_retrieval import retrieve_for_ticket
        from apps.knowledge_base.ticket_retrieval import retrieve_for_ticket as m2_retrieve
        self.assertIs(retrieve_for_ticket, m2_retrieve)


class DiagnosisAgentTests(SimpleTestCase):

    @patch("apps.agents.diagnosis._call_llm")
    def test_1_normal_diagnosis(self, mock_llm):
        mock_llm.return_value = json.dumps({
            "problem_understanding": "The user is unable to establish a VPN connection to the corporate network.",
            "affected_system": "Corporate VPN Gateway",
            "likely_causes": ["Expired VPN certificate", "Incorrect user authentication credentials"],
            "missing_information": ["VPN client log file"],
            "confidence": 0.88
        })

        agent = DiagnosisAgent()
        input_data = {
            "ticket_id": "TCK-5001",
            "subject": "VPN connection failing",
            "description": "Getting error 800 when attempting to connect to corporate VPN.",
            "category": "Network",
            "subcategory": "VPN Access",
            "severity": "HIGH",
            "priority": "P1",
        }

        output = agent.run(input_data)

        self.assertEqual(output["status"], "SUCCESS")
        self.assertEqual(output["confidence"], 0.88)
        diag = output["diagnosis"]
        self.assertEqual(diag["affected_system"], "Corporate VPN Gateway")
        self.assertEqual(len(diag["likely_causes"]), 2)

    @patch("apps.agents.diagnosis._call_llm")
    def test_2_diagnosis_receives_m1_context(self, mock_llm):
        mock_llm.return_value = json.dumps({
            "problem_understanding": "DB connection failure",
            "affected_system": "Database Cluster",
            "likely_causes": ["Network split"],
            "missing_information": [],
            "confidence": 0.90
        })

        agent = DiagnosisAgent()
        input_data = {
            "ticket_id": "TCK-5002",
            "subject": "Database timeout",
            "description": "Production DB timing out on queries",
            "category": "Database",
            "subcategory": "PostgreSQL",
            "severity": "CRITICAL",
            "priority": "P1",
        }

        agent.run(input_data)
        called_prompt = mock_llm.call_args[0][0]
        self.assertIn("Category: Database", called_prompt)
        self.assertIn("Sub-category: PostgreSQL", called_prompt)
        self.assertIn("Severity: CRITICAL", called_prompt)
        self.assertIn("Priority: P1", called_prompt)

    def test_3_missing_insufficient_ticket_information(self):
        agent = DiagnosisAgent()
        input_data = {
            "ticket_id": "TCK-5003",
            "subject": "",
            "description": "",
            "category": "General",
            "subcategory": "",
            "severity": "LOW",
            "priority": "P4",
        }

        output = agent.run(input_data)

        self.assertEqual(output["status"], "DEGRADED")
        self.assertEqual(output["confidence"], 0.20)

    @patch("apps.agents.diagnosis._call_llm")
    def test_4_ai_service_failure_handling(self, mock_llm):
        mock_llm.return_value = None

        agent = DiagnosisAgent()
        input_data = {
            "ticket_id": "TCK-5004",
            "subject": "Outlook crashes on startup",
            "description": "Microsoft Outlook crashes immediately when opened.",
            "category": "Software",
            "subcategory": "Email",
            "severity": "MEDIUM",
            "priority": "P2",
        }

        output = agent.run(input_data)

        self.assertEqual(output["status"], "DEGRADED")
        self.assertEqual(output["confidence"], 0.50)

    @patch("apps.agents.diagnosis._call_llm")
    def test_5_structured_diagnosis_output_schema(self, mock_llm):
        mock_llm.return_value = json.dumps({
            "problem_understanding": "Software installation error",
            "affected_system": "Endpoint PC",
            "likely_causes": ["Insufficient privileges"],
            "missing_information": ["Admin password"],
            "confidence": 0.80
        })

        agent = DiagnosisAgent()
        output = agent.run({"ticket_id": "TCK-5005", "subject": "App install failed", "description": "Installer fails"})

        self.assertIn("diagnosis", output)
        diag = output["diagnosis"]
        for key in ["problem_understanding", "affected_system", "likely_causes", "missing_information", "confidence"]:
            self.assertIn(key, diag)

    @patch("apps.agents.diagnosis._call_llm")
    def test_6_m1_fields_remain_unchanged(self, mock_llm):
        mock_llm.return_value = json.dumps({"problem_understanding": "OK", "confidence": 0.8})

        agent = DiagnosisAgent()
        m1_context = {"ticket_id": "TCK-5006", "subject": "Wi-Fi unstable", "description": "Wi-Fi drops", "category": "Network", "subcategory": "Wireless", "severity": "HIGH", "priority": "P2"}
        m1_copy = dict(m1_context)
        agent.run(m1_copy)
        self.assertEqual(m1_copy["category"], m1_context["category"])

    @patch("apps.agents.diagnosis._call_llm")
    def test_7_nullable_none_fields_handling(self, mock_llm):
        mock_llm.return_value = json.dumps({
            "problem_understanding": "VPN connection failing",
            "affected_system": "Network",
            "likely_causes": ["Gateway issue"],
            "missing_information": [],
            "confidence": 0.85
        })

        agent = DiagnosisAgent()
        input_data = {
            "ticket_id": "IT-2026-5F71FF",
            "subject": "VPN connection failing",
            "description": "I cannot connect to the company VPN.",
            "category": "Network",
            "subcategory": None,
            "severity": None,
            "priority": None,
        }

        output = agent.run(input_data)
        self.assertEqual(output["status"], "SUCCESS")
        self.assertEqual(output["confidence"], 0.85)


class MultiAgentOrchestratorTests(SimpleTestCase):

    @patch("apps.agents.orchestrator.agent_workflows_collection")
    @patch("apps.agents.orchestrator.activity_logs_collection")
    def test_start_workflow(self, mock_activity_logs, mock_workflows):
        mock_workflows.insert_one.return_value = MagicMock()
        mock_activity_logs.insert_one.return_value = MagicMock()

        ticket_id = "TCK-1001"
        ticket_data = {"ticket_id": ticket_id, "subject": "Test Ticket"}
        workflow = start_workflow(ticket_id=ticket_id, ticket_data=ticket_data)

        self.assertEqual(workflow["ticket_id"], ticket_id)
        self.assertEqual(workflow["workflow_status"], "IN_PROGRESS")
        self.assertEqual(workflow["current_agent"], "DiagnosisAgent")

    @patch("apps.agents.orchestrator.tickets_collection")
    def test_start_workflow_nonexistent_ticket_raises_error(self, mock_tickets):
        mock_tickets.find_one.return_value = None
        with self.assertRaises(ValueError):
            start_workflow(ticket_id="NON-EXISTENT")

    @patch("apps.agents.orchestrator.agent_executions_collection")
    @patch("apps.agents.orchestrator.agent_workflows_collection")
    def test_record_agent_execution(self, mock_workflows, mock_executions):
        mock_executions.insert_one.return_value = MagicMock()
        mock_workflows.update_one.return_value = MagicMock()

        workflow_id = "wf_12345678"
        execution = record_agent_execution(
            workflow_id=workflow_id,
            agent_name="DiagnosisAgent",
            input_data={"problem": "VPN connection failing"},
            output_data={"cause": "Authentication failure"},
            status="SUCCESS",
            confidence=0.85
        )

        self.assertEqual(execution["workflow_id"], workflow_id)

    @patch("apps.agents.orchestrator.agent_workflows_collection")
    def test_get_workflow_by_ticket(self, mock_workflows):
        mock_workflows.find_one.return_value = {
            "_id": "dummy",
            "workflow_id": "wf_999",
            "ticket_id": "TCK-1001",
            "workflow_status": "COMPLETED"
        }

        workflow = get_workflow_by_ticket("TCK-1001")
        self.assertIsNotNone(workflow)


class MultiAgentPipelineTests(SimpleTestCase):

    @patch("apps.agents.resolution._call_llm")
    @patch("apps.agents.knowledge_retrieval.retrieve_for_ticket")
    @patch("apps.agents.diagnosis._call_llm")
    @patch("apps.agents.orchestrator.tickets_collection")
    @patch("apps.agents.orchestrator.agent_workflows_collection")
    @patch("apps.agents.orchestrator.agent_executions_collection")
    @patch("apps.agents.orchestrator.activity_logs_collection")
    def test_pipeline_auto_resolution_success(
        self, mock_activity_logs, mock_executions, mock_workflows, mock_tickets, mock_diag_llm, mock_retrieve, mock_res_llm
    ):
        mock_diag_llm.return_value = json.dumps({
            "problem_understanding": "VPN disconnects",
            "affected_system": "VPN Gateway",
            "likely_causes": ["Timeout setting"],
            "missing_information": [],
            "confidence": 0.85
        })

        mock_res_llm.return_value = json.dumps({
            "summary": "Adjust VPN keepalive setting",
            "troubleshooting_steps": ["1. Change keepalive [SOURCE:KB-1#0]"],
            "missing_information": [],
            "limitations": [],
            "confidence": 0.85
        })

        mock_retrieve.return_value = {
            "ticket_id": "TCK-2002",
            "queries": ["VPN issue"],
            "results": [{"article_id": "KB-1", "chunk_index": 0, "article_title": "VPN Guide", "content": "Fix timeout"}],
            "context": "[SOURCE:KB-1#0] Title: VPN Guide\nFix timeout"
        }

        mock_ticket = {
            "ticket_id": "TCK-2002",
            "subject": "VPN Disconnecting",
            "description": "VPN drops every 5 mins",
            "category": "Network",
            "severity": "HIGH",
            "priority": "P1",
        }
        mock_tickets.find_one.return_value = mock_ticket

        saved_workflow = {}

        def mock_insert_wf(doc):
            saved_workflow.update(doc)

        mock_workflows.insert_one.side_effect = mock_insert_wf
        mock_workflows.find_one.side_effect = lambda query, **kwargs: saved_workflow if query.get("workflow_id") == saved_workflow.get("workflow_id") else None

        def mock_update_wf(filter_dict, update_dict):
            if "$set" in update_dict:
                saved_workflow.update(update_dict["$set"])

        mock_workflows.update_one.side_effect = mock_update_wf

        result = execute_orchestration_pipeline(
            ticket_id="TCK-2002",
            ticket_data=mock_ticket,
            confidence_threshold=0.70
        )

        self.assertIsNotNone(result)
        self.assertEqual(result["workflow_status"], "COMPLETED")
        self.assertTrue(result.get("auto_resolve_eligible"))
        self.assertFalse(result.get("requires_escalation"))
        self.assertEqual(len(result["retrieved_evidence"]), 1)
        self.assertEqual(result["retrieved_evidence"][0]["article_id"], "KB-1")

    @patch("apps.agents.resolution._call_llm")
    @patch("apps.agents.knowledge_retrieval.retrieve_for_ticket")
    @patch("apps.agents.diagnosis._call_llm")
    @patch("apps.agents.orchestrator.tickets_collection")
    @patch("apps.agents.orchestrator.agent_workflows_collection")
    @patch("apps.agents.orchestrator.agent_executions_collection")
    @patch("apps.agents.orchestrator.activity_logs_collection")
    def test_pipeline_failed_validation_requires_escalation_without_invoking_escalation_agent(
        self, mock_activity_logs, mock_executions, mock_workflows, mock_tickets, mock_diag_llm, mock_retrieve, mock_res_llm
    ):
        mock_diag_llm.return_value = json.dumps({"problem_understanding": "Unknown", "confidence": 0.50})
        # Empty evidence -> NO_EVIDENCE resolution status
        mock_res_llm.return_value = None
        mock_retrieve.return_value = {"ticket_id": "TCK-2003", "queries": [], "results": [], "context": ""}

        mock_ticket = {"ticket_id": "TCK-2003", "subject": "No evidence ticket"}
        mock_tickets.find_one.return_value = mock_ticket

        saved_workflow = {}
        mock_workflows.insert_one.side_effect = lambda doc: saved_workflow.update(doc)
        mock_workflows.find_one.side_effect = lambda query, **kwargs: saved_workflow if query.get("workflow_id") == saved_workflow.get("workflow_id") else None
        mock_workflows.update_one.side_effect = lambda filter_dict, update_dict: saved_workflow.update(update_dict["$set"]) if "$set" in update_dict else None

        result = execute_orchestration_pipeline(
            ticket_id="TCK-2003",
            ticket_data=mock_ticket,
            confidence_threshold=0.70
        )

        self.assertIsNotNone(result)
        self.assertEqual(result["workflow_status"], "ESCALATED")
        self.assertFalse(result.get("auto_resolve_eligible"))
        self.assertTrue(result.get("requires_escalation"))
        self.assertIsNotNone(result.get("validation"))
        self.assertFalse(result["validation"]["is_valid"])
        self.assertTrue(len(result["validation"]["reasons"]) > 0)

        # Verify EscalationAgent WAS executed
        executed_agent_names = [call[0][0]["agent_name"] for call in mock_executions.insert_one.call_args_list]
        self.assertIn("EscalationAgent", executed_agent_names)




class ResolutionAgentTests(SimpleTestCase):
    """
    Focused unit tests for M3 Resolution Generation Agent.
    """

    @patch("apps.agents.resolution._call_llm")
    def test_1_resolution_receives_diagnosis_output(self, mock_llm):
        mock_llm.return_value = json.dumps({
            "summary": "Fix VPN timeout configuration",
            "troubleshooting_steps": ["1. Change timeout to 300s [SOURCE:KB-101#1]"],
            "missing_information": [],
            "limitations": [],
            "confidence": 0.85
        })

        agent = ResolutionAgent()
        input_data = {
            "ticket_id": "TCK-7001",
            "subject": "VPN Timeout",
            "description": "VPN disconnects after 60s",
            "category": "Network",
            "subcategory": "VPN",
            "diagnosis": {
                "problem_understanding": "Client connection keep-alive timeout",
                "affected_system": "VPN Gateway",
                "likely_causes": ["Misconfigured timeout"]
            },
            "retrieved_evidence": [
                {
                    "article_id": "KB-101",
                    "chunk_index": 1,
                    "title": "VPN Guide",
                    "source_marker": "[SOURCE:KB-101#1]"
                }
            ],
            "packed_context": "[SOURCE:KB-101#1]\nTitle: VPN Guide\nChange timeout to 300s",
            "sources": [{"article_id": "KB-101", "chunk_index": 1, "title": "VPN Guide", "source_marker": "[SOURCE:KB-101#1]"}]
        }

        output = agent.run(input_data)
        self.assertEqual(output["status"], "SUCCESS")
        called_prompt = mock_llm.call_args[0][0]
        self.assertIn("Problem: Client connection keep-alive timeout", called_prompt)
        self.assertIn("Affected System: VPN Gateway", called_prompt)

    @patch("apps.agents.resolution._call_llm")
    def test_2_resolution_receives_m2_retrieval_evidence(self, mock_llm):
        mock_llm.return_value = json.dumps({
            "summary": "Reset network adapter",
            "troubleshooting_steps": ["1. Run netsh winsock reset [SOURCE:KB-202#0]"],
            "missing_information": [],
            "limitations": [],
            "confidence": 0.90
        })

        agent = ResolutionAgent()
        input_data = {
            "ticket_id": "TCK-7002",
            "subject": "Wi-Fi connection error",
            "diagnosis": {"affected_system": "Wi-Fi Card"},
            "retrieved_evidence": [{"article_id": "KB-202", "chunk_index": 0}],
            "packed_context": "[SOURCE:KB-202#0]\nTitle: Wi-Fi Fix\nRun netsh winsock reset",
            "sources": [{"article_id": "KB-202", "chunk_index": 0, "title": "Wi-Fi Fix", "source_marker": "[SOURCE:KB-202#0]"}]
        }

        output = agent.run(input_data)
        called_prompt = mock_llm.call_args[0][0]
        self.assertIn("Run netsh winsock reset", called_prompt)
        self.assertIn("[SOURCE:KB-202#0]", called_prompt)

    @patch("apps.agents.resolution._call_llm")
    def test_3_resolution_is_grounded_in_supplied_evidence(self, mock_llm):
        mock_llm.return_value = json.dumps({
            "summary": "Follow Exchange sync repair guide",
            "troubleshooting_steps": ["1. Clear OST cache [SOURCE:KB-303#2]"],
            "missing_information": [],
            "limitations": [],
            "confidence": 0.88
        })

        agent = ResolutionAgent()
        input_data = {
            "ticket_id": "TCK-7003",
            "subject": "Outlook sync error",
            "diagnosis": {"affected_system": "Outlook Client"},
            "retrieved_evidence": [{"article_id": "KB-303", "chunk_index": 2}],
            "packed_context": "[SOURCE:KB-303#2]\nTitle: Exchange Sync\nClear OST cache",
            "sources": [{"article_id": "KB-303", "chunk_index": 2, "title": "Exchange Sync", "source_marker": "[SOURCE:KB-303#2]"}]
        }

        output = agent.run(input_data)
        res = output["resolution"]
        self.assertIn("[SOURCE:KB-303#2]", res["troubleshooting_steps"][0])

    @patch("apps.agents.resolution._call_llm")
    def test_4_m2_evidence_source_information_preserved(self, mock_llm):
        mock_llm.return_value = json.dumps({
            "summary": "Resolution text",
            "troubleshooting_steps": ["Step 1"],
            "missing_information": [],
            "limitations": [],
            "confidence": 0.80
        })

        agent = ResolutionAgent()
        sources_input = [{"article_id": "KB-404", "chunk_index": 1, "title": "Password Reset Guide", "source_marker": "[SOURCE:KB-404#1]"}]
        input_data = {
            "ticket_id": "TCK-7004",
            "subject": "Password reset",
            "diagnosis": {},
            "retrieved_evidence": [{"article_id": "KB-404", "chunk_index": 1}],
            "packed_context": "Context text",
            "sources": sources_input
        }

        output = agent.run(input_data)
        self.assertEqual(output["resolution"]["sources"], sources_input)

    def test_5_no_useful_evidence_produces_safe_low_confidence_result(self):
        agent = ResolutionAgent()
        input_data = {
            "ticket_id": "TCK-7005",
            "subject": "Unknown error code XYZ999",
            "diagnosis": {"affected_system": "Unknown"},
            "retrieved_evidence": [],
            "packed_context": "",
            "sources": []
        }

        output = agent.run(input_data)
        self.assertEqual(output["status"], "NO_EVIDENCE")
        self.assertEqual(output["confidence"], 0.0)
        self.assertEqual(output["resolution"]["troubleshooting_steps"], [])
        self.assertIn("Insufficient knowledge-base context", output["resolution"]["summary"])

    @patch("apps.agents.resolution._call_llm")
    def test_6_llm_failure_handled_safely(self, mock_llm):
        mock_llm.return_value = None  # Simulate LLM timeout/error

        agent = ResolutionAgent()
        input_data = {
            "ticket_id": "TCK-7006",
            "subject": "Printer issue",
            "diagnosis": {},
            "retrieved_evidence": [{"article_id": "KB-505", "chunk_index": 0}],
            "packed_context": "[SOURCE:KB-505#0]\nPrinter Guide",
            "sources": [{"article_id": "KB-505", "chunk_index": 0, "title": "Printer Guide", "source_marker": "[SOURCE:KB-505#0]"}]
        }

        output = agent.run(input_data)
        self.assertEqual(output["status"], "DEGRADED")
        self.assertEqual(output["confidence"], 0.40)
        self.assertIn("Printer Guide [SOURCE:KB-505#0]", output["resolution"]["troubleshooting_steps"][0])

    @patch("apps.agents.resolution._call_llm")
    def test_7_m1_fields_remain_unchanged(self, mock_llm):
        mock_llm.return_value = json.dumps({"summary": "OK", "troubleshooting_steps": [], "confidence": 0.8})

        agent = ResolutionAgent()
        m1_context = {
            "ticket_id": "TCK-7007",
            "subject": "Hardware issue",
            "category": "Hardware",
            "subcategory": "Laptop",
            "severity": "MEDIUM",
            "priority": "P3",
            "retrieved_evidence": [{"article_id": "KB-1"}],
            "packed_context": "Context"
        }
        m1_copy = dict(m1_context)
        agent.run(m1_copy)
        self.assertEqual(m1_copy["category"], m1_context["category"])
        self.assertEqual(m1_copy["subcategory"], m1_context["subcategory"])
        self.assertEqual(m1_copy["severity"], m1_context["severity"])
        self.assertEqual(m1_copy["priority"], m1_context["priority"])

    def test_8_no_second_rag_implementation_created(self):
        import inspect
        from apps.agents import resolution
        source = inspect.getsource(resolution)
        self.assertNotIn("apps.knowledge_base.vectorstore", source)
        self.assertNotIn("apps.knowledge_base.chunking", source)
        self.assertNotIn("apps.knowledge_base.embeddings", source)
        self.assertNotIn("apps.knowledge_base.retrieval", source)

    @patch("apps.agents.resolution._call_llm")
    def test_9_structured_output_matches_orchestrator_interface(self, mock_llm):
        mock_llm.return_value = json.dumps({
            "summary": "Valid summary",
            "troubleshooting_steps": ["Step 1"],
            "missing_information": ["Info 1"],
            "limitations": ["Limit 1"],
            "confidence": 0.82
        })

        agent = ResolutionAgent()
        output = agent.run({
            "ticket_id": "TCK-7009",
            "subject": "Test interface",
            "retrieved_evidence": [{"article_id": "KB-1"}],
            "packed_context": "Context"
        })

        self.assertIn("status", output)
        self.assertIn("confidence", output)
        self.assertIn("resolution", output)
        res = output["resolution"]
        for key in ["summary", "troubleshooting_steps", "sources", "missing_information", "limitations", "confidence"]:
            self.assertIn(key, res)


class ValidationAgentTests(SimpleTestCase):
    """
    Focused unit tests for M3 Validation Agent / Confidence Gate.
    """

    def test_1_valid_grounded_resolution_passes_validation(self):
        agent = ValidationAgent()
        input_data = {
            "confidence_threshold": 0.70,
            "diagnosis": {"confidence": 0.85},
            "retrieved_evidence": [{"article_id": "KB-101", "chunk_index": 1, "source_marker": "[SOURCE:KB-101#1]"}],
            "resolution": {
                "status": "SUCCESS",
                "confidence": 0.85,
                "resolution": {
                    "summary": "Clear browser cache",
                    "troubleshooting_steps": ["1. Open settings [SOURCE:KB-101#1]"],
                    "sources": [{"article_id": "KB-101", "chunk_index": 1, "source_marker": "[SOURCE:KB-101#1]"}],
                    "missing_information": [],
                    "limitations": [],
                }
            }
        }

        output = agent.run(input_data)
        self.assertEqual(output["status"], "SUCCESS")
        val = output["validation"]
        self.assertTrue(val["is_valid"])
        self.assertTrue(val["auto_resolve_eligible"])
        self.assertGreaterEqual(val["confidence_score"], 0.70)

    def test_2_missing_resolution_is_rejected(self):
        agent = ValidationAgent()
        input_data = {
            "confidence_threshold": 0.70,
            "resolution": {
                "status": "SUCCESS",
                "resolution": {"summary": "", "troubleshooting_steps": []}
            }
        }

        output = agent.run(input_data)
        val = output["validation"]
        self.assertFalse(val["is_valid"])
        self.assertFalse(val["auto_resolve_eligible"])

    def test_3_no_evidence_resolution_is_rejected(self):
        agent = ValidationAgent()
        input_data = {
            "confidence_threshold": 0.70,
            "resolution": {
                "status": "NO_EVIDENCE",
                "confidence": 0.0,
                "resolution": {"summary": "No KB evidence found", "troubleshooting_steps": []}
            }
        }

        output = agent.run(input_data)
        val = output["validation"]
        self.assertFalse(val["is_valid"])
        self.assertFalse(val["auto_resolve_eligible"])

    def test_4_degraded_failed_resolution_is_rejected(self):
        agent = ValidationAgent()
        for bad_status in ["DEGRADED", "FAILED"]:
            input_data = {
                "confidence_threshold": 0.70,
                "resolution": {
                    "status": bad_status,
                    "confidence": 0.40,
                    "resolution": {"summary": "Degraded text", "troubleshooting_steps": ["Step 1"]}
                }
            }
            output = agent.run(input_data)
            val = output["validation"]
            self.assertFalse(val["is_valid"], f"Status {bad_status} should be rejected")

    def test_5_missing_source_citation_information_handled_correctly(self):
        agent = ValidationAgent()
        input_data = {
            "confidence_threshold": 0.70,
            "resolution": {
                "status": "SUCCESS",
                "confidence": 0.80,
                "resolution": {
                    "summary": "Generic step without citation",
                    "troubleshooting_steps": ["1. Restart PC"],
                    "sources": [],
                    "missing_information": [],
                    "limitations": []
                }
            }
        }

        output = agent.run(input_data)
        val = output["validation"]
        self.assertIn("no source citations", " ".join(val["reasons"]))

    def test_6_unsupported_unsubstantiated_resolution_is_rejected(self):
        agent = ValidationAgent()
        input_data = {
            "confidence_threshold": 0.70,
            "retrieved_evidence": [{"source_marker": "[SOURCE:KB-101#1]"}],
            "resolution": {
                "status": "SUCCESS",
                "confidence": 0.80,
                "resolution": {
                    "summary": "Resolution citing fake marker",
                    "troubleshooting_steps": ["1. Step with invalid marker [SOURCE:KB-999#9]"],
                    "sources": [],
                }
            }
        }

        output = agent.run(input_data)
        val = output["validation"]
        self.assertEqual(val["groundedness_ratio"], 0.0)

    def test_7_low_invalid_confidence_handled_correctly(self):
        agent = ValidationAgent()
        input_data = {
            "confidence_threshold": 0.95,  # High threshold
            "diagnosis": {"confidence": 0.50},
            "resolution": {
                "status": "SUCCESS",
                "confidence": 0.50,
                "resolution": {
                    "summary": "Low confidence resolution",
                    "troubleshooting_steps": ["1. Step [SOURCE:KB-1#0]"],
                    "sources": [{"source_marker": "[SOURCE:KB-1#0]"}]
                }
            }
        }

        output = agent.run(input_data)
        val = output["validation"]
        self.assertFalse(val["is_valid"])
        self.assertLess(val["confidence_score"], 0.95)

    def test_8_missing_information_limitations_prevent_auto_resolution(self):
        agent = ValidationAgent()
        input_data = {
            "confidence_threshold": 0.70,
            "resolution": {
                "status": "SUCCESS",
                "confidence": 0.85,
                "resolution": {
                    "summary": "Missing KB article resolution",
                    "troubleshooting_steps": ["1. Contact admin"],
                    "sources": [{"source_marker": "[SOURCE:KB-1#0]"}],
                    "missing_information": ["Approved Knowledge Base Article"],
                    "limitations": []
                }
            }
        }

        output = agent.run(input_data)
        val = output["validation"]
        self.assertFalse(val["is_valid"])
        self.assertIn("Approved Knowledge Base Article", val["blocking_limitations"])

    def test_9_m1_fields_remain_unchanged(self):
        agent = ValidationAgent()
        m1_context = {
            "category": "Hardware",
            "subcategory": "Printer",
            "severity": "LOW",
            "priority": "P4",
            "resolution": {"status": "SUCCESS", "resolution": {"summary": "S", "troubleshooting_steps": ["T"]}}
        }
        m1_copy = dict(m1_context)
        agent.run(m1_copy)
        self.assertEqual(m1_copy["category"], m1_context["category"])
        self.assertEqual(m1_copy["severity"], m1_context["severity"])

    def test_10_no_second_rag_implementation_exists(self):
        import inspect
        from apps.agents import validation
        source = inspect.getsource(validation)
        self.assertNotIn("apps.knowledge_base.vectorstore", source)
        self.assertNotIn("apps.knowledge_base.chunking", source)
        self.assertNotIn("apps.knowledge_base.embeddings", source)
        self.assertNotIn("apps.knowledge_base.retrieval", source)

    def test_11_structured_validation_output_matches_orchestrator_interface(self):
        agent = ValidationAgent()
        output = agent.run({
            "resolution": {
                "status": "SUCCESS",
                "confidence": 0.85,
                "resolution": {
                    "summary": "Summary",
                    "troubleshooting_steps": ["1. Step [SOURCE:KB-1#0]"],
                    "sources": [{"source_marker": "[SOURCE:KB-1#0]"}]
                }
            }
        })

        self.assertIn("status", output)
        self.assertIn("confidence", output)
        self.assertIn("validation", output)
        val = output["validation"]
        for key in ["is_valid", "auto_resolve_eligible", "confidence_score", "groundedness_ratio", "reasons", "citation_check_passed", "blocking_limitations"]:
            self.assertIn(key, val)


from apps.agents.escalation import EscalationAgent


class EscalationAgentTests(SimpleTestCase):
    """
    Focused unit tests for M3 Escalation Agent.
    """

    def test_1_validation_failure_reasons_consumed(self):
        agent = EscalationAgent()
        input_data = {
            "ticket": {"ticket_id": "TCK-7001", "subject": "VPN Failure", "severity": "HIGH", "priority": "P2"},
            "validation": {
                "is_valid": False,
                "reasons": ["Resolution steps contain no source citations or verified evidence references."]
            }
        }
        output = agent.run(input_data)
        self.assertEqual(output["status"], "SUCCESS")
        self.assertEqual(output["confidence"], 1.0)
        esc = output["escalation"]
        self.assertTrue(esc["escalation_required"])
        self.assertEqual(esc["reason"], "Resolution steps contain no source citations or verified evidence references.")
        self.assertIn("Resolution steps contain no source citations or verified evidence references.", esc["validation_failure_reasons"])

    def test_2_preserves_m1_severity_and_priority(self):
        agent = EscalationAgent()
        ticket_data = {
            "ticket_id": "TCK-7002",
            "subject": "Database connection drop",
            "category": "Database",
            "subcategory": "PostgreSQL",
            "severity": "CRITICAL",
            "priority": "P1"
        }
        ticket_copy = dict(ticket_data)
        output = agent.run({"ticket": ticket_copy, "validation": {"reasons": ["High severity ticket"]}})
        esc = output["escalation"]
        self.assertEqual(esc["severity_context"], "CRITICAL")
        self.assertEqual(esc["priority_context"], "P1")
        self.assertEqual(ticket_copy["severity"], ticket_data["severity"])

    def test_3_no_invented_support_tier_or_assignment_produced(self):
        agent = EscalationAgent()
        output = agent.run({
            "ticket": {"ticket_id": "TCK-7003", "severity": "CRITICAL", "priority": "P1"},
            "validation": {"reasons": ["Critical system error"]}
        })
        esc = output["escalation"]
        self.assertNotIn("target_tier", esc)
        self.assertNotIn("assigned_team", esc)
        self.assertNotIn("assigned_user_id", esc)
        self.assertNotIn("assigned_agent_id", esc)
        self.assertEqual(esc["recommended_action"], "Escalate for manual support team review and troubleshooting.")

    def test_4_no_hardcoded_user_or_agent_assignment(self):
        agent = EscalationAgent()
        output = agent.run({"ticket": {"ticket_id": "TCK-7004"}})
        esc = output["escalation"]
        self.assertNotIn("assigned_user_id", esc)
        self.assertNotIn("assigned_agent_id", esc)

    def test_5_structured_escalation_output_matches_orchestrator_interface(self):
        agent = EscalationAgent()
        output = agent.run({
            "ticket": {"ticket_id": "TCK-7005", "subject": "S", "category": "C"},
            "validation": {"reasons": ["Reason 1"]}
        })
        self.assertIn("status", output)
        self.assertIn("confidence", output)
        self.assertIn("escalation", output)
        esc = output["escalation"]
        for key in ["escalation_required", "reason", "priority_context", "severity_context", "ticket_info", "validation_failure_reasons", "recommended_action"]:
            self.assertIn(key, esc)
        self.assertNotIn("target_tier", esc)


    def test_7_no_second_rag_implementation_exists(self):
        import inspect
        from apps.agents import escalation
        source = inspect.getsource(escalation)
        self.assertNotIn("apps.knowledge_base.vectorstore", source)
        self.assertNotIn("apps.knowledge_base.chunking", source)
        self.assertNotIn("apps.knowledge_base.embeddings", source)
        self.assertNotIn("apps.knowledge_base.retrieval", source)

    @patch("apps.agents.orchestrator.send_escalation_email")
    @patch("apps.agents.orchestrator.create_jira_issue")
    @patch("apps.agents.resolution._call_llm")
    @patch("apps.agents.knowledge_retrieval.retrieve_for_ticket")
    @patch("apps.agents.diagnosis._call_llm")
    @patch("apps.agents.orchestrator.tickets_collection")
    @patch("apps.agents.orchestrator.agent_workflows_collection")
    @patch("apps.agents.orchestrator.agent_executions_collection")
    @patch("apps.agents.orchestrator.activity_logs_collection")
    def test_8_validation_failure_triggers_real_escalation_agent(
        self, mock_activity_logs, mock_executions, mock_workflows, mock_tickets, mock_diag_llm, mock_retrieve, mock_res_llm, mock_jira, mock_email
    ):
        mock_jira.return_value = {"status": "SUCCESS", "created": True, "jira_issue_key": "IT-808", "jira_issue_url": "http://jira/IT-808"}
        mock_email.return_value = {"status": "SUCCESS", "sent": True, "recipient": "test@test.com"}
        mock_diag_llm.return_value = json.dumps({"problem_understanding": "Unknown", "confidence": 0.50})
        mock_res_llm.return_value = None
        mock_retrieve.return_value = {"ticket_id": "TCK-7008", "queries": [], "results": [], "context": ""}
        mock_ticket = {"ticket_id": "TCK-7008", "subject": "Failed ticket", "severity": "HIGH", "priority": "P2"}
        mock_tickets.find_one.return_value = mock_ticket

        saved_workflow = {}
        mock_workflows.insert_one.side_effect = lambda doc: saved_workflow.update(doc)
        mock_workflows.find_one.side_effect = lambda query, **kwargs: saved_workflow if query.get("workflow_id") == saved_workflow.get("workflow_id") else None
        mock_workflows.update_one.side_effect = lambda filter_dict, update_dict: saved_workflow.update(update_dict["$set"]) if "$set" in update_dict else None

        result = execute_orchestration_pipeline(
            ticket_id="TCK-7008",
            ticket_data=mock_ticket,
            confidence_threshold=0.70
        )

        self.assertEqual(result["workflow_status"], "ESCALATED")
        self.assertTrue(result["requires_escalation"])
        self.assertIsNotNone(result.get("escalation"))
        self.assertIsNotNone(result.get("jira_result"))
        self.assertIsNotNone(result.get("email_result"))
        mock_jira.assert_called_once()
        mock_email.assert_called_once()
        executed_agent_names = [call[0][0]["agent_name"] for call in mock_executions.insert_one.call_args_list]
        self.assertIn("EscalationAgent", executed_agent_names)

    @patch("apps.agents.orchestrator.send_escalation_email")
    @patch("apps.agents.orchestrator.create_jira_issue")
    @patch("apps.agents.resolution._call_llm")
    @patch("apps.agents.knowledge_retrieval.retrieve_for_ticket")
    @patch("apps.agents.diagnosis._call_llm")
    @patch("apps.agents.orchestrator.tickets_collection")
    @patch("apps.agents.orchestrator.agent_workflows_collection")
    @patch("apps.agents.orchestrator.agent_executions_collection")
    @patch("apps.agents.orchestrator.activity_logs_collection")
    def test_9_validation_success_does_not_trigger_escalation_agent(
        self, mock_activity_logs, mock_executions, mock_workflows, mock_tickets, mock_diag_llm, mock_retrieve, mock_res_llm, mock_jira, mock_email
    ):
        mock_diag_llm.return_value = json.dumps({"problem_understanding": "VPN disconnects", "confidence": 0.85})
        mock_res_llm.return_value = json.dumps({
            "summary": "Fix VPN keepalive",
            "troubleshooting_steps": ["1. Change keepalive [SOURCE:KB-1#0]"],
            "confidence": 0.85
        })
        mock_retrieve.return_value = {
            "ticket_id": "TCK-7009",
            "results": [{"article_id": "KB-1", "chunk_index": 0, "article_title": "VPN Guide"}]
        }
        mock_ticket = {"ticket_id": "TCK-7009", "subject": "VPN Disconnecting"}
        mock_tickets.find_one.return_value = mock_ticket

        saved_workflow = {}
        mock_workflows.insert_one.side_effect = lambda doc: saved_workflow.update(doc)
        mock_workflows.find_one.side_effect = lambda query, **kwargs: saved_workflow if query.get("workflow_id") == saved_workflow.get("workflow_id") else None
        mock_workflows.update_one.side_effect = lambda filter_dict, update_dict: saved_workflow.update(update_dict["$set"]) if "$set" in update_dict else None

        result = execute_orchestration_pipeline(
            ticket_id="TCK-7009",
            ticket_data=mock_ticket,
            confidence_threshold=0.70
        )

        self.assertEqual(result["workflow_status"], "COMPLETED")
        self.assertTrue(result["auto_resolve_eligible"])
        mock_jira.assert_not_called()
        mock_email.assert_not_called()
        executed_agent_names = [call[0][0]["agent_name"] for call in mock_executions.insert_one.call_args_list]
        self.assertNotIn("EscalationAgent", executed_agent_names)

    def test_10_handles_none_and_empty_inputs_safely(self):
        agent = EscalationAgent()
        output = agent.run({
            "ticket": {"ticket_id": "TCK-7010", "subcategory": None, "severity": None, "priority": None},
            "validation": {"reasons": None}
        })
        self.assertEqual(output["status"], "SUCCESS")
        self.assertTrue(output["escalation"]["escalation_required"])


class JiraServiceTests(SimpleTestCase):
    def test_unconfigured_jira_returns_unconfigured_status(self):
        from apps.agents.jira_service import create_jira_issue, is_jira_configured
        empty_config = {"url": "", "email": "", "api_token": "", "project_key": ""}
        self.assertFalse(is_jira_configured(empty_config))

        res = create_jira_issue({"ticket": {"ticket_id": "TCK-9001"}}, jira_config_override=empty_config)
        self.assertEqual(res["status"], "UNCONFIGURED")
        self.assertFalse(res["created"])
        self.assertIsNone(res["jira_issue_key"])
        self.assertIn("missing or incomplete", res["reason"])

    def test_priority_mapping(self):
        from apps.agents.jira_service import map_priority_to_jira
        self.assertEqual(map_priority_to_jira("P1"), "Highest")
        self.assertEqual(map_priority_to_jira("P2"), "High")
        self.assertEqual(map_priority_to_jira("P3"), "Medium")
        self.assertEqual(map_priority_to_jira("P4"), "Low")
        self.assertEqual(map_priority_to_jira(None), "Medium")

    def test_jira_description_building(self):
        from apps.agents.jira_service import build_jira_description
        desc = build_jira_description(
            ticket={"ticket_id": "TCK-9002", "subject": "VPN Failure", "description": "Cannot connect", "category": "VPN", "severity": "HIGH", "priority": "P2"},
            diagnosis={"problem_understanding": "User cannot connect to VPN", "affected_system": "Company VPN", "likely_causes": ["Gateway down"]},
            validation={"reasons": ["Confidence low"], "confidence_score": 0.5},
            escalation_reason="Validation rejected resolution",
            recommended_action="Check gateway server"
        )
        self.assertIn("TCK-9002", desc)
        self.assertIn("VPN Failure", desc)
        self.assertIn("Cannot connect", desc)
        self.assertIn("Company VPN", desc)
        self.assertIn("Validation rejected resolution", desc)

    @patch("urllib.request.urlopen")
    def test_jira_issue_creation_success_mocked(self, mock_urlopen):
        from apps.agents.jira_service import create_jira_issue
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({"id": "10001", "key": "IT-101"}).encode("utf-8")
        mock_response.__enter__.return_value = mock_response
        mock_urlopen.return_value = mock_response

        test_cfg = {
            "url": "https://testdomain.atlassian.net",
            "email": "agent@test.com",
            "api_token": "secret_token",
            "project_key": "IT",
            "issue_type": "Task"
        }

        escalation_data = {
            "ticket": {"ticket_id": "TCK-9003", "subject": "VPN Disconnect", "description": "Details", "priority": "P2"},
            "diagnosis": {"problem_understanding": "VPN issue"},
            "validation": {"reasons": ["Low confidence"]},
            "escalation_reason": "Confidence below threshold"
        }

        res = create_jira_issue(escalation_data, jira_config_override=test_cfg)
        self.assertEqual(res["status"], "SUCCESS")
        self.assertTrue(res["created"])
        self.assertEqual(res["jira_issue_key"], "IT-101")
        self.assertEqual(res["jira_issue_url"], "https://testdomain.atlassian.net/browse/IT-101")

    @patch("urllib.request.urlopen")
    def test_jira_issue_creation_http_error_handling(self, mock_urlopen):
        from apps.agents.jira_service import create_jira_issue
        import urllib.error
        mock_urlopen.side_effect = urllib.error.HTTPError(
            url="https://testdomain.atlassian.net/rest/api/2/issue",
            code=400,
            msg="Bad Request",
            hdrs={},
            fp=MagicMock(read=MagicMock(return_value=b'{"errorMessages":["Project IT does not exist"]}'))
        )

        test_cfg = {
            "url": "https://testdomain.atlassian.net",
            "email": "agent@test.com",
            "api_token": "secret_token",
            "project_key": "IT",
            "issue_type": "Task"
        }

        res = create_jira_issue({"ticket": {"ticket_id": "TCK-9004"}}, jira_config_override=test_cfg)
        self.assertEqual(res["status"], "FAILED")
        self.assertFalse(res["created"])
        self.assertEqual(res["http_code"], 400)


class EmailServiceTests(SimpleTestCase):
    def test_unconfigured_email_returns_unconfigured_status(self):
        from apps.agents.email_service import send_escalation_email, is_email_configured
        empty_cfg = {"smtp_host": "", "smtp_user": "", "smtp_password": "", "support_email": ""}
        self.assertFalse(is_email_configured(empty_cfg))

        res = send_escalation_email({"ticket": {"ticket_id": "TCK-9001"}}, email_config_override=empty_cfg)
        self.assertEqual(res["status"], "UNCONFIGURED")
        self.assertFalse(res["sent"])
        self.assertIn("missing or incomplete", res["reason"])

    def test_email_content_building(self):
        from apps.agents.email_service import build_escalation_email_content
        ticket = {
            "ticket_id": "IT-2026-B6DC06",
            "subject": "VPN Disconnecting",
            "description": "VPN client drops connection every 5 minutes.",
            "category": "VPN",
            "subcategory": "Connection failure",
            "severity": "HIGH",
            "priority": "P2",
        }
        diagnosis = {
            "problem_understanding": "Keepalive timeout",
            "affected_system": "Corporate VPN",
            "likely_causes": ["Network instability", "Outdated client"],
        }
        validation = {
            "is_valid": False,
            "confidence_score": 0.55,
            "reasons": ["Confidence below threshold"],
        }
        jira_result = {
            "jira_issue_key": "KAN-9",
            "jira_issue_url": "https://test.atlassian.net/browse/KAN-9",
        }

        content = build_escalation_email_content(
            ticket=ticket,
            diagnosis=diagnosis,
            validation=validation,
            escalation_reason="Validation confidence failure",
            jira_result=jira_result,
        )

        self.assertIn("[ESCALATION REQUIRED]", content["subject"])
        self.assertIn("IT-2026-B6DC06", content["subject"])
        self.assertIn("VPN Disconnecting", content["text_body"])
        self.assertIn("Corporate VPN", content["text_body"])
        self.assertIn("KAN-9", content["text_body"])
        self.assertIn("KAN-9", content["html_body"])

    @patch("apps.agents.email_service.get_connection")
    @patch("apps.agents.email_service.EmailMultiAlternatives")
    def test_email_sending_success_mocked(self, mock_email_class, mock_get_conn):
        from apps.agents.email_service import send_escalation_email
        mock_msg = MagicMock()
        mock_msg.send.return_value = 1
        mock_email_class.return_value = mock_msg

        test_cfg = {
            "smtp_host": "smtp.test.com",
            "smtp_port": 587,
            "smtp_user": "testuser@test.com",
            "smtp_password": "testpassword",
            "use_tls": True,
            "use_ssl": False,
            "from_email": "testuser@test.com",
            "support_email": "support@test.com",
        }

        escalation_data = {
            "ticket": {"ticket_id": "TCK-9002", "subject": "Test Email Ticket", "severity": "HIGH", "priority": "P2"},
            "diagnosis": {"problem_understanding": "DB connection timeout"},
            "validation": {"reasons": ["Unsubstantiated resolution"]},
            "escalation_reason": "Low confidence score",
        }

        res = send_escalation_email(escalation_data, email_config_override=test_cfg)
        self.assertEqual(res["status"], "SUCCESS")
        self.assertTrue(res["sent"])
        self.assertEqual(res["recipient"], "support@test.com")
        mock_msg.send.assert_called_once()

    @patch("apps.agents.email_service.get_connection")
    def test_email_sending_failure_handling(self, mock_get_conn):
        from apps.agents.email_service import send_escalation_email
        mock_conn = MagicMock()
        mock_conn.send_messages.side_effect = Exception("SMTP Connection Refused")
        mock_get_conn.return_value = mock_conn

        test_cfg = {
            "smtp_host": "smtp.test.com",
            "smtp_port": 587,
            "smtp_user": "testuser@test.com",
            "smtp_password": "testpassword",
            "support_email": "support@test.com",
        }

        res = send_escalation_email({"ticket": {"ticket_id": "TCK-9003"}}, email_config_override=test_cfg)
        self.assertEqual(res["status"], "FAILED")
        self.assertFalse(res["sent"])
        self.assertIn("SMTP Connection Refused", res["reason"])


class ActivityLoggingTests(SimpleTestCase):
    """
    Focused tests for Task 13 M3 Activity Logging persistence.
    """

    @patch("apps.agents.orchestrator.activity_logs_collection")
    def test_log_activity_captures_m3_fields(self, mock_activity_logs):
        mock_activity_logs.insert_one.return_value = MagicMock()

        entry = log_activity(
            ticket_id="TCK-8001",
            action="AGENT_DIAGNOSIS_COMPLETED",
            details="Diagnosis completed successfully",
            actor="DiagnosisAgent",
            workflow_id="wf_12345",
            agent_name="DiagnosisAgent",
            status="SUCCESS",
            metadata={"confidence": 0.95}
        )

        self.assertEqual(entry["ticket_id"], "TCK-8001")
        self.assertEqual(entry["workflow_id"], "wf_12345")
        self.assertEqual(entry["agent_name"], "DiagnosisAgent")
        self.assertEqual(entry["stage"], "DiagnosisAgent")
        self.assertEqual(entry["action"], "AGENT_DIAGNOSIS_COMPLETED")
        self.assertEqual(entry["status"], "SUCCESS")
        self.assertEqual(entry["metadata"]["confidence"], 0.95)
        mock_activity_logs.insert_one.assert_called_once()

    @patch("apps.agents.orchestrator.activity_logs_collection")
    def test_get_activity_logs(self, mock_activity_logs):
        sample_log = {
            "_id": "mock_id",
            "log_id": "log_1",
            "ticket_id": "TCK-8002",
            "workflow_id": "wf_8002",
            "action": "WORKFLOW_STARTED",
            "timestamp": "2026-09-04T00:00:00Z"
        }
        mock_activity_logs.find.return_value = [sample_log]

        logs = get_activity_logs(ticket_id="TCK-8002", workflow_id="wf_8002")

        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0]["ticket_id"], "TCK-8002")
        self.assertNotIn("_id", logs[0])
        mock_activity_logs.find.assert_called_once_with(
            {"ticket_id": "TCK-8002", "workflow_id": "wf_8002"},
            sort=[("timestamp", 1)]
        )

    @patch("apps.agents.resolution._call_llm")
    @patch("apps.agents.knowledge_retrieval.retrieve_for_ticket")
    @patch("apps.agents.diagnosis._call_llm")
    @patch("apps.agents.orchestrator.tickets_collection")
    @patch("apps.agents.orchestrator.agent_workflows_collection")
    @patch("apps.agents.orchestrator.agent_executions_collection")
    @patch("apps.agents.orchestrator.activity_logs_collection")
    def test_pipeline_persists_m3_activity_logs(
        self, mock_activity_logs, mock_executions, mock_workflows, mock_tickets, mock_diag_llm, mock_retrieve, mock_res_llm
    ):
        mock_diag_llm.return_value = json.dumps({
            "problem_understanding": "Software freeze",
            "affected_system": "App",
            "likely_causes": ["Memory leak"],
            "missing_information": [],
            "confidence": 0.85
        })
        mock_res_llm.return_value = json.dumps({
            "summary": "Restart application",
            "troubleshooting_steps": ["1. Restart app [SOURCE:KB-1#0]"],
            "missing_information": [],
            "limitations": [],
            "confidence": 0.85
        })
        mock_retrieve.return_value = {
            "ticket_id": "TCK-8003",
            "queries": ["App freeze"],
            "results": [{"article_id": "KB-1", "chunk_index": 0, "article_title": "App Guide", "content": "Restart app"}],
            "context": "[SOURCE:KB-1#0] Title: App Guide\nRestart app"
        }
        mock_ticket = {
            "ticket_id": "TCK-8003",
            "subject": "App freezing",
            "description": "App freezes constantly",
            "category": "Application",
            "severity": "MEDIUM",
            "priority": "P3"
        }
        mock_tickets.find_one.return_value = mock_ticket

        saved_workflow = {}
        mock_workflows.insert_one.side_effect = lambda doc: saved_workflow.update(doc)
        mock_workflows.find_one.side_effect = lambda query, **kwargs: saved_workflow if query.get("workflow_id") == saved_workflow.get("workflow_id") else None
        mock_workflows.update_one.side_effect = lambda filter_dict, update_dict: saved_workflow.update(update_dict.get("$set", {}))

        logged_entries = []
        mock_activity_logs.insert_one.side_effect = lambda doc: logged_entries.append(dict(doc))

        result = execute_orchestration_pipeline(ticket_id="TCK-8003", ticket_data=mock_ticket, confidence_threshold=0.70)

        self.assertIsNotNone(result)
        self.assertGreaterEqual(len(logged_entries), 5)

        actions = [entry["action"] for entry in logged_entries]
        self.assertIn("WORKFLOW_STARTED", actions)
        self.assertIn("AGENT_DIAGNOSIS_COMPLETED", actions)
        self.assertIn("AGENT_RETRIEVAL_COMPLETED", actions)
        self.assertIn("AGENT_RESOLUTION_COMPLETED", actions)
        self.assertIn("AGENT_VALIDATION_COMPLETED", actions)
        self.assertIn("AUTO_RESOLUTION_APPROVED", actions)

        for entry in logged_entries:
            self.assertEqual(entry["ticket_id"], "TCK-8003")
            self.assertTrue(entry["workflow_id"].startswith("wf_"))
            self.assertIsNotNone(entry["agent_name"])
            self.assertIsNotNone(entry["status"])


class M3ApiViewTests(SimpleTestCase):
    """
    Focused API tests for Task 14 M3 Backend Endpoints.
    """

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user_id = ObjectId()
        self.mock_user = {"_id": self.user_id, "username": "testagent", "role": "Agent"}

    def test_unauthenticated_request_returns_401(self):
        from apps.agents import views as agent_views
        request = self.factory.post("/api/agents/tickets/TCK-9999/execute/")
        response = agent_views.execute_m3_workflow_view(request, ticket_id="TCK-9999")
        self.assertEqual(response.status_code, 401)

    @patch("apps.agents.views.AccessToken", return_value={"user_id": "507f1f77bcf86cd799439011"})
    @patch("apps.agents.views.users_collection")
    def test_user_not_found_returns_404(self, mock_users_col, mock_token):
        from apps.agents import views as agent_views
        mock_users_col.find_one.return_value = None

        request = self.factory.post(
            "/api/agents/tickets/TCK-9999/execute/",
            HTTP_AUTHORIZATION="Bearer invalid-token"
        )
        response = agent_views.execute_m3_workflow_view(request, ticket_id="TCK-9999")
        self.assertEqual(response.status_code, 404)

    @patch("apps.agents.views.AccessToken")
    @patch("apps.agents.views.users_collection")
    @patch("apps.agents.views.tickets_collection")
    def test_nonexistent_ticket_returns_404(self, mock_tickets_col, mock_users_col, mock_token):
        from apps.agents import views as agent_views
        mock_token.return_value = {"user_id": str(self.user_id)}
        mock_users_col.find_one.return_value = self.mock_user
        mock_tickets_col.find_one.return_value = None

        request = self.factory.post(
            "/api/agents/tickets/NON-EXISTENT/execute/",
            HTTP_AUTHORIZATION="Bearer valid-token"
        )
        response = agent_views.execute_m3_workflow_view(request, ticket_id="NON-EXISTENT")
        self.assertEqual(response.status_code, 404)
        self.assertIn("not found", response.data["message"])

    @patch("apps.agents.views.AccessToken")
    @patch("apps.agents.views.users_collection")
    @patch("apps.agents.views.tickets_collection")
    @patch("apps.agents.views.execute_orchestration_pipeline")
    def test_valid_ticket_workflow_execution_success(
        self, mock_execute, mock_tickets_col, mock_users_col, mock_token
    ):
        from apps.agents import views as agent_views
        mock_token.return_value = {"user_id": str(self.user_id)}
        mock_users_col.find_one.return_value = self.mock_user
        mock_ticket = {"ticket_id": "TCK-1001", "subject": "Printer issue"}
        mock_tickets_col.find_one.return_value = mock_ticket
        mock_execute.return_value = {
            "workflow_id": "wf_1001",
            "ticket_id": "TCK-1001",
            "workflow_status": "COMPLETED",
        }

        request = self.factory.post(
            "/api/agents/tickets/TCK-1001/execute/",
            HTTP_AUTHORIZATION="Bearer valid-token"
        )
        response = agent_views.execute_m3_workflow_view(request, ticket_id="TCK-1001")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "SUCCESS")
        self.assertEqual(response.data["workflow"]["workflow_id"], "wf_1001")
        mock_execute.assert_called_once_with(ticket_id="TCK-1001", ticket_data=mock_ticket)

    @patch("apps.agents.views.AccessToken")
    @patch("apps.agents.views.users_collection")
    @patch("apps.agents.views.tickets_collection")
    @patch("apps.agents.views.get_workflow_by_ticket")
    @patch("apps.agents.views.get_workflow_executions")
    def test_get_workflow_status_success(
        self, mock_executions, mock_get_wf, mock_tickets_col, mock_users_col, mock_token
    ):
        from apps.agents import views as agent_views
        mock_token.return_value = {"user_id": str(self.user_id)}
        mock_users_col.find_one.return_value = self.mock_user
        mock_tickets_col.find_one.return_value = {"ticket_id": "TCK-1001"}
        mock_get_wf.return_value = {"workflow_id": "wf_1001", "workflow_status": "ESCALATED"}
        mock_executions.return_value = [{"execution_id": "exec_1", "agent_name": "DiagnosisAgent"}]

        request = self.factory.get(
            "/api/agents/tickets/TCK-1001/workflow/",
            HTTP_AUTHORIZATION="Bearer valid-token"
        )
        response = agent_views.get_m3_workflow_status_view(request, ticket_id="TCK-1001")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "SUCCESS")
        self.assertEqual(response.data["workflow"]["workflow_status"], "ESCALATED")
        self.assertEqual(len(response.data["executions"]), 1)

    @patch("apps.agents.views.AccessToken")
    @patch("apps.agents.views.users_collection")
    @patch("apps.agents.views.get_activity_logs")
    def test_get_activity_logs_success(
        self, mock_get_logs, mock_users_col, mock_token
    ):
        from apps.agents import views as agent_views
        mock_token.return_value = {"user_id": str(self.user_id)}
        mock_users_col.find_one.return_value = self.mock_user
        mock_get_logs.return_value = [
            {"log_id": "log_1", "ticket_id": "TCK-1001", "action": "WORKFLOW_STARTED"}
        ]

        request = self.factory.get(
            "/api/agents/tickets/TCK-1001/activity-logs/",
            HTTP_AUTHORIZATION="Bearer valid-token"
        )
        response = agent_views.get_m3_activity_logs_view(request, ticket_id="TCK-1001")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "SUCCESS")
        self.assertEqual(len(response.data["activity_logs"]), 1)
        self.assertEqual(response.data["count"], 1)

    def test_object_id_sanitization_helper(self):
        from apps.agents import views as agent_views
        oid = ObjectId()
        raw_data = {
            "_id": oid,
            "nested": [{"item_id": oid}],
            "tuple_item": (oid,),
            "name": "test"
        }
        sanitized = agent_views._sanitize_object_ids(raw_data)
        self.assertEqual(sanitized["_id"], str(oid))
        self.assertEqual(sanitized["nested"][0]["item_id"], str(oid))
        self.assertEqual(sanitized["tuple_item"][0], str(oid))
        self.assertEqual(sanitized["name"], "test")

    @patch("apps.agents.views.AccessToken")
    @patch("apps.agents.views.users_collection")
    @patch("apps.agents.views.tickets_collection")
    @patch("apps.agents.views.execute_orchestration_pipeline")
    def test_execute_m3_workflow_view_sanitizes_object_ids(
        self, mock_execute, mock_tickets_col, mock_users_col, mock_token
    ):
        from apps.agents import views as agent_views
        mock_token.return_value = {"user_id": str(self.user_id)}
        mock_users_col.find_one.return_value = self.mock_user
        mock_ticket = {"_id": ObjectId(), "ticket_id": "TCK-1001", "subject": "Printer issue"}
        mock_tickets_col.find_one.return_value = mock_ticket
        mock_execute.return_value = {
            "_id": ObjectId(),
            "workflow_id": "wf_1001",
            "ticket_id": "TCK-1001",
            "workflow_status": "COMPLETED",
        }

        request = self.factory.post(
            "/api/agents/tickets/TCK-1001/execute/",
            HTTP_AUTHORIZATION="Bearer valid-token"
        )
        response = agent_views.execute_m3_workflow_view(request, ticket_id="TCK-1001")
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data["workflow"]["_id"], str)
