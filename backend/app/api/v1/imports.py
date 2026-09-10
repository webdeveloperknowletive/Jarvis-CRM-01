import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.deps import get_db, get_current_user, get_tenant_id, get_optional_tenant_id
from app.models.user import User
from app.models.import_job import ImportJob, ImportRowError
from app.schemas.import_job import (
    ImportPreviewResponse, ImportJobExecuteRequest, ImportJobOut, ImportRowErrorOut
)
from app.services.import_service import preview_import_file, execute_import_job

router = APIRouter(prefix="/imports", tags=["Import Ingestion Engine"])

# Ensure upload directory exists
os.makedirs(settings.STORAGE_LOCAL_DIR, exist_ok=True)


def background_import_runner(job_id: str):
    """Background task function that opens its own session and executes the import job"""
    db = SessionLocal()
    try:
        execute_import_job(db, job_id)
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

    # Save to disk
    file_id = str(uuid.uuid4())
    save_filename = f"{file_id}_{file.filename}"
    file_path = os.path.join(settings.STORAGE_LOCAL_DIR, save_filename)

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
    if not os.path.exists(data.file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Uploaded file not found on server")

    job_type = (data.job_type or "TENANT_LEADS").upper()
    if job_type in ("GLOBAL_COMPANIES", "GLOBAL_DATABASE", "GLOBAL_PEOPLE"):
        if not (current_user.is_super_admin or current_user.platform_role in ("DATA_ENTRY", "DATA_OPS") or current_user.tenant_role == "DATA_ENTRY"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin or Data Entry privilege required for Global Database ingestion")
        target_org_id = None
    else:
        if not tenant_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant context required for tenant lead import")
        target_org_id = tenant_id

    # Create ImportJob record
    job = ImportJob(
        organization_id=target_org_id,
        uploaded_by=current_user.id,
        job_type=job_type,
        file_name=data.file_name,
        file_type=data.file_type,
        file_path=data.file_path,
        column_mapping=data.column_mapping,
        target_stage_id=data.target_stage_id,
        target_owner_id=data.target_owner_id or current_user.id,
        status="PENDING"
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Enqueue execution asynchronously in background
    background_tasks.add_task(background_import_runner, job.id)

    return ImportJobOut(
        id=job.id,
        organization_id=job.organization_id,
        uploaded_by=job.uploaded_by,
        uploader_name=current_user.full_name,
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
