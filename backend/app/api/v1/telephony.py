from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional
from pydantic import BaseModel

from app.core.deps import get_db, get_current_user, get_tenant_id
from app.models.user import User
from app.models.lead import Lead
from app.models.call_record import CallRecord
from app.models.activity import Activity

router = APIRouter(prefix="/telephony", tags=["Telephony"])


class DialRequest(BaseModel):
    lead_id: str
    contact_phone_id: Optional[str] = None


@router.post("/dial")
def initiate_call(
    data: DialRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    lead = db.query(Lead).filter(
        Lead.id == data.lead_id,
        Lead.organization_id == tenant_id
    ).first()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    # Problem 3 & 5: Log the call attempt immediately as Activity and CallRecord
    call_record = CallRecord(
        organization_id=tenant_id,
        lead_id=lead.id,
        contact_id=lead.contact_id,
        user_id=current_user.id,
        provider="NATIVE_DIALER",
        direction="OUTBOUND",
        disposition="INITIATED"
    )
    db.add(call_record)

    # Immediate Activity row with status='SCHEDULED'
    activity = Activity(
        organization_id=tenant_id,
        lead_id=lead.id,
        contact_id=lead.contact_id,
        user_id=current_user.id,
        activity_type="CALL",
        subject=f"Outbound Call Initiated to {lead.contact_name or lead.title}",
        description="Call dialed via native application bridge.",
        status="SCHEDULED"
    )
    db.add(activity)

    db.commit()
    db.refresh(call_record)
    
    phone = lead.contact_phone or ""
    clean_digits = "".join([c for c in phone if c.isdigit() or c == "+"])
    
    return {
        "status": "success",
        "call_record_id": call_record.id,
        "tel_url": f"tel:{clean_digits}" if clean_digits else None
    }


class WebhookPayload(BaseModel):
    call_id: Optional[str] = None
    call_record_id: Optional[str] = None
    status: Optional[str] = None
    disposition: Optional[str] = None
    duration: Optional[int] = None
    duration_seconds: Optional[int] = None
    recording_url: Optional[str] = None


@router.post("/webhook")
def telephony_webhook(
    data: WebhookPayload,
    db: Session = Depends(get_db)
):
    """
    Problem 5: Webhook receives real duration/status.
    Auto-updates CallRecord and logs CRM Activity timeline event.
    """
    target_id = data.call_id or data.call_record_id
    if not target_id:
        raise HTTPException(status_code=400, detail="Missing call_id or call_record_id")

    call_record = db.query(CallRecord).filter(
        or_(CallRecord.id == target_id, CallRecord.provider_call_id == target_id)
    ).first()

    disp = (data.status or data.disposition or "CONNECTED").upper()
    dur = data.duration if data.duration is not None else (data.duration_seconds or 0)

    if call_record:
        call_record.disposition = disp
        call_record.duration_seconds = dur
        if data.recording_url:
            call_record.recording_url = data.recording_url
        
        # Log to activity timeline
        activity = Activity(
            organization_id=call_record.organization_id,
            lead_id=call_record.lead_id,
            contact_id=call_record.contact_id,
            user_id=call_record.user_id,
            activity_type="CALL",
            subject=f"Outbound Call - {disp}",
            description=f"Call completed. Telemetry duration: {dur} seconds.",
            duration_seconds=dur,
            status="COMPLETED"
        )
        db.add(activity)
        db.commit()
        return {"status": "success", "call_record_id": call_record.id}

    return {"status": "ignored", "message": "Call record not found"}
    
    return {"status": "success"}


class TelecallerKPIsOut(BaseModel):
    calls_made_today: int
    talk_time_minutes: int
    high_interest_leads: int


@router.get("/my-kpis", response_model=TelecallerKPIsOut)
def get_my_kpis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    from datetime import datetime, timezone
    from sqlalchemy import func

    today = datetime.now(timezone.utc).date()
    
    calls_made = db.query(Activity).filter(
        Activity.organization_id == tenant_id,
        Activity.user_id == current_user.id,
        Activity.activity_type == "CALL",
        Activity.occurred_at >= datetime.combine(today, datetime.min.time())
    ).count()

    talk_time_seconds = db.query(func.sum(Activity.duration_seconds)).filter(
        Activity.organization_id == tenant_id,
        Activity.user_id == current_user.id,
        Activity.activity_type == "CALL",
        Activity.occurred_at >= datetime.combine(today, datetime.min.time())
    ).scalar() or 0

    high_interest = db.query(Activity).filter(
        Activity.organization_id == tenant_id,
        Activity.user_id == current_user.id,
        Activity.activity_type == "CALL",
        Activity.status == "INTERESTED",
        Activity.occurred_at >= datetime.combine(today, datetime.min.time())
    ).count()

    return TelecallerKPIsOut(
        calls_made_today=calls_made,
        talk_time_minutes=talk_time_seconds // 60,
        high_interest_leads=high_interest
    )

