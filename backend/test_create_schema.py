from app.core.database import SessionLocal
from app.core.tenant_schema import create_tenant_schema_tables
from app.models.organization import Organization

db = SessionLocal()
try:
    org = db.query(Organization).filter(Organization.schema_name == "tenant_acme_corp").first()
    if org:
        print(f"Creating tables for org {org.name}, schema {org.schema_name}")
        create_tenant_schema_tables(db, org.schema_name, org.id)
        print("Done!")
    else:
        print("Org not found")
except Exception as e:
    print("Error:", type(e), e)
finally:
    db.close()
