from datetime import datetime, date, time
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, ConfigDict, ValidationInfo
from datetime import timezone

from app.schemas.base import BaseSchema
from app.db.models import SpecialDayType

class TimeSlot(BaseModel):
    start_time: str
    end_time: str
    is_available: bool = True

    model_config = ConfigDict(from_attributes=True)

class TimeSlotResponse(BaseModel):
    start_time: str
    end_time: str
    is_available: bool = True

    model_config = ConfigDict(from_attributes=True)

class AvailableSlot(BaseModel):
    date: date
    slots: List[TimeSlotResponse]

    model_config = ConfigDict(from_attributes=True)

class AvailableSlotsResponse(BaseModel):
    date: date
    slots: List[TimeSlotResponse]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(from_attributes=True)

class DoctorScheduleBase(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    slot_duration: int = Field(default=30, gt=0)
    break_between_slots: int = Field(default=0, ge=0)
    breaks: Optional[List[dict]] = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)

    @field_validator('end_time')
    @classmethod
    def end_time_must_be_after_start_time(cls, v: Optional[time], info: ValidationInfo) -> Optional[time]:
        if v is not None and 'start_time' in info.data and info.data['start_time'] is not None:
            if v <= info.data['start_time']:
                raise ValueError('end_time must be after start_time')
        return v

class DoctorScheduleCreate(DoctorScheduleBase):
    pass

class DoctorScheduleUpdate(BaseModel):
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    slot_duration: Optional[int] = Field(None, gt=0)
    break_between_slots: Optional[int] = Field(None, ge=0)
    breaks: Optional[List[dict]] = None
    is_active: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator('end_time')
    @classmethod
    def end_time_must_be_after_start_time(cls, v: Optional[time], info: ValidationInfo) -> Optional[time]:
        if v is not None and 'start_time' in info.data and info.data['start_time'] is not None:
            if v <= info.data['start_time']:
                raise ValueError('end_time must be after start_time')
        return v

class DoctorScheduleInDB(BaseSchema, DoctorScheduleBase):
    doctor_id: int
    id: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(from_attributes=True)

class DoctorScheduleBulkUpdate(BaseModel):
    """Схема для массового обновления расписания врача"""
    schedules: List[DoctorScheduleUpdate]

    model_config = ConfigDict(from_attributes=True)

class DoctorSpecialDayBase(BaseModel):
    date: date
    type: SpecialDayType
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator('end_time')
    @classmethod
    def validate_times(cls, v: Optional[time], info: ValidationInfo) -> Optional[time]:
        if v is not None and 'start_time' in info.data and info.data['start_time'] is not None:
            if v <= info.data['start_time']:
                raise ValueError('end_time must be after start_time')
        return v

    @field_validator('start_time')
    @classmethod
    def validate_start_time(cls, v: Optional[time], info: ValidationInfo) -> Optional[time]:
        return v

class DoctorSpecialDayCreate(DoctorSpecialDayBase):
    pass

class DoctorSpecialDayUpdate(BaseModel):
    date: Optional[date] = None
    type: Optional[SpecialDayType] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator('end_time')
    @classmethod
    def validate_times(cls, v: Optional[time], info: ValidationInfo) -> Optional[time]:
        if v is not None and 'start_time' in info.data and info.data['start_time'] is not None:
            if v <= info.data['start_time']:
                raise ValueError('end_time must be after start_time')
        return v

class DoctorSpecialDayInDB(DoctorSpecialDayBase):
    id: int
    doctor_id: int
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(from_attributes=True)