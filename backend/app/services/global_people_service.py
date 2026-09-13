from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.global_people import GlobalPerson
from app.models.company import Company
from app.models.contact import Contact
from app.models.lead import Lead
from app.models.lead_history import LeadStageHistory
from app.models.organization import Organization
from app.models.user import User
from app.schemas.global_people import GlobalPersonCreate, GlobalPersonUpdate, GlobalPersonOut, GlobalPeoplePullResponse
from app.services.pipeline_service import get_first_stage, get_stage_by_id


def search_global_people(
    db: Session,
    search: Optional[str] = None,
    department: Optional[str] = None,
    seniority: Optional[str] = None,
    city: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: Optional[User] = None
) -> List[GlobalPersonOut]:
    query = db.query(GlobalPerson)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (GlobalPerson.full_name.ilike(s)) |
            (GlobalPerson.company_name.ilike(s)) |
            (GlobalPerson.designation.ilike(s)) |
            (GlobalPerson.email.ilike(s)) |
            (GlobalPerson.phone.ilike(s))
        )
    if department and department != "ALL":
        query = query.filter(GlobalPerson.department.ilike(department))
    if seniority and seniority != "ALL":
        query = query.filter(GlobalPerson.seniority.ilike(seniority))
    if city and city.strip():
        query = query.filter(GlobalPerson.city.ilike(f"%{city.strip()}%"))

    people = query.order_by(GlobalPerson.last_updated_at.desc()).offset(skip).limit(limit).all()
    results = []
    for p in people:
        p_dict = {k: v for k, v in p.__dict__.items() if not k.startswith("_")}
        if not (current_user and current_user.is_super_admin):
            p_dict["pull_history"] = []
        results.append(GlobalPersonOut(**p_dict))
    return results


def create_global_person(db: Session, data: GlobalPersonCreate) -> GlobalPersonOut:
    assoc_comps = []
    if data.associated_companies:
        for ac in data.associated_companies:
            c_name = ac.company_name.strip() if hasattr(ac, 'company_name') else (ac.get('company_name', '').strip() if isinstance(ac, dict) else '')
            d_name = (ac.designation.strip() if hasattr(ac, 'designation') and ac.designation else (ac.get('designation', '').strip() if isinstance(ac, dict) and ac.get('designation') else ''))
            if c_name:
                assoc_comps.append({"company_name": c_name, "designation": d_name})

    primary_company = data.company_name.strip() if data.company_name else (assoc_comps[0]["company_name"] if assoc_comps else None)
    primary_designation = data.designation.strip() if data.designation else (assoc_comps[0]["designation"] if assoc_comps and assoc_comps[0].get("designation") else None)

    # If primary company was provided but not in assoc_comps, add it
    if primary_company and not any(ac.get("company_name", "").lower() == primary_company.lower() for ac in assoc_comps):
        assoc_comps.insert(0, {"company_name": primary_company, "designation": primary_designation or ""})

    person = GlobalPerson(
        full_name=data.full_name.strip(),
        email=data.email.strip() if data.email else None,
        phone=data.phone.strip() if data.phone else None,
        designation=primary_designation,
        company_name=primary_company,
        associated_companies=assoc_comps,
        industry=data.industry.strip() if data.industry else None,
        seniority=data.seniority.strip() if data.seniority else None,
        department=data.department.strip() if data.department else None,
        linkedin_url=data.linkedin_url.strip() if data.linkedin_url else None,
        city=data.city.strip() if data.city else None,
        state=data.state.strip() if data.state else None,
        country=data.country.strip() if data.country else "India",
        estimated_value=float(data.estimated_value or 0.0),
        status=data.status or "ACTIVE",
        source=data.source or "MANUAL",
        notes=data.notes.strip() if data.notes else None,
    )
    db.add(person)
    db.commit()
    try:
        db.refresh(person)
    except Exception:
        pass
    return GlobalPersonOut.from_orm(person)


def update_global_person(db: Session, person_id: str, data: GlobalPersonUpdate) -> GlobalPersonOut:
    person = db.query(GlobalPerson).filter(GlobalPerson.id == person_id).first()
    if not person:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Global person lead not found")

    if data.full_name is not None:
        person.full_name = data.full_name.strip()
    if data.email is not None:
        person.email = data.email.strip() if data.email else None
    if data.phone is not None:
        person.phone = data.phone.strip() if data.phone else None
    if data.designation is not None:
        person.designation = data.designation.strip() if data.designation else None
    if data.company_name is not None:
        person.company_name = data.company_name.strip() if data.company_name else None
    if data.associated_companies is not None:
        assoc_comps = []
        for ac in data.associated_companies:
            c_name = ac.company_name.strip() if hasattr(ac, 'company_name') else (ac.get('company_name', '').strip() if isinstance(ac, dict) else '')
            d_name = (ac.designation.strip() if hasattr(ac, 'designation') and ac.designation else (ac.get('designation', '').strip() if isinstance(ac, dict) and ac.get('designation') else ''))
            if c_name:
                assoc_comps.append({"company_name": c_name, "designation": d_name})
        person.associated_companies = assoc_comps
    if data.industry is not None:
        person.industry = data.industry.strip() if data.industry else None
    if data.seniority is not None:
        person.seniority = data.seniority.strip() if data.seniority else None
    if data.department is not None:
        person.department = data.department.strip() if data.department else None
    if data.linkedin_url is not None:
        person.linkedin_url = data.linkedin_url.strip() if data.linkedin_url else None
    if data.city is not None:
        person.city = data.city.strip() if data.city else None
    if data.state is not None:
        person.state = data.state.strip() if data.state else None
    if data.country is not None:
        person.country = data.country.strip() if data.country else "India"
    if data.estimated_value is not None:
        person.estimated_value = float(data.estimated_value)
    if data.status is not None:
        person.status = data.status
    if data.notes is not None:
        person.notes = data.notes.strip() if data.notes else None

    db.commit()
    try:
        db.refresh(person)
    except Exception:
        pass
    return GlobalPersonOut.from_orm(person)


def pull_global_people_to_crm(
    db: Session,
    organization_id: str,
    user: User,
    global_people_ids: List[str],
    target_stage_id: Optional[str] = None,
    target_owner_id: Optional[str] = None
) -> GlobalPeoplePullResponse:
    # 1. Verify organization exists
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target organization not found"
        )

    # 2. Resolve target stage
    if target_stage_id:
        stage = get_stage_by_id(db, target_stage_id, organization_id)
    else:
        stage = get_first_stage(db, organization_id)

    pulled_people = 0
    created_contacts = 0
    created_companies = 0
    created_leads = 0

    owner_id = target_owner_id or user.id
    now_utc = datetime.now(timezone.utc)
    org_name = org.name

    for person_id in global_people_ids:
        person = db.query(GlobalPerson).filter(GlobalPerson.id == person_id).first()
        if not person:
            continue

        pulled_people += 1
        # Append to pull_history instead of marking as PULLED for everyone
        current_history = list(person.pull_history) if person.pull_history else []
        current_history.append({
            "org_id": organization_id,
            "org_name": org_name,
            "pulled_by": user.id,
            "pulled_at": now_utc.isoformat()
        })
        person.pull_history = current_history
        person.pull_status = "AVAILABLE"

        # 3. Company resolution & creation
        company = None
        if person.company_name:
            company = db.query(Company).filter(
                Company.organization_id == organization_id,
                Company.name.ilike(person.company_name.strip())
            ).first()
            if not company:
                company = Company(
                    organization_id=organization_id,
                    name=person.company_name.strip(),
                    industry=person.industry,
                    city=person.city,
                    state=person.state,
                    country=person.country or "India",
                    created_by=user.id
                )
                db.add(company)
                db.flush()
                created_companies += 1

        # 4. Contact resolution & creation
        contact = None
        cont_query = db.query(Contact).filter(Contact.organization_id == organization_id)
        if person.email:
            contact = cont_query.filter(Contact.email == person.email).first()
        if not contact and person.phone:
            contact = cont_query.filter(Contact.phone == person.phone).first()
        if not contact:
            contact = cont_query.filter(Contact.full_name.ilike(person.full_name)).first()

        if not contact:
            contact = Contact(
                organization_id=organization_id,
                company_id=company.id if company else None,
                full_name=person.full_name,
                designation=person.designation,
                department=person.department,
                email=person.email,
                phone=person.phone,
                linkedin_url=person.linkedin_url,
                city=person.city,
                state=person.state,
                country=person.country or "India",
                created_by=user.id
            )
            db.add(contact)
            db.flush()
            created_contacts += 1

        # 5. Lead deduplication & creation
        lead_query = db.query(Lead).filter(Lead.organization_id == organization_id)
        existing_lead = None
        if person.phone:
            existing_lead = lead_query.filter(Lead.contact_phone == person.phone).first()
        if not existing_lead and person.email:
            existing_lead = lead_query.filter(Lead.contact_email == person.email).first()

        if not existing_lead:
            lead_title = f"{person.designation or 'Lead'}: {person.full_name}"
            if person.company_name:
                lead_title = f"{person.company_name} - {person.full_name}"

            lead = Lead(
                organization_id=organization_id,
                company_id=company.id if company else None,
                contact_id=contact.id if contact else None,
                pipeline_stage_id=stage.id,
                owner_id=owner_id,
                title=lead_title,
                company_name=person.company_name or (company.name if company else None),
                contact_name=person.full_name,
                contact_email=person.email,
                contact_phone=person.phone,
                value=float(person.estimated_value or 0.0),
                source="GLOBAL_PEOPLE",
                status="OPEN",
                priority="HIGH" if person.seniority in ("C-Level", "VP", "Director") else "MEDIUM",
                score=75 if person.seniority in ("C-Level", "VP") else 60,
                created_by=user.id
            )
            db.add(lead)
            db.flush()

            # Record stage transition history
            history = LeadStageHistory(
                organization_id=organization_id,
                lead_id=lead.id,
                from_stage_id=None,
                to_stage_id=stage.id,
                changed_by=user.id,
                reason="Pulled from Global People Intelligence Registry",
                duration_seconds=0
            )
            db.add(history)
            created_leads += 1

    db.commit()

    return GlobalPeoplePullResponse(
        pulled_people=pulled_people,
        created_contacts=created_contacts,
        created_companies=created_companies,
        created_leads=created_leads,
        remaining_quota=None
    )


def update_global_person(db: Session, person_id: str, data: GlobalPersonUpdate) -> GlobalPersonOut:
    person = db.query(GlobalPerson).filter(GlobalPerson.id == person_id).first()
    if not person:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Person profile with ID '{person_id}' not found."
        )

    fields = [
        "full_name", "email", "phone", "designation", "company_name",
        "industry", "seniority", "department", "linkedin_url",
        "city", "state", "country", "estimated_value", "status", "notes"
    ]
    for field in fields:
        val = getattr(data, field)
        if val is not None:
            setattr(person, field, val.strip() if isinstance(val, str) else val)

    if data.associated_companies is not None:
        assoc_comps = []
        for ac in data.associated_companies:
            c_name = ac.company_name.strip() if hasattr(ac, 'company_name') else (ac.get('company_name', '').strip() if isinstance(ac, dict) else '')
            d_name = (ac.designation.strip() if hasattr(ac, 'designation') and ac.designation else (ac.get('designation', '').strip() if isinstance(ac, dict) and ac.get('designation') else ''))
            if c_name:
                assoc_comps.append({"company_name": c_name, "designation": d_name})
        person.associated_companies = assoc_comps

    person.last_updated_at = datetime.now(timezone.utc)
    db.commit()
    try:
        db.refresh(person)
    except Exception:
        pass
    return GlobalPersonOut.from_orm(person)

