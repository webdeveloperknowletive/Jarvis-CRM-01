import time
import logging
import uuid
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
from app.api.v1.api import api_router
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


@app.on_event("startup")
def on_startup():
    from sqlalchemy import text
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}...")
    # Initialize tables if not already present
    Base.metadata.create_all(bind=engine)

    # Safe SQLite column migration for pull tracking
    if settings.DATABASE_URL.startswith("sqlite"):
        with engine.connect() as conn:
            for table, col_def in [
                ("global_companies", "pull_status VARCHAR(30) DEFAULT 'AVAILABLE'"),
                ("global_companies", "pulled_by_org_id VARCHAR(36)"),
                ("global_companies", "pulled_by_org_name VARCHAR(255)"),
                ("global_companies", "pulled_at DATETIME"),
                ("global_people", "pull_status VARCHAR(30) DEFAULT 'AVAILABLE'"),
                ("global_people", "pulled_by_org_id VARCHAR(36)"),
                ("global_people", "pulled_by_org_name VARCHAR(255)"),
                ("global_people", "pulled_at DATETIME"),
            ]:
                col_name = col_def.split()[0]
                try:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_def}"))
                    conn.commit()
                    logger.info(f"Added column {col_name} to {table}")
                except Exception:
                    pass

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
