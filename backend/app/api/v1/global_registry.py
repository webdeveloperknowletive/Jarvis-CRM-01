from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.deps import get_db, get_current_user, get_tenant_id
from app.models.user import User
from app.schemas.global_registry import GlobalCompanyOut, GlobalPullRequest, GlobalPullResponse
from app.services.global_service import search_global_companies, pull_global_companies_to_crm

router = APIRouter(prefix="/global", tags=["Global Intelligence Registry"])


@router.get("/companies", response_model=List[GlobalCompanyOut])
def get_global_companies(
    search: Optional[str] = None,
    city: Optional[str] = None,
    industry: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return search_global_companies(db, search, city, industry, skip, limit)


@router.post("/pull", response_model=GlobalPullResponse)
def pull_companies_to_crm(
    data: GlobalPullRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    return pull_global_companies_to_crm(
        db=db,
        organization_id=tenant_id,
        user=current_user,
        global_company_ids=data.global_company_ids,
        target_stage_id=data.target_stage_id,
        target_owner_id=data.target_owner_id
    )
