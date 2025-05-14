from pydantic import BaseModel, Field
from typing import Optional, List, Union
from datetime import datetime
from app.db.models import CertificateStatus
from app.schemas.payment import UserInfo, PatientInfo


class CertificateBase(BaseModel):
    """Базовая схема для справки налогового вычета"""
    patient_id: int
    year: int
    amount: float = Field(..., ge=0)
    certificate_number: Optional[str] = None


class CertificateCreate(BaseModel):
    """Схема для создания справки"""
    patient_id: int
    year: int
    payment_ids: List[int] = Field(..., description="Список ID платежей, включенных в справку")
    # Поле amount не требуется при создании, оно рассчитывается автоматически


class CertificateUpdate(BaseModel):
    """Схема для обновления справки"""
    status: Optional[CertificateStatus] = None
    cancelled_at: Optional[datetime] = None
    cancelled_by_id: Optional[int] = None


class PaymentInfo(BaseModel):
    """Информация о платеже для включения в справку"""
    id: int
    amount: float
    created_at: datetime
    
    class Config:
        from_attributes = True


class CertificateInDB(CertificateBase):
    """Схема для возврата справки из БД"""
    id: int
    status: CertificateStatus
    issued_at: datetime
    issued_by_id: int
    cancelled_at: Optional[datetime] = None
    cancelled_by_id: Optional[int] = None
    patient: Optional[PatientInfo] = None
    payments: Optional[List[PaymentInfo]] = None
    
    class Config:
        from_attributes = True


class CertificateOut(CertificateInDB):
    """Схема для возврата справки с дополнительной информацией"""
    issued_by: Optional[UserInfo] = None
    cancelled_by: Optional[UserInfo] = None
    
    class Config:
        from_attributes = True


class CertificatePaginatedResponse(BaseModel):
    """Схема для возврата списка справок с пагинацией"""
    items: List[CertificateOut]
    total: int
    page: int
    limit: int
    total_pages: int
