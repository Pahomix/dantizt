from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.schemas.user import UserOut

class PatientBase(BaseModel):
    gender: Optional[str] = None
    address: Optional[str] = None
    birth_date: Optional[date] = None
    contraindications: Optional[str] = None
    inn: Optional[str] = None

class PatientCreate(PatientBase):
    user_id: int

class PatientUpdate(PatientBase):
    pass

class PatientInDB(PatientBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

class PatientWithUser(PatientBase):
    id: int
    user: UserOut

    class Config:
        from_attributes = True

class PatientProfileUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    contraindications: Optional[str] = None
    birth_date: Optional[date] = None
    inn: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None

    class Config:
        from_attributes = True
