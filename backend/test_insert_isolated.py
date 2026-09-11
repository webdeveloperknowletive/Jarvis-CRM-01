from app.core.database import SessionLocal
from sqlalchemy import text
from app.models.organization import Organization

db = SessionLocal()
try:
    job_id = "fa144465-a5d0-4666-b4ce-d4a40fe3c944"
    job_org_id = "ca7c1564-32a7-456d-bfc1-97960975b8d9"
    org = db.query(Organization).filter(Organization.id == job_org_id).first()
    tenant_schema = org.schema_name
    print(f"tenant_schema: {tenant_schema}")
    
    db.execute(text(f'SET search_path TO "{tenant_schema}", public'))
    sql = f'''
        INSERT INTO "{tenant_schema}".import_jobs 
        (id, organization_id, uploaded_by, job_type, file_name, file_type, file_path, column_mapping, target_stage_id, target_owner_id, status, total_rows, processed_rows, successful_rows, duplicate_rows, error_rows, created_at, started_at)
        SELECT id, organization_id, uploaded_by, job_type, file_name, file_type, file_path, column_mapping, target_stage_id, target_owner_id, status, total_rows, processed_rows, successful_rows, duplicate_rows, error_rows, created_at, started_at
        FROM public.import_jobs WHERE id = :jid
        ON CONFLICT (id) DO UPDATE SET status = 'PROCESSING', started_at = EXCLUDED.started_at
    '''
    db.execute(text(sql), {"jid": job_id})
    db.commit()
    print("SUCCESS INSERT!")
except Exception as e:
    print("CAUGHT EXCEPTION:", type(e), e)
finally:
    db.close()
