from app.core.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    schemas = ['apex_industrial_solutions', 'bluewave_tech_labs', 'abc_limited', 'public']
    for s in schemas:
        tables = db.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = :s"), {"s": s}).scalars().all()
        print(f"Schema {s}: {len(tables)} tables -> {sorted(tables)}")
finally:
    db.close()
