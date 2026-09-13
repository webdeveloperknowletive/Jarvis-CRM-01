from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.deps import get_db, get_current_user
from app.models.user import User
from app.models.organization import Organization
from app.models.global_registry import GlobalCompany, GlobalDataPullLog
from app.models.global_people import GlobalPerson
from app.schemas.user import UserOut, UserCreate
from app.core.security import get_password_hash

router = APIRouter(prefix="/admin", tags=["Super Admin"])

def require_super_admin(current_user: User = Depends(get_current_user)):
    if not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin privileges required"
        )
    return current_user


class KPIDashboardOut(BaseModel):
    total_organizations: int
    total_org_admins: int
    total_global_companies: int
    total_people_leads: int
    total_data_pulls: int


@router.get("/kpis", response_model=KPIDashboardOut)
def get_kpis(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    total_orgs = db.query(Organization).count()
    total_admins = db.query(User).filter(User.tenant_role == "ORG_ADMIN").count()
    total_companies = db.query(GlobalCompany).filter(GlobalCompany.status == "ACTIVE").count()
    total_people = db.query(GlobalPerson).filter(GlobalPerson.status == "ACTIVE").count()
    total_pulls = db.query(GlobalDataPullLog).count()

    return KPIDashboardOut(
        total_organizations=total_orgs,
        total_org_admins=total_admins,
        total_global_companies=total_companies,
        total_people_leads=total_people,
        total_data_pulls=total_pulls
    )


class AdminUserOut(UserOut):
    organization_name: Optional[str] = None


@router.get("/users", response_model=List[AdminUserOut])
def list_all_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    # Fetch all users (especially ORG_ADMIN and DATA_ENTRY)
    users = db.query(User, Organization.name).outerjoin(
        Organization, User.organization_id == Organization.id
    ).order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for u, org_name in users:
        u_dict = {k: v for k, v in u.__dict__.items() if not k.startswith("_")}
        u_dict["organization_name"] = org_name
        result.append(AdminUserOut(**u_dict))
    return result


class AdminUserCreate(UserCreate):
    pass

class AdminUserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    platform_role: Optional[str] = None
    tenant_role: Optional[str] = None
    password: Optional[str] = None


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    data: AdminUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    email_clean = data.email.lower().strip()
    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email {data.email} already exists"
        )
        
    user = User(
        organization_id=data.organization_id,
        platform_role=data.platform_role,
        tenant_role=data.tenant_role,
        full_name=data.full_name.strip(),
        email=email_clean,
        phone=data.phone,
        password_hash=get_password_hash(data.password),
        status="ACTIVE"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


class UserStatusUpdate(BaseModel):
    status: str


@router.patch("/users/{user_id}/status", response_model=UserOut)
def update_user_status(
    user_id: str,
    data: UserStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change your own status")
        
    user.status = data.status
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
def update_admin_user(
    user_id: str,
    data: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if data.email:
        email_clean = data.email.lower().strip()
        if email_clean != user.email:
            existing = db.query(User).filter(User.email == email_clean).first()
            if existing:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")
        user.email = email_clean

    if data.full_name:
        user.full_name = data.full_name.strip()
    if data.phone is not None:
        user.phone = data.phone
    if data.platform_role is not None:
        user.platform_role = data.platform_role
    if data.tenant_role is not None:
        user.tenant_role = data.tenant_role
    if data.password:
        user.password_hash = get_password_hash(data.password)

    db.commit()
    db.refresh(user)
    return user
