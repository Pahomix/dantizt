from fastapi import APIRouter
from app.api import (
    auth,
    users,
    doctors,
    patients,
    appointments,
    medical_records,
    services,
    reviews,
    schedules,
    specializations,
    payments
)

api_router = APIRouter()

# Аутентификация
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# Пользователи
api_router.include_router(users.router, prefix="/users", tags=["users"])

# Врачи
api_router.include_router(doctors.router, prefix="/doctors", tags=["doctors"])

# Пациенты
api_router.include_router(patients.router, prefix="/patients", tags=["patients"])

# Приемы
api_router.include_router(appointments.router, prefix="/appointments", tags=["appointments"])

# Медицинские записи
api_router.include_router(medical_records.router, prefix="/medical-records", tags=["medical-records"])

# Услуги
api_router.include_router(services.router, prefix="/services", tags=["services"])

# Отзывы
api_router.include_router(reviews.router, prefix="/reviews", tags=["reviews"])

# Расписание
api_router.include_router(schedules.router, prefix="/schedules", tags=["schedules"])

# Специализации
api_router.include_router(specializations.router, prefix="/specializations", tags=["specializations"])

# Платежи
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
