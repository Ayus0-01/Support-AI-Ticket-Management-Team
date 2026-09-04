from pymongo import MongoClient
from decouple import config


client = MongoClient(config('MONGO_URI'))

db = client["SupportAI"]

tickets_collection = db['tickets']
users_collection = db['users']
counters_collection = db['counters']
classification_overrides_collection = db['classification_overrides']
status_history_collection = db['status_history']
comments_collection = db["ticket_comments"]

knowledge_articles_collection = db["knowledge_articles"]
article_versions_collection = db["article_versions"]
article_chunks_collection = db["article_chunks"]
applications_collection = db["applications"]
ingestion_jobs_collection = db["ingestion_jobs"]
ticket_responses_collection = db["ticket_responses"]
response_citations_collection = db["response_citations"]
resolution_feedback_collection = db["resolution_feedback"]
kb_gaps_collection = db["kb_gaps"]
retrieval_logs_collection = db["retrieval_logs"]