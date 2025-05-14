from datetime import datetime, timedelta, time, timezone
from sqlalchemy import select, and_, or_, update, delete, func, text
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, aliased
from typing import List, Optional
import json

from app.core.security import get_current_user
from app.db.session import get_db
from app.db.models import User, Doctor, Patient, Appointment, UserRole, DoctorSchedule, AppointmentStatus, Service, DoctorSpecialDay, SpecialDayType, AppointmentService, Payment, PaymentStatus, PaymentMethod, Notification
from app.core.metrics import track_appointment, update_doctor_workload, track_payment
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentInDB,
    AppointmentWithDetails,
    AppointmentList
)

router = APIRouter()

@router.get("/list", response_model=AppointmentList)
async def get_appointments(
    page: int = 1,
    limit: int = 10,
    status: Optional[AppointmentStatus] = None,
    date: Optional[datetime] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role not in [UserRole.admin, UserRole.reception]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and reception staff can view all appointments"
        )

    # Вычисляем skip из page для пагинации
    skip = (page - 1) * limit

    # Формируем базовый запрос для подсчета общего количества
    count_query = select(Appointment)
    
    # Добавляем фильтры
    if status:
        count_query = count_query.where(Appointment.status == status)
    
    # Если передана дата, фильтруем по ней
    if date:
        # Получаем начало и конец дня
        start_of_day = datetime.combine(date.date(), time.min)
        end_of_day = datetime.combine(date.date(), time.max)
        count_query = count_query.where(
            and_(
                Appointment.start_time >= start_of_day,
                Appointment.start_time <= end_of_day
            )
        )
    
    # Если передан поисковый запрос, ищем по имени пациента или врача
    if search:
        search_term = f"%{search}%"
        # Создаем алиасы для таблицы User
        patient_user = aliased(User)
        doctor_user = aliased(User)
        
        count_query = count_query.join(
            Appointment.patient
        ).join(
            Patient.user.of_type(patient_user)
        ).join(
            Appointment.doctor
        ).join(
            Doctor.user.of_type(doctor_user), isouter=True
        ).where(
            or_(
                patient_user.full_name.ilike(search_term),
                patient_user.email.ilike(search_term),
                doctor_user.full_name.ilike(search_term),
                doctor_user.email.ilike(search_term)
            )
        )
    
    total_count = len((await db.execute(count_query)).scalars().all())

    # Формируем запрос для получения записей с дополнительными данными
    query = (
        select(Appointment)
        .options(
            joinedload(Appointment.patient).joinedload(Patient.user),
            joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Appointment.doctor).joinedload(Doctor.specialization),
            joinedload(Appointment.appointment_services).joinedload(AppointmentService.service)
        )
    )

    # Добавляем фильтры
    if status:
        query = query.where(Appointment.status == status)
    
    # Если передана дата, фильтруем по ней
    if date:
        # Получаем начало и конец дня
        start_of_day = datetime.combine(date.date(), time.min)
        end_of_day = datetime.combine(date.date(), time.max)
        query = query.where(
            and_(
                Appointment.start_time >= start_of_day,
                Appointment.start_time <= end_of_day
            )
        )
    
    # Если передан поисковый запрос, ищем по имени пациента или врача
    if search:
        search_term = f"%{search}%"
        # Создаем алиасы для таблицы User
        patient_user = aliased(User)
        doctor_user = aliased(User)
        
        query = query.join(
            Appointment.patient
        ).join(
            Patient.user.of_type(patient_user)
        ).join(
            Appointment.doctor
        ).join(
            Doctor.user.of_type(doctor_user), isouter=True
        ).where(
            or_(
                patient_user.full_name.ilike(search_term),
                patient_user.email.ilike(search_term),
                doctor_user.full_name.ilike(search_term),
                doctor_user.email.ilike(search_term)
            )
        )

    # Добавляем сортировку по дате
    query = query.order_by(Appointment.start_time.desc())

    # Добавляем пагинацию
    query = query.offset(skip).limit(limit)

    # Выполняем запрос
    result = await db.execute(query)
    appointments = result.unique().scalars().all()

    # Преобразуем результаты в список объектов AppointmentWithDetails
    appointments_with_details = []
    for appointment in appointments:
        doctor = appointment.doctor
        patient = appointment.patient
        
        # Получаем услуги для этой записи
        services = []
        if hasattr(appointment, 'appointment_services') and appointment.appointment_services:
            services = [{
                "id": service.service.id,
                "name": service.service.name,
                "price": float(service.service.cost) if hasattr(service.service, 'cost') else 0.0
            } for service in appointment.appointment_services if service.service]
        
        appointment_dict = appointment.__dict__.copy()
        
        appointments_with_details.append(
            AppointmentWithDetails(
                **appointment_dict,
                doctor_name=doctor.user.full_name if doctor and doctor.user else "Неизвестный врач",
                patient_name=patient.user.full_name if patient and patient.user else "Неизвестный пациент",
                doctor_specialty=doctor.specialization.name if doctor and doctor.specialization else None,
                service_name=None,  # Устаревшее поле, оставляем для обратной совместимости
                service_duration=doctor.specialization.appointment_duration if doctor and doctor.specialization else 30,
                services=services  # Передаем список услуг
            )
        )
    
    return AppointmentList(items=appointments_with_details, total=total_count)

@router.get("/doctor/me", response_model=List[AppointmentWithDetails])
async def get_my_doctor_appointments(
    skip: int = 0,
    limit: int = 100,
    appointment_status: Optional[AppointmentStatus] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить все записи текущего врача"""
    # Проверяем, что пользователь - врач
    if current_user.role != UserRole.doctor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can view their appointments"
        )
    
    # Получаем данные врача
    doctor_result = await db.execute(
        select(Doctor).where(Doctor.user_id == current_user.id)
    )
    doctor = doctor_result.scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )
    
    # Формируем запрос с фильтрами
    query = (
        select(Appointment)
        .options(
            joinedload(Appointment.patient).joinedload(Patient.user),
            joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Appointment.doctor).joinedload(Doctor.specialization),
            joinedload(Appointment.appointment_services).joinedload(AppointmentService.service)
        )
        .where(Appointment.doctor_id == doctor.id)
    )
    
    # Добавляем фильтр по статусу, если указан
    if appointment_status:
        query = query.where(Appointment.status == appointment_status)
    
    # Добавляем фильтры по датам, если указаны
    if from_date:
        query = query.where(Appointment.start_time >= from_date)
    
    if to_date:
        query = query.where(Appointment.start_time <= to_date)
    
    # Добавляем пагинацию
    query = query.offset(skip).limit(limit)
    
    # Сортируем по времени начала
    query = query.order_by(Appointment.start_time)
    
    # Выполняем запрос
    result = await db.execute(query)
    appointments = result.unique().scalars().all()
    
    # Преобразуем результаты в список объектов AppointmentWithDetails
    appointments_with_details = []
    for appointment in appointments:
        patient = appointment.patient
        
        # Получаем услуги для этой записи
        services = []
        if hasattr(appointment, 'appointment_services') and appointment.appointment_services:
            services = [{
                "id": service.service.id,
                "name": service.service.name,
                "price": float(service.service.cost) if hasattr(service.service, 'cost') else 0.0
            } for service in appointment.appointment_services if service.service]
        
        appointment_dict = appointment.__dict__.copy()
        
        # Проверяем наличие обязательных полей и устанавливаем значения по умолчанию
        if appointment_dict.get('created_at') is None:
            appointment_dict['created_at'] = datetime.now(timezone.utc)
        if appointment_dict.get('updated_at') is None:
            appointment_dict['updated_at'] = datetime.now(timezone.utc)
        
        appointments_with_details.append(
            AppointmentWithDetails(
                **appointment_dict,
                doctor_name=doctor.user.full_name,
                patient_name=patient.user.full_name if patient and patient.user else "Неизвестный пациент",
                doctor_specialty=doctor.specialization.name if doctor.specialization else None,
                service_name=None,  # Устаревшее поле, оставляем для обратной совместимости
                service_duration=doctor.specialization.appointment_duration if doctor.specialization else 30,
                services=services,  # Передаем список услуг
                service={}  # Пустой словарь для обратной совместимости
            )
        )
    
    return appointments_with_details

@router.get("/doctor/{doctor_id}", response_model=List[AppointmentWithDetails])
async def get_doctor_appointments(
    doctor_id: int,
    skip: int = 0,
    limit: int = 100,
    appointment_status: Optional[AppointmentStatus] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить все записи конкретного врача"""
    # Проверяем права доступа
    if current_user.role not in [UserRole.admin, UserRole.reception]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and reception staff can view doctor appointments"
        )
    
    # Проверяем существование врача
    doctor_result = await db.execute(
        select(Doctor)
        .options(
            joinedload(Doctor.user),
            joinedload(Doctor.specialization)
        )
        .where(Doctor.id == doctor_id)
    )
    doctor = doctor_result.unique().scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )
    
    # Формируем запрос с фильтрами
    query = (
        select(Appointment)
        .options(
            joinedload(Appointment.patient).joinedload(Patient.user),
            joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Appointment.doctor).joinedload(Doctor.specialization),
            joinedload(Appointment.appointment_services).joinedload(AppointmentService.service)
        )
        .where(Appointment.doctor_id == doctor_id)
    )
    
    # Добавляем фильтр по статусу, если указан
    if appointment_status:
        query = query.where(Appointment.status == appointment_status)
    
    # Добавляем фильтры по датам, если указаны
    if from_date:
        query = query.where(Appointment.start_time >= from_date)
    
    if to_date:
        query = query.where(Appointment.start_time <= to_date)
    
    # Добавляем пагинацию
    query = query.offset(skip).limit(limit)
    
    # Сортируем по времени начала
    query = query.order_by(Appointment.start_time)
    
    # Выполняем запрос
    result = await db.execute(query)
    appointments = result.unique().scalars().all()
    
    # Преобразуем результаты в список объектов AppointmentWithDetails
    appointments_with_details = []
    for appointment in appointments:
        patient = appointment.patient
        
        # Получаем услуги для этой записи
        services = []
        if hasattr(appointment, 'appointment_services') and appointment.appointment_services:
            services = [{
                "id": service.service.id,
                "name": service.service.name,
                "price": float(service.service.cost) if hasattr(service.service, 'cost') else 0.0
            } for service in appointment.appointment_services if service.service]
        
        appointment_dict = appointment.__dict__.copy()
        
        # Проверяем наличие обязательных полей и устанавливаем значения по умолчанию
        if appointment_dict.get('created_at') is None:
            appointment_dict['created_at'] = datetime.now(timezone.utc)
        if appointment_dict.get('updated_at') is None:
            appointment_dict['updated_at'] = datetime.now(timezone.utc)
        
        appointments_with_details.append(
            AppointmentWithDetails(
                **appointment_dict,
                doctor_name=doctor.user.full_name,
                patient_name=patient.user.full_name if patient and patient.user else "Неизвестный пациент",
                doctor_specialty=doctor.specialization.name if doctor.specialization else None,
                service_name=None,  # Устаревшее поле, оставляем для обратной совместимости
                service_duration=doctor.specialization.appointment_duration if doctor.specialization else 30,
                services=services,  # Передаем список услуг
                service={}  # Пустой словарь для обратной совместимости
            )
        )
    
    return appointments_with_details

@router.get("/me", response_model=List[AppointmentWithDetails])
async def get_my_appointments(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить список своих записей на прием"""
    # Проверяем, что пользователь - пациент
    if current_user.role != UserRole.patient:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can view their appointments"
        )
    
    # Получаем данные пациента
    patient_result = await db.execute(
        select(Patient).where(Patient.user_id == current_user.id)
    )
    patient = patient_result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Формируем запрос с фильтрами
    query = (
        select(Appointment)
        .options(
            joinedload(Appointment.patient).joinedload(Patient.user),
            joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Appointment.doctor).joinedload(Doctor.specialization),
            joinedload(Appointment.appointment_services).joinedload(AppointmentService.service)
        )
        .where(Appointment.patient_id == patient.id)
    )
    
    # Добавляем пагинацию
    query = query.offset(skip).limit(limit)
    
    # Сортируем по времени начала (сначала ближайшие)
    query = query.order_by(Appointment.start_time)
    
    # Выполняем запрос
    result = await db.execute(query)
    appointments = result.unique().scalars().all()
    
    # Преобразуем результаты в список объектов AppointmentWithDetails
    appointments_with_details = []
    for appointment in appointments:
        doctor = appointment.doctor
        
        # Получаем услуги для этой записи
        services = []
        if hasattr(appointment, 'appointment_services') and appointment.appointment_services:
            services = [{
                "id": service.service.id,
                "name": service.service.name,
                "price": float(service.service.cost) if hasattr(service.service, 'cost') else 0.0
            } for service in appointment.appointment_services if service.service]
        
        appointment_dict = appointment.__dict__.copy()
        
        # Проверяем наличие обязательных полей и устанавливаем значения по умолчанию
        if appointment_dict.get('created_at') is None:
            appointment_dict['created_at'] = datetime.now(timezone.utc)
        if appointment_dict.get('updated_at') is None:
            appointment_dict['updated_at'] = datetime.now(timezone.utc)
        
        appointments_with_details.append(
            AppointmentWithDetails(
                **appointment_dict,
                doctor_name=doctor.user.full_name if doctor and doctor.user else "Неизвестный врач",
                patient_name=patient.user.full_name,
                doctor_specialty=doctor.specialization.name if doctor and doctor.specialization else None,
                service_name=None,  # Устаревшее поле, оставляем для обратной совместимости
                service_duration=doctor.specialization.appointment_duration if doctor and doctor.specialization else 30,
                services=services,  # Передаем список услуг
                service={}  # Пустой словарь для обратной совместимости
            )
        )
    
    return appointments_with_details

@router.get("/patient/{patient_id}", response_model=List[AppointmentWithDetails])
async def get_patient_appointments(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    appointment_status: Optional[AppointmentStatus] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None
):
    """Получить все записи конкретного пациента"""
    # Проверяем права доступа
    if current_user.role not in [UserRole.admin, UserRole.reception]:
        patient_result = await db.execute(
            select(Patient).where(Patient.id == patient_id)
        )
        patient = patient_result.scalar_one_or_none()
        if not patient or patient.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view appointments for yourself"
            )

    # Формируем базовый запрос
    query = select(Appointment).where(Appointment.patient_id == patient_id)

    # Добавляем фильтры
    if appointment_status:
        query = query.where(Appointment.status == appointment_status)
    if from_date:
        query = query.where(Appointment.start_time >= from_date)
    if to_date:
        query = query.where(Appointment.end_time <= to_date)

    # Сортируем по дате
    query = query.order_by(Appointment.start_time.desc())

    # Выполняем запрос
    result = await db.execute(query)
    appointments = result.scalars().all()

    # Получаем данные врачей
    doctor_ids = [appointment.doctor_id for appointment in appointments]
    service_ids = [appointment.service_id for appointment in appointments]
    
    doctor_results = await db.execute(
        select(Doctor)
        .options(
            joinedload(Doctor.user),
            joinedload(Doctor.specialization)
        )
        .where(Doctor.id.in_(doctor_ids))
    )
    doctors = {doctor.id: doctor for doctor in doctor_results.unique().scalars().all()}

    # Получаем данные услуг
    service_results = await db.execute(
        select(Service).where(Service.id.in_(service_ids))
    )
    services = {service.id: service for service in service_results.scalars().all()}

    # Получаем данные пациента
    patient_result = await db.execute(
        select(Patient)
        .options(joinedload(Patient.user))
        .where(Patient.id == patient_id)
    )
    patient = patient_result.unique().scalar_one()

    # Формируем ответ
    appointments_with_details = []
    current_datetime = datetime.now(timezone.utc)
    for appointment in appointments:
        doctor = doctors.get(appointment.doctor_id)
        service = services.get(appointment.service_id)
        
        # Получаем все услуги для этой записи
        services_result = await db.execute(
            select(Service)
            .join(AppointmentService, Service.id == AppointmentService.service_id)
            .where(AppointmentService.appointment_id == appointment.id)
        )
        appointment_services = services_result.scalars().all()
        
        if doctor:
            appointment_dict = appointment.__dict__.copy()
            if appointment_dict.get('created_at') is None:
                appointment_dict['created_at'] = current_datetime
            if appointment_dict.get('updated_at') is None:
                appointment_dict['updated_at'] = current_datetime
                
            appointment_with_details = AppointmentWithDetails(
                **appointment_dict,
                doctor_name=doctor.user.full_name,
                patient_name=patient.user.full_name,
                doctor_specialty=doctor.specialization.name if doctor.specialization else None,
                service_name=service.name if service else None,
                # Используем длительность из специализации врача вместо service.duration
                service_duration=doctor.specialization.appointment_duration if doctor and doctor.specialization else None,
                service_ids=[service.id for service in appointment_services],
                services=[{
                    "id": service.id,
                    "name": service.name,
                    "duration": doctor.specialization.appointment_duration if doctor and doctor.specialization else 30,
                    "price": service.cost
                } for service in appointment_services]
            )
            appointments_with_details.append(appointment_with_details)

    return appointments_with_details

@router.put("/{appointment_id}", response_model=AppointmentInDB)
async def update_appointment(
    appointment_id: int,
    appointment_update: AppointmentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить информацию о записи"""
    # Проверяем существование записи
    appointment_result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    db_appointment = appointment_result.scalar_one_or_none()
    if not db_appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found"
        )
    
    # Проверяем права доступа
    if current_user.role == UserRole.patient:
        # Пациент может обновлять только свои записи
        patient_result = await db.execute(
            select(Patient).where(Patient.user_id == current_user.id)
        )
        patient = patient_result.scalar_one_or_none()
        if not patient or patient.id != db_appointment.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own appointments"
            )
    elif current_user.role == UserRole.doctor:
        # Врач может обновлять только записи к себе
        doctor_result = await db.execute(
            select(Doctor).where(Doctor.user_id == current_user.id)
        )
        doctor = doctor_result.scalar_one_or_none()
        if not doctor or doctor.id != db_appointment.doctor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update appointments to you"
            )
    
    # Обновляем поля записи
    update_data = appointment_update.model_dump(exclude_unset=True)
    
    # Сохраняем статус для последующей обработки
    status_update = None
    if 'status' in update_data and update_data['status'] == 'completed':
        status_update = update_data.pop('status')
    
    # Обрабатываем обновление услуг, если они указаны
    if 'service_ids' in update_data:
        service_ids = update_data.pop('service_ids')  # Удаляем из update_data, так как это не поле в модели Appointment
        
        if service_ids:
            # Проверяем существование всех услуг
            for service_id in service_ids:
                service_result = await db.execute(
                    select(Service).where(Service.id == service_id)
                )
                service = service_result.scalar_one_or_none()
                if not service:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Service with id {service_id} not found"
                    )
            
            # Удаляем существующие связи
            await db.execute(
                delete(AppointmentService).where(AppointmentService.appointment_id == appointment_id)
            )
            
            # Создаем новые связи
            for service_id in service_ids:
                appointment_service = AppointmentService(
                    appointment_id=appointment_id,
                    service_id=service_id
                )
                db.add(appointment_service)
            
            # Обновляем service_id для обратной совместимости
            if service_ids:
                db_appointment.service_id = service_ids[0]
    
    # Обновляем запись
    for field, value in update_data.items():
        setattr(db_appointment, field, value)
    
    # Фиксируем изменения в базе данных
    await db.commit()
    
    # Теперь, после фиксации услуг, обновляем статус на "completed", если необходимо
    if status_update:
        # Получаем информацию о связанных услугах для создания платежа
        services_query = await db.execute(
            select(Service)
            .join(AppointmentService, Service.id == AppointmentService.service_id)
            .where(AppointmentService.appointment_id == appointment_id)
        )
        services = services_query.scalars().all()
        
        # Если услуги не найдены, проверяем service_id для обратной совместимости
        if not services and db_appointment.service_id:
            service_query = await db.execute(
                select(Service).where(Service.id == db_appointment.service_id)
            )
            service = service_query.scalar_one_or_none()
            if service:
                services = [service]
        
        # Вычисляем общую стоимость услуг
        total_cost = sum(float(service.cost) for service in services) if services else 0
        service_names = ", ".join(service.name for service in services) if services else "Консультация"
        
        # Логируем найденные услуги для отладки
        print(f"Найдено услуг: {len(services)}")
        for service in services:
            print(f"Услуга: {service.name}, стоимость: {service.cost}")
        print(f"Общая стоимость: {total_cost}")
        
        # Обновляем статус записи
        db_appointment.status = status_update
        await db.commit()
        
        # Отправляем метрику об изменении статуса записи
        track_appointment(status=status_update)
        
        # Создаем платеж только если есть услуги и общая стоимость больше 0
        if total_cost > 0:
            new_payment = Payment(
                appointment_id=db_appointment.id,
                patient_id=db_appointment.patient_id,
                doctor_id=db_appointment.doctor_id,
                amount=total_cost,
                status=PaymentStatus.pending,
                payment_method=PaymentMethod.card,
                description=f"Оплата за услуги: {service_names}"
            )
            db.add(new_payment)
            await db.commit()
            
            # Создаем уведомление для пациента
            notification = Notification(
                user_id=db_appointment.patient_id,
                title="Новый платеж",
                message=f"Создан новый платеж на сумму {total_cost} руб. за услуги: {service_names}",
                type="payment"
            )
            db.add(notification)
            await db.commit()
    
    await db.refresh(db_appointment)
    
    # Получаем все услуги для этой записи для включения в ответ
    services_result = await db.execute(
        select(Service)
        .join(AppointmentService, Service.id == AppointmentService.service_id)
        .where(AppointmentService.appointment_id == appointment_id)
    )
    services = services_result.scalars().all()
    
    # Добавляем service_ids в ответ
    db_appointment.service_ids = [service.id for service in services]
    
    return db_appointment

@router.get("/{appointment_id}", response_model=AppointmentWithDetails)
async def get_appointment(
    appointment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить информацию о конкретной записи"""
    # Получаем запись с присоединенными данными о враче, пациенте и услугах
    appointment_result = await db.execute(
        select(Appointment)
        .options(
            joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Appointment.doctor).joinedload(Doctor.specialization),
            joinedload(Appointment.patient).joinedload(Patient.user),
            joinedload(Appointment.appointment_services).joinedload(AppointmentService.service)
        )
        .where(Appointment.id == appointment_id)
    )
    appointment = appointment_result.unique().scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found"
        )
    
    # Проверяем права доступа
    if current_user.role not in [UserRole.admin, UserRole.reception]:
        # Если пользователь - врач, проверяем, что это его запись
        if current_user.role == UserRole.doctor:
            doctor_result = await db.execute(
                select(Doctor).where(Doctor.user_id == current_user.id)
            )
            doctor = doctor_result.scalar_one_or_none()
            if not doctor or doctor.id != appointment.doctor_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only view your own appointments"
                )
        # Если пользователь - пациент, проверяем, что это его запись
        elif current_user.role == UserRole.patient:
            patient_result = await db.execute(
                select(Patient).where(Patient.user_id == current_user.id)
            )
            patient = patient_result.scalar_one_or_none()
            if not patient or patient.id != appointment.patient_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only view your own appointments"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
    
    doctor = appointment.doctor
    patient = appointment.patient
    
    # Получаем услуги для этой записи
    services = []
    if hasattr(appointment, 'appointment_services') and appointment.appointment_services:
        services = [{
            "id": service.service.id,
            "name": service.service.name,
            "price": float(service.service.cost) if hasattr(service.service, 'cost') else 0.0
        } for service in appointment.appointment_services if service.service]
    
    appointment_dict = appointment.__dict__.copy()
    
    # Проверяем наличие обязательных полей и устанавливаем значения по умолчанию
    if appointment_dict.get('created_at') is None:
        appointment_dict['created_at'] = datetime.now(timezone.utc)
    if appointment_dict.get('updated_at') is None:
        appointment_dict['updated_at'] = datetime.now(timezone.utc)
    
    return AppointmentWithDetails(
        **appointment_dict,
        doctor_name=doctor.user.full_name if doctor and doctor.user else "Неизвестный врач",
        patient_name=patient.user.full_name if patient and patient.user else "Неизвестный пациент",
        doctor_specialty=doctor.specialization.name if doctor and doctor.specialization else None,
        service_name=None,  # Устаревшее поле, оставляем для обратной совместимости
        service_duration=doctor.specialization.appointment_duration if doctor and doctor.specialization else 30,
        services=services  # Передаем список услуг
    )

@router.post("", response_model=AppointmentInDB)
async def create_appointment(
    appointment: AppointmentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Создать новую запись на прием"""
    # Проверяем, что пользователь имеет права на создание записи
    if current_user.role not in [UserRole.admin, UserRole.reception, UserRole.patient]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to create appointments"
        )
    
    # Проверяем существование врача
    doctor_result = await db.execute(
        select(Doctor)
        .options(
            joinedload(Doctor.user),
            joinedload(Doctor.specialization)
        )
        .where(Doctor.id == appointment.doctor_id)
    )
    doctor = doctor_result.unique().scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )
    
    # Проверяем существование пациента
    patient_result = await db.execute(
        select(Patient)
        .options(joinedload(Patient.user))
        .where(Patient.id == appointment.patient_id)
    )
    patient = patient_result.unique().scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Проверяем, что пациент создает запись для себя или имеет соответствующие права
    if current_user.role == UserRole.patient:
        patient_check_result = await db.execute(
            select(Patient).where(Patient.user_id == current_user.id)
        )
        patient_check = patient_check_result.scalar_one_or_none()
        if not patient_check or patient_check.id != appointment.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only create appointments for yourself"
            )
    
    # Проверяем, что время приема свободно
    overlapping_result = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.doctor_id == appointment.doctor_id,
                or_(
                    and_(
                        Appointment.start_time <= appointment.start_time,
                        Appointment.end_time > appointment.start_time
                    ),
                    and_(
                        Appointment.start_time < appointment.end_time,
                        Appointment.end_time >= appointment.end_time
                    ),
                    and_(
                        Appointment.start_time >= appointment.start_time,
                        Appointment.end_time <= appointment.end_time
                    )
                ),
                Appointment.status != AppointmentStatus.cancelled
            )
        )
    )
    overlapping = overlapping_result.scalars().all()
    
    if overlapping:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This time slot is already booked"
        )
    
    # Создаем новую запись
    new_appointment = Appointment(
        doctor_id=appointment.doctor_id,
        patient_id=appointment.patient_id,
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        status=appointment.status,
        notes=appointment.notes,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    
    db.add(new_appointment)
    await db.commit()
    await db.refresh(new_appointment)
    
    # Отправляем метрику о создании записи
    track_appointment(
        status=new_appointment.status.value if hasattr(new_appointment.status, 'value') else str(new_appointment.status)
    )
    
    # Обновляем метрику загруженности врача
    update_doctor_workload(
        doctor_id=doctor.id,
        doctor_name=doctor.user.full_name,
        appointment_count=1  # Увеличиваем счетчик на 1 при создании новой записи
    )
    
    # Создаем уведомление для врача
    notification = Notification(
        user_id=doctor.user_id,
        title="Новая запись на прием",
        message=f"К вам записался пациент {patient.user.full_name} на {appointment.start_time.strftime('%d.%m.%Y %H:%M')}",
        is_read=False
    )
    db.add(notification)
    
    # Создаем уведомление для пациента
    notification = Notification(
        user_id=patient.user_id,
        title="Запись на прием создана",
        message=f"Вы записаны к врачу {doctor.user.full_name} на {appointment.start_time.strftime('%d.%m.%Y %H:%M')}",
        is_read=False
    )
    db.add(notification)
    
    await db.commit()
    
    return new_appointment

@router.post("/{appointment_id}/services", response_model=AppointmentWithDetails)
async def add_services_to_appointment(
    appointment_id: int,
    service_ids: List[int],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Добавить услуги к приему"""
    # Проверяем существование приема
    appointment_result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = appointment_result.scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found"
        )
    
    # Проверяем права доступа
    if current_user.role != UserRole.admin and current_user.role != UserRole.reception:
        # Для врачей проверяем, что это их прием
        if current_user.role == UserRole.doctor:
            doctor_result = await db.execute(
                select(Doctor).where(Doctor.user_id == current_user.id)
            )
            doctor = doctor_result.scalar_one_or_none()
            if not doctor or doctor.id != appointment.doctor_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only add services to your own appointments"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to add services to appointments"
            )
    
    # Проверяем существование услуг
    services_result = await db.execute(
        select(Service).where(Service.id.in_(service_ids))
    )
    services = services_result.scalars().all()
    
    if len(services) != len(service_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more services not found"
        )
    
    # Удаляем существующие связи услуг с приемом
    await db.execute(
        delete(AppointmentService).where(AppointmentService.appointment_id == appointment_id)
    )
    
    # Добавляем новые связи услуг с приемом
    for service_id in service_ids:
        db.add(AppointmentService(
            appointment_id=appointment_id,
            service_id=service_id
        ))
    
    # Если статус приема "in_progress", меняем его на "completed"
    if appointment.status == AppointmentStatus.in_progress:
        appointment.status = AppointmentStatus.completed
        appointment.updated_at = datetime.now(timezone.utc)
        
        # Отправляем метрику об изменении статуса записи
        track_appointment(status=AppointmentStatus.completed.value)
    
    await db.commit()
    
    # Получаем обновленный прием со всеми связями
    appointment_result = await db.execute(
        select(Appointment)
        .options(
            joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Appointment.doctor).joinedload(Doctor.specialization),
            joinedload(Appointment.patient).joinedload(Patient.user),
            joinedload(Appointment.appointment_services).joinedload(AppointmentService.service)
        )
        .where(Appointment.id == appointment_id)
    )
    appointment = appointment_result.unique().scalar_one()
    
    # Формируем ответ
    doctor = appointment.doctor
    patient = appointment.patient
    
    # Получаем все услуги для этой записи
    appointment_services = appointment.appointment_services
    
    appointment_dict = appointment.__dict__.copy()
    
    return AppointmentWithDetails(
        **appointment_dict,
        doctor_name=doctor.user.full_name if doctor and doctor.user else None,
        patient_name=patient.user.full_name if patient and patient.user else None,
        doctor_specialty=doctor.specialization.name if doctor and doctor.specialization else None,
        service_name=None,  # Устаревшее поле, оставляем для обратной совместимости
        service_duration=doctor.specialization.appointment_duration if doctor and doctor.specialization else 30,
        services=[{
            "id": service.service.id,
            "name": service.service.name,
            "price": float(service.service.cost) if hasattr(service.service, 'cost') else 0.0
        } for service in appointment_services]
    )

@router.post("/{appointment_id}/complete", response_model=AppointmentWithDetails)
async def complete_appointment(
    appointment_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Завершить прием с указанием оказанных услуг"""
    # Получаем список ID услуг из запроса
    service_ids = data.get("service_ids", [])
    
    # Проверяем существование приема
    appointment_result = await db.execute(
        select(Appointment).where(Appointment.id == appointment_id)
    )
    appointment = appointment_result.scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found"
        )
    
    # Проверяем права доступа
    if current_user.role != UserRole.admin and current_user.role != UserRole.reception:
        # Для врачей проверяем, что это их прием
        if current_user.role == UserRole.doctor:
            doctor_result = await db.execute(
                select(Doctor).where(Doctor.user_id == current_user.id)
            )
            doctor = doctor_result.scalar_one_or_none()
            if not doctor or doctor.id != appointment.doctor_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only complete your own appointments"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to complete appointments"
            )
    
    # Проверяем существование услуг
    services_result = await db.execute(
        select(Service).where(Service.id.in_(service_ids))
    )
    services = services_result.scalars().all()
    
    if len(services) != len(service_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more services not found"
        )
    
    # Удаляем существующие связи услуг с приемом
    await db.execute(
        delete(AppointmentService).where(AppointmentService.appointment_id == appointment_id)
    )
    
    # Добавляем новые связи услуг с приемом
    for service_id in service_ids:
        db.add(AppointmentService(
            appointment_id=appointment_id,
            service_id=service_id
        ))
    
    # Меняем статус приема на "completed"
    appointment.status = AppointmentStatus.completed
    appointment.updated_at = datetime.now(timezone.utc)
    
    await db.commit()
    
    # Получаем обновленный прием со всеми связями
    appointment_result = await db.execute(
        select(Appointment)
        .options(
            joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Appointment.doctor).joinedload(Doctor.specialization),
            joinedload(Appointment.patient).joinedload(Patient.user),
            joinedload(Appointment.appointment_services).joinedload(AppointmentService.service)
        )
        .where(Appointment.id == appointment_id)
    )
    appointment = appointment_result.unique().scalar_one()
    
    # Формируем ответ
    doctor = appointment.doctor
    patient = appointment.patient
    
    # Получаем все услуги для этой записи
    appointment_services = appointment.appointment_services
    
    appointment_dict = appointment.__dict__.copy()
    
    return AppointmentWithDetails(
        **appointment_dict,
        doctor_name=doctor.user.full_name if doctor and doctor.user else None,
        patient_name=patient.user.full_name if patient and patient.user else None,
        doctor_specialty=doctor.specialization.name if doctor and doctor.specialization else None,
        service_name=None,  # Устаревшее поле, оставляем для обратной совместимости
        service_duration=doctor.specialization.appointment_duration if doctor and doctor.specialization else 30,
        services=[{
            "id": service.service.id,
            "name": service.service.name,
            "price": float(service.service.cost) if hasattr(service.service, 'cost') else 0.0
        } for service in appointment_services]
    )
