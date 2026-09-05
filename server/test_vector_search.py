from AIticket.db import article_chunks_collection
from apps.knowledge_base.embeddings import generate_embeddings


query = "VPN connection timeout troubleshooting"

query_vector = generate_embeddings([query])[0]

pipeline = [
    {
        "$vectorSearch": {
            "index": "kb_vector_index",
            "path": "embedding",
            "queryVector": query_vector,
            "numCandidates": 20,
            "limit": 5,
            "filter": {
                "article_status": "DRAFT"
            },
        }
    },
    {
        "$project": {
            "_id": 0,
            "article_id": 1,
            "article_title": 1,
            "article_slug": 1,
            "content": 1,
            "article_status": 1,
            "score": {
                "$meta": "vectorSearchScore"
            },
        }
    },
]

results = list(
    article_chunks_collection.aggregate(
        pipeline
    )
)

print("RESULT COUNT:", len(results))

for result in results:
    print(result)