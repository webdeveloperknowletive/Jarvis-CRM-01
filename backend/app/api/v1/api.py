from fastapi import APIRouter
from app.api.v1 import (
    auth,
    organizations,
    users,
    companies,
    contacts,
    pipelines,
    leads,
    activities,
    tasks,
    imports,
    global_registry,
    global_people,
    radar,
    ai,
    health,
    gmail,
    telephony,
    templates,
    payments,
    shifts,
    telecaller,
    dedupe,
    communications,
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(organizations.router)
api_router.include_router(users.router)
api_router.include_router(companies.router)
api_router.include_router(contacts.router)
api_router.include_router(pipelines.router)
api_router.include_router(leads.router)
api_router.include_router(activities.router)
api_router.include_router(tasks.router)
api_router.include_router(imports.router)
api_router.include_router(global_registry.router)
api_router.include_router(global_people.router)
api_router.include_router(radar.router)
api_router.include_router(ai.router)
api_router.include_router(gmail.router)
api_router.include_router(telephony.router)
api_router.include_router(templates.router)
api_router.include_router(payments.router)
api_router.include_router(shifts.router)
api_router.include_router(telecaller.router)
api_router.include_router(dedupe.router)
api_router.include_router(communications.router)

