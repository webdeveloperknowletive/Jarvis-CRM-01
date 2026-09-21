from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi import HTTPException, status

from app.models.task import Task
from app.models.lead import Lead
from app.models.user import User
from app.schemas.task import TaskCreate, TaskUpdate, TaskRescheduleRequest, TaskOut


def create_task(
    db: Session,
    organization_id: str,
    creator_user: User,
    data: TaskCreate
) -> Task:
    lead = None
    if data.lead_id:
        lead = db.query(Lead).filter(
            Lead.id == data.lead_id,
            Lead.organization_id == organization_id
        ).first()
        if not lead:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")

    task = Task(
        organization_id=organization_id,
        lead_id=data.lead_id,
        company_id=data.company_id or (lead.company_id if lead else None),
        contact_id=data.contact_id or (lead.contact_id if lead else None),
        task_type=data.task_type or "FOLLOW_UP",
        title=data.title.strip(),
        description=data.description,
        priority=data.priority or "MEDIUM",
        status="PENDING",
        due_at=data.due_at,
        assigned_to=data.assigned_to or creator_user.id,
        created_by=creator_user.id
    )

    # Idempotency: a lead has one authoritative active follow-up.  Update the
    # existing row in-place so repeated UI/policy requests cannot create a
    # second active task or erase the historical record.
    if task.task_type == "FOLLOW_UP" and task.lead_id:
        existing = db.query(Task).filter(
            Task.organization_id == organization_id,
            Task.lead_id == task.lead_id,
            Task.task_type == "FOLLOW_UP",
            Task.status == "PENDING"
        ).with_for_update().order_by(Task.created_at.desc()).first()
        if existing:
            existing.title = task.title
            existing.description = task.description
            existing.priority = task.priority
            existing.due_at = task.due_at
            existing.assigned_to = task.assigned_to
            db.commit()
            db.refresh(existing)
            return existing

    db.add(task)
    db.commit()
    try:
        db.refresh(task)
    except Exception:
        pass
    return task


def complete_task(
    db: Session,
    task_id: str,
    organization_id: str,
    actor_user: User
) -> Task:
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.organization_id == organization_id
    ).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    task.status = "COMPLETED"
    task.completed_at = datetime.now(timezone.utc)
    db.commit()
    try:
        db.refresh(task)
    except Exception:
        pass
    return task


def reschedule_task(
    db: Session,
    task_id: str,
    organization_id: str,
    actor_user: User,
    data: TaskRescheduleRequest
) -> Task:
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.organization_id == organization_id
    ).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    old_due = task.due_at.isoformat() if task.due_at else None
    task.reschedule_count += 1
    new_history = list(task.reschedule_history or [])
    new_history.append({
        "old_due_at": old_due,
        "new_due_at": data.new_due_at.isoformat(),
        "reason": data.reason,
        "changed_by": actor_user.id,
        "changed_by_name": actor_user.full_name,
        "changed_at": datetime.now(timezone.utc).isoformat()
    })
    task.reschedule_history = new_history
    task.due_at = data.new_due_at
    task.status = "PENDING"
    db.commit()
    try:
        db.refresh(task)
    except Exception:
        pass
    return task


def list_tasks(
    db: Session,
    organization_id: str,
    assigned_to: Optional[str] = None,
    status_filter: Optional[str] = None,
    lead_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
) -> List[TaskOut]:
    query = db.query(Task).filter(Task.organization_id == organization_id)
    if assigned_to:
        query = query.filter(Task.assigned_to == assigned_to)
    if status_filter:
        query = query.filter(Task.status == status_filter.upper())
    if lead_id:
        query = query.filter(Task.lead_id == lead_id)

    tasks = query.order_by(Task.due_at.asc().nullslast()).offset(skip).limit(limit).all()
    return [
        TaskOut(
            id=t.id,
            organization_id=t.organization_id,
            lead_id=t.lead_id,
            company_id=t.company_id,
            contact_id=t.contact_id,
            task_type=t.task_type,
            title=t.title,
            description=t.description,
            priority=t.priority,
            status=t.status,
            due_at=t.due_at,
            completed_at=t.completed_at,
            assigned_to=t.assigned_to,
            assigned_to_name=t.assignee.full_name if t.assignee else None,
            created_by=t.created_by,
            reschedule_count=t.reschedule_count,
            reschedule_history=t.reschedule_history or [],
            created_at=t.created_at,
            updated_at=t.updated_at
        )
        for t in tasks
    ]
