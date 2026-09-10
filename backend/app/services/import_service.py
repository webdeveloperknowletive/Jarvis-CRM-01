import os
import re
import csv
import uuid
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
import pandas as pd
from sqlalchemy.orm import Session

from app.models.import_job import ImportJob, ImportRowError
from app.models.lead import Lead
from app.models.lead_history import LeadStageHistory
from app.models.company import Company
from app.models.contact import Contact
from app.models.global_registry import GlobalCompany, GlobalContact, GlobalCompanyContactMap
from app.models.global_people import GlobalPerson
from app.models.pipeline import PipelineStage
from app.models.user import User
from app.services.pipeline_service import get_first_stage, get_stage_by_id
from app.services.company_service import get_or_create_company
from app.services.contact_service import get_or_create_contact

COLUMN_PATTERNS = {
    "id": [r"^id$", r"company_id", r"uuid", r"unique_id", r"identifier"],
    "contact_phone": [r"company_contact_number", r"contact_number", r"company_phone", r"phone", r"mobile", r"cell", r"contact_no", r"tel", r"telephone"],
    "contact_email": [r"company_email", r"contact_email", r"email_id", r"email", r"mail", r"e-mail"],
    "associated_companies": [r"associated_companies", r"associated_company", r"companies", r"other_companies", r"affiliations"],
    "company_name": [r"company_name", r"^company$", r"organization", r"^org$", r"business", r"firm", r"account", r"legal_name"],
    "contact_name": [r"contact_name", r"contact_person", r"^contact$", r"^person$", r"^name$", r"director", r"decision_maker", r"client", r"full_name"],
    "cin": [r"^cin$", r"cin_number", r"corporate_id"],
    "registration_number": [r"registration_number", r"registration_no", r"reg_no", r"reg_num", r"registration"],
    "gst_number": [r"gst_number", r"gst_no", r"gstin", r"gst"],
    "address": [r"address", r"street", r"office_address", r"location_address"],
    "postal_code": [r"pincode", r"pin_code", r"postal_code", r"zip", r"zipcode", r"postal"],
    "city": [r"city", r"location", r"town", r"district"],
    "state": [r"state", r"province"],
    "website": [r"website", r"web", r"domain", r"url", r"site"],
    "designation": [r"designation_with_each_company", r"designation", r"job_title", r"role", r"position"],
    "title": [r"title", r"deal", r"opportunity", r"project"],
    "value": [r"value", r"amount", r"budget", r"revenue", r"deal_size"],
    "industry": [r"industry", r"sector", r"category"],
    "seniority": [r"seniority", r"level", r"tier"],
    "department": [r"department", r"dept", r"function", r"division"],
    "linkedin_url": [r"linkedin", r"profile", r"social"],
    "notes": [r"notes", r"bio", r"summary", r"description", r"comments"],
}


def normalize_phone(phone_raw: Any) -> Optional[str]:
    if pd.isna(phone_raw) or not str(phone_raw).strip():
        return None
    val = str(phone_raw).strip()
    # Remove floating point decimals from Excel like 9876543210.0
    if val.endswith(".0"):
        val = val[:-2]
    # Remove spaces, parentheses, hyphens
    val = re.sub(r"[\s\(\)\-\.]", "", val)
    return val if len(val) >= 6 else None


def normalize_email(email_raw: Any) -> Optional[str]:
    if pd.isna(email_raw) or not str(email_raw).strip():
        return None
    val = str(email_raw).strip().lower()
    if "@" in val and "." in val:
        return val
    return None


def detect_file_encoding(file_path: str) -> str:
    # Try utf-8, fallback to latin-1
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            f.read(4096)
        return "utf-8"
    except UnicodeDecodeError:
        return "latin-1"


def preview_import_file(file_path: str, file_type: str) -> Dict[str, Any]:
    file_type = file_type.upper()
    if file_type == "CSV":
        encoding = detect_file_encoding(file_path)
        df = pd.read_csv(file_path, encoding=encoding, nrows=50)
        # get total row count
        with open(file_path, "r", encoding=encoding) as f:
            total_rows = sum(1 for _ in f) - 1
    elif file_type in ("XLSX", "XLS"):
        df = pd.read_excel(file_path, nrows=50)
        total_rows = len(pd.read_excel(file_path))
    else:
        raise ValueError(f"Unsupported file format: {file_type}")

    headers = [str(c).strip() for c in df.columns if not str(c).startswith("Unnamed:")]
    if len(headers) == 0:
        raise ValueError("The uploaded spreadsheet does not contain any recognizable column headers.")
    if total_rows <= 0 and len(df) == 0:
        raise ValueError("The uploaded spreadsheet contains no data rows. Please verify your sheet has data below the headers.")

    sample_rows = df.head(5).fillna("").to_dict(orient="records")

    # Smart column mapping suggestion
    suggested_mapping = {}
    for header in headers:
        header_lower = header.lower().strip()
        norm_header = re.sub(r"[\s\-]+", "_", header_lower)
        matched = False
        for system_field, patterns in COLUMN_PATTERNS.items():
            if any(re.search(pat, header_lower) or re.search(pat, norm_header) for pat in patterns):
                if system_field not in suggested_mapping.values():
                    suggested_mapping[header] = system_field
                    matched = True
                    break
        if not matched:
            suggested_mapping[header] = "ignore"

    return {
        "detected_headers": headers,
        "sample_rows": sample_rows,
        "suggested_mappings": suggested_mapping,
        "total_detected_rows": max(0, total_rows)
    }


def execute_import_job(db: Session, job_id: str) -> ImportJob:
    job = db.query(ImportJob).filter(ImportJob.id == job_id).first()
    if not job:
        raise ValueError(f"Import job {job_id} not found")

    job.status = "PROCESSING"
    job.started_at = datetime.now(timezone.utc)
    db.commit()

    try:
        file_path = job.file_path
        file_type = job.file_type.upper()
        mapping = job.column_mapping or {}

        is_global_companies = (job.job_type or "").upper() in ("GLOBAL_COMPANIES", "GLOBAL_DATABASE")
        is_global_people = (job.job_type or "").upper() == "GLOBAL_PEOPLE"
        is_global = is_global_companies or is_global_people
        stage = None
        organization_id = None

        if not is_global:
            # Resolve Target Pipeline Stage without modifying the pipeline!
            organization_id = job.organization_id
            target_stage_id = job.target_stage_id
            if target_stage_id:
                stage = get_stage_by_id(db, target_stage_id, organization_id)
            else:
                stage = get_first_stage(db, organization_id)

        # Read dataset
        if file_type == "CSV":
            encoding = detect_file_encoding(file_path)
            df = pd.read_csv(file_path, encoding=encoding)
        elif file_type in ("XLSX", "XLS"):
            df = pd.read_excel(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_type}")

        total = len(df)
        job.total_rows = total
        db.commit()

        # Inversion of mapping: system_field -> csv_column
        reverse_map = {v: k for k, v in mapping.items() if v != "ignore"}

        successful = 0
        duplicates = 0
        errors = 0

        for idx, row in df.iterrows():
            row_num = idx + 1
            raw_dict = {str(k): ("" if pd.isna(v) else str(v)) for k, v in row.items()}

            try:
                # Extract fields
                comp_name = str(row[reverse_map["company_name"]]).strip() if "company_name" in reverse_map and not pd.isna(row[reverse_map["company_name"]]) else None
                cont_name = str(row[reverse_map["contact_name"]]).strip() if "contact_name" in reverse_map and not pd.isna(row[reverse_map["contact_name"]]) else None
                raw_email = row[reverse_map["contact_email"]] if "contact_email" in reverse_map else None
                raw_phone = row[reverse_map["contact_phone"]] if "contact_phone" in reverse_map else None
                lead_title = str(row[reverse_map["title"]]).strip() if "title" in reverse_map and not pd.isna(row[reverse_map["title"]]) else None
                city = str(row[reverse_map["city"]]).strip() if "city" in reverse_map and not pd.isna(row[reverse_map["city"]]) else None
                state_name = str(row[reverse_map["state"]]).strip() if "state" in reverse_map and not pd.isna(row[reverse_map["state"]]) else None
                postal_code = str(row[reverse_map["postal_code"]]).strip() if "postal_code" in reverse_map and not pd.isna(row[reverse_map["postal_code"]]) else None
                address = str(row[reverse_map["address"]]).strip() if "address" in reverse_map and not pd.isna(row[reverse_map["address"]]) else None
                website = str(row[reverse_map["website"]]).strip() if "website" in reverse_map and not pd.isna(row[reverse_map["website"]]) else None
                cin = str(row[reverse_map["cin"]]).strip() if "cin" in reverse_map and not pd.isna(row[reverse_map["cin"]]) else None
                reg_num = str(row[reverse_map["registration_number"]]).strip() if "registration_number" in reverse_map and not pd.isna(row[reverse_map["registration_number"]]) else None
                gst_num = str(row[reverse_map["gst_number"]]).strip() if "gst_number" in reverse_map and not pd.isna(row[reverse_map["gst_number"]]) else None
                row_id = str(row[reverse_map["id"]]).strip() if "id" in reverse_map and not pd.isna(row[reverse_map["id"]]) else None
                assoc_raw = str(row[reverse_map["associated_companies"]]).strip() if "associated_companies" in reverse_map and not pd.isna(row[reverse_map["associated_companies"]]) else None
                designation = str(row[reverse_map["designation"]]).strip() if "designation" in reverse_map and not pd.isna(row[reverse_map["designation"]]) else None
                industry = str(row[reverse_map["industry"]]).strip() if "industry" in reverse_map and not pd.isna(row[reverse_map["industry"]]) else None
                seniority = str(row[reverse_map["seniority"]]).strip() if "seniority" in reverse_map and not pd.isna(row[reverse_map["seniority"]]) else None
                department = str(row[reverse_map["department"]]).strip() if "department" in reverse_map and not pd.isna(row[reverse_map["department"]]) else None
                linkedin_url = str(row[reverse_map["linkedin_url"]]).strip() if "linkedin_url" in reverse_map and not pd.isna(row[reverse_map["linkedin_url"]]) else None
                notes = str(row[reverse_map["notes"]]).strip() if "notes" in reverse_map and not pd.isna(row[reverse_map["notes"]]) else None
                raw_val = row[reverse_map["value"]] if "value" in reverse_map and not pd.isna(row[reverse_map["value"]]) else 0.0

                # Normalization
                email = normalize_email(raw_email)
                phone = normalize_phone(raw_phone)

                if is_global_people:
                    person_name = cont_name or lead_title
                    if not person_name:
                        error = ImportRowError(
                            job_id=job.id,
                            row_number=row_num,
                            raw_data=raw_dict,
                            error_code="EMPTY_NAME",
                            error_message="People Intelligence row must have a contact or person name"
                        )
                        db.add(error)
                        errors += 1
                        continue

                    # Deduplication check in global_people
                    dup = None
                    if email:
                        dup = db.query(GlobalPerson).filter(GlobalPerson.email == email).first()
                    if not dup and phone:
                        dup = db.query(GlobalPerson).filter(GlobalPerson.phone == phone).first()
                    if not dup and comp_name:
                        dup = db.query(GlobalPerson).filter(
                            GlobalPerson.full_name.ilike(person_name),
                            GlobalPerson.company_name.ilike(comp_name)
                        ).first()

                    if dup:
                        duplicates += 1
                        continue

                    try:
                        val_num = float(raw_val)
                    except Exception:
                        val_num = 0.0

                    # Parse associated companies
                    assoc_list = []
                    if assoc_raw:
                        parts = re.split(r"[,;|]+", assoc_raw)
                        for part in parts:
                            p = part.strip()
                            if not p:
                                continue
                            m = re.match(r"^([^\(\-]+)(?:[\(\-]([^\)\-]+)\)?)?$", p)
                            if m:
                                c_part = m.group(1).strip()
                                d_part = m.group(2).strip() if m.group(2) else ""
                                if c_part:
                                    assoc_list.append({"company_name": c_part, "designation": d_part})
                            else:
                                assoc_list.append({"company_name": p, "designation": ""})

                    if comp_name:
                        if not any(a["company_name"].lower() == comp_name.lower() for a in assoc_list):
                            assoc_list.insert(0, {"company_name": comp_name, "designation": designation or ""})
                    elif assoc_list:
                        comp_name = assoc_list[0]["company_name"]
                        if not designation and assoc_list[0].get("designation"):
                            designation = assoc_list[0]["designation"]

                    new_person = GlobalPerson(
                        full_name=person_name,
                        email=email,
                        phone=phone,
                        designation=designation,
                        company_name=comp_name,
                        associated_companies=assoc_list,
                        industry=industry,
                        seniority=seniority,
                        department=department,
                        linkedin_url=linkedin_url,
                        city=city,
                        state=state_name,
                        country="India",
                        estimated_value=val_num,
                        status="ACTIVE",
                        source="IMPORT",
                        notes=notes
                    )
                    db.add(new_person)
                    successful += 1

                elif is_global_companies:
                    if not comp_name:
                        error = ImportRowError(
                            job_id=job.id,
                            row_number=row_num,
                            raw_data=raw_dict,
                            error_code="EMPTY_COMPANY",
                            error_message="Company Intelligence row must have a company name"
                        )
                        db.add(error)
                        errors += 1
                        continue

                    # Determine company UUID
                    company_uuid = row_id if (row_id and len(row_id) >= 10) else str(uuid.uuid4())
                    if db.query(GlobalCompany).filter(GlobalCompany.id == company_uuid).first():
                        company_uuid = str(uuid.uuid4())

                    # Upsert Global Company
                    cin_clean = cin.strip().upper() if cin else None
                    reg_clean = reg_num.strip() if reg_num else None
                    gst_clean = gst_num.strip().upper() if gst_num else None

                    g_comp = None
                    if cin_clean:
                        g_comp = db.query(GlobalCompany).filter(GlobalCompany.registry_id == cin_clean).first()
                    if not g_comp and reg_clean:
                        g_comp = db.query(GlobalCompany).filter(GlobalCompany.registration_number == reg_clean).first()
                    if not g_comp and gst_clean:
                        g_comp = db.query(GlobalCompany).filter(GlobalCompany.gst_number == gst_clean).first()
                    if not g_comp:
                        g_comp = db.query(GlobalCompany).filter(GlobalCompany.legal_name.ilike(comp_name)).first()

                    if not g_comp:
                        cin_val = cin_clean or reg_clean or f"REG-{uuid.uuid4().hex[:8].upper()}"
                        if db.query(GlobalCompany).filter(GlobalCompany.registry_id == cin_val).first():
                            cin_val = f"{cin_val}-{uuid.uuid4().hex[:4].upper()}"

                        g_comp = GlobalCompany(
                            id=company_uuid,
                            registry_country="IN",
                            registry_type="CIN" if cin_clean else "OTHER",
                            registry_id=cin_val,
                            legal_name=comp_name,
                            display_name=comp_name,
                            cin=cin_clean,
                            registration_number=reg_clean,
                            gst_number=gst_clean,
                            address=address,
                            postal_code=postal_code,
                            website=website,
                            industry=industry,
                            email=email,
                            phone=phone,
                            city=city,
                            state=state_name,
                            country="India",
                            status="ACTIVE"
                        )
                        db.add(g_comp)
                        db.flush()
                    else:
                        if city and not g_comp.city: g_comp.city = city
                        if state_name and not g_comp.state: g_comp.state = state_name
                        if address and not g_comp.address: g_comp.address = address
                        if postal_code and not g_comp.postal_code: g_comp.postal_code = postal_code
                        if website and not g_comp.website: g_comp.website = website
                        if cin_clean and not g_comp.cin: g_comp.cin = cin_clean
                        if reg_clean and not g_comp.registration_number: g_comp.registration_number = reg_clean
                        if gst_clean and not g_comp.gst_number: g_comp.gst_number = gst_clean
                        if industry and not g_comp.industry: g_comp.industry = industry
                        if phone and not g_comp.phone: g_comp.phone = phone
                        if email and not g_comp.email: g_comp.email = email

                    # Upsert Global Contact
                    if cont_name:
                        g_cont = None
                        if email:
                            g_cont = db.query(GlobalContact).filter(GlobalContact.email == email).first()
                        elif phone:
                            g_cont = db.query(GlobalContact).filter(GlobalContact.phone == phone).first()
                        if not g_cont:
                            g_cont = db.query(GlobalContact).filter(GlobalContact.full_name.ilike(cont_name)).first()

                        if not g_cont:
                            g_cont = GlobalContact(
                                full_name=cont_name,
                                designation=designation or "Director",
                                email=email,
                                phone=phone,
                                city=city,
                                status="ACTIVE"
                            )
                            db.add(g_cont)
                            db.flush()

                        # Link in GlobalCompanyContactMap
                        mapping_entry = db.query(GlobalCompanyContactMap).filter(
                            GlobalCompanyContactMap.company_id == g_comp.id,
                            GlobalCompanyContactMap.contact_id == g_cont.id
                        ).first()
                        if not mapping_entry:
                            mapping_entry = GlobalCompanyContactMap(
                                company_id=g_comp.id,
                                contact_id=g_cont.id,
                                designation=designation or "Director"
                            )
                            db.add(mapping_entry)

                    successful += 1

                else:
                    # Row validation
                    if not comp_name and not cont_name and not lead_title:
                        error = ImportRowError(
                            job_id=job.id,
                            row_number=row_num,
                            raw_data=raw_dict,
                            error_code="EMPTY_IDENTIFIER",
                            error_message="Row has no company name, contact name, or lead title"
                        )
                        db.add(error)
                        errors += 1
                        continue

                    final_title = lead_title or (f"{comp_name} - Opportunity" if comp_name else f"Lead: {cont_name}")

                    # 1. Company Resolution & Deduplication
                    company = None
                    if comp_name:
                        company, _ = get_or_create_company(
                            db=db,
                            organization_id=organization_id,
                            name=comp_name,
                            cin=cin,
                            city=city,
                            user_id=job.uploaded_by
                        )

                    # 2. Contact Resolution & Deduplication
                    contact = None
                    if cont_name:
                        contact, _ = get_or_create_contact(
                            db=db,
                            organization_id=organization_id,
                            full_name=cont_name,
                            phone=phone,
                            email=email,
                            company_id=company.id if company else None,
                            designation=designation,
                            user_id=job.uploaded_by
                        )

                    # 3. Duplicate Detection for Lead
                    dup_query = db.query(Lead).filter(Lead.organization_id == organization_id)
                    is_dup = False
                    if phone:
                        if dup_query.filter(Lead.contact_phone == phone).first():
                            is_dup = True
                    elif email:
                        if dup_query.filter(Lead.contact_email == email).first():
                            is_dup = True

                    if is_dup:
                        duplicates += 1
                        continue

                    # 4. Create Lead Record referencing target stage
                    new_lead = Lead(
                        organization_id=organization_id,
                        company_id=company.id if company else None,
                        contact_id=contact.id if contact else None,
                        pipeline_stage_id=stage.id,
                        owner_id=job.target_owner_id or job.uploaded_by,
                        title=final_title,
                        company_name=comp_name or (company.name if company else None),
                        contact_name=cont_name or (contact.full_name if contact else None),
                        contact_email=email,
                        contact_phone=phone,
                        source="IMPORT",
                        status="OPEN",
                        priority="MEDIUM",
                        score=60,
                        created_by=job.uploaded_by
                    )
                    db.add(new_lead)
                    db.flush()

                    # 5. Append Initial Stage History
                    history = LeadStageHistory(
                        organization_id=organization_id,
                        lead_id=new_lead.id,
                        from_stage_id=None,
                        to_stage_id=stage.id,
                        changed_by=job.uploaded_by,
                        reason=f"Batch Import: {job.file_name}",
                        duration_seconds=0
                    )
                    db.add(history)
                    successful += 1

                # Periodic commit every 250 rows for safety & memory control
                if row_num % 250 == 0:
                    job.processed_rows = row_num
                    job.successful_rows = successful
                    job.duplicate_rows = duplicates
                    job.error_rows = errors
                    db.commit()

            except Exception as row_exc:
                db.rollback()
                errors += 1
                error = ImportRowError(
                    job_id=job.id,
                    row_number=row_num,
                    raw_data=raw_dict,
                    error_code="ROW_PROCESSING_ERROR",
                    error_message=str(row_exc)[:500]
                )
                db.add(error)
                db.commit()

        job.processed_rows = total
        job.successful_rows = successful
        job.duplicate_rows = duplicates
        job.error_rows = errors
        job.status = "COMPLETED" if errors == 0 else "PARTIAL"
        job.completed_at = datetime.now(timezone.utc)
        job.error_summary = {
            "total_rows": total,
            "successful_rows": successful,
            "duplicate_rows": duplicates,
            "error_rows": errors,
            "completion_rate": f"{(successful / total * 100):.1f}%" if total > 0 else "0%"
        }
        db.commit()
        db.refresh(job)
        return job

    except Exception as exc:
        db.rollback()
        job.status = "FAILED"
        job.completed_at = datetime.now(timezone.utc)
        job.error_summary = {"fatal_error": str(exc)}
        db.commit()
        db.refresh(job)
        return job
