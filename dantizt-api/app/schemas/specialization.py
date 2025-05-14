from pydantic import BaseModel
from typing import Optional

class SpecializationBase(BaseModel):
    name: str
    description: Optional[str] = None
    appointment_duration: Optional[int] = 30  # Длительность приема в минутах

class SpecializationCreate(SpecializationBase):
    pass

class SpecializationUpdate(SpecializationBase):
    pass

class SpecializationInDB(SpecializationBase):
    id: int

    class Config:
        from_attributes = True 