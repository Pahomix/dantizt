from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional, List
from app.db.models import AppointmentStatus

class AppointmentBase(BaseModel):
    doctor_id: int
    patient_id: int
    start_time: datetime
    end_time: datetime
    status: AppointmentStatus = Field(default=AppointmentStatus.scheduled)
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AppointmentCreate(AppointmentBase):
    pass

class AppointmentUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[AppointmentStatus] = None
    notes: Optional[str] = None
    service_ids: Optional[List[int]] = None  # Список ID услуг для обновления

class AppointmentInDB(AppointmentBase):
    id: int

    class Config:
        from_attributes = True

class AppointmentWithDetails(AppointmentInDB):
    doctor_name: str
    patient_name: str
    doctor_specialty: Optional[str] = None
    service_name: Optional[str] = None  # Для обратной совместимости
    service_duration: Optional[int] = None  # Для обратной совместимости
    services: Optional[List[dict]] = []  # Список услуг с информацией
    service: Optional[dict] = {}  # Для обратной совместимости, теперь всегда пустой словарь

    class Config:
        from_attributes = True

class AppointmentList(BaseModel):
    items: list[AppointmentWithDetails]
    total: int

    class Config:
        from_attributes = True
