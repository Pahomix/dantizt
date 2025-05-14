from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from datetime import datetime
import logging

from app.core.security import get_current_user
from app.api.deps import get_db
from app.db.models import (
    User, Patient, Payment, TaxDeductionCertificate, CertificatePayment,
    CertificateStatus, UserRole, PaymentStatus
)
from app.schemas.certificate import (
    CertificateCreate, CertificateUpdate, CertificateOut, CertificatePaginatedResponse
)
from app.api.v1.endpoints.medical_records import generate_tax_deduction_pdf
from app.utils.email import send_email, send_tax_deduction_certificate

# Настраиваем логирование
logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=CertificatePaginatedResponse)
async def get_certificates(
    status: Optional[str] = None,
    search: Optional[str] = None,
    year: Optional[int] = None,
    page: int = 1,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получить список справок для налогового вычета с возможностью фильтрации и пагинации.
    """
    # Проверяем, что пользователь имеет роль регистратора или администратора
    if current_user.role not in [UserRole.reception, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only reception staff or administrators can view tax deduction certificates"
        )
    
    # Базовый запрос
    query = select(TaxDeductionCertificate).options(
        joinedload(TaxDeductionCertificate.patient).joinedload(Patient.user),
        joinedload(TaxDeductionCertificate.issued_by),
        joinedload(TaxDeductionCertificate.cancelled_by),
        joinedload(TaxDeductionCertificate.payments)
    )
    
    # Применяем фильтры
    if status:
        query = query.where(TaxDeductionCertificate.status == status)
    
    if year:
        query = query.where(TaxDeductionCertificate.year == year)
    
    if search:
        # Поиск по имени пациента или номеру справки
        query = query.join(TaxDeductionCertificate.patient).join(Patient.user).filter(
            or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
                TaxDeductionCertificate.certificate_number.ilike(f"%{search}%")
            )
        )
    
    # Получаем общее количество записей
    count_query = select(func.count()).select_from(query.subquery())
    total_count = await db.scalar(count_query)
    
    # Применяем пагинацию
    query = query.order_by(TaxDeductionCertificate.issued_at.desc())
    query = query.offset((page - 1) * limit).limit(limit)
    
    # Выполняем запрос
    result = await db.execute(query)
    certificates = result.unique().scalars().all()
    
    # Рассчитываем количество страниц
    total_pages = (total_count + limit - 1) // limit
    
    return {
        "items": certificates,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }


@router.get("/{certificate_id}", response_model=CertificateOut)
async def get_certificate(
    certificate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получить информацию о конкретной справке.
    """
    # Проверяем, что пользователь имеет роль регистратора или администратора
    if current_user.role not in [UserRole.reception, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only reception staff or administrators can view tax deduction certificates"
        )
    
    # Получаем справку
    result = await db.execute(
        select(TaxDeductionCertificate).options(
            joinedload(TaxDeductionCertificate.patient).joinedload(Patient.user),
            joinedload(TaxDeductionCertificate.issued_by),
            joinedload(TaxDeductionCertificate.cancelled_by),
            joinedload(TaxDeductionCertificate.payments)
        ).where(TaxDeductionCertificate.id == certificate_id)
    )
    certificate = result.unique().scalar_one_or_none()
    
    if not certificate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificate not found"
        )
    
    return certificate


@router.post("/", response_model=CertificateOut)
async def create_certificate(
    certificate: CertificateCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Создать новую справку для налогового вычета.
    """
    # Проверяем, что пользователь имеет роль регистратора
    if current_user.role != UserRole.reception:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only reception staff can create tax deduction certificates"
        )
    
    # Проверяем, что пациент существует
    patient_result = await db.execute(
        select(Patient).options(joinedload(Patient.user)).where(Patient.id == certificate.patient_id)
    )
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Проверяем, существует ли уже справка за указанный год для указанного пациента
    existing_certificate_result = await db.execute(
        select(TaxDeductionCertificate).where(
            and_(
                TaxDeductionCertificate.patient_id == certificate.patient_id,
                TaxDeductionCertificate.year == certificate.year,
                TaxDeductionCertificate.status == CertificateStatus.issued
            )
        )
    )
    existing_certificate = existing_certificate_result.scalar_one_or_none()
    if existing_certificate:
        # Если справка уже существует, возвращаем ее вместо создания новой
        logger.info(f"Certificate for patient {certificate.patient_id} for year {certificate.year} already exists, returning existing certificate")
        
        # Загружаем связанные объекты
        result = await db.execute(
            select(TaxDeductionCertificate).options(
                joinedload(TaxDeductionCertificate.patient).joinedload(Patient.user),
                joinedload(TaxDeductionCertificate.issued_by),
                joinedload(TaxDeductionCertificate.payments)
            ).where(TaxDeductionCertificate.id == existing_certificate.id)
        )
        existing_certificate = result.unique().scalar_one()
        
        return existing_certificate
    
    # Проверяем, что все платежи существуют и принадлежат указанному пациенту
    payments_result = await db.execute(
        select(Payment).where(
            and_(
                Payment.id.in_(certificate.payment_ids),
                Payment.patient_id == certificate.patient_id,
                Payment.status == PaymentStatus.completed
            )
        )
    )
    payments = payments_result.scalars().all()
    
    if len(payments) != len(certificate.payment_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Some payments do not exist, do not belong to the patient, or are not completed"
        )
    
    # Проверяем, что платежи относятся к указанному году
    for payment in payments:
        payment_year = payment.created_at.year
        if payment_year != certificate.year:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment {payment.id} is from year {payment_year}, not {certificate.year}"
            )
    
    # Рассчитываем общую сумму платежей
    total_amount = sum(payment.amount for payment in payments)
    
    # Генерируем номер справки
    certificate_number = f"{certificate.year}-{certificate.patient_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    # Создаем справку
    db_certificate = TaxDeductionCertificate(
        patient_id=certificate.patient_id,
        year=certificate.year,
        amount=total_amount,
        certificate_number=certificate_number,
        status=CertificateStatus.issued,
        issued_by_id=current_user.id
    )
    
    db.add(db_certificate)
    await db.commit()
    await db.refresh(db_certificate)
    
    # Связываем справку с платежами
    for payment in payments:
        db.add(CertificatePayment(
            certificate_id=db_certificate.id,
            payment_id=payment.id
        ))
    
    await db.commit()
    await db.refresh(db_certificate)
    
    # Загружаем связанные объекты
    result = await db.execute(
        select(TaxDeductionCertificate).options(
            joinedload(TaxDeductionCertificate.patient).joinedload(Patient.user),
            joinedload(TaxDeductionCertificate.issued_by),
            joinedload(TaxDeductionCertificate.payments)
        ).where(TaxDeductionCertificate.id == db_certificate.id)
    )
    db_certificate = result.unique().scalar_one()
    
    return db_certificate


@router.patch("/{certificate_id}", response_model=CertificateOut)
async def update_certificate(
    certificate_id: int,
    certificate_update: CertificateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Обновить статус справки (например, отменить).
    """
    # Проверяем, что пользователь имеет роль регистратора
    if current_user.role != UserRole.reception:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only reception staff can update tax deduction certificates"
        )
    
    # Получаем справку
    result = await db.execute(
        select(TaxDeductionCertificate).options(
            joinedload(TaxDeductionCertificate.patient).joinedload(Patient.user),
            joinedload(TaxDeductionCertificate.issued_by),
            joinedload(TaxDeductionCertificate.payments)
        ).where(TaxDeductionCertificate.id == certificate_id)
    )
    db_certificate = result.unique().scalar_one_or_none()
    
    if not db_certificate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificate not found"
        )
    
    # Обновляем статус
    if certificate_update.status:
        db_certificate.status = certificate_update.status
        
        # Если статус изменен на "отменен", добавляем информацию об отмене
        if certificate_update.status == CertificateStatus.cancelled:
            db_certificate.cancelled_at = datetime.now()
            db_certificate.cancelled_by_id = current_user.id
    
    await db.commit()
    await db.refresh(db_certificate)
    
    return db_certificate


@router.delete("/{certificate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_certificate(
    certificate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Удалить справку (только для администраторов).
    """
    # Проверяем, что пользователь является администратором
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete tax deduction certificates"
        )
    
    # Получаем справку
    result = await db.execute(
        select(TaxDeductionCertificate).where(TaxDeductionCertificate.id == certificate_id)
    )
    db_certificate = result.scalar_one_or_none()
    
    if not db_certificate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificate not found"
        )
    
    # Удаляем справку
    await db.delete(db_certificate)
    await db.commit()
    
    return None


@router.get("/{certificate_id}/download", response_class=None)
async def download_certificate(
    certificate_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Скачать справку в формате PDF.
    """
    # Проверяем, что пользователь имеет роль регистратора или администратора
    if current_user.role not in [UserRole.reception, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only reception staff or administrators can download certificates"
        )
    
    # Получаем справку
    result = await db.execute(
        select(TaxDeductionCertificate).options(
            joinedload(TaxDeductionCertificate.patient)
        ).where(TaxDeductionCertificate.id == certificate_id)
    )
    db_certificate = result.unique().scalar_one_or_none()
    
    if not db_certificate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificate not found"
        )
    
    # Проверяем, что справка не отменена
    if db_certificate.status == CertificateStatus.cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot download cancelled certificate"
        )
    
    # Генерируем PDF
    return await generate_tax_deduction_pdf(
        patient_id=db_certificate.patient_id,
        year=db_certificate.year,
        send_email=False,
        current_user=current_user,
        db=db
    )


@router.post("/{certificate_id}/send-email", status_code=status.HTTP_200_OK)
async def send_certificate_email(
    certificate_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Отправить справку на email пациента.
    """
    # Проверяем, что пользователь имеет роль регистратора или администратора
    if current_user.role not in [UserRole.reception, UserRole.admin]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only reception staff or administrators can send certificates by email"
        )
    
    # Получаем справку
    result = await db.execute(
        select(TaxDeductionCertificate).options(
            joinedload(TaxDeductionCertificate.patient).joinedload(Patient.user)
        ).where(TaxDeductionCertificate.id == certificate_id)
    )
    db_certificate = result.unique().scalar_one_or_none()
    
    if not db_certificate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Certificate not found"
        )
    
    # Проверяем, что справка не отменена
    if db_certificate.status == CertificateStatus.cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send cancelled certificate"
        )
    
    # Генерируем PDF и отправляем на email
    await generate_tax_deduction_pdf(
        patient_id=db_certificate.patient_id,
        year=db_certificate.year,
        send_email=True,
        current_user=current_user,
        db=db
    )
    
    return {"message": "Certificate sent to patient's email"}
