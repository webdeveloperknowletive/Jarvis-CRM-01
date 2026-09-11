from typing import Generator, Optional
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.models.organization import Organization

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload["sub"]
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if user.status in ("SUSPENDED", "DEACTIVATED"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive or suspended")
    return user


def require_super_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    if not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Admin platform privilege required"
        )
    return current_user


def require_platform_user(
    current_user: User = Depends(get_current_user)
) -> User:
    if not (current_user.platform_role in ("SUPER_ADMIN", "DATA_OPS")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform staff access required"
        )
    return current_user


def require_org_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    if not current_user.is_org_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization Admin privilege required"
        )
    return current_user


def get_tenant_id(
    current_user: User = Depends(get_current_user),
    x_tenant_id: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> str:
    """
    Resolves the active tenant ID:
    - For normal tenant users, ALWAYS their current_user.organization_id (never spoofable).
    - For super admins, allows passing X-Tenant-Id header for tenant-scoped operations,
      or falls back to their assigned tenant if set.
    Sets PostgreSQL search_path to the tenant's isolated schema.
    """
    tenant_id: Optional[str] = None
    if current_user.organization_id:
        tenant_id = current_user.organization_id
    elif current_user.is_super_admin:
        if x_tenant_id:
            tenant_id = x_tenant_id
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Super Admin must specify tenant context via X-Tenant-Id header or parameter"
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to any tenant organization"
        )

    # Route PostgreSQL search_path to tenant's isolated schema
    if db.bind and db.bind.dialect.name == "postgresql":
        try:
            org = db.query(Organization).filter(Organization.id == tenant_id).first()
            if org and org.schema_name:
                db.execute(text(f'SET search_path TO "{org.schema_name}", public'))
        except Exception:
            pass

    return tenant_id


def get_optional_tenant_id(
    current_user: User = Depends(get_current_user),
    x_tenant_id: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Optional[str]:
    tenant_id: Optional[str] = None
    if current_user.organization_id:
        tenant_id = current_user.organization_id
    elif current_user.is_super_admin:
        tenant_id = x_tenant_id

    # Route PostgreSQL search_path to tenant's isolated schema if tenant_id is resolved
    if tenant_id and db.bind and db.bind.dialect.name == "postgresql":
        try:
            org = db.query(Organization).filter(Organization.id == tenant_id).first()
            if org and org.schema_name:
                db.execute(text(f'SET search_path TO "{org.schema_name}", public'))
        except Exception:
            pass

    return tenant_id
