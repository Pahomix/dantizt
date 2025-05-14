from pydantic import BaseModel

class TreatmentBase(BaseModel):
    appointment_id: int
    service_id: int
    doctor_notes: str | None = None
    prescriptions: str | None = None

class TreatmentCreate(TreatmentBase):
    pass

class TreatmentUpdate(TreatmentBase):
    pass 

class TreatmentInDB(TreatmentBase):
    id: int

    class Config:
        from_attributes = True