from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
from app.db.models import RecordType, RecordStatus, AppointmentStatus

class UserInfo(BaseModel):
    id: int
    full_name: str
    email: str

    class Config:
        from_attributes = True

class DoctorInfo(BaseModel):
    id: int
    user: UserInfo

    class Config:
        from_attributes = True

class ServiceInfo(BaseModel):
    id: int
    name: str
    cost: float
    # duration: int  # Удалено, так как длительность определяется специализацией врача
    # Длительность услуги теперь определяется через doctor.specialization.appointment_duration

    class Config:
        from_attributes = True

class ToothPosition(BaseModel):
    quadrant: int                   # Квадрант (1-4)
    number: int                     # Номер зуба в квадранте (1-8)

    class Config:
        json_encoders = {
            list: lambda v: v
        }
        
    def dict(self, *args, **kwargs):
        d = super().dict(*args, **kwargs)
        return d

class MedicalRecordBase(BaseModel):
    record_type: RecordType
    title: str
    content: str
    status: RecordStatus = RecordStatus.active
    tooth_positions: Optional[List[ToothPosition]] = None  # Затронутые зубы
    attachments: Optional[List[str]] = None  # Ссылки на прикрепленные файлы

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            ToothPosition: lambda v: v.dict()
        }
        
    def dict(self, *args, **kwargs):
        d = super().dict(*args, **kwargs)
        if d['tooth_positions'] is not None:
            d['tooth_positions'] = [
                {
                    'quadrant': tooth['quadrant'],
                    'number': tooth['number']
                }
                for tooth in d['tooth_positions']
            ]
        return d

class MedicalRecordCreate(MedicalRecordBase):
    patient_id: int
    doctor_id: int
    appointment_id: Optional[int] = None
    treatment_plan_id: Optional[int] = None

class MedicalRecordUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    status: Optional[RecordStatus] = None
    tooth_positions: Optional[List[ToothPosition]] = None
    attachments: Optional[List[str]] = None

class MedicalRecordInDB(MedicalRecordBase):
    id: int
    patient_id: int
    doctor_id: int
    appointment_id: Optional[int]
    treatment_plan_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PatientAppointmentWithRecords(BaseModel):
    id: int
    start_time: datetime
    end_time: datetime
    status: AppointmentStatus
    notes: Optional[str] = None
    doctor: DoctorInfo
    service: ServiceInfo
    medical_records: List[MedicalRecordInDB] = []

    class Config:
        from_attributes = True
