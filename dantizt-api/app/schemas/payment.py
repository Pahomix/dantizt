from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from app.db.models import PaymentStatus, PaymentMethod

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

class PatientInfo(BaseModel):
    id: int
    user: UserInfo

    class Config:
        from_attributes = True

class ServiceInfo(BaseModel):
    id: int
    name: str
    cost: float

    class Config:
        from_attributes = True

class AppointmentInfo(BaseModel):
    id: int
    start_time: datetime
    doctor: Optional[DoctorInfo] = None
    service: Optional[ServiceInfo] = None
    services: Optional[List[ServiceInfo]] = None

    class Config:
        from_attributes = True

class PaymentBase(BaseModel):
    appointment_id: int
    patient_id: int
    doctor_id: int
    amount: float = Field(..., ge=0)
    payment_method: PaymentMethod
    description: Optional[str] = None

class PaymentCreate(PaymentBase):
    pass

class PaymentUpdate(BaseModel):
    amount: Optional[float] = Field(None, ge=0)
    payment_method: Optional[PaymentMethod] = None
    status: Optional[PaymentStatus] = None
    description: Optional[str] = None

class PaymentInDB(PaymentBase):
    id: int
    status: PaymentStatus
    created_at: datetime
    updated_at: Optional[datetime] = None
    appointment: Optional[AppointmentInfo] = None
    patient: Optional[PatientInfo] = None

    class Config:
        from_attributes = True

class PaymentProcessSchema(BaseModel):
    paymentId: Optional[int] = None
    payment_id: Optional[int] = None  # Альтернативный формат для payment_id
    status: PaymentStatus = PaymentStatus.completed
    payment_method: Optional[PaymentMethod] = PaymentMethod.card
    cardNumber: Optional[str] = None
    expiryDate: Optional[str] = None
    cvv: Optional[str] = None

    @field_validator('cardNumber', 'expiryDate', 'cvv')
    def validate_card_fields(cls, v, info):
        # Если метод оплаты - карта, то поля карты обязательны
        if info.data.get('payment_method') == PaymentMethod.card:
            if v is None:
                field_name = info.field_name
                raise ValueError(f"{field_name} is required when payment method is card")
        return v

    class Config:
        from_attributes = True