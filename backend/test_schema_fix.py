import uuid
from sqlalchemy import text
from app.core.database import SessionLocal
from app.models.import_job import ImportJob
from app.models.user import User

db = SessionLocal()
u = db.query(User).first()

# Set search path to tenant
db.execute(text('SET search_path TO "apex_industrial_solutions", public'))

# Test with public schema explicitly on ImportJob
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

# Now switch search path to tenant or whatever
db.execute(text('SET search_path TO "apex_industrial_solutions", public'))
print("1. Job ID:", job.id)
print("2. Job Org:", job.organization_id)
print("3. Job Status:", job.status)

# Now switch search path to public
db.execute(text('SET search_path TO public'))
db.refresh(job)
print("4. Job ID:", job.id)
print("5. Job Org:", job.organization_id)

db.close()
