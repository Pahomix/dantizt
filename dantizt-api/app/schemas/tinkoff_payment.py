from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.db.models import PaymentStatus, PaymentMethod
from decimal import Decimal

class TinkoffPaymentItem(BaseModel):
    """Элемент чека для API Тинькофф"""
    Name: str
    Quantity: float = 1.0
    Amount: int  # Сумма в копейках
    Price: int  # Цена в копейках
    Tax: str = "none"  # Налог (none, vat0, vat10, vat20)
    PaymentObject: str = "service"  # Тип объекта (service, commodity)
    PaymentMethod: str = "full_payment"  # Метод оплаты

class TinkoffPaymentInitRequest(BaseModel):
    """Запрос на инициализацию платежа через API Тинькофф"""
    payment_id: int
    amount: float  # Сумма в рублях
    description: str
    customer_email: str
    customer_phone: str
    receipt_items: List[Dict[str, Any]]
    return_url: Optional[str] = None  # URL для возврата после оплаты

class TinkoffPaymentInitResponse(BaseModel):
    """Ответ на инициализацию платежа через API Тинькофф"""
    Success: bool
    ErrorCode: str
    TerminalKey: str
    Status: str
    PaymentId: str
    OrderId: str
    Amount: int
    PaymentURL: Optional[str] = None
    Message: Optional[str] = None
    Details: Optional[str] = None

class TinkoffPaymentStatusRequest(BaseModel):
    """Запрос на получение статуса платежа через API Тинькофф"""
    payment_id: int
    tinkoff_payment_id: str

class TinkoffPaymentStatusResponse(BaseModel):
    """Ответ на запрос статуса платежа через API Тинькофф"""
    Success: bool
    ErrorCode: str
    Message: Optional[str] = None
    TerminalKey: str
    Status: str
    PaymentId: str
    OrderId: str
    Amount: int

class TinkoffNotificationRequest(BaseModel):
    """Запрос от API Тинькофф при изменении статуса платежа"""
    TerminalKey: str
    OrderId: str
    Success: bool
    Status: str
    PaymentId: str
    Amount: int
    CardId: Optional[str] = None
    Pan: Optional[str] = None
    ExpDate: Optional[str] = None
    Token: str
    ErrorCode: Optional[str] = None
    Message: Optional[str] = None
    Details: Optional[str] = None

class TinkoffPaymentConfirmRequest(BaseModel):
    """Запрос на подтверждение платежа через API Тинькофф"""
    payment_id: int
    tinkoff_payment_id: str
    amount: Optional[float] = None  # Сумма в рублях

class TinkoffPaymentCancelRequest(BaseModel):
    """Запрос на отмену платежа через API Тинькофф"""
    payment_id: int
    tinkoff_payment_id: str

class TinkoffPaymentRefundRequest(BaseModel):
    """Запрос на возврат платежа через API Тинькофф"""
    payment_id: int
    tinkoff_payment_id: str
    amount: Optional[float] = None  # Сумма в рублях
