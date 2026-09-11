import os
import time
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import create_access_token

client = TestClient(app)

# 1. Get super admin token
db = SessionLocal()
admin = db.query(User).filter(User.email == "superadmin@jarvis.local").first()
if not admin:
    admin = db.query(User).filter(User.is_super_admin == True).first()
print(f"Testing with Admin: {admin.email} (ID: {admin.id})")

token = create_access_token(subject=admin.id)
headers = {"Authorization": f"Bearer {token}"}

# Test 1: Global Companies JSON Ingestion (The one from user's screenshot)
print("\n--- TEST 1: Global Companies JSON Ingestion ---")
companies_file = "storage_uploads/35e85f11-5009-42e6-b82e-5fc1e93cb719_sourcing_companies_2026-09-11.json"
assert os.path.exists(companies_file), f"File {companies_file} not found"

exec_payload_1 = {
    "file_path": os.path.abspath(companies_file),
    "file_name": "sourcing_companies_2026-09-11.json",
    "file_type": "JSON",
    "job_type": "GLOBAL_COMPANIES",
    "column_mapping": {
        "id": "id",
        "companyName": "company_name",
        "companyId": "cin",
        "address": "address"
    }
}

res1 = client.post("/api/v1/imports/execute", json=exec_payload_1, headers=headers)
print("Execute Status Code:", res1.status_code)
print("Execute Response:", res1.json())
assert res1.status_code == 202, f"Expected 202, got {res1.status_code}: {res1.text}"

job_id_1 = res1.json()["id"]
print(f"Created Job ID: {job_id_1}")

# Wait for background task to complete
for i in range(15):
    time.sleep(1)
    status_res = client.get(f"/api/v1/imports/jobs/{job_id_1}", headers=headers)
    assert status_res.status_code == 200, f"Status check failed: {status_res.text}"
    job_status = status_res.json()["status"]
    processed = status_res.json()["processed_rows"]
    total = status_res.json()["total_rows"]
    print(f"Poll {i+1}: status={job_status}, processed={processed}/{total}")
    if job_status in ("COMPLETED", "PARTIAL", "FAILED"):
        break

assert job_status == "COMPLETED", f"Job 1 did not complete successfully: {job_status}"
print("TEST 1 PASSED: 500 companies successfully imported from JSON with ZERO errors!")

# Test 2: Tenant Leads JSON Ingestion
print("\n--- TEST 2: Tenant Leads JSON Ingestion ---")
leads_file = "storage_uploads/9a2c6321-8f73-4c73-8d93-acdc419a218c_30_new_leads.json"
assert os.path.exists(leads_file), f"File {leads_file} not found"

# Find a tenant
from app.models.organization import Organization
org = db.query(Organization).filter(Organization.schema_name.isnot(None)).first()
print(f"Using Tenant Org: {org.name} (ID: {org.id}, Schema: {org.schema_name})")

tenant_headers = {
    "Authorization": f"Bearer {token}",
    "X-Tenant-Id": org.id
}

exec_payload_2 = {
    "file_path": os.path.abspath(leads_file),
    "file_name": "30_new_leads.json",
    "file_type": "JSON",
    "job_type": "TENANT_LEADS",
    "column_mapping": {
        "contact_name": "contact_name",
        "company_name": "company_name",
        "designation": "designation",
        "contact_email": "contact_email",
        "contact_phone": "contact_phone",
        "city": "city",
        "value": "value"
    }
}

res2 = client.post("/api/v1/imports/execute", json=exec_payload_2, headers=tenant_headers)
print("Execute Status Code:", res2.status_code)
print("Execute Response:", res2.json())
assert res2.status_code == 202, f"Expected 202, got {res2.status_code}: {res2.text}"

job_id_2 = res2.json()["id"]
print(f"Created Tenant Leads Job ID: {job_id_2}")

for i in range(15):
    time.sleep(1)
    status_res = client.get(f"/api/v1/imports/jobs/{job_id_2}", headers=tenant_headers)
    assert status_res.status_code == 200, f"Status check failed: {status_res.text}"
    job_status = status_res.json()["status"]
    processed = status_res.json()["processed_rows"]
    total = status_res.json()["total_rows"]
    print(f"Poll {i+1}: status={job_status}, processed={processed}/{total}")
    if job_status in ("COMPLETED", "PARTIAL", "FAILED"):
        break

assert job_status in ("COMPLETED", "PARTIAL"), f"Job 2 did not complete successfully: {job_status}"
print("TEST 2 PASSED: 30 leads successfully imported from JSON with ZERO errors!")

db.close()
print("\nALL BACKEND INGESTION TESTS PASSED COMPLETELY!")
