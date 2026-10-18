import os
import logging
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

logger = logging.getLogger("medi_tracker.database")

# Support common environment variable names
raw_mongo_url = (
    os.getenv("MONGO_URL") or
    os.getenv("MONGODB_URL") or
    os.getenv("MONGO_URI") or
    os.getenv("DATABASE_URL") or
    ""
).strip()

if not raw_mongo_url:
    raw_mongo_url = "mongodb://localhost:27017"

# Strip accidental surrounding quotes from web consoles or .env files
MONGO_URL = raw_mongo_url.strip('"').strip("'").strip()
DB_NAME = os.getenv("DB_NAME", "medi_tracker").strip()

_init_error = None
try:
    client = AsyncIOMotorClient(
        MONGO_URL,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
    )
    db = client[DB_NAME]
except Exception as e:
    _init_error = str(e)
    logger.error(f"Failed to initialize MongoDB connection '{MONGO_URL}': {e}")
    client = AsyncIOMotorClient("mongodb://localhost:27017", serverSelectionTimeoutMS=1000)
    db = client[DB_NAME]

def serialize_doc(doc: dict) -> dict:
    if not doc:
        return {}
    res = dict(doc)
    if "_id" in res:
        res["id"] = str(res["_id"])
        del res["_id"]
    return res