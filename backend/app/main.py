import time
import logging
import uuid
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
from app.api.v1.api import api_router
from app.api.v1 import admin
from app.api.v1 import billing
from app.api.v1 import data_quality
from app.api.v1 import jobs, api_keys, action_center, global_edits
import app.models  # Ensure all models are registered

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("jarvis_crm")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    # allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.middleware("http")
async def add_process_time_and_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    origin = request.headers.get("origin") or "*"
    cors_headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
    }
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "detail": str(exc), "error": {"code": "INTERNAL_SERVER_ERROR", "message": str(exc)}},
        headers=cors_headers
    )


# Include API Routers
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(billing.router, prefix=settings.API_V1_STR)
app.include_router(data_quality.router, prefix=settings.API_V1_STR)
app.include_router(jobs.router, prefix=settings.API_V1_STR)
app.include_router(api_keys.router, prefix=settings.API_V1_STR)
app.include_router(action_center.router, prefix=settings.API_V1_STR)
app.include_router(global_edits.router, prefix=settings.API_V1_STR)


@app.on_event("startup")
def on_startup():
    from sqlalchemy import text
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}...")
    # Initialize tables if not already present
    Base.metadata.create_all(bind=engine)

    # Safe column migration for Phase 1 and pull tracking (both PostgreSQL and SQLite)
    with engine.connect() as conn:
        is_pg = "postgres" in settings.DATABASE_URL
        for table, col_name, pg_type, sqlite_type, default_clause in [
            ("global_companies", "pull_status", "VARCHAR(30)", "VARCHAR(30)", "DEFAULT 'AVAILABLE'"),
            ("global_companies", "pulled_by_org_id", "VARCHAR(36)", "VARCHAR(36)", None),
            ("global_companies", "pulled_by_org_name", "VARCHAR(255)", "VARCHAR(255)", None),
            ("global_companies", "pulled_at", "TIMESTAMP", "DATETIME", None),
            ("global_people", "pull_status", "VARCHAR(30)", "VARCHAR(30)", "DEFAULT 'AVAILABLE'"),
            ("global_people", "pulled_by_org_id", "VARCHAR(36)", "VARCHAR(36)", None),
            ("global_people", "pulled_by_org_name", "VARCHAR(255)", "VARCHAR(255)", None),
            ("global_people", "pulled_at", "TIMESTAMP", "DATETIME", None),
            ("users", "token_version", "INTEGER", "INTEGER", "DEFAULT 1"),
            ("users", "deleted_at", "TIMESTAMP", "DATETIME", None),
            ("users", "deleted_by", "VARCHAR(36)", "VARCHAR(36)", None),
            ("users", "deletion_reason", "VARCHAR(500)", "VARCHAR(500)", None),
            ("organizations", "deleted_at", "TIMESTAMP", "DATETIME", None),
            ("organizations", "deleted_by", "VARCHAR(36)", "VARCHAR(36)", None),
            ("organizations", "deletion_reason", "VARCHAR(500)", "VARCHAR(500)", None),
            ("leads", "deleted_at", "TIMESTAMP", "DATETIME", None),
            ("leads", "deleted_by", "VARCHAR(36)", "VARCHAR(36)", None),
            ("leads", "deletion_reason", "VARCHAR(500)", "VARCHAR(500)", None),
            ("companies", "deleted_at", "TIMESTAMP", "DATETIME", None),
            ("companies", "deleted_by", "VARCHAR(36)", "VARCHAR(36)", None),
            ("companies", "deletion_reason", "VARCHAR(500)", "VARCHAR(500)", None),
            ("contacts", "deleted_at", "TIMESTAMP", "DATETIME", None),
            ("contacts", "deleted_by", "VARCHAR(36)", "VARCHAR(36)", None),
            ("contacts", "deletion_reason", "VARCHAR(500)", "VARCHAR(500)", None),
            ("audit_logs", "actor_user_id", "VARCHAR(36)", "VARCHAR(36)", None),
            ("audit_logs", "target_user_id", "VARCHAR(36)", "VARCHAR(36)", None),
            ("audit_logs", "support_session_id", "VARCHAR(36)", "VARCHAR(36)", None),
            ("audit_logs", "context_type", "VARCHAR(30)", "VARCHAR(30)", "DEFAULT 'PLATFORM_CONTEXT'"),
            ("audit_logs", "reason", "VARCHAR(500)", "VARCHAR(500)", None),
            ("audit_logs", "sequence_number", "INTEGER", "INTEGER", None),
            ("audit_logs", "event_hash", "VARCHAR(64)", "VARCHAR(64)", None),
            ("audit_logs", "previous_event_hash", "VARCHAR(64)", "VARCHAR(64)", None),
        ]:
            col_type = pg_type if is_pg else sqlite_type
            col_sql = f"{col_name} {col_type}"
            if default_clause:
                col_sql += f" {default_clause}"
            stmt = f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col_sql}" if is_pg else f"ALTER TABLE {table} ADD COLUMN {col_sql}"
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass

    # Seed Platform RBAC System (Roles & Permissions)
    try:
        from app.core.database import SessionLocal
        from app.models.rbac import seed_platform_rbac
        seed_db = SessionLocal()
        try:
            seed_platform_rbac(seed_db)
            logger.info("Platform RBAC initialized and verified.")
        finally:
            seed_db.close()
    except Exception as exc:
        logger.warning(f"RBAC initialization notice: {exc}")

    logger.info("Database schema checked and verified.")

    # Initialize PostgreSQL schema-per-tenant trigger and sync schemas
    if not settings.DATABASE_URL.startswith("sqlite"):
        try:
            from app.core.database import SessionLocal
            from app.core.tenant_schema import install_org_schema_trigger, sync_all_tenant_schemas
            startup_db = SessionLocal()
            try:
                install_org_schema_trigger(startup_db)
                sync_all_tenant_schemas(startup_db)
                logger.info("PostgreSQL tenant schemas and triggers verified.")
            finally:
                startup_db.close()
        except Exception as exc:
            logger.warning(f"Tenant schema startup sync notice: {exc}")


@app.get("/")
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": f"{settings.API_V1_STR}/docs",
        "status": "operational"
    }
