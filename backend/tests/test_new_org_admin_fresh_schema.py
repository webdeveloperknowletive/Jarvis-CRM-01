from fastapi.testclient import TestClient
from app.main import app
from sqlalchemy import text
from app.core.database import SessionLocal

def test_new_org_admin_isolated_schema_and_fresh_dashboard():
    client = TestClient(app)
    db = SessionLocal()

    # Cleanup before test
    db.execute(text("DELETE FROM organizations WHERE slug = 'adani-industries-ltd'"))
    db.execute(text("DELETE FROM users WHERE email = 'admin@adani.com'"))
    db.execute(text("DROP SCHEMA IF EXISTS adani_industries_ltd CASCADE"))
    db.commit()

    # 1. Login as Super Admin
    sa_res = client.post("/api/v1/auth/login", json={"email": "superadmin@jarvis.local", "password": "JarvisAdmin@2026"})
    assert sa_res.status_code == 200
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
    assert res.status_code == 201
    org_data = res.json()
    assert org_data["name"] == "Adani Industries LTD."

    # 3. Verify PostgreSQL schema exists and has 0 leads
    leads_in_schema = db.execute(text('SELECT count(*) FROM "adani_industries_ltd"."leads"')).scalar()
    assert leads_in_schema == 0

    stages_in_schema = db.execute(text('SELECT count(*) FROM "adani_industries_ltd"."pipeline_stages"')).scalar()
    assert stages_in_schema == 7

    # 4. Login as the new Org Admin
    org_login = client.post("/api/v1/auth/login", json={"email": "admin@adani.com", "password": "AdaniAdmin@2026"})
    assert org_login.status_code == 200
    new_token = org_login.json()["access_token"]
    new_headers = {"Authorization": f"Bearer {new_token}"}

    # 5. Check Leads list: Must be completely fresh (0 leads)
    new_leads = client.get("/api/v1/leads/", headers=new_headers).json()
    assert len(new_leads) == 0

    # 6. Check Pipeline stages: Exactly 7 default stages
    new_pipeline = client.get("/api/v1/pipelines/", headers=new_headers).json()
    assert "stages" in new_pipeline
    assert len(new_pipeline["stages"]) == 7

    # 7. Check Global Registry access (can see global companies)
    global_res = client.get("/api/v1/global/companies", headers=new_headers)
    assert global_res.status_code == 200
    assert len(global_res.json()) >= 1

    # Cleanup
    db.execute(text("DELETE FROM organizations WHERE slug = 'adani-industries-ltd'"))
    db.execute(text("DELETE FROM users WHERE email = 'admin@adani.com'"))
    db.execute(text("DROP SCHEMA IF EXISTS adani_industries_ltd CASCADE"))
    db.commit()
    db.close()
