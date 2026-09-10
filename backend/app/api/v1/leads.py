from typing import List, Optional
from pydantic import BaseModel
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.deps import get_db, get_current_user, get_tenant_id
from app.models.user import User
from app.models.lead import Lead
from app.models.lead_history import LeadStageHistory
from app.models.audit import RadarEvent
from app.schemas.lead import (
    LeadCreate, LeadUpdate, LeadOut, LeadStageChangeRequest,
    LeadAssignRequest, LeadStageHistoryOut
)
from app.schemas.activity import ActivityOut
from app.services.lead_service import (
    create_lead, change_lead_stage, assign_lead, serialize_lead
)
from app.services.activity_service import get_lead_timeline

router = APIRouter(prefix="/leads", tags=["Leads & Opportunities"])


@router.get("/", response_model=List[LeadOut])
def list_leads(
    status_filter: Optional[str] = Query(None, alias="status"),
    stage_id: Optional[str] = None,
    owner_id: Optional[str] = None,
    search: Optional[str] = None,
    priority: Optional[str] = None,
    min_score: Optional[int] = None,
    skip: int = 0,
    limit: int = 250,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    query = db.query(Lead).filter(Lead.organization_id == tenant_id)

    # Allow filtering by owner_id if explicitly specified
    if owner_id:
        query = query.filter(Lead.owner_id == owner_id)

    if status_filter:
        query = query.filter(Lead.status == status_filter.upper())
    if stage_id:
        query = query.filter(Lead.pipeline_stage_id == stage_id)
    if priority:
        query = query.filter(Lead.priority == priority.upper())
    if min_score:
        query = query.filter(Lead.score >= min_score)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (Lead.title.ilike(s)) |
            (Lead.company_name.ilike(s)) |
            (Lead.contact_name.ilike(s)) |
            (Lead.contact_email.ilike(s)) |
            (Lead.contact_phone.ilike(s))
        )

    leads = query.order_by(desc(Lead.created_at)).offset(skip).limit(limit).all()
    return [serialize_lead(l, current_user, db) for l in leads]


@router.post("/", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
def create_new_lead(
    data: LeadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    lead = create_lead(db, tenant_id, data, current_user)
    return serialize_lead(lead, current_user, db)


@router.get("/{id}", response_model=LeadOut)
def get_lead_detail(
    id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    lead = db.query(Lead).filter(
        Lead.id == id,
        Lead.organization_id == tenant_id
    ).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    # Record contact view in radar
    radar_event = RadarEvent(
        organization_id=tenant_id,
        actor_user_id=current_user.id,
        action="CONTACT_VIEW",
        entity_type="LEAD",
        entity_id=lead.id,
        ip_address=request.client.host if request.client else None
    )
    db.add(radar_event)
    db.commit()

    return serialize_lead(lead, current_user, db)


@router.patch("/{id}", response_model=LeadOut)
def update_lead(
    id: str,
    data: LeadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    lead = db.query(Lead).filter(
        Lead.id == id,
        Lead.organization_id == tenant_id
    ).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    if data.title:
        lead.title = data.title.strip()
    if data.company_name:
        lead.company_name = data.company_name.strip()
    if data.contact_name:
        lead.contact_name = data.contact_name.strip()
    if data.contact_email is not None:
        lead.contact_email = data.contact_email.lower().strip() if data.contact_email else None
    if data.contact_phone is not None:
        lead.contact_phone = data.contact_phone.strip() if data.contact_phone else None
    if data.status:
        lead.status = data.status.upper()
    if data.priority:
        lead.priority = data.priority.upper()
    if data.score is not None:
        lead.score = data.score
    if data.value is not None:
        lead.value = data.value
    if data.description is not None:
        lead.description = data.description
    if data.notes is not None:
        lead.notes = data.notes
    if data.tags is not None:
        lead.tags = data.tags

    db.commit()
    db.refresh(lead)
    return serialize_lead(lead, current_user, db)


@router.post("/{id}/stage", response_model=LeadOut)
def update_stage(
    id: str,
    data: LeadStageChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    lead = change_lead_stage(db, id, data.stage_id, tenant_id, current_user, data.reason)
    return serialize_lead(lead, current_user, db)


@router.post("/{id}/assign", response_model=LeadOut)
def reassign_lead(
    id: str,
    data: LeadAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    lead = assign_lead(db, id, data.owner_id, tenant_id, current_user)
    return serialize_lead(lead, current_user, db)


@router.get("/{id}/timeline", response_model=List[ActivityOut])
def get_timeline(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    return get_lead_timeline(db, id, tenant_id)


@router.get("/{id}/stage-history", response_model=List[LeadStageHistoryOut])
def get_stage_history(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    history = db.query(LeadStageHistory).filter(
        LeadStageHistory.lead_id == id,
        LeadStageHistory.organization_id == tenant_id
    ).order_by(desc(LeadStageHistory.created_at)).all()

    return [
        LeadStageHistoryOut(
            id=h.id,
            lead_id=h.lead_id,
            from_stage_id=h.from_stage_id,
            to_stage_id=h.to_stage_id,
            from_stage_name=h.from_stage.name if h.from_stage else None,
            to_stage_name=h.to_stage.name if h.to_stage else None,
            changed_by=h.changed_by,
            changed_by_name=h.user.full_name if h.user else None,
            reason=h.reason,
            duration_seconds=h.duration_seconds or 0,
            created_at=h.created_at
        )
        for h in history
    ]


class LeadActionResponse(BaseModel):
    status: str
    action_type: str
    lead_id: str
    gmail_url: Optional[str] = None
    whatsapp_url: Optional[str] = None
    tel_url: Optional[str] = None
    recipient_email: Optional[str] = None
    recipient_phone: Optional[str] = None
    message: Optional[str] = None


@router.post("/{id}/action/{action_type}", response_model=LeadActionResponse)
def trigger_lead_action(
    id: str,
    action_type: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    lead = db.query(Lead).filter(
        Lead.id == id,
        Lead.organization_id == tenant_id
    ).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    action_clean = action_type.lower()

    # Record auditable Radar event
    radar_event = RadarEvent(
        organization_id=tenant_id,
        actor_user_id=current_user.id,
        action=f"{action_clean.upper()}_TRIGGERED",
        entity_type="LEAD",
        entity_id=lead.id,
        ip_address=request.client.host if request.client else None
    )
    db.add(radar_event)
    db.commit()

    if action_clean in ("email", "mail"):
        target_email = lead.contact_email or ""
        subject = f"Regarding {lead.title} - {lead.company_name or 'Jarvis CRM'}"
        body = f"Hello {lead.contact_name or 'there'},\n\nI am reaching out regarding {lead.title}.\n\nBest regards,\n{current_user.full_name}"
        params = urllib.parse.urlencode({
            "view": "cm",
            "fs": "1",
            "to": target_email,
            "authuser": current_user.email,
            "su": subject,
            "body": body
        })
        gmail_url = f"https://mail.google.com/mail/?{params}"
        return LeadActionResponse(
            status="success",
            action_type="email",
            lead_id=lead.id,
            gmail_url=gmail_url,
            recipient_email=lead.contact_email,
            message="Gmail composer link generated"
        )

    elif action_clean == "whatsapp":
        phone = lead.contact_phone or ""
        clean_digits = "".join([c for c in phone if c.isdigit()])
        text = f"Hello {lead.contact_name or ''}, reaching out regarding {lead.title} from {lead.company_name or 'our team'}."
        encoded_text = urllib.parse.quote(text)
        whatsapp_url = f"https://api.whatsapp.com/send?phone={clean_digits}&text={encoded_text}"
        return LeadActionResponse(
            status="success",
            action_type="whatsapp",
            lead_id=lead.id,
            whatsapp_url=whatsapp_url,
            recipient_phone=clean_digits,
            message="WhatsApp proxy dispatch ready"
        )

    elif action_clean == "call":
        phone = lead.contact_phone or ""
        clean_digits = "".join([c for c in phone if c.isdigit() or c == "+"])
        tel_url = f"tel:{clean_digits}" if clean_digits else None
        return LeadActionResponse(
            status="success",
            action_type="call",
            lead_id=lead.id,
            tel_url=tel_url,
            recipient_phone=lead.contact_phone,
            message="VoIP outbound call connection initialized"
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported action: {action_type}")

