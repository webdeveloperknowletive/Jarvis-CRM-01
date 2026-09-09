from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin, generate_uuid


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    platform_role = Column(String(30), nullable=True)  # SUPER_ADMIN, DATA_OPS
    tenant_role = Column(String(30), nullable=True)    # ORG_ADMIN, SALES_MANAGER, SALES_REP, TELECALLER, VIEWER
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    password_hash = Column(String(255), nullable=False)
    status = Column(String(30), nullable=False, default="ACTIVE")  # INVITED, ACTIVE, SUSPENDED, DEACTIVATED
    permission_overrides = Column(JSON, nullable=False, default=dict)
    last_login_at = Column(DateTime, nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="users")
    assigned_leads = relationship("Lead", back_populates="owner", foreign_keys="Lead.owner_id")

    @property
    def is_super_admin(self) -> bool:
        return self.platform_role == "SUPER_ADMIN"

    @property
    def is_org_admin(self) -> bool:
        return self.tenant_role == "ORG_ADMIN" or self.is_super_admin

    @property
    def effective_role(self) -> str:
        return self.platform_role or self.tenant_role or "VIEWER"
