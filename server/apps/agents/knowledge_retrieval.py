"""
M3 Knowledge Retrieval Agent.
Calls and reuses the existing M2 RAG/retrieval capability (apps.knowledge_base.ticket_retrieval).
Does NOT recreate or duplicate vector search, embeddings, chunking, or RAG pipelines.
"""
from typing import Dict, Any, List, Optional
from .interfaces import BaseAgent
from apps.knowledge_base.ticket_retrieval import retrieve_for_ticket


class KnowledgeRetrievalAgent(BaseAgent):
    """
    Real M3 Knowledge Retrieval Agent.
    Consumes ticket context + Diagnosis Agent output, and invokes existing M2 retrieval.
    Never modifies M1 classification/severity/priority fields.
    Never fabricates knowledge if no M2 articles are found.
    """
    agent_name = "KnowledgeRetrievalAgent"

    def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        subject = (input_data.get("subject") or "").strip()


        description = (input_data.get("description") or "").strip()
        category = (input_data.get("category") or "").strip()
        subcategory = (input_data.get("subcategory") or "").strip()
        severity = (input_data.get("severity") or "").strip()
        priority = (input_data.get("priority") or "").strip()
        diagnosis = input_data.get("diagnosis", {})

        # Extract affected system from Diagnosis Agent output if available
        affected_system = ""
        if isinstance(diagnosis, dict):
            affected_system = diagnosis.get("affected_system", "")
            if affected_system == "Unknown":
                affected_system = ""

        # Prepare ticket payload expected by existing M2 retrieve_for_ticket
        ticket_payload = {
            "ticket_id": input_data.get("ticket_id", ""),
            "subject": subject,
            "description": description,
            "category": category,
            "subcategory": subcategory,
            "affected_system": affected_system,
            "severity": severity,
            "priority": priority,
        }

        try:
            # Call existing M2 retrieval capability
            m2_output = retrieve_for_ticket(
                ticket=ticket_payload,
                include_internal=False,
                top_k=5,
            )

            raw_results = m2_output.get("results", [])
            packed_context = m2_output.get("context", "")
            queries_used = m2_output.get("queries", [])

            # Handle no evidence found in M2
            if not raw_results:
                return {
                    "status": "NO_EVIDENCE",
                    "confidence": 0.0,
                    "retrieved_evidence": [],
                    "packed_context": "",
                    "sources": [],
                    "queries_used": queries_used,
                    "message": "No relevant knowledge-base context was retrieved for this ticket."
                }

            # Convert M2 chunk results into structured M3 evidence & citations
            retrieved_evidence = []
            sources = []

            for chunk in raw_results:
                article_id = chunk.get("article_id", "")
                chunk_index = chunk.get("chunk_index", 0)
                title = chunk.get("article_title", "")
                heading_path = chunk.get("heading_path", "")
                content = chunk.get("content", "")
                score = chunk.get("rerank_score", chunk.get("rrf_score", 0.0))

                source_marker = f"[SOURCE:{article_id}#{chunk_index}]"

                evidence_item = {
                    "article_id": article_id,
                    "chunk_index": chunk_index,
                    "title": title,
                    "heading_path": heading_path,
                    "content": content,
                    "score": float(score),
                    "source_marker": source_marker,
                }
                retrieved_evidence.append(evidence_item)

                sources.append({
                    "article_id": article_id,
                    "chunk_index": chunk_index,
                    "title": title,
                    "source_marker": source_marker,
                })

            return {
                "status": "SUCCESS",
                "confidence": 1.0,
                "retrieved_evidence": retrieved_evidence,
                "packed_context": packed_context,
                "sources": sources,
                "queries_used": queries_used,
            }

        except Exception as e:
            # Catch M2 execution errors safely without crashing application
            return {
                "status": "FAILED",
                "confidence": 0.0,
                "retrieved_evidence": [],
                "packed_context": "",
                "sources": [],
                "queries_used": [],
                "error_message": f"M2 Retrieval failed: {str(e)}"
            }
