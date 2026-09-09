from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi import HTTPException, status

from app.models.activity import Activity
from app.models.lead import Lead
from app.models.user import User
from app.models.audit import AuditLog, RadarEvent
from app.schemas.activity import ActivityCreate, ActivityOut


def create_activity(
    db: Session,
    organization_id: str,
    user: User,
    data: ActivityCreate
) -> Activity:
    lead = None
    if data.lead_id:
        lead = db.query(Lead).filter(
            Lead.id == data.lead_id,
            Lead.organization_id == organization_id
        ).first()
        if not lead:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    activity = Activity(
        organization_id=organization_id,
        lead_id=data.lead_id,
        company_id=data.company_id or (lead.company_id if lead else None),
        contact_id=data.contact_id or (lead.contact_id if lead else None),
        user_id=user.id,
        activity_type=data.activity_type.upper(),
        subject=data.subject,
        description=data.description,
        direction=data.direction or "OUTBOUND",
        status=data.status or "COMPLETED",
        duration_seconds=data.duration_seconds or 0,
        metadata_json=data.metadata_json or {},
        occurred_at=datetime.now(timezone.utc)
    )
    db.add(activity)

    # Record Radar event if communication action (Call / WhatsApp / Email)
    if activity.activity_type in ("CALL", "WHATSAPP", "EMAIL"):
        radar_event = RadarEvent(
            organization_id=organization_id,
            actor_user_id=user.id,
            action=f"OUTBOUND_{activity.activity_type}",
            entity_type="LEAD",
            entity_id=lead.id if lead else organization_id,
            metadata_json={"activity_type": activity.activity_type, "duration": activity.duration_seconds}
        )
        db.add(radar_event)

    db.commit()
    db.refresh(activity)
    return activity


def get_lead_timeline(db: Session, lead_id: str, organization_id: str) -> List[ActivityOut]:
    activities = db.query(Activity).filter(
        Activity.lead_id == lead_id,
        Activity.organization_id == organization_id
    ).order_by(desc(Activity.occurred_at)).all()

    result = []
    for act in activities:
        result.append(ActivityOut(
            id=act.id,
            organization_id=act.organization_id,
            lead_id=act.lead_id,
            company_id=act.company_id,
            contact_id=act.contact_id,
            user_id=act.user_id,
            user_name=act.user.full_name if act.user else None,
            activity_type=act.activity_type,
            subject=act.subject,
            description=act.description,
            direction=act.direction,
            status=act.status,
            duration_seconds=act.duration_seconds,
            metadata_json=act.metadata_json,
            occurred_at=act.occurred_at,
            created_at=act.created_at
        ))
    return result


def list_activities(
    db: Session,
    organization_id: str,
    user_id: Optional[str] = None,
    activity_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
) -> List[ActivityOut]:
    query = db.query(Activity).filter(Activity.organization_id == organization_id)
    if user_id:
        query = query.filter(Activity.user_id == user_id)
    if activity_type:
        query = query.filter(Activity.activity_type == activity_type.upper())

    items = query.order_by(desc(Activity.occurred_at)).offset(skip).limit(limit).all()
    return [
        ActivityOut(
            id=act.id,
            organization_id=act.organization_id,
            lead_id=act.lead_id,
            company_id=act.company_id,
            contact_id=act.contact_id,
            user_id=act.user_id,
            user_name=act.user.full_name if act.user else None,
            activity_type=act.activity_type,
            subject=act.subject,
            description=act.description,
            direction=act.direction,
            status=act.status,
            duration_seconds=act.duration_seconds,
            metadata_json=act.metadata_json,
            occurred_at=act.occurred_at,
            created_at=act.created_at
        )
        for act in items
    ]
