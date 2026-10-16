import os
import io
import uuid
import string
import secrets
import shutil
from typing import List, Optional, Dict, Any
import bcrypt
from datetime import datetime, date, timedelta
from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from bson import ObjectId
from jose import jwt, JWTError
from database import db, serialize_doc
from report_generator import generate_doctor_summary_pdf
from models import (
    MedicineSchema,
    MedicineUpdate,
    IntakeLogSchema,
    RefillPayload,
    UserRegister,
    UserLogin,
    TokenResponse,
    DocumentResponse,
    FamilyInviteResponse,
    FamilyJoinPayload,
    FamilyLinkMember,
    FamilyMembersResponse,
    PersonalInfoSchema,
    ConditionCreate,
    ConditionSchema,
    DoctorNoteCreate,
    DoctorNoteSchema,
    PatientProfileUpdate,
    PatientProfileResponse,
)

app = FastAPI(title="Medi Tracker API")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
default_upload_dir = "/tmp/uploads" if os.getenv("K_SERVICE") else os.path.join(BASE_DIR, "uploads")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", default_upload_dir)
REPORTS_DIR = os.path.join(UPLOAD_DIR, "reports")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Frontend Distribution Directory (for single container deployment on Cloud Run)
FRONTEND_DIST = os.getenv("FRONTEND_DIST", os.path.join(BASE_DIR, "static", "dist"))
if not os.path.exists(FRONTEND_DIST):
    local_dist = os.path.join(BASE_DIR, "..", "frontend", "dist")
    if os.path.exists(local_dist):
        FRONTEND_DIST = local_dist

# Configure CORS for production and development
raw_origins = os.getenv("ALLOWED_ORIGINS", "").strip()
if raw_origins == "*":
    cors_origins = ["*"]
    cors_allow_credentials = False
elif raw_origins:
    cors_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    cors_allow_credentials = True
else:
    cors_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    cors_allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Security & JWT Config ---
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    JWT_SECRET = "medi-tracker-development-insecure-key-change-in-prod"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

security = HTTPBearer()

def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_bytes = plain_password.encode("utf-8")[:72]
    try:
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials or not credentials.credentials:
        raise credentials_exception

    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    try:
        user_oid = ObjectId(user_id)
    except Exception:
        raise credentials_exception

    user = await db.users.find_one({"_id": user_oid})
    if not user:
        raise credentials_exception

    user_data = serialize_doc(user)
    user_data.pop("password_hash", None)
    return user_data

async def verify_delegated_access(
    current_user: dict,
    target_patient_id: Optional[str] = None,
    required_permission: str = "view",
) -> str:
    """
    Returns the effective user ID for queries.
    If target_patient_id is None or matches current_user['id'], returns current_user['id'].
    Otherwise, verifies active caregiver link in family_links collection.
    """
    if not target_patient_id or target_patient_id == current_user["id"]:
        return current_user["id"]

    link = await db.family_links.find_one({
        "patient_id": target_patient_id,
        "caregiver_id": current_user["id"],
        "status": "active",
    })
    if not link:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have delegated caregiver access for this patient."
        )

    if required_permission == "full" and link.get("permissions") == "view":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: You have view-only access for this patient."
        )

    return target_patient_id

def serialize_medicine(doc: dict) -> dict:
    doc = serialize_doc(doc)
    doc.setdefault("total_stock", 30)
    doc.setdefault("refill_threshold", 5)
    doc.setdefault("dose_unit", "pills")
    doc.setdefault("category", "After Food")
    return doc

# --- Root & Health Check ---
@app.get("/")
async def root():
    if os.path.exists(FRONTEND_DIST):
        index_file = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
    return {"message": "Medi Tracker API is running"}

@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "medi-tracker-api",
        "timestamp": datetime.utcnow().isoformat()
    }

# --- Authentication Endpoints ---
@app.post("/api/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister):
    email = str(payload.email).lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = {
        "email": email,
        "full_name": payload.full_name.strip(),
        "password_hash": hash_password(payload.password),
        "created_at": datetime.utcnow().isoformat(),
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # Automatically associate any unowned legacy data to the first user registered
    user_meds_count = await db.medicines.count_documents({"owner_id": user_id})
    if user_meds_count == 0:
        await db.medicines.update_many({"owner_id": None}, {"$set": {"owner_id": user_id}})
        await db.intake_logs.update_many({"owner_id": None}, {"$set": {"owner_id": user_id}})

    access_token = create_access_token({"sub": user_id, "email": email})
    user_profile = {
        "id": user_id,
        "email": email,
        "full_name": user_doc["full_name"],
    }
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_profile,
    )

@app.post("/api/auth/login", response_model=TokenResponse)
async def login(payload: UserLogin):
    email = str(payload.email).lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user_id = str(user["_id"])
    access_token = create_access_token({"sub": user_id, "email": email})
    user_profile = {
        "id": user_id,
        "email": email,
        "full_name": user.get("full_name", email.split("@")[0]),
    }
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_profile,
    )

@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# --- Healthcare Tips ---
HEALTH_TIPS = [
    {
        "id": "tip-1",
        "title": "Stay Hydrated with Every Dose",
        "tip": "Take oral medications with a full glass of water (200-250 ml) unless instructed otherwise to prevent esophageal irritation and enhance absorption.",
        "category": "Hydration",
        "icon_hint": "droplet",
    },
    {
        "id": "tip-2",
        "title": "Anchor to Daily Habits",
        "tip": "Tie your pill times to fixed routines, such as morning coffee or brushing your teeth. Habit-stacking reduces missed doses by over 40%.",
        "category": "Adherence",
        "icon_hint": "clock",
    },
    {
        "id": "tip-3",
        "title": "Safe Medication Storage",
        "tip": "Avoid keeping medications in humid bathroom cabinets; moisture and warmth degrade active ingredients. A cool, dry pantry or bedroom drawer is ideal.",
        "category": "Storage",
        "icon_hint": "shield",
    },
    {
        "id": "tip-4",
        "title": "Understanding 'With Food'",
        "tip": "'With food' means during or within 30 minutes after eating. 'On an empty stomach' requires taking pills at least 1 hour before or 2 hours after meals.",
        "category": "Nutrition",
        "icon_hint": "utensils",
    },
    {
        "id": "tip-5",
        "title": "Consistent Sleep Schedules",
        "tip": "Aim for 7 to 8 hours of quality sleep. Deep restorative sleep stabilizes hepatic enzymes that process and metabolize prescription drugs.",
        "category": "Sleep",
        "icon_hint": "moon",
    },
    {
        "id": "tip-6",
        "title": "Probiotics & Antibiotics Spacing",
        "tip": "When prescribed antibiotics, take probiotic supplements or yogurt at least 2 to 3 hours apart so the antibiotic doesn't destroy the beneficial bacteria.",
        "category": "Gut Health",
        "icon_hint": "activity",
    },
    {
        "id": "tip-7",
        "title": "Never Double Up Missed Doses",
        "tip": "If you forget a dose, take it as soon as remembered unless it is almost time for your next scheduled dose. Never take double doses to compensate.",
        "category": "Safety",
        "icon_hint": "alert",
    },
]

@app.get("/api/health-tips")
async def get_health_tips():
    return HEALTH_TIPS

# --- Medicine Management (User-Scoped & Caregiver Delegated) ---
@app.post("/api/medicines")
async def add_medicine(
    med: MedicineSchema,
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    target_id = patient_id or med.owner_id
    effective_id = await verify_delegated_access(current_user, target_id, "full")
    doc = med.model_dump()
    doc["owner_id"] = effective_id
    result = await db.medicines.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_medicine(doc)

@app.get("/api/medicines")
async def get_medicines(
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    effective_id = await verify_delegated_access(current_user, patient_id, "view")
    cursor = db.medicines.find({"owner_id": effective_id})
    return [serialize_medicine(doc) async for doc in cursor]

@app.put("/api/medicines/{med_id}")
async def update_medicine(
    med_id: str,
    payload: MedicineUpdate,
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    try:
        oid = ObjectId(med_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid medicine ID")

    effective_id = await verify_delegated_access(current_user, patient_id, "full")

    result = await db.medicines.update_one(
        {"_id": oid, "owner_id": effective_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")

    updated_doc = await db.medicines.find_one({"_id": oid, "owner_id": effective_id})
    return serialize_medicine(updated_doc)

@app.post("/api/medicines/{med_id}/refill")
async def refill_medicine(
    med_id: str,
    payload: RefillPayload,
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    try:
        oid = ObjectId(med_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid medicine ID")

    if payload.refill_amount <= 0:
        raise HTTPException(status_code=400, detail="Refill amount must be greater than zero")

    effective_id = await verify_delegated_access(current_user, patient_id, "full")

    med = await db.medicines.find_one({"_id": oid, "owner_id": effective_id})
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")

    curr_stock = med.get("total_stock", 30)
    new_stock = curr_stock + payload.refill_amount
    await db.medicines.update_one(
        {"_id": oid, "owner_id": effective_id},
        {"$set": {"total_stock": new_stock}},
    )
    med["total_stock"] = new_stock
    return serialize_medicine(med)

@app.delete("/api/medicines/{med_id}")
async def delete_medicine(
    med_id: str,
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    try:
        oid = ObjectId(med_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid medicine ID")

    effective_id = await verify_delegated_access(current_user, patient_id, "full")

    res = await db.medicines.delete_one({"_id": oid, "owner_id": effective_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Medicine not found")

    await db.intake_logs.delete_many({"medicine_id": med_id, "owner_id": effective_id})
    return {"status": "deleted"}

# --- Daily Intake Tracking (User-Scoped & Caregiver Delegated) ---
@app.post("/api/logs")
async def log_intake(
    log: IntakeLogSchema,
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    target_id = patient_id or log.owner_id
    effective_id = await verify_delegated_access(current_user, target_id, "full")

    log_doc = log.model_dump()
    log_doc["owner_id"] = effective_id

    # Check previous status to detect transitions to/from "taken"
    existing = await db.intake_logs.find_one({
        "medicine_id": log.medicine_id,
        "date": log.date,
        "time": log.time,
        "owner_id": effective_id,
    })
    prev_status = existing.get("status") if existing else None

    await db.intake_logs.update_one(
        {
            "medicine_id": log.medicine_id,
            "date": log.date,
            "time": log.time,
            "owner_id": effective_id,
        },
        {"$set": log_doc},
        upsert=True,
    )

    # Stock adjustment logic
    try:
        oid = ObjectId(log.medicine_id)
        if prev_status != "taken" and log.status == "taken":
            med = await db.medicines.find_one({"_id": oid, "owner_id": effective_id})
            if med:
                curr_stock = med.get("total_stock", 30)
                new_stock = max(0, curr_stock - 1)
                await db.medicines.update_one(
                    {"_id": oid, "owner_id": effective_id},
                    {"$set": {"total_stock": new_stock}},
                )
        elif prev_status == "taken" and log.status != "taken":
            await db.medicines.update_one(
                {"_id": oid, "owner_id": effective_id},
                {"$inc": {"total_stock": 1}},
            )
    except Exception as e:
        print(f"Error updating medicine stock on log: {e}")

    return {"status": "logged"}

@app.get("/api/logs/today")
async def get_today_logs(
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    effective_id = await verify_delegated_access(current_user, patient_id, "view")
    today = datetime.utcnow().strftime("%Y-%m-%d")
    logs = await db.intake_logs.find({"date": today, "owner_id": effective_id}).to_list(1000)
    return [serialize_doc(log) for log in logs]

@app.get("/api/logs/history")
async def get_logs_history(
    days: int = 30,
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    effective_id = await verify_delegated_access(current_user, patient_id, "view")
    start_date = (date.today() - timedelta(days=days)).isoformat()
    cursor = db.intake_logs.find({
        "date": {"$gte": start_date},
        "owner_id": effective_id,
    }).sort([("date", -1), ("time", 1)])
    logs = [serialize_doc(doc) async for doc in cursor]

    med_ids = list({log["medicine_id"] for log in logs if "medicine_id" in log})
    valid_oids = []
    for mid in med_ids:
        try:
            valid_oids.append(ObjectId(mid))
        except Exception:
            pass

    med_map = {}
    if valid_oids:
        med_cursor = db.medicines.find({
            "_id": {"$in": valid_oids},
            "owner_id": effective_id,
        })
        med_map = {str(m["_id"]): m async for m in med_cursor}

    for log in logs:
        med = med_map.get(log.get("medicine_id"))
        log["medicine_name"] = med.get("name", "Unknown Medicine") if med else "Unknown Medicine"
        log["dosage"] = med.get("dosage", "") if med else ""
        log["category"] = med.get("category", "After Food") if med else "After Food"

    logs.sort(key=lambda x: x.get("time", ""))
    logs.sort(key=lambda x: x.get("date", ""), reverse=True)
    return logs

# --- Analytics Dashboard (User-Scoped & Caregiver Delegated) ---
@app.get("/api/analytics")
async def get_analytics(
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    effective_id = await verify_delegated_access(current_user, patient_id, "view")
    summary_pipeline = [
        {"$match": {"owner_id": effective_id}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    counts = {doc["_id"]: doc["count"] async for doc in db.intake_logs.aggregate(summary_pipeline)}

    today = date.today()
    start_date = (today - timedelta(days=6)).isoformat()
    end_date = today.isoformat()

    trend_pipeline = [
        {
            "$match": {
                "owner_id": effective_id,
                "date": {"$gte": start_date, "$lte": end_date},
            }
        },
        {
            "$group": {
                "_id": "$date",
                "taken": {
                    "$sum": {"$cond": [{"$eq": ["$status", "taken"]}, 1, 0]}
                },
                "missed": {
                    "$sum": {"$cond": [{"$eq": ["$status", "missed"]}, 1, 0]}
                },
            }
        },
    ]
    trend_map = {doc["_id"]: doc async for doc in db.intake_logs.aggregate(trend_pipeline)}

    trends = []
    for i in range(6, -1, -1):
        day_str = (today - timedelta(days=i)).isoformat()
        day_data = trend_map.get(day_str, {})
        trends.append({
            "date": day_str,
            "taken": day_data.get("taken", 0),
            "missed": day_data.get("missed", 0),
        })

    return {
        "summary": {
            "taken": counts.get("taken", 0),
            "missed": counts.get("missed", 0),
        },
        "trends": trends,
    }

@app.get("/api/analytics/streak")
async def get_streak(
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    effective_id = await verify_delegated_access(current_user, patient_id, "view")
    med_cursor = db.medicines.find({"owner_id": effective_id})
    meds = [m async for m in med_cursor]
    total_scheduled = sum(len(m.get("times", [])) for m in meds)

    pipeline = [
        {"$match": {"owner_id": effective_id}},
        {
            "$group": {
                "_id": "$date",
                "taken": {
                    "$sum": {"$cond": [{"$eq": ["$status", "taken"]}, 1, 0]}
                },
                "missed": {
                    "$sum": {"$cond": [{"$eq": ["$status", "missed"]}, 1, 0]}
                },
                "total": {"$sum": 1},
            }
        },
    ]
    cursor = db.intake_logs.aggregate(pipeline)
    logs_by_date = {doc["_id"]: doc async for doc in cursor}

    def is_complete(doc, target):
        if not doc:
            return False
        if doc.get("missed", 0) > 0:
            return False
        if target > 0:
            return doc.get("taken", 0) >= target
        return doc.get("taken", 0) > 0

    today = date.today()
    today_str = today.isoformat()
    today_doc = logs_by_date.get(today_str)
    today_missed = today_doc.get("missed", 0) if today_doc else 0

    if today_missed > 0:
        return {"streak": 0}

    if is_complete(today_doc, total_scheduled):
        curr = today
    else:
        curr = today - timedelta(days=1)

    streak = 0
    while True:
        d_str = curr.isoformat()
        doc = logs_by_date.get(d_str)
        if is_complete(doc, total_scheduled):
            streak += 1
            curr -= timedelta(days=1)
        else:
            break

    return {"streak": streak}

# --- Health Records Vault Endpoints ---
@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(...),
    doc_type: str = Form("prescription"),
    notes: Optional[str] = Form(""),
    patient_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    effective_id = await verify_delegated_access(current_user, patient_id, "full")

    clean_name = os.path.basename(file.filename or "document")
    ext = os.path.splitext(clean_name)[1].lower()
    allowed_exts = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".txt", ".doc", ".docx"}
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: PDF, PNG, JPG, JPEG, WEBP."
        )

    unique_filename = f"{uuid.uuid4().hex[:12]}_{clean_name}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    content = await file.read()
    file_size = len(content)

    with open(file_path, "wb") as f:
        f.write(content)

    file_url = f"http://localhost:8000/uploads/{unique_filename}"
    doc = {
        "owner_id": effective_id,
        "uploaded_by": current_user["id"],
        "title": title.strip(),
        "doc_type": doc_type.strip().lower(),
        "file_url": file_url,
        "file_name": clean_name,
        "file_size": file_size,
        "notes": (notes or "").strip(),
        "uploaded_at": datetime.utcnow().isoformat(),
    }
    res = await db.medical_documents.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_doc(doc)

@app.get("/api/documents")
async def get_documents(
    patient_id: Optional[str] = None,
    doc_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    effective_id = await verify_delegated_access(current_user, patient_id, "view")
    query = {"owner_id": effective_id}
    if doc_type and doc_type.lower() != "all":
        query["doc_type"] = doc_type.lower()

    cursor = db.medical_documents.find(query).sort("uploaded_at", -1)
    return [serialize_doc(doc) async for doc in cursor]

@app.delete("/api/documents/{doc_id}")
async def delete_document(
    doc_id: str,
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    try:
        oid = ObjectId(doc_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid document ID")

    doc = await db.medical_documents.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    await verify_delegated_access(current_user, doc.get("owner_id"), "full")

    file_url = doc.get("file_url", "")
    if "/uploads/" in file_url:
        filename = file_url.split("/uploads/")[-1]
        disk_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(disk_path):
            try:
                os.remove(disk_path)
            except Exception as e:
                print(f"Error removing file {disk_path}: {e}")

    await db.medical_documents.delete_one({"_id": oid})
    return {"status": "deleted"}

# --- Family & Caregiver Delegation Endpoints ---
@app.post("/api/family/generate-code", response_model=FamilyInviteResponse)
async def generate_family_invite_code(current_user: dict = Depends(get_current_user)):
    await db.family_invites.delete_many({"patient_id": current_user["id"]})

    code = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    expires_at = datetime.utcnow() + timedelta(hours=24)

    invite_doc = {
        "patient_id": current_user["id"],
        "patient_name": current_user.get("full_name", "Family Member"),
        "patient_email": current_user.get("email", ""),
        "invite_code": code,
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": expires_at.isoformat(),
    }
    await db.family_invites.insert_one(invite_doc)
    return FamilyInviteResponse(invite_code=code, expires_at=expires_at.isoformat())

@app.post("/api/family/join")
async def join_family(
    payload: FamilyJoinPayload,
    current_user: dict = Depends(get_current_user),
):
    code = payload.invite_code.strip().upper()
    invite = await db.family_invites.find_one({"invite_code": code})
    if not invite:
        raise HTTPException(
            status_code=404,
            detail="Invalid invite code. Please verify the 6-character code with your family member."
        )

    expires_at = datetime.fromisoformat(invite["expires_at"])
    if datetime.utcnow() > expires_at:
        await db.family_invites.delete_one({"_id": invite["_id"]})
        raise HTTPException(status_code=400, detail="Invite code has expired. Please request a new one.")

    patient_id = invite["patient_id"]
    if patient_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="You cannot pair as caregiver to your own account.")

    existing_link = await db.family_links.find_one({
        "patient_id": patient_id,
        "caregiver_id": current_user["id"],
    })
    if existing_link:
        return {
            "status": "already_connected",
            "message": "Already connected to this family member.",
            "link_id": str(existing_link["_id"]),
            "patient_id": patient_id,
        }

    link_doc = {
        "patient_id": patient_id,
        "caregiver_id": current_user["id"],
        "relationship": payload.relationship.strip() or "Caregiver",
        "permissions": "full",
        "status": "active",
        "created_at": datetime.utcnow().isoformat(),
    }
    res = await db.family_links.insert_one(link_doc)

    patient = await db.users.find_one({"_id": ObjectId(patient_id)})
    return {
        "status": "connected",
        "link_id": str(res.inserted_id),
        "patient_id": patient_id,
        "patient_name": patient.get("full_name", "Family Member") if patient else "Family Member",
        "relationship": link_doc["relationship"],
    }

@app.get("/api/family/members", response_model=FamilyMembersResponse)
async def get_family_members(current_user: dict = Depends(get_current_user)):
    # 1. Caregivers connected to current user (current_user is patient)
    cg_cursor = db.family_links.find({"patient_id": current_user["id"], "status": "active"})
    cg_links = [doc async for doc in cg_cursor]
    caregivers = []
    for link in cg_links:
        try:
            cg_user = await db.users.find_one({"_id": ObjectId(link["caregiver_id"])})
            caregivers.append({
                "link_id": str(link["_id"]),
                "user_id": link["caregiver_id"],
                "full_name": cg_user.get("full_name", "Caregiver") if cg_user else "Caregiver",
                "email": cg_user.get("email", "") if cg_user else "",
                "relationship": link.get("relationship", "Caregiver"),
                "permissions": link.get("permissions", "full"),
                "status": link.get("status", "active"),
                "created_at": link.get("created_at", ""),
            })
        except Exception:
            pass

    # 2. Patients current user can manage (current_user is caregiver)
    pt_cursor = db.family_links.find({"caregiver_id": current_user["id"], "status": "active"})
    pt_links = [doc async for doc in pt_cursor]
    patients = []
    for link in pt_links:
        try:
            pt_user = await db.users.find_one({"_id": ObjectId(link["patient_id"])})
            patients.append({
                "link_id": str(link["_id"]),
                "patient_id": link["patient_id"],
                "full_name": pt_user.get("full_name", "Family Member") if pt_user else "Family Member",
                "email": pt_user.get("email", "") if pt_user else "",
                "relationship": link.get("relationship", "Family Member"),
                "permissions": link.get("permissions", "full"),
                "status": link.get("status", "active"),
                "created_at": link.get("created_at", ""),
            })
        except Exception:
            pass

    # 3. Active invite code generated by current user
    active_invite = await db.family_invites.find_one({
        "patient_id": current_user["id"],
        "expires_at": {"$gt": datetime.utcnow().isoformat()},
    })

    return FamilyMembersResponse(
        caregivers=caregivers,
        patients=patients,
        active_invite=serialize_doc(active_invite) if active_invite else None,
    )

@app.delete("/api/family/revoke/{link_id}")
async def revoke_family_link(link_id: str, current_user: dict = Depends(get_current_user)):
    try:
        oid = ObjectId(link_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid link ID")

    link = await db.family_links.find_one({"_id": oid})
    if not link:
        raise HTTPException(status_code=404, detail="Family link not found")

    if link.get("patient_id") != current_user["id"] and link.get("caregiver_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to revoke this link")

    await db.family_links.delete_one({"_id": oid})
    return {"status": "revoked"}

# --- Patient Profile & Clinical Advice Endpoints ---

async def get_or_create_profile(owner_id: str) -> dict:
    profile = await db.patient_profiles.find_one({"owner_id": owner_id})
    if not profile:
        # Pre-populate full_name from users collection if available
        user_name = ""
        try:
            user_doc = await db.users.find_one({"_id": ObjectId(owner_id)})
            if user_doc:
                user_name = user_doc.get("full_name", "")
        except Exception:
            pass

        default_profile = {
            "owner_id": owner_id,
            "personal_info": {
                "full_name": user_name,
                "age": None,
                "gender": "",
                "blood_group": "",
                "emergency_contact": "",
                "height_cm": None,
                "weight_kg": None,
            },
            "health_conditions": [],
            "allergies": [],
            "doctor_notes": [],
            "updated_at": datetime.utcnow().isoformat(),
        }
        res = await db.patient_profiles.insert_one(default_profile)
        default_profile["_id"] = res.inserted_id
        profile = default_profile
    return profile

@app.get("/api/profile")
async def get_patient_profile(
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    effective_id = await verify_delegated_access(current_user, patient_id, "view")
    profile = await get_or_create_profile(effective_id)

    can_edit = True
    is_caregiver = (effective_id != current_user["id"])
    if is_caregiver:
        link = await db.family_links.find_one({
            "patient_id": effective_id,
            "caregiver_id": current_user["id"],
            "status": "active",
        })
        if link and link.get("permissions") == "view":
            can_edit = False

    data = serialize_doc(profile)
    data["is_caregiver"] = is_caregiver
    data["can_edit"] = can_edit
    return data

@app.put("/api/profile")
async def update_patient_profile(
    payload: PatientProfileUpdate,
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    effective_id = await verify_delegated_access(current_user, patient_id, "full")
    await get_or_create_profile(effective_id)

    update_fields = {"updated_at": datetime.utcnow().isoformat()}
    if payload.personal_info is not None:
        p_info = payload.personal_info.model_dump()
        update_fields["personal_info"] = p_info
    if payload.allergies is not None:
        clean_allergies = list(dict.fromkeys([a.strip() for a in payload.allergies if a and a.strip()]))
        update_fields["allergies"] = clean_allergies

    await db.patient_profiles.update_one(
        {"owner_id": effective_id},
        {"$set": update_fields}
    )

    updated_doc = await db.patient_profiles.find_one({"owner_id": effective_id})
    data = serialize_doc(updated_doc)
    data["is_caregiver"] = (effective_id != current_user["id"])
    data["can_edit"] = True
    return data

@app.post("/api/profile/conditions")
async def add_condition(
    payload: ConditionCreate,
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    effective_id = await verify_delegated_access(current_user, patient_id, "full")
    await get_or_create_profile(effective_id)

    condition_id = f"cond_{uuid.uuid4().hex[:8]}"
    condition_item = {
        "id": condition_id,
        "condition_name": payload.condition_name.strip(),
        "diagnosed_date": payload.diagnosed_date.strip() if payload.diagnosed_date else datetime.utcnow().strftime("%Y-%m-%d"),
        "severity": payload.severity.strip() if payload.severity else "Moderate",
        "status": payload.status.strip() if payload.status else "active",
    }

    await db.patient_profiles.update_one(
        {"owner_id": effective_id},
        {
            "$push": {"health_conditions": condition_item},
            "$set": {"updated_at": datetime.utcnow().isoformat()}
        }
    )
    return condition_item

@app.delete("/api/profile/conditions/{cond_id}")
async def delete_condition(
    cond_id: str,
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    effective_id = await verify_delegated_access(current_user, patient_id, "full")
    res = await db.patient_profiles.update_one(
        {"owner_id": effective_id},
        {
            "$pull": {"health_conditions": {"id": cond_id}},
            "$set": {"updated_at": datetime.utcnow().isoformat()}
        }
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"status": "deleted", "id": cond_id}

@app.post("/api/profile/doctor-notes")
async def add_doctor_note(
    payload: DoctorNoteCreate,
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    effective_id = await verify_delegated_access(current_user, patient_id, "full")
    await get_or_create_profile(effective_id)

    note_id = f"note_{uuid.uuid4().hex[:8]}"
    clean_tags = [t.strip() for t in (payload.tags or []) if t and t.strip()]
    note_item = {
        "id": note_id,
        "doctor_name": payload.doctor_name.strip(),
        "specialty": payload.specialty.strip() if payload.specialty else "General Physician",
        "visit_date": payload.visit_date.strip() if payload.visit_date else datetime.utcnow().strftime("%Y-%m-%d"),
        "advice_text": payload.advice_text.strip(),
        "tags": clean_tags,
        "created_at": datetime.utcnow().isoformat(),
    }

    await db.patient_profiles.update_one(
        {"owner_id": effective_id},
        {
            "$push": {"doctor_notes": {"$each": [note_item], "$position": 0}},
            "$set": {"updated_at": datetime.utcnow().isoformat()}
        }
    )
    return note_item

@app.delete("/api/profile/doctor-notes/{note_id}")
async def delete_doctor_note(
    note_id: str,
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    effective_id = await verify_delegated_access(current_user, patient_id, "full")
    res = await db.patient_profiles.update_one(
        {"owner_id": effective_id},
        {
            "$pull": {"doctor_notes": {"id": note_id}},
            "$set": {"updated_at": datetime.utcnow().isoformat()}
        }
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"status": "deleted", "id": note_id}

# --- Prescription Photo & Medical Report Endpoints ---

@app.post("/api/reports/upload")
async def upload_prescription_photo(
    file: UploadFile = File(...),
    title: str = Form(...),
    doctor_name: Optional[str] = Form(""),
    notes: Optional[str] = Form(""),
    patient_id: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    effective_id = await verify_delegated_access(current_user, patient_id, "full")

    clean_name = os.path.basename(file.filename or "prescription.jpg")
    ext = os.path.splitext(clean_name)[1].lower()
    allowed_exts = {".jpg", ".jpeg", ".png", ".webp"}
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed image formats: JPG, JPEG, PNG, WEBP."
        )

    unique_filename = f"report_{uuid.uuid4().hex[:12]}{ext}"
    file_path = os.path.join(REPORTS_DIR, unique_filename)

    content = await file.read()
    file_size = len(content)

    with open(file_path, "wb") as f:
        f.write(content)

    photo_url = f"/uploads/reports/{unique_filename}"
    doc = {
        "owner_id": effective_id,
        "uploaded_by": current_user["id"],
        "title": title.strip(),
        "doctor_name": (doctor_name or "").strip(),
        "notes": (notes or "").strip(),
        "photo_url": photo_url,
        "file_name": clean_name,
        "file_size": file_size,
        "upload_date": datetime.utcnow().strftime("%Y-%m-%d"),
        "created_at": datetime.utcnow().isoformat(),
    }
    res = await db.prescription_photos.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_doc(doc)

@app.get("/api/reports")
async def get_prescription_photos(
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    effective_id = await verify_delegated_access(current_user, patient_id, "view")
    cursor = db.prescription_photos.find({"owner_id": effective_id}).sort("created_at", -1)
    return [serialize_doc(doc) async for doc in cursor]

@app.delete("/api/reports/{id}")
async def delete_prescription_photo(
    id: str,
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid report photo ID")

    doc = await db.prescription_photos.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Prescription photo not found")

    await verify_delegated_access(current_user, doc.get("owner_id"), "full")

    # Delete physical file
    photo_url = doc.get("photo_url", "")
    if "/uploads/reports/" in photo_url:
        filename = photo_url.split("/uploads/reports/")[-1]
        disk_path = os.path.join(REPORTS_DIR, filename)
        if os.path.exists(disk_path):
            try:
                os.remove(disk_path)
            except Exception:
                pass

    await db.prescription_photos.delete_one({"_id": oid})
    return {"status": "deleted", "id": id}

@app.get("/api/reports/doctor-summary-pdf")
async def get_doctor_summary_pdf(
    patient_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    effective_id = await verify_delegated_access(current_user, patient_id, "view")

    # 1. Profile Data
    profile = await get_or_create_profile(effective_id)

    # 2. Active Medications
    med_cursor = db.medicines.find({"owner_id": effective_id})
    medicines = [serialize_doc(m) async for m in med_cursor]

    # 3. 30-Day Adherence Stats
    today = date.today()
    start_date_30 = (today - timedelta(days=29)).isoformat()

    logs_cursor = db.intake_logs.find({
        "owner_id": effective_id,
        "date": {"$gte": start_date_30}
    })
    logs_30 = [l async for l in logs_cursor]
    taken_doses = sum(1 for l in logs_30 if l.get("status") == "taken")
    missed_doses = sum(1 for l in logs_30 if l.get("status") == "missed")
    total_decided = taken_doses + missed_doses
    if total_decided > 0:
        adherence_pct = round((taken_doses / total_decided) * 100, 1)
    else:
        adherence_pct = 100.0 if len(medicines) > 0 else 0.0

    # 4. Streak
    streak_days = 0
    try:
        date_status_map = {}
        for l in logs_30:
            d = l.get("date")
            if d not in date_status_map:
                date_status_map[d] = []
            date_status_map[d].append(l.get("status"))

        cur = today
        while True:
            d_str = cur.isoformat()
            st_list = date_status_map.get(d_str, [])
            if "taken" in st_list:
                streak_days += 1
                cur -= timedelta(days=1)
            elif cur == today and not st_list:
                # If no logs yet today, check yesterday
                cur -= timedelta(days=1)
            else:
                break
    except Exception:
        streak_days = 0

    adherence_data = {
        "adherence_pct": adherence_pct,
        "streak_days": streak_days,
        "taken_doses": taken_doses,
        "missed_doses": missed_doses,
    }

    # 5. Doctor Notes
    doctor_notes = profile.get("doctor_notes", [])

    # 6. Generate PDF
    pdf_bytes = generate_doctor_summary_pdf(
        patient_data=profile,
        medicines=medicines,
        adherence_data=adherence_data,
        doctor_notes=doctor_notes,
    )

    filename = f"Doctor_Summary_{patient_id or current_user['id'][:6]}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\"",
            "Cache-Control": "no-cache",
        },
    )

# --- Database Ping ---
@app.get("/api/db-check")
async def db_check():
    try:
        await db.command("ping")
        return {"status": "connected", "database": db.name}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- SPA Client-Side Routing Handler for Frontend ---
if os.path.exists(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend_assets")

    @app.get("/{full_path:path}")
    async def serve_spa_frontend(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("uploads/"):
            raise HTTPException(status_code=404, detail="Not Found")
        target_file = os.path.join(FRONTEND_DIST, full_path)
        if full_path and os.path.isfile(target_file):
            return FileResponse(target_file)
        index_file = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Frontend index not found")