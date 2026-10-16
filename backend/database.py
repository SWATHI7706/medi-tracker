import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger("medi_tracker.database")

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "medi_tracker")

try:
    client = AsyncIOMotorClient(
        MONGO_URL,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
    )
    db = client[DB_NAME]
except Exception as e:
    logger.error(f"Failed to initialize MongoDB connection '{MONGO_URL}': {e}")
    client = AsyncIOMotorClient("mongodb://localhost:27017", serverSelectionTimeoutMS=1000)
    db = client[DB_NAME]

def serialize_doc(doc: dict) -> dict:
    if not doc:
        return {}
    doc["id"] = str(doc["_id"])
    del doc["_id"]
    return doc