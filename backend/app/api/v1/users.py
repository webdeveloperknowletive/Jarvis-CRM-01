from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user, require_org_admin, get_tenant_id
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.core.security import get_password_hash

router = APIRouter(prefix="/users", tags=["Users & RBAC"])


@router.get("/", response_model=List[UserOut])
def list_users(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    query = db.query(User).filter(User.organization_id == tenant_id)
    return query.order_by(User.full_name.asc()).offset(skip).limit(limit).all()


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_tenant_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_admin),
    tenant_id: str = Depends(get_tenant_id)
):
    email_clean = data.email.lower().strip()
    existing = db.query(User).filter(
        User.email == email_clean,
        User.organization_id == tenant_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email {data.email} already exists in this organization"
        )

    # Validate allowed roles
    allowed_roles = ["ORG_ADMIN", "SALES_MANAGER", "SALES_REP", "TELECALLER", "VIEWER"]
    role = data.tenant_role or "SALES_REP"
    if role not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid tenant role: {role}")

    user = User(
        organization_id=tenant_id,
        tenant_role=role,
        full_name=data.full_name.strip(),
        email=email_clean,
        phone=data.phone,
        password_hash=get_password_hash(data.password),
        status="ACTIVE",
        permission_overrides=data.permission_overrides or {}
    )
    db.add(user)
    db.flush()

    audit = AuditLog(
        organization_id=tenant_id,
        user_id=current_user.id,
        action="USER_INVITED",
        entity_type="USER",
        entity_id=user.id,
        new_values={"email": user.email, "role": user.tenant_role}
    )
    db.add(audit)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{id}", response_model=UserOut)
def update_user(
    id: str,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_org_admin),
    tenant_id: str = Depends(get_tenant_id)
):
    user = db.query(User).filter(
        User.id == id,
        User.organization_id == tenant_id
    ).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    old_role = user.tenant_role
    if data.full_name:
        user.full_name = data.full_name.strip()
    if data.phone is not None:
        user.phone = data.phone
    if data.tenant_role:
        user.tenant_role = data.tenant_role
    if data.status:
        user.status = data.status
    if data.permission_overrides is not None:
        user.permission_overrides = data.permission_overrides

    audit = AuditLog(
        organization_id=tenant_id,
        user_id=current_user.id,
        action="USER_UPDATED",
        entity_type="USER",
        entity_id=user.id,
        old_values={"role": old_role},
        new_values={"role": user.tenant_role, "status": user.status}
    )
    db.add(audit)
    db.commit()
    db.refresh(user)
    return user
