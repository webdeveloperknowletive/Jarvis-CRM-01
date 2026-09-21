"""Organization-local business date helpers.

Timestamps are persisted in UTC.  Anything that represents a business day
(targets, attendance and daily reporting) must be calculated in the tenant's
configured timezone instead of from the host machine's UTC date.
"""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from app.models.organization import Organization


def organization_timezone(db: Session, organization_id: str) -> ZoneInfo:
    organization = db.query(Organization).filter(Organization.id == organization_id).first()
    timezone_name = organization.timezone if organization and organization.timezone else "Asia/Kolkata"
    try:
        return ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        # A bad tenant setting must not silently move work into the server's
        # local timezone.  The documented application fallback is explicit.
        return ZoneInfo("Asia/Kolkata")


def organization_business_date(db: Session, organization_id: str, now: datetime | None = None):
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return current.astimezone(organization_timezone(db, organization_id)).date()
