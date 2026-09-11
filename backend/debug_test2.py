import os
import time
import traceback
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.models.organization import Organization
from app.core.security import create_access_token

client = TestClient(app)
db = SessionLocal()
admin = db.query(User).filter(User.email == "superadmin@jarvis.local").first()
if not admin:
    admin = db.query(User).filter(User.is_super_admin == True).first()
token = create_access_token(subject=admin.id)

leads_file = "storage_uploads/9a2c6321-8f73-4c73-8d93-acdc419a218c_30_new_leads.json"
org = db.query(Organization).filter(Organization.schema_name.isnot(None)).first()
print(f"Using Tenant Org: {org.name} (ID: {org.id}, Schema: {org.schema_name})")

tenant_headers = {
    "Authorization": f"Bearer {token}",
    "X-Tenant-Id": org.id
}

exec_payload = {
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

res = client.post("/api/v1/imports/execute", json=exec_payload, headers=tenant_headers)
print("Execute Status:", res.status_code, res.json())
job_id = res.json()["id"]

for i in range(15):
    time.sleep(1)
    status_res = client.get(f"/api/v1/imports/jobs/{job_id}", headers=tenant_headers)
    data = status_res.json()
    print(f"Poll {i+1}: status={data.get('status')}, processed={data.get('processed_rows')}/{data.get('total_rows')}, error_summary={data.get('error_summary')}")
    if data.get("status") in ("COMPLETED", "PARTIAL", "FAILED"):
        break

db.close()
