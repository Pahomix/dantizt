from pydantic import BaseModel
from datetime import datetime
from enum import Enum
from typing import Optional

class PaymentStatus(str, Enum):
    pending = "pending"
    completed = "completed"
    cancelled = "cancelled"

class PaymentBase(BaseModel):
    amount: float
    description: Optional[str] = None

class PaymentCreate(PaymentBase):
    status: PaymentStatus = PaymentStatus.pending

class PaymentUpdate(BaseModel):
    status: Optional[PaymentStatus] = None
    description: Optional[str] = None

class PaymentResponse(PaymentBase):
    payment_id: int
    patient_id: int
    patient_name: str
    patient_email: str
    status: PaymentStatus
    created_at: datetime

    class Config:
        from_attributes = True
