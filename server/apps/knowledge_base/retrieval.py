from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional, Sequence, Tuple

from AIticket.db import article_chunks_collection

from .embeddings import (
    EMBEDDING_DIM,
    MODEL_NAME,
    generate_embeddings,
)
from .filters import apply_retrieval_filters
from .reranker import rerank_results, _get_reranker


VECTOR_INDEX_NAME = "kb_vector_index"
TEXT_INDEX_NAME = "kb_text_index"

DEFAULT_RRF_K = 60
DEFAULT_NUM_CANDIDATES = 300


def _normalize_query(
    query: str,
) -> str:
    value = (query or "").strip()

    if not value:
        raise ValueError(
            "query cannot be empty"
        )

    return value


def _build_vector_filter(
    *,
    status: str,
    category: Optional[str] = None,
    embedding_model: str = MODEL_NAME,
) -> Dict:
    """
    Build a valid MongoDB Vector Search pre-filter.

    IMPORTANT:
    $vectorSearch.filter uses MongoDB filter syntax.
    It does NOT use Atlas Search 'compound' syntax.
    """

    conditions = [
        {
            "article_status": {
                "$eq": status
            }
        },
        {
            "embedding_model": {
                "$eq": embedding_model
            }
        },
    ]

    if category:
        conditions.append(
            {
                "category": {
                    "$eq": category
                }
            }
        )

    if len(conditions) == 1:
        return conditions[0]

    return {
        "$and": conditions
    }


def _build_keyword_filter(
    *,
    status: str,
    category: Optional[str] = None,
) -> List[Dict]:
    """
    Build the Atlas Search compound filter for
    kb_text_index.
    """

    filters = [
        {
            "equals": {
                "path": "article_status",
                "value": status,
            }
        }
    ]

    if category:
        filters.append(
            {
                "equals": {
                    "path": "category",
                    "value": category,
                }
            }
        )

    return filters


def _project_search_fields() -> Dict:
    """
    Shared projection for retrieval results.
    """
    return {
        "_id": 0,
        "article_id": 1,
        "article_title": 1,
        "article_slug": 1,
        "content": 1,
        "article_status": 1,
        "category": 1,
        "sub_category": 1,
        "article_updated_at": 1,
        "chunk_index": 1,
        "heading_path": 1,
    }


def vector_search(
    *,
    query: str,
    status: str = "PUBLISHED",
    limit: int = 30,
    category: Optional[str] = None,
    embedding_model: str = MODEL_NAME,
    num_candidates: Optional[int] = None,
) -> List[Dict]:
    """
    Vector half of M2 hybrid retrieval.

    Uses the existing kb_vector_index and performs
    metadata pre-filtering before vector search.
    """

    query = _normalize_query(
        query
    )

    if limit <= 0:
        raise ValueError(
            "limit must be greater than zero"
        )

    if num_candidates is None:
        num_candidates = max(
            DEFAULT_NUM_CANDIDATES,
            limit * 10,
        )

    if num_candidates < limit:
        raise ValueError(
            "num_candidates cannot be less than limit"
        )

    query_vector = generate_embeddings(
        [query]
    )[0]

    if len(query_vector) != EMBEDDING_DIM:
        raise ValueError(
            "Query embedding dimension mismatch: "
            f"expected {EMBEDDING_DIM}, "
            f"received {len(query_vector)}"
        )

    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX_NAME,
                "path": "embedding",
                "queryVector": query_vector,
                "numCandidates": num_candidates,
                "limit": limit,
                "filter": _build_vector_filter(
                    status=status,
                    category=category,
                    embedding_model=embedding_model,
                ),
            }
        },
        {
            "$project": {
                **_project_search_fields(),
                "score": {
                    "$meta": "vectorSearchScore",
                },
            }
        },
    ]

    return list(
        article_chunks_collection.aggregate(
            pipeline
        )
    )


def keyword_search(
    *,
    query: str,
    status: str = "PUBLISHED",
    limit: int = 30,
    category: Optional[str] = None,
) -> List[Dict]:
    """
    Keyword half of M2 hybrid retrieval.

    M2 weighting:
        content       = normal
        heading_path  = 2x
        article_title = 3x
    """

    query = _normalize_query(
        query
    )

    if limit <= 0:
        raise ValueError(
            "limit must be greater than zero"
        )

    pipeline = [
        {
            "$search": {
                "index": TEXT_INDEX_NAME,
                "compound": {
                    "filter": _build_keyword_filter(
                        status=status,
                        category=category,
                    ),
                    "should": [
                        {
                            "text": {
                                "query": query,
                                "path": "content",
                            }
                        },
                        {
                            "text": {
                                "query": query,
                                "path": "heading_path",
                                "score": {
                                    "boost": {
                                        "value": 2
                                    }
                                },
                            }
                        },
                        {
                            "text": {
                                "query": query,
                                "path": "article_title",
                                "score": {
                                    "boost": {
                                        "value": 3
                                    }
                                },
                            }
                        },
                    ],
                    "minimumShouldMatch": 1,
                },
            }
        },
        {
            "$limit": limit
        },
        {
            "$project": {
                **_project_search_fields(),
                "score": {
                    "$meta": "searchScore",
                },
            }
        },
    ]

    return list(
        article_chunks_collection.aggregate(
            pipeline
        )
    )


def _chunk_key(
    result: Dict,
) -> Tuple[str, int]:
    """
    M2 retrieval unit:
    article + chunk index.
    """
    return (
        str(
            result["article_id"]
        ),
        int(
            result.get(
                "chunk_index",
                0,
            )
        ),
    )


def reciprocal_rank_fusion(
    vector_results: Sequence[Dict],
    keyword_results: Sequence[Dict],
    k: int = DEFAULT_RRF_K,
) -> List[Dict]:
    """
    Reciprocal Rank Fusion using chunk-level identity.
    """

    if k <= 0:
        raise ValueError(
            "k must be greater than zero"
        )

    scores: Dict[
        Tuple[str, int],
        float,
    ] = {}

    documents: Dict[
        Tuple[str, int],
        Dict,
    ] = {}

    for rank, result in enumerate(
        vector_results,
        start=1,
    ):
        key = _chunk_key(
            result
        )

        scores[key] = (
            scores.get(
                key,
                0.0,
            )
            + 1.0
            / (
                k + rank
            )
        )

        documents[key] = dict(
            result
        )

    for rank, result in enumerate(
        keyword_results,
        start=1,
    ):
        key = _chunk_key(
            result
        )

        scores[key] = (
            scores.get(
                key,
                0.0,
            )
            + 1.0
            / (
                k + rank
            )
        )

        if key not in documents:
            documents[key] = dict(
                result
            )

    ranked_keys = sorted(
        scores,
        key=lambda key: scores[key],
        reverse=True,
    )

    fused = []

    for key in ranked_keys:
        result = dict(
            documents[key]
        )

        result[
            "rrf_score"
        ] = scores[key]

        fused.append(
            result
        )

    return fused


def _run_hybrid_pair(
    *,
    query: str,
    status: str,
    limit: int,
    category: Optional[str],
    embedding_model: str,
) -> Tuple[
    List[Dict],
    List[Dict],
]:
    """
    Run vector and keyword retrieval concurrently.
    """

    with ThreadPoolExecutor(
        max_workers=2,
        thread_name_prefix="kb-retrieval",
    ) as executor:

        vector_future = (
            executor.submit(
                vector_search,
                query=query,
                status=status,
                limit=limit,
                category=category,
                embedding_model=embedding_model,
            )
        )

        keyword_future = (
            executor.submit(
                keyword_search,
                query=query,
                status=status,
                limit=limit,
                category=category,
            )
        )

        return (
            vector_future.result(),
            keyword_future.result(),
        )


def hybrid_search(
    *,
    query: str,
    status: str = "PUBLISHED",
    limit: int = 30,
    top_k: int = 5,
    category: Optional[str] = None,
    department: Optional[str] = None,
    include_internal: bool = False,
    rerank_candidates: Optional[int] = None,
    embedding_model: str = MODEL_NAME,
) -> List[Dict]:
    """
    Complete M2 single-query retrieval:

        vector + keyword concurrently
                  ↓
                 RRF
                  ↓
          access filtering
                  ↓
              reranking
    """

    if rerank_candidates is None:
        rerank_candidates = max(
            top_k,
            20,
        )

    _get_reranker()

    vector_results, keyword_results = (
        _run_hybrid_pair(
            query=query,
            status=status,
            limit=limit,
            category=category,
            embedding_model=embedding_model,
        )
    )

    fused_results = (
        reciprocal_rank_fusion(
            vector_results,
            keyword_results,
        )
    )

    filtered_results = (
        apply_retrieval_filters(
            fused_results,
            category=category,
            department=department,
            include_internal=include_internal,
        )
    )

    filtered_results = (
        filtered_results[
            :rerank_candidates
        ]
    )

    return rerank_results(
        query=query,
        results=filtered_results,
        top_k=top_k,
    )


def multi_query_hybrid_search(
    *,
    queries: Sequence[str],
    status: str = "PUBLISHED",
    limit: int = 30,
    top_k: int = 5,
    rerank_candidates: int = 20,
    category: Optional[str] = None,
    department: Optional[str] = None,
    include_internal: bool = False,
    embedding_model: str = MODEL_NAME,
) -> List[Dict]:
    """
    Multi-query M2 retrieval.

    Each query gets concurrent vector + keyword retrieval,
    followed by chunk-level RRF.

    Results are then merged across queries before access
    filtering and final reranking.
    """

    if not queries:
        return []

    _get_reranker()

    merged_candidates: Dict[
        Tuple[str, int],
        Dict,
    ] = {}

    for query in queries:
        vector_results, keyword_results = (
            _run_hybrid_pair(
                query=query,
                status=status,
                limit=limit,
                category=category,
                embedding_model=embedding_model,
            )
        )

        fused_results = (
            reciprocal_rank_fusion(
                vector_results,
                keyword_results,
            )
        )

        for result in fused_results:
            key = _chunk_key(
                result
            )

            existing = (
                merged_candidates.get(
                    key
                )
            )

            if existing is None:
                merged_candidates[
                    key
                ] = dict(
                    result
                )
            else:
                existing[
                    "rrf_score"
                ] = (
                    existing.get(
                        "rrf_score",
                        0.0,
                    )
                    + result.get(
                        "rrf_score",
                        0.0,
                    )
                )

    fused_candidates = list(
        merged_candidates.values()
    )

    fused_candidates.sort(
        key=lambda item: item.get(
            "rrf_score",
            0.0,
        ),
        reverse=True,
    )

    filtered_candidates = (
        apply_retrieval_filters(
            fused_candidates,
            category=category,
            department=department,
            include_internal=include_internal,
        )
    )

    filtered_candidates.sort(
        key=lambda item: item.get(
            "rrf_score",
            0.0,
        ),
        reverse=True,
    )

    filtered_candidates = (
        filtered_candidates[
            :rerank_candidates
        ]
    )

    return rerank_results(
        query=" ".join(
            queries
        ),
        results=filtered_candidates,
        top_k=top_k,
    )