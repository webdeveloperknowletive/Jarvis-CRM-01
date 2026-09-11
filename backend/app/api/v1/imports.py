import os
import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.deps import get_db, get_current_user, get_tenant_id, get_optional_tenant_id
from app.models.user import User
from app.models.import_job import ImportJob, ImportRowError
from app.models.base import utc_now
from app.schemas.import_job import (
    ImportPreviewResponse, ImportJobExecuteRequest, ImportJobOut, ImportRowErrorOut
)
from app.services.import_service import preview_import_file, execute_import_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/imports", tags=["Import Ingestion Engine"])

# Ensure upload directory exists
os.makedirs(settings.STORAGE_LOCAL_DIR, exist_ok=True)


def background_import_runner(job_id: str, schema_name: Optional[str] = None):
    """Background task function that opens its own session and executes the import job"""
    db = SessionLocal()
    try:
        if schema_name and db.bind and db.bind.dialect.name == "postgresql":
            db.execute(text(f'SET search_path TO "{schema_name}", public'))
        elif db.bind and db.bind.dialect.name == "postgresql":
            db.execute(text('SET search_path TO public'))
        execute_import_job(db, job_id)
    except Exception as exc:
        logger.error(f"Background import execution failed for job {job_id}: {exc}", exc_info=True)
    finally:
        db.close()


ALLOWED_TABULAR_EXTENSIONS = (".csv", ".xls", ".xlsx", ".xlsb", ".xlsm", ".parquet", ".json")


@router.post("/upload", response_model=ImportPreviewResponse)
async def upload_import_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    # Strictly validate tabular extensions
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if ext not in ALLOWED_TABULAR_EXTENSIONS:
        invalid_type = ext.replace(".", "").upper() if ext else "UNKNOWN"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file format '{invalid_type}'. Data ingestion strictly requires tabular spreadsheet files (.CSV, .XLS, .XLSX, .XLSB, .XLSM, .PARQUET, .JSON). Non-tabular formats such as .PDF, .TXT, .MD, .ZIP, .HTML are not supported."
        )

    # Save to disk with absolute path
    file_id = str(uuid.uuid4())
    save_filename = f"{file_id}_{file.filename}"
    file_path = os.path.abspath(os.path.join(settings.STORAGE_LOCAL_DIR, save_filename))

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    file_type = ext.replace(".", "").upper()

    try:
        preview = preview_import_file(file_path, file_type)
        preview["headers"] = preview.get("detected_headers", [])
        preview["preview_rows"] = preview.get("sample_rows", [])
        preview["total_rows_estimate"] = preview.get("total_detected_rows", 0)
        preview["file_path"] = file_path
        preview["file_name"] = file.filename
        preview["file_type"] = file_type
        return preview
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse file: {str(exc)}"
        )


@router.post("/execute", response_model=ImportJobOut, status_code=status.HTTP_202_ACCEPTED)
def execute_import(
    data: ImportJobExecuteRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: Optional[str] = Depends(get_optional_tenant_id)
):
    import json as py_json
    file_path = data.file_path
    if not os.path.exists(file_path):
        fname = os.path.basename(file_path)
        candidates = [
            os.path.abspath(file_path),
            os.path.join(settings.STORAGE_LOCAL_DIR, fname),
            os.path.abspath(os.path.join(settings.STORAGE_LOCAL_DIR, fname)),
            os.path.join("storage_uploads", fname),
            os.path.join("backend", "storage_uploads", fname),
            os.path.abspath(os.path.join("backend", "storage_uploads", fname)),
        ]
        found = False
        for c in candidates:
            if os.path.exists(c):
                file_path = os.path.abspath(c)
                found = True
                break
        if not found:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Uploaded file not found on server: {data.file_path}")

    target_org_id = None
    schema_name = None

    job_type = (data.job_type or "TENANT_LEADS").upper()
    if job_type in ("GLOBAL_COMPANIES", "GLOBAL_DATABASE", "GLOBAL_PEOPLE"):
        if not (current_user.is_super_admin or current_user.platform_role in ("DATA_ENTRY", "DATA_OPS") or current_user.tenant_role == "DATA_ENTRY"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin or Data Entry privilege required for Global Database ingestion")
        target_org_id = None
        # Explicitly ensure clean public schema for global jobs
        if db.bind and db.bind.dialect.name == "postgresql":
            db.execute(text('SET search_path TO public'))
    else:
        if not tenant_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant context required for tenant lead import")
        target_org_id = tenant_id
        # Resolve schema_name
        if target_org_id and db.bind and db.bind.dialect.name == "postgresql":
            from app.models.organization import Organization
            org = db.query(Organization).filter(Organization.id == target_org_id).first()
            if org and org.schema_name:
                schema_name = org.schema_name
                db.execute(text(f'SET search_path TO "{schema_name}", public'))

    now = utc_now()
    job_id = str(uuid.uuid4())
    col_map = data.column_mapping or {}

    # Create ImportJob record
    job = ImportJob(
        id=job_id,
        organization_id=target_org_id,
        uploaded_by=current_user.id,
        job_type=job_type,
        file_name=data.file_name,
        file_type=data.file_type,
        file_path=file_path,
        column_mapping=col_map,
        target_stage_id=data.target_stage_id,
        target_owner_id=data.target_owner_id or current_user.id,
        status="PENDING",
        total_rows=0,
        processed_rows=0,
        successful_rows=0,
        duplicate_rows=0,
        error_rows=0,
        created_at=now
    )
    db.add(job)
    db.commit()

    # Dual-sync to public.import_jobs if created in a tenant schema, so queries with search_path=public can immediately see it
    if schema_name and db.bind and db.bind.dialect.name == "postgresql":
        try:
            db.execute(text("""
                INSERT INTO public.import_jobs 
                (id, organization_id, uploaded_by, job_type, file_name, file_type, file_path, column_mapping, target_stage_id, target_owner_id, status, total_rows, processed_rows, successful_rows, duplicate_rows, error_rows, created_at, error_summary)
                VALUES (:id, :org_id, :user_id, :job_type, :file_name, :file_type, :file_path, :column_mapping, :target_stage_id, :target_owner_id, :status, :total_rows, :processed_rows, :successful_rows, :duplicate_rows, :error_rows, :created_at, :error_summary)
                ON CONFLICT (id) DO NOTHING
            """), {
                "id": job_id,
                "org_id": target_org_id,
                "user_id": current_user.id,
                "job_type": job_type,
                "file_name": data.file_name,
                "file_type": data.file_type,
                "file_path": file_path,
                "column_mapping": py_json.dumps(col_map),
                "target_stage_id": data.target_stage_id,
                "target_owner_id": data.target_owner_id or current_user.id,
                "status": "PENDING",
                "total_rows": 0,
                "processed_rows": 0,
                "successful_rows": 0,
                "duplicate_rows": 0,
                "error_rows": 0,
                "created_at": now,
                "error_summary": "{}"
            })
            db.commit()
        except Exception as sync_exc:
            logger.debug(f"public.import_jobs dual-sync notice: {sync_exc}")

    # Expunge job to prevent any expired attribute reload crash
    try:
        db.expunge(job)
    except Exception:
        pass

    # Enqueue execution asynchronously in background
    background_tasks.add_task(background_import_runner, job_id, schema_name)

    return ImportJobOut(
        id=job_id,
        organization_id=target_org_id,
        uploaded_by=current_user.id,
        uploader_name=current_user.full_name,
        job_type=job_type,
        file_name=data.file_name,
        file_type=data.file_type,
        total_rows=0,
        processed_rows=0,
        successful_rows=0,
        duplicate_rows=0,
        error_rows=0,
        status="PENDING",
        column_mapping=col_map,
        error_summary={},
        started_at=None,
        completed_at=None,
        created_at=now
    )


@router.get("/jobs", response_model=List[ImportJobOut])
def list_import_jobs(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: Optional[str] = Depends(get_optional_tenant_id)
):
    query = db.query(ImportJob)
    if not (current_user.is_super_admin and not tenant_id):
        query = query.filter(ImportJob.organization_id == tenant_id)
    jobs = query.order_by(ImportJob.created_at.desc()).offset(skip).limit(limit).all()

    # If no jobs found in active search path and PostgreSQL, check public schema as well
    if len(jobs) == 0 and db.bind and db.bind.dialect.name == "postgresql":
        try:
            db.execute(text('SET search_path TO public'))
            query2 = db.query(ImportJob)
            if not (current_user.is_super_admin and not tenant_id):
                query2 = query2.filter(ImportJob.organization_id == tenant_id)
            jobs = query2.order_by(ImportJob.created_at.desc()).offset(skip).limit(limit).all()
        except Exception:
            pass

    return [
        ImportJobOut(
            id=j.id,
            organization_id=j.organization_id,
            uploaded_by=j.uploaded_by,
            uploader_name=j.uploader.full_name if j.uploader else None,
            job_type=j.job_type,
            file_name=j.file_name,
            file_type=j.file_type,
            total_rows=j.total_rows,
            processed_rows=j.processed_rows,
            successful_rows=j.successful_rows,
            duplicate_rows=j.duplicate_rows,
            error_rows=j.error_rows,
            status=j.status,
            column_mapping=j.column_mapping,
            error_summary=j.error_summary or {},
            started_at=j.started_at,
            completed_at=j.completed_at,
            created_at=j.created_at
        )
        for j in jobs
    ]


@router.get("/jobs/{id}", response_model=ImportJobOut)
def get_import_job(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: Optional[str] = Depends(get_optional_tenant_id)
):
    query = db.query(ImportJob).filter(ImportJob.id == id)
    if not current_user.is_super_admin:
        query = query.filter(ImportJob.organization_id == tenant_id)
    job = query.first()

    # Fallback search across public and tenant schemas if not found in current search path
    if not job and db.bind and db.bind.dialect.name == "postgresql":
        try:
            db.execute(text('SET search_path TO public'))
            query_pub = db.query(ImportJob).filter(ImportJob.id == id)
            if not current_user.is_super_admin:
                query_pub = query_pub.filter(ImportJob.organization_id == tenant_id)
            job = query_pub.first()

            if not job:
                schemas = db.execute(text("SELECT schema_name FROM organizations WHERE schema_name IS NOT NULL")).scalars().all()
                for s in schemas:
                    db.execute(text(f'SET search_path TO "{s}", public'))
                    job = db.query(ImportJob).filter(ImportJob.id == id).first()
                    if job:
                        if not current_user.is_super_admin and job.organization_id != tenant_id:
                            job = None
                        break
        except Exception as fallback_exc:
            logger.debug(f"get_import_job schema fallback error: {fallback_exc}")

    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import job not found")

    return ImportJobOut(
        id=job.id,
        organization_id=job.organization_id,
        uploaded_by=job.uploaded_by,
        uploader_name=job.uploader.full_name if job.uploader else None,
        job_type=job.job_type,
        file_name=job.file_name,
        file_type=job.file_type,
        total_rows=job.total_rows,
        processed_rows=job.processed_rows,
        successful_rows=job.successful_rows,
        duplicate_rows=job.duplicate_rows,
        error_rows=job.error_rows,
        status=job.status,
        column_mapping=job.column_mapping,
        error_summary=job.error_summary or {},
        started_at=job.started_at,
        completed_at=job.completed_at,
        created_at=job.created_at
    )


@router.get("/jobs/{id}/errors", response_model=List[ImportRowErrorOut])
def get_import_row_errors(
    id: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    job = db.query(ImportJob).filter(
        ImportJob.id == id,
        ImportJob.organization_id == tenant_id
    ).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Import job not found")

    errors = db.query(ImportRowError).filter(
        ImportRowError.job_id == id
    ).order_by(ImportRowError.row_number.asc()).offset(skip).limit(limit).all()

    return errors
