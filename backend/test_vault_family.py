import os
import requests

API_URL = "http://127.0.0.1:8000"

def test_vault_and_family():
    print("Testing Vault & Family endpoints...")
    # 1. Register user A (Patient)
    import uuid
    suffix = uuid.uuid4().hex[:6]
    user_a = {
        "email": f"patient_{suffix}@example.com",
        "password": "Password123!",
        "full_name": f"Patient Alpha {suffix}"
    }
    r = requests.post(f"{API_URL}/api/auth/register", json=user_a)
    assert r.status_code == 201, f"Register A failed: {r.text}"
    token_a = r.json()["access_token"]
    user_a_id = r.json()["user"]["id"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Register user B (Caregiver)
    user_b = {
        "email": f"caregiver_{suffix}@example.com",
        "password": "Password123!",
        "full_name": f"Caregiver Beta {suffix}"
    }
    r = requests.post(f"{API_URL}/api/auth/register", json=user_b)
    assert r.status_code == 201, f"Register B failed: {r.text}"
    token_b = r.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 3. Patient A generates invite code
    r = requests.post(f"{API_URL}/api/family/generate-code", headers=headers_a)
    assert r.status_code == 200, f"Generate code failed: {r.text}"
    invite_code = r.json()["invite_code"]
    print(f"Generated invite code: {invite_code}")

    # 4. Caregiver B joins using code
    r = requests.post(f"{API_URL}/api/family/join", headers=headers_b, json={"invite_code": invite_code, "relationship": "Daughter"})
    assert r.status_code == 200, f"Join family failed: {r.text}"
    print(f"Caregiver joined: {r.json()}")

    # 5. Check family members for Caregiver B
    r = requests.get(f"{API_URL}/api/family/members", headers=headers_b)
    assert r.status_code == 200, f"Get members B failed: {r.text}"
    members_b = r.json()
    assert len(members_b["patients"]) >= 1, "Patient not found in B's list"
    assert members_b["patients"][0]["patient_id"] == user_a_id
    print("Caregiver has Patient A in delegated patients list!")

    # 6. Patient A uploads a document
    file_content = b"%PDF-1.4 simulated pdf test content"
    files = {"file": ("blood_report.pdf", file_content, "application/pdf")}
    data = {"title": "CBC Blood Test", "doc_type": "report", "notes": "Fasting blood test"}
    r = requests.post(f"{API_URL}/api/documents/upload", headers=headers_a, files=files, data=data)
    assert r.status_code == 200, f"Upload document failed: {r.text}"
    doc = r.json()
    doc_id = doc["id"]
    file_url = doc["file_url"]
    print(f"Uploaded doc: {doc_id} -> {file_url}")

    # 7. Check static file serving
    r = requests.get(file_url)
    assert r.status_code == 200, f"Static file serve failed: {r.status_code}"
    assert r.content == file_content, "Served file content mismatch"
    print("Static file serving verified!")

    # 8. Caregiver B accesses Patient A's documents via delegated access
    r = requests.get(f"{API_URL}/api/documents?patient_id={user_a_id}", headers=headers_b)
    assert r.status_code == 200, f"Caregiver get docs failed: {r.text}"
    b_docs = r.json()
    assert any(d["id"] == doc_id for d in b_docs), "Caregiver cannot see patient's doc"
    print("Delegated document access verified!")

    # 9. Caregiver B deletes doc on behalf of Patient A
    r = requests.delete(f"{API_URL}/api/documents/{doc_id}?patient_id={user_a_id}", headers=headers_b)
    assert r.status_code == 200, f"Delete doc failed: {r.text}"
    print("Delegated document deletion verified!")

    print("ALL BACKEND VAULT & FAMILY TESTS PASSED!")

if __name__ == "__main__":
    test_vault_and_family()
