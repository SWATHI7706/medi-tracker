import os
import logging
import urllib.parse
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

logger = logging.getLogger("medi_tracker.database")

def sanitize_mongo_url(url: str) -> str:
    """
    Safely encodes special characters in MongoDB username and password
    according to RFC 3986 (quote_plus) to prevent ConfigurationError.
    """
    url = url.strip().strip('"').strip("'")
    if "://" not in url or "@" not in url:
        return url

    scheme, rest = url.split("://", 1)
    last_at = rest.rfind("@")
    creds_part = rest[:last_at]
    host_part = rest[last_at + 1:]

    if ":" in creds_part:
        username, password = creds_part.split(":", 1)
        unquoted_user = urllib.parse.unquote(username)
        unquoted_pass = urllib.parse.unquote(password)
        safe_user = urllib.parse.quote_plus(unquoted_user)
        safe_pass = urllib.parse.quote_plus(unquoted_pass)
        return f"{scheme}://{safe_user}:{safe_pass}@{host_part}"
    else:
        unquoted_user = urllib.parse.unquote(creds_part)
        safe_user = urllib.parse.quote_plus(unquoted_user)
        return f"{scheme}://{safe_user}@{host_part}"

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

MONGO_URL = sanitize_mongo_url(raw_mongo_url)
DB_NAME = os.getenv("DB_NAME", "medi_tracker").strip()

try:
    import certifi
    ca_file = certifi.where()
except Exception:
    ca_file = None

client_kwargs = {
    "serverSelectionTimeoutMS": 5000,
    "connectTimeoutMS": 5000,
}

if ca_file and ("mongodb+srv://" in MONGO_URL or "ssl=true" in MONGO_URL.lower() or "tls=true" in MONGO_URL.lower()):
    client_kwargs["tlsCAFile"] = ca_file

_init_error = None
try:
    client = AsyncIOMotorClient(
        MONGO_URL,
        **client_kwargs,
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