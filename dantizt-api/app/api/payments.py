from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.db.database import get_session
from app.models.payments import Payment
from app.schemas.payments import PaymentCreate, PaymentUpdate, PaymentResponse
from app.auth.auth import get_current_user, get_current_admin_user
from typing import List

router = APIRouter()

@router.get("/", response_model=List[PaymentResponse])
async def get_all_payments(
    current_user: dict = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Получить все платежи (только для админов)
    """
    query = """
        SELECT * FROM payments_view
        ORDER BY created_at DESC;
    """
    result = await session.execute(text(query))
    payments = result.fetchall()
    return [dict(payment) for payment in payments]

@router.get("/patient", response_model=List[PaymentResponse])
async def get_patient_payments(
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Получить платежи текущего пациента
    """
    query = """
        SELECT * FROM payments_view
        WHERE patient_id = :patient_id
        ORDER BY created_at DESC;
    """
    result = await session.execute(text(query), {"patient_id": current_user["patient_id"]})
    payments = result.fetchall()
    return [dict(payment) for payment in payments]

@router.post("/", response_model=PaymentResponse)
async def create_payment(
    payment: PaymentCreate,
    current_user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Создать новый платеж
    """
    db_payment = Payment(
        patient_id=current_user["patient_id"],
        amount=payment.amount,
        description=payment.description,
        status=payment.status
    )
    session.add(db_payment)
    await session.commit()
    await session.refresh(db_payment)

    # Получаем полную информацию о платеже из представления
    query = """
        SELECT * FROM payments_view
        WHERE payment_id = :payment_id;
    """
    result = await session.execute(text(query), {"payment_id": db_payment.id})
    payment = result.fetchone()
    return dict(payment)

@router.patch("/{payment_id}", response_model=PaymentResponse)
async def update_payment(
    payment_id: int,
    payment: PaymentUpdate,
    current_user: dict = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Обновить статус платежа (только для админов)
    """
    db_payment = await session.get(Payment, payment_id)
    if not db_payment:
        raise HTTPException(status_code=404, detail="Платеж не найден")

    for field, value in payment.dict(exclude_unset=True).items():
        setattr(db_payment, field, value)

    await session.commit()
    await session.refresh(db_payment)

    # Получаем полную информацию о платеже из представления
    query = """
        SELECT * FROM payments_view
        WHERE payment_id = :payment_id;
    """
    result = await session.execute(text(query), {"payment_id": payment_id})
    payment = result.fetchone()
    return dict(payment)
