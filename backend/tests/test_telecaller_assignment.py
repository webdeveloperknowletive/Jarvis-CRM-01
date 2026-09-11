import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_telecaller_scoping_and_batch_assignment(client):
    # 1. Login as Org Admin
    res = client.post("/api/v1/auth/login", json={"email": "admin@apex.com", "password": "ApexAdmin@2026"})
    assert res.status_code == 200
    org_token = res.json()["access_token"]
    org_headers = {"Authorization": f"Bearer {org_token}"}

    # 2. Get Telecallers
    res_tel = client.get("/api/v1/users/telecallers", headers=org_headers)
    assert res_tel.status_code == 200
    telecallers = res_tel.json()
    assert len(telecallers) >= 1
    telecaller = next(t for t in telecallers if t["email"] == "telecaller@apex.com")
    telecaller_id = telecaller["id"]

    # 3. Get leads and batch assign 5 leads
    res_leads = client.get("/api/v1/leads/", headers=org_headers)
    assert res_leads.status_code == 200
    all_leads = res_leads.json()
    assert len(all_leads) >= 5
    target_lead_ids = [l["id"] for l in all_leads[:5]]

    res_assign = client.post(
        "/api/v1/leads/batch-assign",
        json={"lead_ids": target_lead_ids, "telecaller_id": telecaller_id},
        headers=org_headers
    )
    assert res_assign.status_code == 200
    data = res_assign.json()
    assert data["updated_count"] == 5
    assert data["telecaller_id"] == telecaller_id

    # 4. Login as Telecaller and verify strictly sees assigned leads
    res_t_login = client.post("/api/v1/auth/login", json={"email": "telecaller@apex.com", "password": "Telecaller@2026"})
    assert res_t_login.status_code == 200
    tel_token = res_t_login.json()["access_token"]
    tel_headers = {"Authorization": f"Bearer {tel_token}"}

    res_t_leads = client.get("/api/v1/leads/", headers=tel_headers)
    assert res_t_leads.status_code == 200
    tel_leads = res_t_leads.json()
    
    # Verify every lead returned to telecaller has owner_id == telecaller_id
    assert len(tel_leads) >= 5
    for l in tel_leads:
        assert l["owner_id"] == telecaller_id
