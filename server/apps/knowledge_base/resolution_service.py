import time
from apps.agents.orchestrator import log_activity

from .ticket_retrieval import (
    retrieve_for_ticket,
)
from .generator import (
    generate_resolution,
)
from .persistence import (
    create_retrieval_log,
    create_ticket_response,
    create_response_citations,
    record_kb_gap,
    mark_ticket_resolution_generated,
)


def generate_and_persist_resolution(
    *,
    ticket,
    classification_confidence=0.0,
):
    """
    Complete M2 resolution workflow:

        ticket
        -> retrieval
        -> generation
        -> persistence

    Returns the persisted draft response.
    """

    start_time = time.perf_counter()

    retrieval = retrieve_for_ticket(
        ticket=ticket,
        include_internal=False,
    )

    retrieval_log = create_retrieval_log(
        ticket_id=ticket["_id"],
        queries_used=retrieval[
            "queries"
        ],
        chunks_retrieved=len(
            retrieval["results"]
        ),
        results=retrieval[
            "results"
        ],
    )

    resolution = generate_resolution(
        subject=ticket.get(
            "subject",
            "",
        ),
        description=ticket.get(
            "description",
            "",
        ),
        category=ticket.get(
            "category",
            "",
        ),
        subcategory=ticket.get(
            "subcategory",
            "",
        ),
        severity=ticket.get(
            "severity",
            "",
        ),
        already_tried=ticket.get(
            "already_tried",
            "",
        ),
        packed_context=retrieval[
            "context"
        ],
        retrieval_results=retrieval[
            "results"
        ],
        classification_confidence=(
            classification_confidence
        ),
    )

    latency_ms = int(
        (
            time.perf_counter()
            - start_time
        )
        * 1000
    )

    response = create_ticket_response(
        ticket=ticket,
        resolution=resolution,
        retrieval_log=retrieval_log,
        queries_used=retrieval[
            "queries"
        ],
        model="qwen3:4b",
        prompt_version="resolution.v1",
        embedding_model=(
            "BAAI/bge-large-en-v1.5"
        ),
        latency_ms=latency_ms,
    )
    mark_ticket_resolution_generated(
        ticket_id=ticket["_id"],
        response_id=response["_id"],
    )

    create_response_citations(
        response=response,
        retrieval_results=retrieval[
            "results"
        ],
    )

    if not resolution.get(
        "sufficient_context",
        False,
    ):
        record_kb_gap(
            ticket_id=ticket["_id"],
            reason=resolution.get(
                "escalation_reason",
                "Insufficient knowledge-base context.",
            ),
        )

    return response

def get_ticket_resolution_confidence(ticket):
    classification = (
        ticket.get("classification")
        or {}
    )

    category = (
        classification.get("category")
        or {}
    )

    severity = (
        classification.get("severity")
        or {}
    )

    return max(
        float(
            category.get(
                "confidence",
                0.0,
            )
            or 0.0
        ),
        float(
            severity.get(
                "confidence",
                0.0,
            )
            or 0.0
        ),
    )