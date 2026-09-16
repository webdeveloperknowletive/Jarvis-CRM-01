from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import logging
import uuid

from app.core.deps import get_db, get_current_user, get_tenant_id
from app.models.user import User
from app.models.payment import Payment
from app.models.lead import Lead

router = APIRouter(prefix="/payments", tags=["Payments"])
logger = logging.getLogger(__name__)

class PaymentGenerate(BaseModel):
    lead_id: str
    amount: float
    currency: str = "INR"

class PaymentOut(BaseModel):
    id: str
    lead_id: str
    amount: float
    currency: str
    status: str
    payment_link: Optional[str] = None
    reference_id: Optional[str] = None

    class Config:
        from_attributes = True

@router.post("/generate", response_model=PaymentOut)
def generate_payment(
    data: PaymentGenerate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
):
    lead = db.query(Lead).filter(
        Lead.id == data.lead_id,
        Lead.organization_id == tenant_id
    ).first()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    payment = Payment(
        organization_id=tenant_id,
        lead_id=lead.id,
        amount=data.amount,
        currency=data.currency,
        status="PENDING",
        reference_id=f"PAY_{str(uuid.uuid4())[:8].upper()}"
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    
    # Mocking the payment link for MVP
    payment.payment_link = f"https://pay.example.com/checkout/{payment.id}"
    db.commit()
    
    return payment


@router.get("/lead/{lead_id}", response_model=List[PaymentOut])
def get_lead_payments(
    lead_id: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
):
    payments = db.query(Payment).filter(
        Payment.lead_id == lead_id,
        Payment.organization_id == tenant_id
    ).all()
    return payments


@router.post("/{payment_id}/simulate-payment")
def simulate_payment(
    payment_id: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_tenant_id)
):
    payment = db.query(Payment).filter(
        Payment.id == payment_id,
        Payment.organization_id == tenant_id
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
        
    payment.status = "PAID"
    
    # Automatically update Lead status to WON
    lead = db.query(Lead).filter(Lead.id == payment.lead_id).first()
    if lead and lead.status != "WON":
        lead.status = "WON"
        from app.models.pipeline import PipelineStage
        won_stage = db.query(PipelineStage).filter(PipelineStage.is_won == True).first()
        if won_stage:
            lead.pipeline_stage_id = won_stage.id
            
    db.commit()
    return {"status": "success", "message": "Payment marked as PAID, Lead won!"}


class PaymentWebhookPayload(BaseModel):
    event: Optional[str] = "payment.captured"
    payment_id: Optional[str] = None
    provider_payment_id: Optional[str] = None
    status: Optional[str] = "paid"
    amount: Optional[float] = None
    lead_id: Optional[str] = None
    payload: Optional[dict] = None


@router.post("/webhook")
def payments_webhook(
    data: PaymentWebhookPayload,
    db: Session = Depends(get_db)
):
    """
    Public webhook receiving payment confirmation from payment gateways (Razorpay/Stripe).
    Transitions lead to WON / CLOSED_WON and records telemetry and activity.
    """
    from datetime import datetime, timezone
    payment = None
    if data.payment_id:
        payment = db.query(Payment).filter(Payment.id == data.payment_id).first()
    if not payment and data.provider_payment_id:
        payment = db.query(Payment).filter(Payment.reference_id == data.provider_payment_id).first()
    if not payment and data.lead_id:
        payment = db.query(Payment).filter(Payment.lead_id == data.lead_id).order_by(Payment.created_at.desc()).first()

    if not payment:
        return {"status": "ignored", "message": "No matching payment record found"}

    payment.status = "PAID"
    now = datetime.now(timezone.utc)
    if hasattr(payment, "paid_at"):
        payment.paid_at = now

    # Transition Lead
    lead = db.query(Lead).filter(Lead.id == payment.lead_id).first()
    if lead:
        lead.status = "WON"
        from app.models.pipeline import PipelineStage
        won_stage = db.query(PipelineStage).filter(
            PipelineStage.organization_id == payment.organization_id,
            PipelineStage.is_won == True
        ).first()
        if won_stage:
            lead.pipeline_stage_id = won_stage.id

        # Add Activity
        from app.models.activity import Activity
        act = Activity(
            organization_id=payment.organization_id,
            lead_id=lead.id,
            company_id=lead.company_id,
            contact_id=lead.contact_id,
            user_id=lead.owner_id or payment.organization_id,
            activity_type="PAYMENT",
            subject="Payment Confirmed",
            description=f"Payment of {payment.currency} {payment.amount} successfully confirmed.",
            status="COMPLETED"
        )
        db.add(act)

    db.commit()
    return {"status": "success", "payment_id": payment.id, "lead_status": "WON" if lead else None}

