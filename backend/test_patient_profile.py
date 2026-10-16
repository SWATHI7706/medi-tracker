import uuid
import requests

API_URL = "http://127.0.0.1:8000"

def test_patient_profile_suite():
    suffix = uuid.uuid4().hex[:6]

    print("--- 1. Register Patient User ---")
    patient_email = f"patient_{suffix}@example.com"
    reg_res = requests.post(f"{API_URL}/api/auth/register", json={
        "email": patient_email,
        "password": "Password123!",
        "full_name": f"Jane Doe {suffix}"
    })
    assert reg_res.status_code in (200, 201), f"Register failed: {reg_res.text}"
    patient_token = reg_res.json()["access_token"]
    patient_id = reg_res.json()["user"]["id"]
    patient_headers = {"Authorization": f"Bearer {patient_token}"}
    print(f"Patient registered: {patient_id}")

    print("--- 2. GET /api/profile (auto-initialize) ---")
    prof_res = requests.get(f"{API_URL}/api/profile", headers=patient_headers)
    assert prof_res.status_code == 200, f"Get profile failed: {prof_res.text}"
    profile = prof_res.json()
    assert profile["owner_id"] == patient_id
    assert profile["can_edit"] is True
    assert profile["is_caregiver"] is False
    assert profile["personal_info"]["full_name"] == f"Jane Doe {suffix}"
    assert profile["health_conditions"] == []
    assert profile["allergies"] == []
    assert profile["doctor_notes"] == []
    print("Auto-initialization verified!")

    print("--- 3. PUT /api/profile (update personal info & allergies) ---")
    update_res = requests.put(f"{API_URL}/api/profile", headers=patient_headers, json={
        "personal_info": {
            "full_name": f"Jane Doe {suffix}",
            "age": 42,
            "gender": "Female",
            "blood_group": "O+",
            "emergency_contact": "+1 (555) 234-5678",
            "height_cm": 168.0,
            "weight_kg": 64.5,
        },
        "allergies": ["Penicillin", "Peanuts", "  Sulfa Drugs  "]
    })
    assert update_res.status_code == 200, f"Update failed: {update_res.text}"
    updated = update_res.json()
    assert updated["personal_info"]["age"] == 42
    assert updated["personal_info"]["blood_group"] == "O+"
    assert updated["personal_info"]["height_cm"] == 168.0
    assert updated["personal_info"]["weight_kg"] == 64.5
    assert "Sulfa Drugs" in updated["allergies"]
    assert len(updated["allergies"]) == 3
    print("Profile update verified!")

    print("--- 4. POST /api/profile/conditions ---")
    cond1_res = requests.post(f"{API_URL}/api/profile/conditions", headers=patient_headers, json={
        "condition_name": "Type 2 Diabetes",
        "diagnosed_date": "2023-05-12",
        "severity": "Moderate",
        "status": "active"
    })
    assert cond1_res.status_code == 200, f"Add cond1 failed: {cond1_res.text}"
    cond1 = cond1_res.json()
    assert cond1["condition_name"] == "Type 2 Diabetes"
    assert cond1["id"].startswith("cond_")
    cond1_id = cond1["id"]

    cond2_res = requests.post(f"{API_URL}/api/profile/conditions", headers=patient_headers, json={
        "condition_name": "Hypertension",
        "diagnosed_date": "2024-01-10",
        "severity": "Chronic",
        "status": "managed"
    })
    assert cond2_res.status_code == 200
    cond2_id = cond2_res.json()["id"]

    # Verify both conditions in profile
    p = requests.get(f"{API_URL}/api/profile", headers=patient_headers).json()
    assert len(p["health_conditions"]) == 2
    print("Conditions added and verified!")

    print("--- 5. DELETE /api/profile/conditions/{cond_id} ---")
    del_cond = requests.delete(f"{API_URL}/api/profile/conditions/{cond2_id}", headers=patient_headers)
    assert del_cond.status_code == 200
    p = requests.get(f"{API_URL}/api/profile", headers=patient_headers).json()
    assert len(p["health_conditions"]) == 1
    assert p["health_conditions"][0]["id"] == cond1_id
    print("Condition deletion verified!")

    print("--- 6. POST /api/profile/doctor-notes ---")
    note_res = requests.post(f"{API_URL}/api/profile/doctor-notes", headers=patient_headers, json={
        "doctor_name": "Dr. Sarah Jenkins",
        "specialty": "Cardiology",
        "visit_date": "2026-08-20",
        "advice_text": "Maintain low sodium diet and 30 mins daily walking. Check BP morning and evening.",
        "tags": ["Diet", "Cardio", "BP Check"]
    })
    assert note_res.status_code == 200, f"Add note failed: {note_res.text}"
    note = note_res.json()
    assert note["id"].startswith("note_")
    assert note["doctor_name"] == "Dr. Sarah Jenkins"
    note_id = note["id"]

    p = requests.get(f"{API_URL}/api/profile", headers=patient_headers).json()
    assert len(p["doctor_notes"]) == 1
    assert p["doctor_notes"][0]["id"] == note_id
    print("Doctor note added and verified!")

    print("--- 7. DELETE /api/profile/doctor-notes/{note_id} ---")
    del_note = requests.delete(f"{API_URL}/api/profile/doctor-notes/{note_id}", headers=patient_headers)
    assert del_note.status_code == 200
    p = requests.get(f"{API_URL}/api/profile", headers=patient_headers).json()
    assert len(p["doctor_notes"]) == 0
    print("Doctor note deletion verified!")

    print("--- 8. Caregiver Delegation & Permissions ---")
    # Register Caregiver
    cg_res = requests.post(f"{API_URL}/api/auth/register", json={
        "email": f"caregiver_{suffix}@example.com",
        "password": "Password123!",
        "full_name": f"Nurse Bob {suffix}"
    })
    assert cg_res.status_code in (200, 201), f"Caregiver register failed: {cg_res.text}"
    cg_token = cg_res.json()["access_token"]
    cg_headers = {"Authorization": f"Bearer {cg_token}"}

    # Patient generates invite
    inv_res = requests.post(f"{API_URL}/api/family/generate-code", headers=patient_headers)
    assert inv_res.status_code == 200
    code = inv_res.json()["invite_code"]

    # Caregiver joins
    join_res = requests.post(f"{API_URL}/api/family/join", headers=cg_headers, json={
        "invite_code": code,
        "relationship": "Caregiver"
    })
    assert join_res.status_code == 200

    # Caregiver views Patient A profile
    cg_prof = requests.get(f"{API_URL}/api/profile?patient_id={patient_id}", headers=cg_headers)
    assert cg_prof.status_code == 200
    cg_p_data = cg_prof.json()
    assert cg_p_data["owner_id"] == patient_id
    assert cg_p_data["is_caregiver"] is True
    assert cg_p_data["can_edit"] is True
    print("Caregiver full delegated view verified!")

    # Caregiver adds doctor note on behalf of Patient A
    cg_add_note = requests.post(f"{API_URL}/api/profile/doctor-notes?patient_id={patient_id}", headers=cg_headers, json={
        "doctor_name": "Dr. Michael Chang",
        "specialty": "Endocrinology",
        "visit_date": "2026-09-01",
        "advice_text": "HbA1c test scheduled in 3 months. Continue current Metformin dosage.",
        "tags": ["Endo", "HbA1c"]
    })
    assert cg_add_note.status_code == 200
    print("Caregiver delegated write verified!")

    print("ALL PATIENT PROFILE & CLINICAL HUB BACKEND TESTS PASSED!")

if __name__ == "__main__":
    test_patient_profile_suite()
