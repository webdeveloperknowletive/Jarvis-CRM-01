import os
import re
import csv
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
from app.models.pipeline import PipelineStage
from app.models.user import User
from app.services.pipeline_service import get_first_stage, get_stage_by_id
from app.services.company_service import get_or_create_company
from app.services.contact_service import get_or_create_contact

COLUMN_PATTERNS = {
    "company_name": [r"company", r"organization", r"org", r"business", r"firm", r"account", r"legal_name"],
    "contact_name": [r"contact", r"person", r"name", r"director", r"decision_maker", r"client"],
    "contact_email": [r"email", r"mail", r"e-mail"],
    "contact_phone": [r"phone", r"mobile", r"cell", r"contact_no", r"tel", r"telephone"],
    "title": [r"title", r"deal", r"opportunity", r"project"],
    "city": [r"city", r"location", r"town"],
    "state": [r"state", r"province"],
    "cin": [r"cin", r"registration", r"reg_no"],
    "value": [r"value", r"amount", r"budget", r"revenue", r"deal_size"],
    "industry": [r"industry", r"sector", r"category"],
    "designation": [r"designation", r"job_title", r"role", r"position"],
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

    headers = [str(c).strip() for c in df.columns]
    sample_rows = df.head(5).fillna("").to_dict(orient="records")

    # Smart column mapping suggestion
    suggested_mapping = {}
    for header in headers:
        header_lower = header.lower()
        matched = False
        for system_field, patterns in COLUMN_PATTERNS.items():
            if any(re.search(pat, header_lower) for pat in patterns):
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

        is_global = (job.job_type or "").upper() in ("GLOBAL_COMPANIES", "GLOBAL_DATABASE")
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
                cin = str(row[reverse_map["cin"]]).strip() if "cin" in reverse_map and not pd.isna(row[reverse_map["cin"]]) else None
                designation = str(row[reverse_map["designation"]]).strip() if "designation" in reverse_map and not pd.isna(row[reverse_map["designation"]]) else None
                industry = str(row[reverse_map["industry"]]).strip() if "industry" in reverse_map and not pd.isna(row[reverse_map["industry"]]) else None

                # Normalization
                email = normalize_email(raw_email)
                phone = normalize_phone(raw_phone)

                if is_global:
                    if not comp_name:
                        error = ImportRowError(
                            job_id=job.id,
                            row_number=row_num,
                            raw_data=raw_dict,
                            error_code="EMPTY_COMPANY",
                            error_message="Global database row must have a company name"
                        )
                        db.add(error)
                        errors += 1
                        continue

                    # Upsert Global Company
                    cin_clean = cin.strip().upper() if cin else None
                    g_comp = None
                    if cin_clean:
                        g_comp = db.query(GlobalCompany).filter(GlobalCompany.registry_id == cin_clean).first()
                    if not g_comp:
                        g_comp = db.query(GlobalCompany).filter(GlobalCompany.legal_name.ilike(comp_name)).first()

                    if not g_comp:
                        cin_val = cin_clean or f"U{re.sub(r'[^A-Z0-9]', '', comp_name.upper())[:18]}{idx:02d}"
                        g_comp = GlobalCompany(
                            registry_id=cin_val,
                            legal_name=comp_name,
                            display_name=comp_name,
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
