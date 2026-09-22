from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from app.core.deps import get_db, get_current_user, get_tenant_id
from app.models.user import User
from app.models.task import Task
from app.schemas.task import TaskOut
from app.services.task_service import complete_task, reschedule_task
from app.schemas.task import TaskRescheduleRequest
from pydantic import BaseModel
from sqlalchemy import or_
from app.models.delegation import AbsenceDelegation
from app.core.business_time import organization_business_date

router = APIRouter(prefix="/followups", tags=["Follow-ups"])

class RescheduleRequest(BaseModel):
    new_due_at: datetime
    reason: Optional[str] = None

@router.get("/", response_model=List[TaskOut])
def list_followups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    status: Optional[str] = "PENDING"
):
    assignee_ids = [current_user.id]
    if current_user.tenant_role == "TELECALLER":
        today = organization_business_date(db, tenant_id)
        rows = db.query(AbsenceDelegation.absent_user_id).filter(
            AbsenceDelegation.organization_id == tenant_id,
            AbsenceDelegation.cover_user_id == current_user.id,
            AbsenceDelegation.start_date <= today,
            AbsenceDelegation.end_date >= today,
        ).all()
        assignee_ids.extend(row[0] for row in rows)
    query = db.query(Task).filter(
        Task.organization_id == tenant_id,
        Task.assigned_to.in_(assignee_ids),
        Task.task_type == "FOLLOW_UP"
    )
    if status:
        query = query.filter(Task.status == status)
    
    return query.order_by(Task.due_at.asc()).all()


@router.post("/{task_id}/complete", response_model=TaskOut)
def complete_followup(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    if not db.query(Task.id).filter(
        Task.id == task_id,
        Task.organization_id == tenant_id,
        Task.task_type == "FOLLOW_UP",
    ).first():
        raise HTTPException(status_code=404, detail="Follow-up not found")
    task = complete_task(db, task_id, tenant_id, current_user)
    return task


@router.post("/{task_id}/reschedule", response_model=TaskOut)
def reschedule_followup(
    task_id: str,
    req: RescheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    if not db.query(Task.id).filter(
        Task.id == task_id,
        Task.organization_id == tenant_id,
        Task.task_type == "FOLLOW_UP",
    ).first():
        raise HTTPException(status_code=404, detail="Follow-up not found")
    task = reschedule_task(
        db,
        task_id,
        tenant_id,
        current_user,
        TaskRescheduleRequest(new_due_at=req.new_due_at, reason=req.reason),
    )
    return task
