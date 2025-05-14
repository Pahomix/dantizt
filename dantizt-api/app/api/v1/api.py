from fastapi import APIRouter
from app.api.v1.endpoints import (
    users, doctors, patients, appointments, 
    services, medical_records, payments, notifications,
    certificates, auth as endpoints_auth, specializations, statistics, schedules
)
from app.api.v1 import auth

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(endpoints_auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(doctors.router, prefix="/doctors", tags=["doctors"])
api_router.include_router(patients.router, prefix="/patients", tags=["patients"])
api_router.include_router(appointments.router, prefix="/appointments", tags=["appointments"])
api_router.include_router(services.router, prefix="/services", tags=["services"])
api_router.include_router(medical_records.router, prefix="/medical-records", tags=["medical-records"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(certificates.router, prefix="/certificates", tags=["certificates"])
api_router.include_router(specializations.router, prefix="/specializations", tags=["specializations"])
api_router.include_router(statistics.router, prefix="/statistics", tags=["statistics"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["schedules"])
