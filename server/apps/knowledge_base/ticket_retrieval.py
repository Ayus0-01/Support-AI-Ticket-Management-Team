from .query_builder import build_search_queries
from .retrieval import multi_query_hybrid_search
from .packing import pack_context
from .reranker import _get_reranker


def retrieve_for_ticket(
    *,
    ticket,
    include_internal=False,
    limit=30,
    top_k=5,
    rerank_candidates=20,
    context_budget=4000,
):
    """
    Run the complete M2 retrieval pipeline for a
    stored support ticket.
    """
    _get_reranker()

    subject = ticket.get(
        "subject",
        "",
    )

    description = ticket.get(
        "description",
        "",
    )

    category = ticket.get(
        "category",
        "",
    ) or ""

    affected_system = ticket.get(
        "affected_system",
        "",
    ) or ""

    department = ticket.get(
        "department",
        "",
    ) or ""

    queries = build_search_queries(
        subject=subject,
        description=description,
        category=category,
        affected_system=affected_system,
    )

    results = multi_query_hybrid_search(
        queries=queries,
        status="PUBLISHED",
        limit=limit,
        top_k=top_k,
        rerank_candidates=rerank_candidates,
        category=category or None,
        department=department or None,
        include_internal=include_internal,
    )

    context = pack_context(
        results,
        budget_tokens=context_budget,
    )

    return {
        "ticket_id": ticket.get(
            "ticket_id"
        ),
        "queries": queries,
        "results": results,
        "context": context,
    }