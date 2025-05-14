from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class DoctorReviewBase(BaseModel):
    doctor_id: int
    rating: float = Field(..., ge=1, le=5)
    comment: Optional[str] = None

class DoctorReviewCreate(DoctorReviewBase):
    pass

class DoctorReviewUpdate(BaseModel):
    rating: Optional[float] = Field(None, ge=1, le=5)
    comment: Optional[str] = None

class DoctorReviewInDB(DoctorReviewBase):
    id: int
    patient_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True
