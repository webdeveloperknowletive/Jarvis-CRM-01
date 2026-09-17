from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from sqlalchemy import text

client = TestClient(app)
db = SessionLocal()

# Cleanup before test
db.execute(text("DELETE FROM organizations WHERE slug = 'adani-industries-ltd'"))
db.execute(text("DELETE FROM users WHERE email = 'admin@adani.com'"))
db.execute(text("DROP SCHEMA IF EXISTS adani_industries_ltd CASCADE"))
db.commit()

# 1. Login as Super Admin
sa_res = client.post("/api/v1/auth/login", json={"email": "superadmin@jarvis.local", "password": "JarvisAdmin@2026"})
sa_token = sa_res.json()["access_token"]

# 2. Create organization Adani Industries LTD.
res = client.post("/api/v1/organizations/", json={
    "name": "Adani Industries LTD.",
    "slug": "adani-industries-ltd",
    "admin_name": "Gautam Adani",
    "admin_email": "admin@adani.com",
    "admin_password": "AdaniAdmin@2026",
    "plan_code": "GROWTH"
}, headers={"Authorization": f"Bearer {sa_token}"})

org_login = client.post("/api/v1/auth/login", json={"email": "admin@adani.com", "password": "AdaniAdmin@2026"})
new_token = org_login.json()["access_token"]
new_headers = {"Authorization": f"Bearer {new_token}"}

new_leads_res = client.get("/api/v1/leads/", headers=new_headers)
print("LEADS RESPONSE:", new_leads_res.status_code, new_leads_res.text)

# Cleanup
db.execute(text("DELETE FROM organizations WHERE slug = 'adani-industries-ltd'"))
db.execute(text("DELETE FROM users WHERE email = 'admin@adani.com'"))
db.execute(text("DROP SCHEMA IF EXISTS adani_industries_ltd CASCADE"))
db.commit()
db.close()
