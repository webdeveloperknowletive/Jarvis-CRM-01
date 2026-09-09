from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin, generate_uuid


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id = Column(String(36), ForeignKey("leads.id", ondelete="CASCADE"), nullable=True, index=True)
    company_id = Column(String(36), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    contact_id = Column(String(36), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)

    task_type = Column(String(50), nullable=False, default="FOLLOW_UP")  # FOLLOW_UP, CALL, MEETING, GENERAL
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String(30), nullable=False, default="MEDIUM")       # LOW, MEDIUM, HIGH, URGENT
    status = Column(String(30), nullable=False, default="PENDING")        # PENDING, COMPLETED, CANCELLED, OVERDUE

    due_at = Column(DateTime, nullable=True, index=True)
    completed_at = Column(DateTime, nullable=True)
    assigned_to = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    reschedule_count = Column(Integer, nullable=False, default=0)
    reschedule_history = Column(JSON, nullable=False, default=list)  # [{old_due_at, new_due_at, reason, changed_at, changed_by}]

    # Relationships
    lead = relationship("Lead", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assigned_to])
    creator = relationship("User", foreign_keys=[created_by])
