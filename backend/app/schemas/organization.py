from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime, date
from decimal import Decimal


class PlanOut(BaseModel):
    id: str
    code: str
    name: str
    seat_limit: int
    monthly_pull_quota: int
    price_amount: Optional[Decimal] = None
    price_currency: str
    feature_flags: Dict[str, Any] = {}

    class Config:
        from_attributes = True


class OrganizationCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    timezone: Optional[str] = "Asia/Kolkata"
    currency: Optional[str] = "INR"
    admin_name: str
    admin_email: str
    admin_password: str
    plan_code: Optional[str] = "GROWTH"


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    timezone: Optional[str] = None
    currency: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class OrganizationOut(BaseModel):
    id: str
    name: str
    slug: str
    schema_name: Optional[str] = None
    status: str
    timezone: str
    currency: str
    settings: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SubscriptionOut(BaseModel):
    id: str
    organization_id: str
    plan_id: str
    status: str
    seats_purchased: int
    pull_quota_monthly: int
    pull_quota_used: int
    current_period_start: Optional[date] = None
    current_period_end: Optional[date] = None
    plan: Optional[PlanOut] = None

    class Config:
        from_attributes = True
