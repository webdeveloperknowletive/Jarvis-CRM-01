from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user
from app.core.security import verify_password, create_access_token, get_password_hash
from app.models.user import User
from app.models.organization import Organization
from app.models.audit import AuditLog
from app.schemas.auth import LoginRequest, Token, PasswordChangeRequest
from app.schemas.user import UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
def login(request: LoginRequest, http_request: Request, db: Session = Depends(get_db)):
    email_clean = request.email.lower().strip()
    user = db.query(User).filter(User.email == email_clean).first()

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    if user.status in ("SUSPENDED", "DEACTIVATED"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended. Please contact your administrator."
        )

    # Issue access token
    access_token = create_access_token(subject=user.id)

    # Update last login
    from datetime import datetime, timezone
    user.last_login_at = datetime.now(timezone.utc)

    # Audit log (SECURITY GUARDRAIL: Login Tracking)
    client_ip = http_request.client.host if http_request.client else "Unknown"
    user_agent = http_request.headers.get("user-agent", "Unknown")

    audit = AuditLog(
        organization_id=user.organization_id,
        user_id=user.id,
        action="USER_LOGIN",
        entity_type="USER",
        entity_id=user.id,
        ip_address=client_ip,
        user_agent=user_agent
    )
    db.add(audit)
    db.commit()

    org_data = None
    if user.organization:
        org_data = {
            "id": user.organization.id,
            "name": user.organization.name,
            "slug": user.organization.slug,
            "timezone": user.organization.timezone,
            "currency": user.organization.currency,
        }

    user_dict = {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "platform_role": user.platform_role,
        "tenant_role": user.tenant_role,
        "effective_role": user.effective_role,
        "is_super_admin": user.is_super_admin,
        "is_data_entry": user.is_data_entry,
        "organization": org_data,
        "organization_id": user.organization_id
    }

    return Token(access_token=access_token, token_type="bearer", user=user_dict)


@router.get("/me")
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    org_data = None
    if current_user.organization:
        org_data = {
            "id": current_user.organization.id,
            "name": current_user.organization.name,
            "slug": current_user.organization.slug,
            "timezone": current_user.organization.timezone,
            "currency": current_user.organization.currency,
        }

    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "phone": current_user.phone,
        "platform_role": current_user.platform_role,
        "tenant_role": current_user.tenant_role,
        "effective_role": current_user.effective_role,
        "is_super_admin": current_user.is_super_admin,
        "is_data_entry": current_user.is_data_entry,
        "status": current_user.status,
        "organization_id": current_user.organization_id,
        "organization": org_data,
        "permission_overrides": current_user.permission_overrides or {}
    }


@router.post("/change-password")
def change_password(
    data: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(data.old_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password incorrect")
    current_user.password_hash = get_password_hash(data.new_password)
    db.commit()
    return {"success": True, "message": "Password updated successfully"}
