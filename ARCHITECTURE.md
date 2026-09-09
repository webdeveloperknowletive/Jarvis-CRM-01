# JARVIS CRM — System Architecture & Technical Specifications

## Architectural Overview
JARVIS CRM is built as a **Modular Monolith** organized into distinct domain boundaries:

```
jarvis/
├── backend/
│   ├── app/
│   │   ├── core/         # Config, Database, Security, FastAPI Dependencies
│   │   ├── models/       # SQLAlchemy 2.0 Declarative Models
│   │   ├── schemas/      # Pydantic v2 Request & Response DTOs
│   │   ├── services/     # Core Domain Services & Business Logic
│   │   ├── api/v1/       # RESTful API Route Controllers
│   │   └── main.py       # FastAPI Entrypoint & Middleware
│   ├── tests/            # Automated Pytest Suite (Auth, Tenancy, Imports, Masking)
│   └── alembic/          # Database Migrations
├── frontend/
│   ├── src/
│   │   ├── components/   # Role-adaptive UI, Kanban, Dialer, Ingestion Wizard
│   │   ├── services/     # Typed API Service Client
│   │   ├── index.css     # Glassmorphic Design System & Modern Styling
│   │   └── App.tsx       # Root React Component & Routing
├── scripts/
│   ├── seed_demo.py      # Database Seeder (Platform Admin, Tenants, Leads)
│   └── generate_test_import.py # Ingestion Performance Test Generator
├── docs/                 # Architecture Bibles, PRD, and Technical Specs
├── docker-compose.yml    # Multi-container Production & Dev Setup
└── Dockerfile.*          # Container definitions for Backend & Frontend
```

## Running the Application Locally

### 1. Backend Server
```bash
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```
Interactive Swagger API documentation: `http://localhost:8000/api/v1/docs`

### 2. Frontend Development Server
```bash
cd frontend
npm run dev
```
Web application: `http://localhost:5173`

### 3. Run Automated Tests
```bash
python -m pytest backend/tests/ -v
```

### 4. Demo Login Credentials
- **Platform Super Admin**: `superadmin@jarvis.local` / `JarvisAdmin@2026`
- **Tenant CRM Admin (Apex)**: `admin@apex.com` / `ApexAdmin@2026`
- **Telecaller (Masked Phone)**: `telecaller@apex.com` / `Telecaller@2026`
