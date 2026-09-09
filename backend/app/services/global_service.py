from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.global_registry import GlobalCompany, GlobalContact, GlobalCompanyContactMap, GlobalDataPullLog
from app.models.organization import Subscription
from app.models.company import Company
from app.models.contact import Contact
from app.models.lead import Lead
from app.models.lead_history import LeadStageHistory
from app.models.user import User
from app.schemas.global_registry import GlobalCompanyOut, GlobalPullResponse
from app.services.pipeline_service import get_first_stage, get_stage_by_id


def search_global_companies(
    db: Session,
    search: Optional[str] = None,
    city: Optional[str] = None,
    industry: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
) -> List[GlobalCompanyOut]:
    query = db.query(GlobalCompany).filter(GlobalCompany.status == "ACTIVE")
    if search:
        s = f"%{search}%"
        query = query.filter(
            (GlobalCompany.legal_name.ilike(s)) |
            (GlobalCompany.registry_id.ilike(s)) |
            (GlobalCompany.display_name.ilike(s))
        )
    if city:
        query = query.filter(GlobalCompany.city.ilike(f"%{city}%"))
    if industry:
        query = query.filter(GlobalCompany.industry.ilike(f"%{industry}%"))

    companies = query.order_by(GlobalCompany.legal_name.asc()).offset(skip).limit(limit).all()

    results = []
    for c in companies:
        cnt = db.query(GlobalCompanyContactMap).filter(GlobalCompanyContactMap.company_id == c.id).count()
        results.append(GlobalCompanyOut(
            id=c.id,
            registry_id=c.registry_id,
            legal_name=c.legal_name,
            display_name=c.display_name,
            company_type=c.company_type,
            industry=c.industry,
            website=c.website,
            email=c.email,
            phone=c.phone,
            city=c.city,
            state=c.state,
            country=c.country,
            status=c.status,
            contacts_count=cnt,
            first_seen_at=c.first_seen_at,
            last_updated_at=c.last_updated_at
        ))
    return results


def pull_global_companies_to_crm(
    db: Session,
    organization_id: str,
    user: User,
    global_company_ids: List[str],
    target_stage_id: Optional[str] = None,
    target_owner_id: Optional[str] = None
) -> GlobalPullResponse:
    # 1. Check active subscription and remaining pull quota
    sub = db.query(Subscription).filter(
        Subscription.organization_id == organization_id,
        Subscription.status == "ACTIVE"
    ).first()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No active subscription found for this organization"
        )

    needed = len(global_company_ids)
    remaining_quota = sub.pull_quota_monthly - sub.pull_quota_used
    if needed > remaining_quota:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requested {needed} records, but only {remaining_quota} monthly pull credits remaining"
        )

    # 2. Resolve target stage
    if target_stage_id:
        stage = get_stage_by_id(db, target_stage_id, organization_id)
    else:
        stage = get_first_stage(db, organization_id)

    pulled_comps = 0
    pulled_conts = 0
    created_leads = 0

    for g_id in global_company_ids:
        g_comp = db.query(GlobalCompany).filter(GlobalCompany.id == g_id).first()
        if not g_comp:
            continue

        # Check if already pulled or existing in tenant CRM
        crm_comp = db.query(Company).filter(
            Company.organization_id == organization_id,
            (Company.source_global_company_id == g_comp.id) | (Company.cin == g_comp.registry_id)
        ).first()

        if not crm_comp:
            crm_comp = Company(
                organization_id=organization_id,
                source_global_company_id=g_comp.id,
                name=g_comp.legal_name,
                legal_name=g_comp.legal_name,
                cin=g_comp.registry_id,
                industry=g_comp.industry,
                website=g_comp.website,
                email=g_comp.email,
                phone=g_comp.phone,
                city=g_comp.city,
                state=g_comp.state,
                country=g_comp.country,
                created_by=user.id
            )
            db.add(crm_comp)
            db.flush()
            pulled_comps += 1

        # Pull associated contacts
        mapped_contacts = db.query(GlobalCompanyContactMap).filter(
            GlobalCompanyContactMap.company_id == g_comp.id
        ).all()

        primary_contact = None
        for mc in mapped_contacts:
            g_contact = mc.contact
            crm_cont = db.query(Contact).filter(
                Contact.organization_id == organization_id,
                Contact.company_id == crm_comp.id,
                Contact.full_name == g_contact.full_name
            ).first()

            if not crm_cont:
                crm_cont = Contact(
                    organization_id=organization_id,
                    company_id=crm_comp.id,
                    source_global_contact_id=g_contact.id,
                    full_name=g_contact.full_name,
                    designation=mc.designation or g_contact.designation,
                    email=g_contact.email,
                    phone=g_contact.phone,
                    linkedin_url=g_contact.linkedin_url,
                    city=g_contact.city,
                    created_by=user.id
                )
                db.add(crm_cont)
                db.flush()
                pulled_conts += 1

            if not primary_contact:
                primary_contact = crm_cont

        # Create active CRM lead from pulled company
        existing_lead = db.query(Lead).filter(
            Lead.organization_id == organization_id,
            Lead.company_id == crm_comp.id
        ).first()

        if not existing_lead:
            new_lead = Lead(
                organization_id=organization_id,
                company_id=crm_comp.id,
                contact_id=primary_contact.id if primary_contact else None,
                pipeline_stage_id=stage.id,
                owner_id=target_owner_id or user.id,
                title=f"{crm_comp.name} - Global Expansion",
                company_name=crm_comp.name,
                contact_name=primary_contact.full_name if primary_contact else None,
                contact_email=primary_contact.email if primary_contact else crm_comp.email,
                contact_phone=primary_contact.phone if primary_contact else crm_comp.phone,
                source="GLOBAL_PULL",
                source_global_company_id=g_comp.id,
                status="OPEN",
                priority="HIGH",
                score=75,
                created_by=user.id
            )
            db.add(new_lead)
            db.flush()

            # Record Stage History
            history = LeadStageHistory(
                organization_id=organization_id,
                lead_id=new_lead.id,
                from_stage_id=None,
                to_stage_id=stage.id,
                changed_by=user.id,
                reason="Pulled from Global Intelligence Registry",
                duration_seconds=0
            )
            db.add(history)
            created_leads += 1

            # Log Pull
            pull_log = GlobalDataPullLog(
                organization_id=organization_id,
                pulled_by=user.id,
                global_company_id=g_comp.id,
                global_contact_id=primary_contact.source_global_contact_id if primary_contact else None,
                resulting_company_id=crm_comp.id,
                resulting_contact_id=primary_contact.id if primary_contact else None,
                resulting_lead_id=new_lead.id,
                snapshot_json={
                    "company_name": g_comp.legal_name,
                    "cin": g_comp.registry_id,
                    "city": g_comp.city,
                    "industry": g_comp.industry
                }
            )
            db.add(pull_log)

    # 3. Deduct Quota
    sub.pull_quota_used += needed
    db.commit()

    return GlobalPullResponse(
        pulled_companies=pulled_comps,
        pulled_contacts=pulled_conts,
        created_leads=created_leads,
        remaining_quota=sub.pull_quota_monthly - sub.pull_quota_used
    )
