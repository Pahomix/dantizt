from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime

class PatientAllergyView(BaseModel):
    patient_id: int
    first_name: str
    last_name: str
    birth_date: date
    allergies: Optional[str]

class DoctorWorkloadView(BaseModel):
    doctor_id: int
    first_name: str
    last_name: str
    specialization: str
    appointments_count: int
    appointment_date: Optional[date]

class FinancialStatisticsView(BaseModel):
    month: datetime
    service_name: str
    services_count: int
    total_amount: float

class TreatmentHistoryView(BaseModel):
    patient_id: int
    patient_name: str
    doctor_name: str
    specialization: str
    diagnosis: str
    treatment_plan: str
    treatment_date: datetime

class UserActivityView(BaseModel):
    username: str
    role: str
    action_type: str
    action_count: int
    last_action_date: datetime 