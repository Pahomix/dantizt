from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum

from app.db.models import RecordStatus

class DiagnosisStatus(str, Enum):
    active = "active"          # Текущий диагноз
    resolved = "resolved"      # Вылеченный
    recurring = "recurring"    # Периодически повторяющийся
    chronic = "chronic"        # Хронический

class DiagnosisBase(BaseModel):
    code: str                  # Код по международной классификации
    description: str           # Описание диагноза и лечения
    status: RecordStatus = RecordStatus.active
    notes: Optional[str] = None  # Дополнительные заметки

class DiagnosisCreate(DiagnosisBase):
    patient_id: int
    doctor_id: int

class DiagnosisUpdate(BaseModel):
    code: Optional[str] = None
    description: Optional[str] = None
    status: Optional[RecordStatus] = None
    notes: Optional[str] = None

class DiagnosisInDB(DiagnosisBase):
    id: int
    patient_id: int
    doctor_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
