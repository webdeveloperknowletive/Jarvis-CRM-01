from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class GlobalContactOut(BaseModel):
    id: str
    registry_id: Optional[str] = None
    full_name: str
    designation: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    city: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


class GlobalCompanyOut(BaseModel):
    id: str
    registry_id: str  # CIN
    legal_name: str
    display_name: Optional[str] = None
    company_type: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str
    status: str
    contacts_count: int = 0
    first_seen_at: datetime
    last_updated_at: datetime

    class Config:
        from_attributes = True


class GlobalPullRequest(BaseModel):
    global_company_ids: List[str]
    target_stage_id: Optional[str] = None
    target_owner_id: Optional[str] = None


class GlobalPullResponse(BaseModel):
    pulled_companies: int
    pulled_contacts: int
    created_leads: int
    remaining_quota: int
