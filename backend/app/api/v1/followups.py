from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from app.core.deps import get_db, get_current_user, get_tenant_id
from app.models.user import User
from app.models.task import Task
from app.schemas.task import TaskOut
from pydantic import BaseModel

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
    query = db.query(Task).filter(
        Task.organization_id == tenant_id,
        Task.assigned_to == current_user.id,
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
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.organization_id == tenant_id,
        Task.assigned_to == current_user.id,
        Task.task_type == "FOLLOW_UP"
    ).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Follow-up not found or not assigned to you")
        
    task.status = "COMPLETED"
    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/reschedule", response_model=TaskOut)
def reschedule_followup(
    task_id: str,
    req: RescheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.organization_id == tenant_id,
        Task.assigned_to == current_user.id,
        Task.task_type == "FOLLOW_UP"
    ).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Follow-up not found or not assigned to you")
        
    task.due_at = req.new_due_at
    if req.reason:
        if task.notes:
            task.notes += f"\nRescheduled: {req.reason}"
        else:
            task.notes = f"Rescheduled: {req.reason}"
            
    db.commit()
    db.refresh(task)
    return task
