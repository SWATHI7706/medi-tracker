from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]

class MedicineSchema(BaseModel):
    name: str
    dosage: str
    times: List[str]
    category: Optional[str] = "After Food"
    total_stock: Optional[int] = 30
    refill_threshold: Optional[int] = 5
    dose_unit: Optional[str] = "pills"
    owner_id: Optional[str] = None

class MedicineUpdate(BaseModel):
    name: Optional[str] = None
    dosage: Optional[str] = None
    times: Optional[List[str]] = None
    category: Optional[str] = None
    total_stock: Optional[int] = None
    refill_threshold: Optional[int] = None
    dose_unit: Optional[str] = None

class RefillPayload(BaseModel):
    refill_amount: int

class IntakeLogSchema(BaseModel):
    medicine_id: str
    date: str
    time: str
    status: str
    owner_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class DocumentResponse(BaseModel):
    id: str
    owner_id: str
    title: str
    doc_type: str
    file_url: str
    file_name: str
    file_size: int
    notes: Optional[str] = ""
    uploaded_at: str

class FamilyInviteResponse(BaseModel):
    invite_code: str
    expires_at: str

class FamilyJoinPayload(BaseModel):
    invite_code: str
    relationship: str

class FamilyLinkMember(BaseModel):
    link_id: str
    user_id: str
    full_name: str
    email: str
    relationship: str
    permissions: str
    status: str
    created_at: str

class FamilyMembersResponse(BaseModel):
    caregivers: List[Dict[str, Any]]
    patients: List[Dict[str, Any]]
    active_invite: Optional[Dict[str, Any]] = None

class PersonalInfoSchema(BaseModel):
    full_name: Optional[str] = ""
    age: Optional[int] = None
    gender: Optional[str] = ""
    blood_group: Optional[str] = ""
    emergency_contact: Optional[str] = ""
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None

class ConditionCreate(BaseModel):
    condition_name: str
    diagnosed_date: Optional[str] = ""
    severity: Optional[str] = "Moderate"
    status: Optional[str] = "active"

class ConditionSchema(BaseModel):
    id: str
    condition_name: str
    diagnosed_date: Optional[str] = ""
    severity: Optional[str] = "Moderate"
    status: Optional[str] = "active"

class DoctorNoteCreate(BaseModel):
    doctor_name: str
    specialty: Optional[str] = "General Physician"
    visit_date: Optional[str] = ""
    advice_text: str
    tags: Optional[List[str]] = []

class DoctorNoteSchema(BaseModel):
    id: str
    doctor_name: str
    specialty: Optional[str] = "General Physician"
    visit_date: Optional[str] = ""
    advice_text: str
    tags: Optional[List[str]] = []
    created_at: Optional[str] = None

class PatientProfileUpdate(BaseModel):
    personal_info: Optional[PersonalInfoSchema] = None
    allergies: Optional[List[str]] = None

class PatientProfileResponse(BaseModel):
    id: Optional[str] = None
    owner_id: str
    personal_info: PersonalInfoSchema
    health_conditions: List[ConditionSchema] = []
    allergies: List[str] = []
    doctor_notes: List[DoctorNoteSchema] = []
    updated_at: Optional[str] = None
    is_caregiver: Optional[bool] = False
    can_edit: Optional[bool] = True