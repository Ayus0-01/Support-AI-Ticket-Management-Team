"""
MongoDB Collections and Data Structures for M3 Multi-Agent Engine.
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import uuid

from AIticket.db import db

# M3 MongoDB Collections
agent_workflows_collection = db["agent_workflows"]
agent_executions_collection = db["agent_executions"]
activity_logs_collection = db["activity_logs"]


def generate_uuid() -> str:
    return str(uuid.uuid4())


def get_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()
