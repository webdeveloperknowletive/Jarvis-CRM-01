import os
import json
import time
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import create_access_token

client = TestClient(app)
db = SessionLocal()
admin = db.query(User).filter(User.email == "superadmin@jarvis.local").first()
token = create_access_token(subject=admin.id)
headers = {"Authorization": f"Bearer {token}"}

# Create a sample JSON file for Global People
people_data = [
    {
        "full_name": "Satya Nadella",
        "company_name": "Microsoft Corp",
        "designation": "Chief Executive Officer",
        "email": "satya.nadella@example.com",
        "phone": "+1 425 882 8080",
        "location": "Redmond, WA",
        "linkedin_url": "https://linkedin.com/in/satyanadella"
    },
    {
        "full_name": "Sundar Pichai",
        "company_name": "Google LLC",
        "designation": "CEO",
        "email": "sundar.pichai@example.com",
        "phone": "+1 650 253 0000",
        "location": "Mountain View, CA",
        "linkedin_url": "https://linkedin.com/in/sundarpichai"
    }
]

people_file = os.path.abspath("storage_uploads/test_people_sample.json")
os.makedirs(os.path.dirname(people_file), exist_ok=True)
with open(people_file, "w", encoding="utf-8") as f:
    json.dump(people_data, f, indent=2)

exec_payload = {
    "file_path": people_file,
    "file_name": "test_people_sample.json",
    "file_type": "JSON",
    "job_type": "GLOBAL_PEOPLE",
    "column_mapping": {
        "full_name": "contact_name",
        "company_name": "company_name",
        "designation": "designation",
        "email": "contact_email",
        "phone": "contact_phone",
        "location": "city",
        "linkedin_url": "linkedin_url"
    }
}

res = client.post("/api/v1/imports/execute", json=exec_payload, headers=headers)
print("Execute Status Code:", res.status_code)
assert res.status_code == 202, f"Expected 202: {res.text}"
job_id = res.json()["id"]

for i in range(10):
    time.sleep(1)
    status_res = client.get(f"/api/v1/imports/jobs/{job_id}", headers=headers)
    data = status_res.json()
    print(f"Poll {i+1}: status={data.get('status')}, processed={data.get('processed_rows')}/{data.get('total_rows')}")
    if data.get("status") in ("COMPLETED", "PARTIAL", "FAILED"):
        break

assert data.get("status") == "COMPLETED", f"People import failed: {data}"
print("TEST 3 PASSED: Global People imported from JSON with ZERO errors!")
db.close()
