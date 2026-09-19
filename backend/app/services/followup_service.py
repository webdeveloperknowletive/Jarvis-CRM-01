from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models.activity import Activity
from app.models.task import Task
from app.models.followup_policy import FollowupPolicy
from app.models.user import User

def execute_followup_policy(db: Session, activity: Activity, tenant_id: str, current_user: User):
    """
    Checks if the given activity outcome matches an active Follow-up Policy.
    If it does, schedules the next best action / task automatically.
    """
    if activity.activity_type != "CALL" or not activity.status:
        return
        
    policy = db.query(FollowupPolicy).filter(
        FollowupPolicy.organization_id == tenant_id,
        FollowupPolicy.trigger_outcome == activity.status,
        FollowupPolicy.is_active == True
    ).first()
    
    if not policy:
        return
        
    # Check how many follow-ups have been created for this lead for this policy type
    # For MVP, we just create a task if it doesn't exceed max attempts (rough check)
    existing_tasks = db.query(Task).filter(
        Task.lead_id == activity.lead_id,
        Task.task_type == "FOLLOW_UP",
        Task.title.like(f"%[{policy.name}]%")
    ).count()
    
    if existing_tasks >= policy.max_attempts:
        return
        
    # Deduplication check: Cancel old PENDING follow-ups for this lead
    pending_tasks = db.query(Task).filter(
        Task.lead_id == activity.lead_id,
        Task.task_type == "FOLLOW_UP",
        Task.status == "PENDING"
    ).all()

    for pt in pending_tasks:
        pt.status = "CANCELLED"
    db.commit()

    # Get lead to assign to its owner
    from app.models.lead import Lead
    lead = db.query(Lead).filter(Lead.id == activity.lead_id).first()
    owner_id = lead.owner_id if lead else current_user.id

    due_date = datetime.now(timezone.utc) + timedelta(minutes=policy.interval_minutes)
    
    new_task = Task(
        organization_id=tenant_id,
        lead_id=activity.lead_id,
        task_type="FOLLOW_UP",
        title=f"Auto Follow-up [{policy.name}]",
        description=f"Automated follow-up triggered by previous outcome: {activity.status}",
        priority="HIGH" if activity.status in ["INTERESTED", "CALLBACK"] else "MEDIUM",
        status="PENDING",
        due_at=due_date,
        assigned_to=owner_id
    )
    
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task
