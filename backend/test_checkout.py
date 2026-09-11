import uuid
from sqlalchemy import text
from app.core.database import SessionLocal
from app.models.import_job import ImportJob
from app.models.user import User

db = SessionLocal()
u = db.query(User).first()
job = ImportJob(
    id=str(uuid.uuid4()),
    organization_id=None,
    uploaded_by=u.id,
    job_type='GLOBAL_COMPANIES',
    file_name='test.json',
    file_type='JSON',
    status='PENDING'
)
db.add(job)
db.commit()

db.expunge(job)
db.execute(text('SET search_path TO "apex_industrial_solutions", public'))
print('Expunged job ID:', job.id)
print('Expunged job Org:', job.organization_id)
print('Expunged job Status:', job.status)
db.close()
