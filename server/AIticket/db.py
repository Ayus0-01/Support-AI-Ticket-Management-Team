from pymongo import MongoClient
from decouple import config

class MockCollection:
    def __init__(self, name):
        self.name = name
    def find_one(self, *args, **kwargs):
        return None
    def insert_one(self, *args, **kwargs):
        class InsertResult:
            inserted_id = "60c72b2f9b1d8e2b8c9d4b99"
        return InsertResult()
    def find(self, *args, **kwargs):
        return []
    def update_one(self, *args, **kwargs):
        return None
    def delete_one(self, *args, **kwargs):
        return None
    def count_documents(self, *args, **kwargs):
        return 0

try:
    client = MongoClient(config('MONGO_URI'), serverSelectionTimeoutMS=2000)
    db = client["SupportAI"]
    tickets_collection = db['tickets']
    users_collection = db['users']
except Exception as e:
    print("[WARNING] MongoDB connection failed during import. Falling back to Mock Collections. Error:", e)
    tickets_collection = MockCollection('tickets')
    users_collection = MockCollection('users')