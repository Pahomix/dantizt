from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status as http_status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.api.deps import get_db
from app.db.models import Payment
from app.services.payment_service import PaymentService

router = APIRouter()
logger = logging.getLogger(__name__)

# Инициализируем сервис для работы с платежами
payment_service = PaymentService()

@router.get("/order/{order_id}")
async def check_payment_status_by_order(
    order_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Проверка статуса платежа по ID заказа (OrderId)
    
    Этот эндпоинт позволяет проверить статус платежа без авторизации.
    Возвращает статус платежа в Тинькофф и статус заказа в системе.
    """
    try:
        logger.info(f"Checking payment status for order_id: {order_id}")
        
        # Ищем платеж по external_id (который соответствует OrderId в Тинькофф)
        query = select(Payment).where(Payment.external_id == order_id)
        result = await db.execute(query)
        payment = result.scalar_one_or_none()
        
        if not payment:
            logger.warning(f"Payment with order_id {order_id} not found")
            return {
                "success": False,
                "message": "Payment not found",
                "status": "UNKNOWN",
                "order_status": "NOT_FOUND"
            }
        
        logger.info(f"Found payment: ID={payment.id}, status={payment.status}, external_payment_id={payment.external_payment_id}")
        
        # Если у платежа нет external_payment_id, значит он еще не был инициализирован в Тинькофф
        if not payment.external_payment_id:
            return {
                "success": True,
                "payment_id": payment.id,
                "order_id": order_id,
                "status": "NEW",
                "order_status": payment.status,
                "message": "Payment not initialized in Tinkoff yet"
            }
        
        # Проверяем статус платежа через API Тинькофф
        tinkoff_response = await payment_service.check_payment_status(
            payment_id=payment.id,
            tinkoff_payment_id=payment.external_payment_id,
            db=db
        )
        
        # Формируем ответ с информацией о статусе платежа
        response = {
            "success": True,
            "payment_id": payment.id,
            "order_id": order_id,
            "status": tinkoff_response.get("Status", "UNKNOWN"),
            "order_status": payment.status,
            "amount": payment.amount
        }
        
        return response
    except Exception as e:
        logger.error(f"Error checking payment status by order_id: {str(e)}")
        return {
            "success": False,
            "message": f"Error checking payment status: {str(e)}",
            "status": "ERROR",
            "order_status": "ERROR"
        }
