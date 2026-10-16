import uuid
import requests
import io

API_URL = "http://127.0.0.1:8000"

# Minimal 1x1 valid PNG bytes for testing image upload
MINIMAL_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff"
    b"?\x00\x05\xfe\x02\xfe\xa745\xa6\x00\x00\x00\x00IEND\xaeB`\x82"
)

def test_reports_and_pdf_suite():
    suffix = uuid.uuid4().hex[:6]

    print("--- 1. Register Patient User ---")
    patient_email = f"report_patient_{suffix}@example.com"
    reg_res = requests.post(f"{API_URL}/api/auth/register", json={
        "email": patient_email,
        "password": "Password123!",
        "full_name": f"Alice Morgan {suffix}"
    })
    assert reg_res.status_code in (200, 201), f"Register failed: {reg_res.text}"
    patient_token = reg_res.json()["access_token"]
    patient_id = reg_res.json()["user"]["id"]
    patient_headers = {"Authorization": f"Bearer {patient_token}"}
    print(f"Patient registered: {patient_id}")

    print("--- 2. Populate Patient Profile & Prescriptions ---")
    # Update profile vitals & allergies
    requests.put(f"{API_URL}/api/profile", headers=patient_headers, json={
        "personal_info": {
            "full_name": f"Alice Morgan {suffix}",
            "age": 38,
            "gender": "Female",
            "blood_group": "A+",
            "height_cm": 165.0,
            "weight_kg": 60.0,
            "emergency_contact": "+1 (555) 432-1098"
        },
        "allergies": ["Penicillin", "Peanuts"]
    })

    # Add chronic condition
    requests.post(f"{API_URL}/api/profile/conditions", headers=patient_headers, json={
        "condition_name": "Asthma",
        "diagnosed_date": "2023-04-15",
        "severity": "Moderate",
        "status": "active"
    })

    # Add doctor note
    requests.post(f"{API_URL}/api/profile/doctor-notes", headers=patient_headers, json={
        "doctor_name": "Dr. Robert Chen",
        "specialty": "Pulmonology",
        "visit_date": "2026-08-15",
        "advice_text": "Inhaler use twice daily. Avoid dusty environments. Return for spirometry in 6 months.",
        "tags": ["Inhaler", "Asthma", "Spirometry"]
    })

    # Add prescription medicine
    requests.post(f"{API_URL}/api/medicines", headers=patient_headers, json={
        "name": "Albuterol Inhaler",
        "dosage": "90mcg",
        "times": ["08:00", "20:00"],
        "category": "With Water",
        "total_stock": 45,
        "refill_threshold": 10,
        "dose_unit": "puffs"
    })
    print("Patient clinical health profile populated!")

    print("--- 3. Upload Prescription Photo (POST /api/reports/upload) ---")
    files = {
        "file": ("clinic_prescription.png", MINIMAL_PNG, "image/png")
    }
    data = {
        "title": "Cardiologist Visit - Sep 2026",
        "doctor_name": "Dr. Gregory House",
        "notes": "Original stamped prescription for blood pressure and inhaler refill."
    }
    upload_res = requests.post(f"{API_URL}/api/reports/upload", headers=patient_headers, files=files, data=data)
    assert upload_res.status_code == 200, f"Upload failed: {upload_res.text}"
    photo_doc = upload_res.json()
    assert photo_doc["title"] == "Cardiologist Visit - Sep 2026"
    assert photo_doc["doctor_name"] == "Dr. Gregory House"
    assert photo_doc["notes"] == "Original stamped prescription for blood pressure and inhaler refill."
    assert "photo_url" in photo_doc
    assert "/uploads/reports/" in photo_doc["photo_url"]
    photo_id = photo_doc["id"]
    print(f"Prescription photo uploaded successfully! ID: {photo_id}")

    print("--- 4. Verify Static File Serving of Report Photo ---")
    static_res = requests.get(photo_doc["photo_url"])
    assert static_res.status_code == 200, f"Static fetch failed: {static_res.status_code}"
    assert static_res.content == MINIMAL_PNG, "Static content does not match uploaded PNG"
    print("Report photo static file serving verified!")

    print("--- 5. List Prescription Photos (GET /api/reports) ---")
    list_res = requests.get(f"{API_URL}/api/reports", headers=patient_headers)
    assert list_res.status_code == 200, f"List failed: {list_res.text}"
    photos = list_res.json()
    assert len(photos) >= 1
    assert any(p["id"] == photo_id for p in photos)
    print("Prescription photos list verified!")

    print("--- 6. Generate Doctor Visit Summary PDF (GET /api/reports/doctor-summary-pdf) ---")
    pdf_res = requests.get(f"{API_URL}/api/reports/doctor-summary-pdf", headers=patient_headers)
    assert pdf_res.status_code == 200, f"PDF export failed: {pdf_res.status_code} - {pdf_res.text}"
    assert "application/pdf" in pdf_res.headers.get("Content-Type", ""), "Response is not application/pdf"
    assert pdf_res.content.startswith(b"%PDF-"), "Response does not have PDF magic bytes"
    assert len(pdf_res.content) > 1000, "Generated PDF is unexpectedly small"
    print(f"Doctor Visit Summary PDF successfully generated! Size: {len(pdf_res.content)} bytes")

    print("--- 7. Caregiver Delegation for Reports & PDF Export ---")
    # Register Caregiver
    cg_res = requests.post(f"{API_URL}/api/auth/register", json={
        "email": f"cg_{suffix}@example.com",
        "password": "Password123!",
        "full_name": f"Caregiver Charlie {suffix}"
    })
    assert cg_res.status_code in (200, 201)
    cg_token = cg_res.json()["access_token"]
    cg_headers = {"Authorization": f"Bearer {cg_token}"}

    # Invite & Join
    code = requests.post(f"{API_URL}/api/family/generate-code", headers=patient_headers).json()["invite_code"]
    requests.post(f"{API_URL}/api/family/join", headers=cg_headers, json={"invite_code": code, "relationship": "Spouse"})

    # Caregiver fetches Patient's reports
    cg_reports_res = requests.get(f"{API_URL}/api/reports?patient_id={patient_id}", headers=cg_headers)
    assert cg_reports_res.status_code == 200
    cg_reports = cg_reports_res.json()
    assert any(p["id"] == photo_id for p in cg_reports)
    print("Caregiver delegated view of patient reports verified!")

    # Caregiver downloads Patient's Doctor Summary PDF
    cg_pdf_res = requests.get(f"{API_URL}/api/reports/doctor-summary-pdf?patient_id={patient_id}", headers=cg_headers)
    assert cg_pdf_res.status_code == 200
    assert cg_pdf_res.content.startswith(b"%PDF-")
    print("Caregiver delegated PDF download verified!")

    print("--- 8. Delete Prescription Photo (DELETE /api/reports/{id}) ---")
    del_res = requests.delete(f"{API_URL}/api/reports/{photo_id}", headers=patient_headers)
    assert del_res.status_code == 200
    after_del = requests.get(f"{API_URL}/api/reports", headers=patient_headers).json()
    assert not any(p["id"] == photo_id for p in after_del)
    print("Prescription photo deletion verified!")

    print("ALL PRESCRIPTION PHOTO UPLOADER & DOCTOR VISIT SUMMARY PDF TESTS PASSED!")

if __name__ == "__main__":
    test_reports_and_pdf_suite()
