# Import Base and models from app.db.models
from app.db.base_class import Base
from app.db.models import (
    User,
    Doctor,
    Patient,
    Service,
    Appointment,
    MedicalRecord,
    Payment,
    Notification,
    DoctorSchedule,
    DoctorSpecialDay,
    TreatmentPlan
)

# Модели, которые должны быть загружены SQLAlchemy
__all__ = [
    "Base",
    "User",
    "Doctor",
    "Patient",
    "Service",
    "Appointment",
    "MedicalRecord",
    "Payment",
    "Notification",
    "DoctorSchedule",
    "DoctorSpecialDay",
    "TreatmentPlan"
]
