from pydantic import BaseModel
from typing import Optional, List
from datetime import date, time
from enum import Enum

class SpecialDayType(str, Enum):
    holiday = "holiday"        # Праздничный день
    vacation = "vacation"      # Отпуск
    sick_leave = "sick_leave"  # Больничный
    training = "training"      # Обучение/конференция
    other = "other"           # Другое

class SpecialDayBase(BaseModel):
    doctor_id: int
    date_from: date
    date_to: date
    type: SpecialDayType
    description: Optional[str] = None
    is_working: bool = False  # False = выходной, True = особый рабочий день
    work_start_time: Optional[time] = None  # Если is_working = True
    work_end_time: Optional[time] = None    # Если is_working = True

class SpecialDayCreate(SpecialDayBase):
    pass

class SpecialDayUpdate(BaseModel):
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    type: Optional[SpecialDayType] = None
    description: Optional[str] = None
    is_working: Optional[bool] = None
    work_start_time: Optional[time] = None
    work_end_time: Optional[time] = None

class SpecialDayInDB(SpecialDayBase):
    id: int

    class Config:
        from_attributes = True
