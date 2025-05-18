from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status as http_status, Request, Response
from fastapi.responses import PlainTextResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from datetime import datetime
from sqlalchemy import or_
import json
import logging

from app.core.security import get_current_user
from app.api.deps import get_db
from app.db.models import User, Payment, PaymentStatus, UserRole, Appointment, Doctor, Patient, AppointmentService, Service, Notification
from app.core.metrics import track_payment
from app.schemas.payment import PaymentCreate, PaymentUpdate, PaymentInDB, PaymentProcessSchema
from app.schemas.tinkoff_payment import (
    TinkoffPaymentInitRequest, TinkoffPaymentInitResponse,
    TinkoffPaymentStatusRequest, TinkoffPaymentStatusResponse,
    TinkoffNotificationRequest, TinkoffPaymentConfirmRequest,
    TinkoffPaymentCancelRequest, TinkoffPaymentRefundRequest
)
from app.services.payment_service import PaymentService

router = APIRouter()

# Настраиваем логгер
logger = logging.getLogger(__name__)

@router.get("/", response_model=dict)
async def get_payments(
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить список платежей с возможностью фильтрации и пагинации"""
    # Базовый запрос
    query = select(Payment).options(
        joinedload(Payment.appointment).joinedload(Appointment.doctor).joinedload(Doctor.user),
        joinedload(Payment.appointment).joinedload(Appointment.service),
        joinedload(Payment.patient).joinedload(Patient.user)
    )
    
    # Применяем фильтры
    if status:
        query = query.where(Payment.status == status)
    
    if search:
        # Поиск по имени пациента или врача
        query = query.join(Payment.patient).join(Patient.user).filter(
            or_(
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%")
            )
        )
    
    # Ограничиваем доступ в зависимости от роли пользователя
    if current_user.role == UserRole.doctor:
        doctor_result = await db.execute(
            select(Doctor).where(Doctor.user_id == current_user.id)
        )
        doctor = doctor_result.scalar_one_or_none()
        if doctor:
            query = query.where(Payment.doctor_id == doctor.id)
        else:
            return []
    elif current_user.role == UserRole.patient:
        patient_result = await db.execute(
            select(Patient).where(Patient.user_id == current_user.id)
        )
        patient = patient_result.scalar_one_or_none()
        if patient:
            query = query.where(Payment.patient_id == patient.id)
        else:
            return []
    
    # Получаем общее количество записей
    count_query = select(func.count()).select_from(query.subquery())
    total_count = await db.scalar(count_query)
    
    # Применяем пагинацию
    query = query.offset((page - 1) * limit).limit(limit)
    
    # Выполняем запрос
    result = await db.execute(query)
    payments = result.unique().scalars().all()
    
    # Для каждого платежа получаем связанные услуги и создаем словари
    payments_data = []
    for payment in payments:
        # Проверяем, нужно ли обновить сумму платежа
        if payment.amount == 0 and payment.appointment:
            # Получаем услуги для записи на прием
            services_query = await db.execute(
                select(Service)
                .join(AppointmentService, Service.id == AppointmentService.service_id)
                .where(AppointmentService.appointment_id == payment.appointment.id)
            )
            services = services_query.scalars().all()
            
            # Рассчитываем общую стоимость услуг
            total_cost = sum(float(service.cost) for service in services if service.cost)
            
            # Если сумма платежа равна 0, обновляем её на основе стоимости услуг
            if total_cost > 0:
                payment.amount = total_cost
                await db.commit()
                await db.refresh(payment)
        
        payment_dict = {
            "id": payment.id,
            "appointment_id": payment.appointment_id,
            "patient_id": payment.patient_id,
            "doctor_id": payment.doctor_id,
            "amount": payment.amount,
            "status": payment.status,
            "payment_method": payment.payment_method,
            "created_at": payment.created_at,
            "updated_at": payment.updated_at
        }
        
        # Добавляем информацию о приеме и услугах
        if payment.appointment:
            appointment_dict = {
                "id": payment.appointment.id,
                "start_time": payment.appointment.start_time,
                "end_time": payment.appointment.end_time,
                "status": payment.appointment.status,
                "notes": payment.appointment.notes
            }
            
            # Добавляем информацию о докторе
            if payment.appointment.doctor:
                appointment_dict["doctor"] = {
                    "id": payment.appointment.doctor.id,
                    "user": {
                        "id": payment.appointment.doctor.user.id,
                        "full_name": payment.appointment.doctor.user.full_name,
                        "email": payment.appointment.doctor.user.email
                    }
                }
            
            # Получаем связанные услуги
            services_query = await db.execute(
                select(Service)
                .join(AppointmentService, Service.id == AppointmentService.service_id)
                .where(AppointmentService.appointment_id == payment.appointment.id)
            )
            services = services_query.scalars().all()
            
            # Добавляем услуги в словарь
            appointment_dict["services"] = [{
                "id": service.id,
                "name": service.name,
                "cost": service.cost,
                "description": service.description
            } for service in services]
            
            # Добавляем информацию о сервисе (для обратной совместимости)
            if payment.appointment.service:
                appointment_dict["service"] = {
                    "id": payment.appointment.service.id,
                    "name": payment.appointment.service.name,
                    "cost": payment.appointment.service.cost,
                    "description": payment.appointment.service.description
                }
            
            payment_dict["appointment"] = appointment_dict
        
        # Добавляем информацию о пациенте
        if payment.patient:
            payment_dict["patient"] = {
                "id": payment.patient.id,
                "user": {
                    "id": payment.patient.user.id,
                    "full_name": payment.patient.user.full_name,
                    "email": payment.patient.user.email
                }
            }
        
        payments_data.append(payment_dict)
    
    # Возвращаем данные в формате, который ожидает фронтенд
    return {
        "items": payments_data,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit  # Округление вверх
    }

@router.get("/patient", response_model=List[PaymentInDB])
async def get_patient_payments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить все платежи для текущего пациента"""
    if current_user.role != UserRole.patient:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Only patients can view their payments"
        )
    
    # Получаем пациента по user_id
    patient_result = await db.execute(
        select(Patient).where(Patient.user_id == current_user.id)
    )
    patient = patient_result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Получаем платежи пациента с предварительной загрузкой связанных данных
    result = await db.execute(
        select(Payment)
        .where(Payment.patient_id == patient.id)
        .options(
            joinedload(Payment.appointment).joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Payment.appointment).joinedload(Appointment.service),
            joinedload(Payment.patient).joinedload(Patient.user)
        )
    )
    payments = result.scalars().all()
    
    # Создаем список для хранения результатов
    payment_results = []
    
    # Для каждого платежа получаем связанные услуги и создаем новый объект
    for payment in payments:
        # Получаем услуги для записи, если она существует
        services = []
        total_cost = 0
        
        if payment.appointment:
            services_query = await db.execute(
                select(Service)
                .join(AppointmentService, Service.id == AppointmentService.service_id)
                .where(AppointmentService.appointment_id == payment.appointment.id)
            )
            services = services_query.scalars().all()
            
            # Рассчитываем общую стоимость услуг
            total_cost = sum(service.cost for service in services)
            
            # Если сумма платежа равна 0, обновляем её на основе стоимости услуг
            if payment.amount == 0 and total_cost > 0:
                payment.amount = total_cost
                await db.commit()
                await db.refresh(payment)
        
        payment_dict = {
            "id": payment.id,
            "appointment_id": payment.appointment_id if payment.appointment else None,
            "patient_id": payment.patient_id,
            "doctor_id": payment.doctor_id,
            "amount": payment.amount,
            "status": payment.status,
            "payment_method": payment.payment_method,
            "description": f"Оплата за услуги", 
            "created_at": payment.created_at,
            "updated_at": payment.updated_at,
            "appointment": None,
            "patient": payment.patient
        }
        
        # Если есть запись на прием, добавляем информацию о ней
        if payment.appointment:
            # Создаем словарь с информацией о записи и добавляем услуги
            appointment_dict = {
                "id": payment.appointment.id,
                "doctor_id": payment.appointment.doctor_id,
                "patient_id": payment.appointment.patient_id,
                "start_time": payment.appointment.start_time,
                "end_time": payment.appointment.end_time,
                "status": payment.appointment.status,
                "notes": payment.appointment.notes,
                "doctor": payment.appointment.doctor,
                "patient": payment.appointment.patient,
                "service": payment.appointment.service,
                "services": services
            }
            payment_dict["appointment"] = appointment_dict
        
        # Добавляем платеж в результаты
        payment_results.append(payment_dict)
    
    return payment_results

@router.post("/", response_model=PaymentInDB)
async def create_payment(
    payment: PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Создать новый платеж"""
    # Проверяем, есть ли запись на прием
    if payment.appointment_id:
        # Получаем услуги для записи
        services_query = await db.execute(
            select(Service)
            .join(AppointmentService, Service.id == AppointmentService.service_id)
            .where(AppointmentService.appointment_id == payment.appointment_id)
        )
        services = services_query.scalars().all()
        
        # Рассчитываем общую стоимость услуг
        total_cost = sum(service.cost for service in services)
        
        # Если сумма платежа равна 0 или не указана, устанавливаем её на основе стоимости услуг
        if (payment.amount == 0 or payment.amount is None) and total_cost > 0:
            payment.amount = total_cost
    
    db_payment = Payment(**payment.dict())
    db.add(db_payment)
    await db.commit()
    await db.refresh(db_payment)
    
    # Загружаем связанные данные
    result = await db.execute(
        select(Payment)
        .where(Payment.id == db_payment.id)
        .options(
            joinedload(Payment.appointment).joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Payment.appointment).joinedload(Appointment.service),
            joinedload(Payment.patient).joinedload(Patient.user)
        )
    )
    payment_with_relations = result.scalar_one_or_none()
    
    # Создаем словарь с данными платежа
    payment_dict = {
        "id": payment_with_relations.id,
        "appointment_id": payment_with_relations.appointment_id,
        "patient_id": payment_with_relations.patient_id,
        "doctor_id": payment_with_relations.doctor_id,
        "amount": payment_with_relations.amount,
        "status": payment_with_relations.status,
        "payment_method": payment_with_relations.payment_method,
        "description": "Оплата за услуги",
        "created_at": payment_with_relations.created_at,
        "updated_at": payment_with_relations.updated_at,
        "appointment": None,
        "patient": payment_with_relations.patient
    }
    
    # Если есть запись на прием, добавляем информацию о ней
    if payment_with_relations.appointment:
        services_query = await db.execute(
            select(Service)
            .join(AppointmentService, Service.id == AppointmentService.service_id)
            .where(AppointmentService.appointment_id == payment_with_relations.appointment.id)
        )
        services = services_query.scalars().all()
        
        # Создаем словарь с информацией о записи и добавляем услуги
        appointment_dict = {
            "id": payment_with_relations.appointment.id,
            "doctor_id": payment_with_relations.appointment.doctor_id,
            "patient_id": payment_with_relations.appointment.patient_id,
            "start_time": payment_with_relations.appointment.start_time,
            "end_time": payment_with_relations.appointment.end_time,
            "status": payment_with_relations.appointment.status,
            "notes": payment_with_relations.appointment.notes,
            "doctor": payment_with_relations.appointment.doctor,
            "patient": payment_with_relations.appointment.patient,
            "service": payment_with_relations.appointment.service,
            "services": services
        }
        payment_dict["appointment"] = appointment_dict
    
    return payment_dict

@router.get("/{payment_id}", response_model=PaymentInDB)
async def get_payment(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить информацию о конкретном платеже"""
    result = await db.execute(
        select(Payment)
        .where(Payment.id == payment_id)
        .options(
            joinedload(Payment.appointment).joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Payment.appointment).joinedload(Appointment.service),
            joinedload(Payment.patient).joinedload(Patient.user)
        )
    )
    payment = result.scalar_one_or_none()
    
    if not payment:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Проверяем права доступа
    if current_user.role == UserRole.patient:
        patient_result = await db.execute(
            select(Patient).where(Patient.user_id == current_user.id)
        )
        patient = patient_result.scalar_one_or_none()
        if not patient or payment.patient_id != patient.id:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="You can only view your own payments"
            )
    elif current_user.role == UserRole.doctor:
        doctor_result = await db.execute(
            select(Doctor).where(Doctor.user_id == current_user.id)
        )
        doctor = doctor_result.scalar_one_or_none()
        if not doctor or payment.doctor_id != doctor.id:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="You can only view payments for your patients"
            )
    
    # Создаем словарь с данными платежа
    payment_dict = {
        "id": payment.id,
        "appointment_id": payment.appointment_id if payment.appointment else None,
        "patient_id": payment.patient_id,
        "doctor_id": payment.doctor_id,
        "amount": payment.amount,
        "status": payment.status,
        "payment_method": payment.payment_method,
        "description": "Оплата за услуги",  # Добавляем статическое описание
        "created_at": payment.created_at,
        "updated_at": payment.updated_at,
        "appointment": None,
        "patient": payment.patient
    }
    
    # Получаем услуги для записи на прием и создаем словарь с данными записи
    if payment.appointment:
        services_query = await db.execute(
            select(Service)
            .join(AppointmentService, Service.id == AppointmentService.service_id)
            .where(AppointmentService.appointment_id == payment.appointment.id)
        )
        services = services_query.scalars().all()
        
        # Рассчитываем общую стоимость услуг
        total_cost = sum(service.cost for service in services)
        
        # Если сумма платежа равна 0, обновляем её на основе стоимости услуг
        if payment.amount == 0 and total_cost > 0:
            payment.amount = total_cost
            await db.commit()
            await db.refresh(payment)
            payment_dict["amount"] = payment.amount  # Обновляем сумму в словаре
        
        # Создаем словарь с информацией о записи и добавляем услуги
        appointment_dict = {
            "id": payment.appointment.id,
            "doctor_id": payment.appointment.doctor_id,
            "patient_id": payment.appointment.patient_id,
            "start_time": payment.appointment.start_time,
            "end_time": payment.appointment.end_time,
            "status": payment.appointment.status,
            "notes": payment.appointment.notes,
            "doctor": payment.appointment.doctor,
            "patient": payment.appointment.patient,
            "service": payment.appointment.service,
            "services": services
        }
        payment_dict["appointment"] = appointment_dict
    
    return payment_dict

@router.put("/{payment_id}", response_model=PaymentInDB)
async def update_payment(
    payment_id: int,
    payment_update: PaymentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить информацию о платеже"""
    result = await db.execute(
        select(Payment)
        .where(Payment.id == payment_id)
        .options(
            joinedload(Payment.appointment).joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Payment.appointment).joinedload(Appointment.service),
            joinedload(Payment.patient).joinedload(Patient.user)
        )
    )
    payment = result.scalar_one_or_none()
    
    if not payment:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
        
    # Проверяем права доступа
    if not current_user.is_superuser and current_user.role != UserRole.reception:
        if current_user.role == UserRole.doctor:
            doctor_result = await db.execute(
                select(Doctor).where(Doctor.user_id == current_user.id)
            )
            doctor = doctor_result.scalar_one_or_none()
            if not doctor or doctor.id != payment.doctor_id:
                raise HTTPException(
                    status_code=http_status.HTTP_403_FORBIDDEN,
                    detail="Not enough permissions"
                )
        else:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
    
    # Обновляем поля платежа
    update_data = payment_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(payment, field, value)
    
    await db.commit()
    await db.refresh(payment)
    
    # Получаем услуги для записи на прием
    if payment.appointment:
        services_query = await db.execute(
            select(Service)
            .join(AppointmentService, Service.id == AppointmentService.service_id)
            .where(AppointmentService.appointment_id == payment.appointment.id)
        )
        services = services_query.scalars().all()
        payment.appointment.services = services
    
    return payment

@router.post("/process", response_model=PaymentInDB)
async def process_payment(
    payment_data: PaymentProcessSchema,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обработать платеж (подтвердить или отклонить)"""
    # Получаем ID платежа из любого из доступных полей
    payment_id = payment_data.paymentId or payment_data.payment_id
    
    if not payment_id:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Payment ID is required (either paymentId or payment_id)"
        )
        
    logger.info(f"Processing payment with ID: {payment_id}")
    
    result = await db.execute(
        select(Payment)
        .where(Payment.id == payment_id)
        .options(
            joinedload(Payment.appointment).joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Payment.appointment).joinedload(Appointment.service),
            joinedload(Payment.patient).joinedload(Patient.user)
        )
    )
    payment = result.scalar_one_or_none()
    
    if not payment:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Проверяем права доступа
    if not current_user.is_superuser and current_user.role != UserRole.reception:
        # Проверяем, является ли пользователь пациентом, который оплачивает свой платеж
        if current_user.role == UserRole.patient:
            patient_result = await db.execute(
                select(Patient).where(Patient.user_id == current_user.id)
            )
            patient = patient_result.scalar_one_or_none()
            if not patient or patient.id != payment.patient_id:
                raise HTTPException(
                    status_code=http_status.HTTP_403_FORBIDDEN,
                    detail="You can only process your own payments"
                )
        else:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Only administrators, reception staff, and patients (for their own payments) can process payments"
            )
    
    # Обновляем статус платежа - для пациентов всегда устанавливаем статус "completed"
    if current_user.role == UserRole.patient:
        payment.status = PaymentStatus.completed
    else:
        payment.status = payment_data.status
    
    # Обновляем метод оплаты, если он указан
    if payment_data.payment_method:
        payment.payment_method = payment_data.payment_method
    
    if payment.status == PaymentStatus.completed:
        payment.updated_at = datetime.now()
    
    await db.commit()
    await db.refresh(payment)
    
    # Создаем уведомление для пациента
    status_text = "подтвержден" if payment.status == PaymentStatus.completed else "отклонен"
    notification = Notification(
        user_id=payment.patient_id,
        title="Статус платежа изменен",
        message=f"Ваш платеж на сумму {payment.amount} руб. {status_text}",
        type="payment"
    )
    db.add(notification)
    await db.commit()
    
    # Отслеживаем метрики платежа
    track_payment(payment.amount, payment.status, payment.payment_method)
    
    # Создаем словарь с данными платежа
    payment_dict = {
        "id": payment.id,
        "appointment_id": payment.appointment_id if payment.appointment else None,
        "patient_id": payment.patient_id,
        "doctor_id": payment.doctor_id,
        "amount": payment.amount,
        "status": payment.status,
        "payment_method": payment.payment_method,
        "description": "Оплата за услуги",  # Исправляем ошибку с полем description
        "created_at": payment.created_at,
        "updated_at": payment.updated_at,
        "appointment": None,
        "patient": payment.patient
    }
    
    # Получаем услуги для записи на прием и создаем словарь с данными записи
    if payment.appointment:
        services_query = await db.execute(
            select(Service)
            .join(AppointmentService, Service.id == AppointmentService.service_id)
            .where(AppointmentService.appointment_id == payment.appointment.id)
        )
        services = services_query.scalars().all()
        
        # Рассчитываем общую стоимость услуг
        total_cost = sum(service.cost for service in services)
        
        # Если сумма платежа равна 0, обновляем её на основе стоимости услуг
        if payment.amount == 0 and total_cost > 0:
            payment.amount = total_cost
            await db.commit()
            await db.refresh(payment)
            payment_dict["amount"] = payment.amount  # Обновляем сумму в словаре
            
            # Обновляем сообщение уведомления с новой суммой
            notification.message = f"Ваш платеж на сумму {payment.amount} руб. {status_text}"
            await db.commit()
        
        # Создаем словарь с информацией о записи и добавляем услуги
        appointment_dict = {
            "id": payment.appointment.id,
            "doctor_id": payment.appointment.doctor_id,
            "patient_id": payment.appointment.patient_id,
            "start_time": payment.appointment.start_time,
            "end_time": payment.appointment.end_time,
            "status": payment.appointment.status,
            "notes": payment.appointment.notes,
            "doctor": payment.appointment.doctor,
            "patient": payment.appointment.patient,
            "service": payment.appointment.service,
            "services": services
        }
        payment_dict["appointment"] = appointment_dict
    
    return payment_dict

@router.delete("/{payment_id}")
async def delete_payment(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Удалить платеж (только для администраторов)"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete payments"
        )
    
    result = await db.execute(
        select(Payment)
        .where(Payment.id == payment_id)
        .options(
            joinedload(Payment.appointment).joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Payment.appointment).joinedload(Appointment.service),
            joinedload(Payment.patient).joinedload(Patient.user)  # Добавляем загрузку пациента и его пользователя
        )
    )
    payment = result.scalar_one_or_none()
    
    if not payment:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    await db.delete(payment)
    await db.commit()
    return {"message": "Payment deleted successfully"}

def payment_to_dict(payment):
    return {
        "id": payment.id,
        "appointment_id": payment.appointment_id,
        "patient_id": payment.patient_id,
        "doctor_id": payment.doctor_id,
        "amount": payment.amount,
        "status": payment.status,
        "payment_method": payment.payment_method,
        "description": payment.description,
        "created_at": payment.created_at,
        "updated_at": payment.updated_at,
        "appointment": None,
        "patient": payment.patient
    }

def service_to_dict(service):
    return {
        "id": service.id,
        "name": service.name,
        "cost": service.cost,
        "description": service.description
    }

# Инициализируем сервис для работы с платежами
payment_service = PaymentService()

@router.post("/tinkoff/init", response_model=TinkoffPaymentInitResponse)
async def init_tinkoff_payment(
    payment_data: TinkoffPaymentInitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Инициализация платежа через API Тинькофф"""
    try:
        # Проверяем, что пользователь имеет доступ к платежу
        query = select(Payment).where(Payment.id == payment_data.payment_id)
        result = await db.execute(query)
        payment = result.scalar_one_or_none()
        
        if not payment:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Payment not found"
            )
        
        # Проверяем права доступа
        if current_user.role == UserRole.patient:
            patient_result = await db.execute(
                select(Patient).where(Patient.user_id == current_user.id)
            )
            patient = patient_result.scalar_one_or_none()
            if not patient or payment.patient_id != patient.id:
                raise HTTPException(
                    status_code=http_status.HTTP_403_FORBIDDEN,
                    detail="You don't have access to this payment"
                )
        elif current_user.role == UserRole.doctor:
            doctor_result = await db.execute(
                select(Doctor).where(Doctor.user_id == current_user.id)
            )
            doctor = doctor_result.scalar_one_or_none()
            if not doctor or payment.doctor_id != doctor.id:
                raise HTTPException(
                    status_code=http_status.HTTP_403_FORBIDDEN,
                    detail="You don't have access to this payment"
                )
        elif not current_user.is_superuser and current_user.role != UserRole.reception:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this payment"
            )
        
        # Инициализируем платеж через API Тинькофф
        response = await payment_service.init_payment(
            payment_id=payment_data.payment_id,
            return_url=payment_data.return_url,
            db=db
        )
        
        # Отслеживаем метрику платежа
        track_payment(float(payment.amount), "init", str(payment.payment_method))
        
        # Формируем ответ в формате TinkoffPaymentInitResponse
        if response.get("Success"):
            return {
                "Success": response.get("Success"),
                "ErrorCode": response.get("ErrorCode", "0"),  # Добавляем обязательное поле ErrorCode
                "TerminalKey": response.get("TerminalKey", payment_service.tinkoff_api.terminal_key),  # Добавляем обязательное поле TerminalKey
                "Status": response.get("Status"),
                "PaymentId": response.get("PaymentId"),
                "OrderId": response.get("OrderId"),
                "Amount": response.get("Amount"),
                "PaymentURL": response.get("PaymentURL")
            }
        else:
            # Если ответ неуспешный, возвращаем ошибку
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=response.get("Message") or "Error initializing payment"
            )
    except ValueError as e:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error initializing payment: {str(e)}"
        )

@router.post("/tinkoff/status", response_model=TinkoffPaymentStatusResponse, dependencies=[])
async def check_tinkoff_payment_status(
    payment_data: TinkoffPaymentStatusRequest,
    db: AsyncSession = Depends(get_db)
):
    """Проверка статуса платежа через API Тинькофф"""
    try:
        # Проверяем существование платежа
        query = select(Payment).where(Payment.id == payment_data.payment_id)
        result = await db.execute(query)
        payment = result.scalar_one_or_none()
        
        if not payment:
            logger.warning(f"Платеж с ID {payment_data.payment_id} не найден при проверке статуса")
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Payment not found"
            )
        
        # Логируем информацию о платеже
        logger.info(f"Проверка статуса платежа ID={payment.id}, external_payment_id={payment.external_payment_id}, tinkoff_payment_id={payment_data.tinkoff_payment_id}")
        
        # Проверяем статус платежа через API Тинькофф
        response = await payment_service.check_payment_status(
            payment_id=payment_data.payment_id,
            tinkoff_payment_id=payment_data.tinkoff_payment_id,
            db=db
        )
        
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking payment status: {str(e)}"
        )

@router.get("/check-status/{payment_id}")
async def manual_check_payment_status(
    payment_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Ручная проверка статуса платежа через API Тинькофф (GetState)
    
    Этот эндпоинт позволяет проверить статус платежа без авторизации.
    Может использоваться клиентом для периодической проверки статуса платежа,
    если уведомления от Тинькофф не приходят.
    """
    try:
        # Получаем платеж из БД
        query = select(Payment).where(Payment.id == payment_id)
        result = await db.execute(query)
        payment = result.scalar_one_or_none()
        
        if not payment:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Payment not found"
            )
            
        # Если у платежа нет external_payment_id, значит он еще не был инициализирован в Тинькофф
        if not payment.external_payment_id:
            return {
                "success": True,
                "payment_id": payment_id,
                "status": payment.status,
                "message": "Payment not initialized in Tinkoff yet"
            }
            
        # Проверяем статус платежа через API Тинькофф
        response = await payment_service.check_payment_status(
            payment_id=payment_id,
            tinkoff_payment_id=payment.external_payment_id,
            db=db
        )
        
        # Добавляем информацию о статусе платежа в системе
        response["system_status"] = payment.status
        
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error checking payment status: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking payment status: {str(e)}"
        )

@router.post("/tinkoff/confirm")
async def confirm_tinkoff_payment(
    payment_data: TinkoffPaymentConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Подтверждение платежа через API Тинькофф"""
    try:
        # Проверяем, что пользователь имеет доступ к платежу
        query = select(Payment).where(Payment.id == payment_data.payment_id)
        result = await db.execute(query)
        payment = result.scalar_one_or_none()
        
        if not payment:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Payment not found"
            )
        
        # Проверяем права доступа (только администратор или сотрудник регистратуры)
        if not current_user.is_superuser and current_user.role != UserRole.reception:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Only administrators and reception staff can confirm payments"
            )
        
        # Подтверждаем платеж через API Тинькофф
        response = await payment_service.confirm_payment(
            payment_id=payment_data.payment_id,
            tinkoff_payment_id=payment_data.tinkoff_payment_id,
            amount=payment_data.amount,
            db=db
        )
        
        # Отслеживаем метрику платежа
        track_payment("confirm", payment.amount, payment.payment_method)
        
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error confirming payment: {str(e)}"
        )

@router.post("/tinkoff/cancel")
async def cancel_tinkoff_payment(
    payment_data: TinkoffPaymentCancelRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Отмена платежа через API Тинькофф"""
    try:
        # Проверяем, что пользователь имеет доступ к платежу
        query = select(Payment).where(Payment.id == payment_data.payment_id)
        result = await db.execute(query)
        payment = result.scalar_one_or_none()
        
        if not payment:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Payment not found"
            )
        
        # Проверяем права доступа (только администратор или сотрудник регистратуры)
        if not current_user.is_superuser and current_user.role != UserRole.reception:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Only administrators and reception staff can cancel payments"
            )
        
        # Отменяем платеж через API Тинькофф
        response = await payment_service.cancel_payment(
            payment_id=payment_data.payment_id,
            tinkoff_payment_id=payment_data.tinkoff_payment_id,
            db=db
        )
        
        # Отслеживаем метрику платежа
        track_payment("cancel", payment.amount, payment.payment_method)
        
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error canceling payment: {str(e)}"
        )

@router.post("/tinkoff/refund")
async def refund_tinkoff_payment(
    payment_data: TinkoffPaymentRefundRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Возврат платежа через API Тинькофф"""
    try:
        # Проверяем, что пользователь имеет доступ к платежу
        query = select(Payment).where(Payment.id == payment_data.payment_id)
        result = await db.execute(query)
        payment = result.scalar_one_or_none()
        
        if not payment:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="Payment not found"
            )
        
        # Проверяем права доступа (только администратор или сотрудник регистратуры)
        if not current_user.is_superuser and current_user.role != UserRole.reception:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Only administrators and reception staff can refund payments"
            )
        
        # Возвращаем платеж через API Тинькофф
        response = await payment_service.refund_payment(
            payment_id=payment_data.payment_id,
            tinkoff_payment_id=payment_data.tinkoff_payment_id,
            amount=payment_data.amount,
            db=db
        )
        
        # Отслеживаем метрику платежа
        track_payment("refund", payment.amount, payment.payment_method)
        
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error refunding payment: {str(e)}"
        )

@router.post("/notification", include_in_schema=True, dependencies=[])
async def process_tinkoff_notification(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    # Самое первое логирование, до любых блоков try-except
    logger.info("!!! TINKOFF NOTIFICATION RECEIVED - INITIAL LOG !!!")
    logger.info(f"!!! Request from IP: {request.client.host if request.client else 'Unknown'} !!!")
    logger.info(f"!!! Request method: {request.method} !!!")
    logger.info(f"!!! Request URL: {request.url} !!!")
    logger.info(f"!!! Headers: {dict(request.headers)} !!!")
    logger.info("!!! END OF INITIAL LOG !!!")
    
    """Обработка уведомления от API Тинькофф"""
    try:
        # Расширенное логирование входящего запроса
        logger.info("=== TINKOFF NOTIFICATION ENDPOINT START ===")
        logger.info(f"Received Tinkoff notification request from {request.client.host}")
        logger.info(f"Request method: {request.method}")
        logger.info(f"Request URL: {request.url}")
        
        # Логируем все заголовки
        headers = dict(request.headers)
        logger.info(f"Request headers: {headers}")
        
        # Проверяем ключевые заголовки
        content_type = headers.get('content-type', 'unknown')
        logger.info(f"Content-Type: {content_type}")
        
        # Получаем данные из запроса
        try:
            # Сначала пробуем получить данные как JSON
            notification_data = await request.json()
            logger.info(f"Successfully parsed JSON data: {notification_data}")
            logger.info(f"JSON data type: {type(notification_data)}")
            logger.info(f"JSON keys: {list(notification_data.keys()) if isinstance(notification_data, dict) else 'Not a dict'}")
        except Exception as json_error:
            # Если не удалось получить JSON, пробуем получить данные формы
            logger.warning(f"Failed to parse JSON: {str(json_error)}")
            logger.info("Trying to parse as form data...")
            
            try:
                form_data = await request.form()
                notification_data = dict(form_data)
                logger.info(f"Successfully parsed form data: {notification_data}")
                logger.info(f"Form data type: {type(notification_data)}")
                logger.info(f"Form keys: {list(notification_data.keys()) if notification_data else 'No keys'}")
            except Exception as form_error:
                logger.error(f"Failed to parse form data: {str(form_error)}")
                
                # Последняя попытка - получить сырые данные
                try:
                    raw_body = await request.body()
                    logger.info(f"Raw body: {raw_body}")
                    notification_data = {"raw_body": str(raw_body)}
                except Exception as raw_error:
                    logger.error(f"Failed to get raw body: {str(raw_error)}")
                    notification_data = {}
        
        # Проверяем наличие необходимых полей
        if not notification_data:
            logger.error("Empty notification data received")
            # Даже при ошибке возвращаем OK для Тинькофф
            return PlainTextResponse(content="OK", status_code=200)
        
        # Проверяем наличие ключевых полей для Tinkoff
        expected_keys = ['OrderId', 'PaymentId', 'Status', 'Success']
        found_keys = [key for key in expected_keys if key in notification_data]
        missing_keys = [key for key in expected_keys if key not in notification_data]
        
        logger.info(f"Found expected keys: {found_keys}")
        if missing_keys:
            logger.warning(f"Missing expected keys: {missing_keys}")
        
        # Логируем все параметры запроса для отладки
        logger.info(f"Request query params: {dict(request.query_params)}")
        logger.info(f"Request path params: {dict(request.path_params)}")
        
        # Проверяем значения ключевых полей
        if 'OrderId' in notification_data:
            logger.info(f"OrderId: {notification_data['OrderId']}")
        if 'PaymentId' in notification_data:
            logger.info(f"PaymentId: {notification_data['PaymentId']}")
        if 'Status' in notification_data:
            logger.info(f"Status: {notification_data['Status']}")
        
        # Обрабатываем уведомление
        logger.info("Calling payment_service.process_notification...")
        result = await payment_service.process_notification(notification_data, db)
        logger.info(f"Notification processing result: {result}")
        
        if result.get("success"):
            logger.info("Successfully processed Tinkoff notification")
            logger.info("=== TINKOFF NOTIFICATION ENDPOINT COMPLETE ===\n")
        else:
            logger.warning(f"Failed to process Tinkoff notification: {result.get('message')}")
            logger.info("=== TINKOFF NOTIFICATION ENDPOINT COMPLETE WITH ERRORS ===\n")
        
        # Возвращаем ответ в формате, который ожидает Тинькофф
        return PlainTextResponse(content="OK", status_code=200)
    except Exception as e:
        logger.error(f"Error processing Tinkoff notification: {str(e)}")
        logger.error(traceback.format_exc())
        logger.info("=== TINKOFF NOTIFICATION ENDPOINT FAILED ===\n")
        # Даже при ошибке возвращаем OK для Тинькофф
        return PlainTextResponse(content="OK", status_code=200)
