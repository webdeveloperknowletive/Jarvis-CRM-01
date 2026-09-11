from datetime import datetime, timezone
import uuid
from sqlalchemy import text, Column, String, Integer, DateTime, ForeignKey, JSON
from app.core.database import SessionLocal, Base
from app.models.user import User
from app.core.config import settings

class TestPublicJob(Base):
    __tablename__ = "import_jobs"
    __table_args__ = {"schema": "public", "extend_existing": True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), nullable=True)
    uploaded_by = Column(String(36), nullable=False)
    job_type = Column(String(50), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(20), nullable=False)
    total_rows = Column(Integer, nullable=False, default=0)
    processed_rows = Column(Integer, nullable=False, default=0)
    successful_rows = Column(Integer, nullable=False, default=0)
    duplicate_rows = Column(Integer, nullable=False, default=0)
    error_rows = Column(Integer, nullable=False, default=0)
    status = Column(String(30), nullable=False, default="PENDING")
    column_mapping = Column(JSON, nullable=False, default=dict)
    error_summary = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

db = SessionLocal()
u = db.query(User).first()

# Set search path to tenant schema
db.execute(text('SET search_path TO "apex_industrial_solutions", public'))

job = TestPublicJob(
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
print("Committed TestPublicJob:", job.id)

# Now switch search path to tenant
db.execute(text('SET search_path TO "apex_industrial_solutions", public'))
db.refresh(job)
print("Refreshed with tenant search path! ID:", job.id, "Status:", job.status)

# Now switch search path to public
db.execute(text('SET search_path TO public'))
db.refresh(job)
print("Refreshed with public search path! ID:", job.id, "Status:", job.status)

# Now switch search path to another tenant
db.execute(text('SET search_path TO "bluewave_tech_labs", public'))
db.refresh(job)
print("Refreshed with bluewave search path! ID:", job.id, "Status:", job.status)

print("SUCCESS!! NO ObjectDeletedError regardless of search path!")
db.close()
