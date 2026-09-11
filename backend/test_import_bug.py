import uuid
from sqlalchemy import text
from app.core.database import SessionLocal
from app.models.import_job import ImportJob
from app.models.user import User

db = SessionLocal()
u = db.query(User).first()

db.execute(text('SET search_path TO "apex_industrial_solutions", public'))
job = ImportJob(
    id=str(uuid.uuid4()),
    organization_id=None,
    uploaded_by=u.id,
    job_type='GLOBAL_COMPANIES',
    file_name='test.json',
    file_type='JSON',
    file_path='test.json',
    column_mapping={},
    status='PENDING'
)
db.add(job)
db.commit()

# Switch search path
db.execute(text('SET search_path TO public'))

# If we do NOT call db.refresh:
print("Without refresh - Job ID:", job.id)
print("Without refresh - Job Org:", job.organization_id)
print("Without refresh - Job Status:", job.status)

# Now what if db.refresh IS called:
try:
    db.refresh(job)
    print("Refresh succeeded")
except Exception as e:
    print("Refresh error:", e)

# Now after refresh was called:
try:
    print("After refresh - Job Org:", job.organization_id)
except Exception as e:
    print("After refresh error:", type(e), e)

db.close()
