from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models.activity import Activity
from app.models.task import Task
from app.models.followup_policy import FollowupPolicy
from app.models.user import User
from app.core.business_time import followup_preset_due_at


def _matching_policy(db: Session, tenant_id: str, outcome: str | None):
    if not outcome:
        return None
    return db.query(FollowupPolicy).filter(
        FollowupPolicy.organization_id == tenant_id,
        FollowupPolicy.trigger_outcome == outcome,
        FollowupPolicy.is_active.is_(True),
    ).first()


def _attempt_limit_reached(db: Session, tenant_id: str, lead_id: str, policy: FollowupPolicy | None) -> bool:
    if not policy or not policy.max_attempts:
        return False
    attempts = db.query(Task).filter(
        Task.organization_id == tenant_id,
        Task.lead_id == lead_id,
        Task.task_type == "FOLLOW_UP",
        Task.status.in_(("COMPLETED", "CANCELLED", "OVERDUE")),
    ).count()
    return attempts >= policy.max_attempts


def _upsert_active_followup(
    db: Session,
    activity: Activity,
    tenant_id: str,
    current_user: User,
    due_at: datetime,
    title: str,
    description: str,
):
    from app.models.lead import Lead

    if not activity.lead_id:
        return None
    lead = db.query(Lead).filter(
        Lead.id == activity.lead_id,
        Lead.organization_id == tenant_id,
    ).with_for_update().first()
    if not lead:
        return None

    pending_task = db.query(Task).filter(
        Task.organization_id == tenant_id,
        Task.lead_id == activity.lead_id,
        Task.task_type == "FOLLOW_UP",
        Task.status == "PENDING",
    ).with_for_update().order_by(Task.created_at.desc()).first()
    owner_id = lead.owner_id or current_user.id
    priority = "HIGH" if activity.status in ("INTERESTED", "CALLBACK") else "MEDIUM"
    if pending_task:
        pending_task.title = title
        pending_task.description = description
        pending_task.priority = priority
        pending_task.due_at = due_at
        pending_task.assigned_to = owner_id
        db.flush()
        return pending_task

    task = Task(
        organization_id=tenant_id,
        lead_id=activity.lead_id,
        company_id=lead.company_id,
        contact_id=lead.contact_id,
        task_type="FOLLOW_UP",
        title=title,
        description=description,
        priority=priority,
        status="PENDING",
        due_at=due_at,
        assigned_to=owner_id,
        created_by=current_user.id,
    )
    db.add(task)
    db.flush()
    return task


def apply_followup_preset(
    db: Session,
    activity: Activity,
    tenant_id: str,
    current_user: User,
    preset: str,
):
    """Persist a Desk preset; `none` explicitly clears any active follow-up."""
    if not activity.lead_id:
        return None
    due_at = followup_preset_due_at(db, tenant_id, preset)
    if due_at is None:
        db.query(Task).filter(
            Task.organization_id == tenant_id,
            Task.lead_id == activity.lead_id,
            Task.task_type == "FOLLOW_UP",
            Task.status == "PENDING",
        ).update(
            {
                Task.status: "CANCELLED",
                Task.description: "Cancelled because the recorded call outcome selected No Follow-up.",
            },
            synchronize_session=False,
        )
        db.flush()
        return None

    policy = _matching_policy(db, tenant_id, activity.status)
    if _attempt_limit_reached(db, tenant_id, activity.lead_id, policy):
        return None
    label = {"tomorrow": "Tomorrow", "3days": "In 3 Days", "nextweek": "Next Week"}[preset]
    return _upsert_active_followup(
        db,
        activity,
        tenant_id,
        current_user,
        due_at,
        f"Follow-up: {label}",
        f"Scheduled from call outcome: {activity.status or 'UNKNOWN'}",
    )

def execute_followup_policy(db: Session, activity: Activity, tenant_id: str, current_user: User):
    """
    Checks if the given activity outcome matches an active Follow-up Policy.
    If it does, schedules the next best action / task automatically.
    """
    if activity.activity_type != "CALL" or not activity.status:
        return
        
    policy = _matching_policy(db, tenant_id, activity.status)
    
    if not policy:
        return
        
    if not activity.lead_id or _attempt_limit_reached(db, tenant_id, activity.lead_id, policy):
        return

    due_date = datetime.now(timezone.utc) + timedelta(minutes=policy.interval_minutes)
    return _upsert_active_followup(
        db,
        activity,
        tenant_id,
        current_user,
        due_date,
        f"Auto Follow-up [{policy.name}]",
        f"Automated follow-up triggered by previous outcome: {activity.status}",
    )
