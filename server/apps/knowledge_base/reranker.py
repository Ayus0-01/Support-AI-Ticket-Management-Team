import torch

from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
)


MODEL_NAME = "BAAI/bge-reranker-v2-m3"


_tokenizer = None
_model = None


def _get_reranker():
    global _tokenizer, _model
    if _tokenizer is None or _model is None:
        _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        _model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME)
        _model.eval()
    return _tokenizer, _model


def _score_pair(
    query,
    document,
):
    """
    Compute the raw reranker score for one
    query/document pair.
    """
    tokenizer, model = _get_reranker()
    inputs = tokenizer(
        query,
        document,
        padding=True,
        truncation=True,
        return_tensors="pt",
        max_length=512,
    )

    with torch.no_grad():
        score = (
            model(**inputs)
            .logits
            .view(-1)
            .float()
            .item()
        )

    return score



def rerank_results(
    query,
    results,
    top_k=5,
    score_floor=None,
):
    """
    Rerank hybrid-search results using the
    local BGE reranker.

    Each result receives:
        rerank_score

    IMPORTANT:
    BGE reranker scores are raw model logits.
    They are used for relative ranking, not as
    an absolute probability threshold.

    If score_floor is explicitly supplied, it
    may still be used by callers that need it.

    If the reranker is unavailable, the original
    RRF order is returned and the run is marked
    as degraded.
    """

    if not results:
        return []

    try:
        reranked = []

        for result in results:
            content = result.get(
                "content",
                "",
            )

            title = result.get(
                "article_title",
                "",
            )

            document = (
                f"{title}\n\n"
                f"{content}"
            )

            raw_score = _score_pair(
                query,
                document,
            )

            updated_result = dict(
                result
            )

            updated_result[
                "rerank_score"
            ] = raw_score

            reranked.append(
                updated_result
            )

        reranked.sort(
            key=lambda item: item[
                "rerank_score"
            ],
            reverse=True,
        )

        if score_floor is not None:
            reranked = [
                result
                for result in reranked
                if result[
                    "rerank_score"
                ] >= score_floor
            ]

        return reranked[:top_k]

    except Exception:
        fallback_results = []

        for result in results[:top_k]:
            fallback_result = dict(
                result
            )

            fallback_result[
                "degraded"
            ] = [
                "RERANKER_UNAVAILABLE"
            ]

            fallback_results.append(
                fallback_result
            )

        return fallback_results