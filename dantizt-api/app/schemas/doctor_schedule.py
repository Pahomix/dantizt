from pydantic import BaseModel
from typing import List, Optional
from datetime import time

class DoctorScheduleBase(BaseModel):
    work_start_time: time
    work_end_time: time
    lunch_start_time: Optional[time] = None
    lunch_end_time: Optional[time] = None
    working_days: List[int]

class DoctorScheduleCreate(DoctorScheduleBase):
    doctor_id: int

class DoctorScheduleUpdate(DoctorScheduleBase):
    pass

class DoctorScheduleInDB(DoctorScheduleBase):
    id: int
    doctor_id: int
    is_active: bool

    class Config:
        from_attributes = True 