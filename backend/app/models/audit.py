from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from app.core.database import Base
from app.models.base import generate_uuid, utc_now


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)  # CREATE, UPDATE, DELETE, EXPORT, STAGE_CHANGE, MASK_REVEAL, LOGIN
    entity_type = Column(String(100), nullable=False, index=True)  # LEAD, COMPANY, CONTACT, PIPELINE, USER, ORGANIZATION
    entity_id = Column(String(36), nullable=True, index=True)

    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)


class RadarEvent(Base):
    __tablename__ = "radar_events"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(100), nullable=False, index=True)  # CONTACT_VIEW, BULK_VIEW, EXPORT_ATTEMPT, MASKED_CALL, REVEAL_REQUEST
    entity_type = Column(String(50), nullable=False)          # LEAD, CONTACT, COMPANY
    entity_id = Column(String(36), nullable=False)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    metadata_json = Column(JSON, nullable=False, default=dict)
    occurred_at = Column(DateTime, default=utc_now, nullable=False, index=True)
