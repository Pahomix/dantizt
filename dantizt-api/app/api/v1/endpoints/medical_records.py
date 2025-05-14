from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete, and_, text
from typing import List, Optional
import json
from datetime import datetime
from app.core.security import get_current_user
from app.db.session import get_db
from app.db.models import (
    User, Doctor, Patient, MedicalRecord, Appointment,
    UserRole, RecordType, validate_tooth_positions, TreatmentPlan,
    Service, AppointmentService, Payment
)
from app.schemas.medical_record import (
    MedicalRecordCreate,
    MedicalRecordUpdate,
    MedicalRecordInDB,
    PatientAppointmentWithRecords
)
from fastapi.responses import StreamingResponse, JSONResponse
from app.utils.pdf_generator import generate_tax_deduction_certificate
from app.utils.email import send_tax_deduction_certificate
import logging
from sqlalchemy.orm import joinedload
from urllib.parse import quote
import io

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("", response_model=MedicalRecordInDB)
async def create_medical_record(
    record: MedicalRecordCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Создать новую медицинскую запись (только для врачей)"""
    logger.debug(f"Creating medical record: {record}")
    
    if current_user.role != UserRole.doctor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can create medical records"
        )
    
    # Проверяем, что врач создает запись для своего пациента
    doctor_result = await db.execute(
        select(Doctor).where(Doctor.user_id == current_user.id)
    )
    doctor = doctor_result.scalar_one_or_none()
    if not doctor or doctor.id != record.doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create records as yourself"
        )
    
    # Проверяем существование пациента
    patient_result = await db.execute(
        select(Patient).where(Patient.id == record.patient_id)
    )
    if not patient_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Проверяем корректность позиций зубов
    if record.tooth_positions and not validate_tooth_positions(
        [pos.dict() for pos in record.tooth_positions]
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid tooth positions"
        )
    
    # Подготавливаем данные для записи
    record_data = record.dict()
    tooth_data = None
    if record.tooth_positions:
        tooth_data = [pos.dict() for pos in record.tooth_positions]
    record_data['tooth_data'] = tooth_data
    record_data['date'] = datetime.now().date()  # Добавляем текущую дату
    del record_data['tooth_positions']
    
    # Проверяем наличие treatment_plan_id
    if record_data.get('treatment_plan_id'):
        treatment_plan = await db.execute(
            select(TreatmentPlan).where(TreatmentPlan.id == record_data['treatment_plan_id'])
        )
        treatment_plan = treatment_plan.scalar_one_or_none()
        if not treatment_plan:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Treatment plan not found"
            )
    
    # Создаем запись
    db_record = MedicalRecord(**record_data)
    db.add(db_record)
    await db.commit()
    await db.refresh(db_record)
    
    return db_record

@router.get("/patient/{patient_id}", response_model=List[MedicalRecordInDB])
async def get_patient_medical_records(
    patient_id: int,
    record_type: Optional[RecordType] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить медицинские записи пациента с возможностью фильтрации"""
    # Проверяем права доступа
    if current_user.role == UserRole.patient:
        # Если обычный пользователь, проверяем что это его записи
        patient_result = await db.execute(
            select(Patient).where(
                and_(
                    Patient.id == patient_id,
                    Patient.user_id == current_user.id
                )
            )
        )
        if not patient_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own medical records"
            )
    elif current_user.role == UserRole.doctor:
        # Если врач, проверяем что это его пациент
        doctor_result = await db.execute(
            select(Doctor).where(Doctor.user_id == current_user.id)
        )
        doctor = doctor_result.scalar_one_or_none()
        if not doctor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Doctor profile not found"
            )
    
    # Формируем запрос
    query = select(MedicalRecord).where(MedicalRecord.patient_id == patient_id)
    
    # Добавляем фильтры
    if record_type:
        query = query.where(MedicalRecord.record_type == record_type)
    if from_date:
        query = query.where(MedicalRecord.created_at >= from_date)
    if to_date:
        query = query.where(MedicalRecord.created_at <= to_date)
    
    # Сортируем по дате создания (сначала новые)
    query = query.order_by(MedicalRecord.created_at.desc())
    
    # Получаем записи
    result = await db.execute(query)
    records = result.scalars().all()
    
    return records

@router.get("/{record_id}", response_model=MedicalRecordInDB)
async def get_medical_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить конкретную медицинскую запись"""
    # Получаем запись
    result = await db.execute(
        select(MedicalRecord).where(MedicalRecord.id == record_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medical record not found"
        )
    
    # Проверяем права доступа
    if current_user.role == UserRole.patient:
        patient_result = await db.execute(
            select(Patient).where(
                and_(
                    Patient.id == record.patient_id,
                    Patient.user_id == current_user.id
                )
            )
        )
        if not patient_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own medical records"
            )
    elif current_user.role == UserRole.doctor:
        doctor_result = await db.execute(
            select(Doctor).where(Doctor.user_id == current_user.id)
        )
        doctor = doctor_result.scalar_one_or_none()
        if not doctor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Doctor profile not found"
            )
    
    return record

@router.put("/{record_id}", response_model=MedicalRecordInDB)
async def update_medical_record(
    record_id: int,
    record_update: MedicalRecordUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить медицинскую запись (только для врачей)"""
    if current_user.role != UserRole.doctor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can update medical records"
        )
    
    # Получаем запись
    result = await db.execute(
        select(MedicalRecord).where(MedicalRecord.id == record_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medical record not found"
        )
    
    # Проверяем, что это запись этого врача
    doctor_result = await db.execute(
        select(Doctor).where(Doctor.user_id == current_user.id)
    )
    doctor = doctor_result.scalar_one_or_none()
    if not doctor or doctor.id != record.doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own medical records"
        )
    
    # Проверяем корректность позиций зубов
    if record_update.tooth_positions and not validate_tooth_positions(
        [pos.dict() for pos in record_update.tooth_positions]
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid tooth positions"
        )
    
    # Если это диагноз и обновляется код диагноза, проверяем его наличие
    if (
        record.record_type == RecordType.diagnosis
        and record_update.diagnosis_code is not None
        and not record_update.diagnosis_code
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Diagnosis code is required for diagnosis records"
        )
    
    # Обновляем запись
    update_data = record_update.dict(exclude_unset=True)
    if update_data:
        await db.execute(
            update(MedicalRecord)
            .where(MedicalRecord.id == record_id)
            .values(**update_data)
        )
        await db.commit()
    
    # Получаем обновленную запись
    result = await db.execute(
        select(MedicalRecord).where(MedicalRecord.id == record_id)
    )
    updated_record = result.scalar_one()
    
    return updated_record

@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_medical_record(
    record_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Удалить медицинскую запись (только для врачей)"""
    if current_user.role != UserRole.doctor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can delete medical records"
        )
    
    # Получаем запись
    result = await db.execute(
        select(MedicalRecord).where(MedicalRecord.id == record_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medical record not found"
        )
    
    # Проверяем, что это запись этого врача
    doctor_result = await db.execute(
        select(Doctor).where(Doctor.user_id == current_user.id)
    )
    doctor = doctor_result.scalar_one_or_none()
    if not doctor or doctor.id != record.doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own medical records"
        )
    
    # Удаляем запись
    await db.execute(
        delete(MedicalRecord).where(MedicalRecord.id == record_id)
    )
    await db.commit()

@router.post("/{record_id}/attachments", status_code=status.HTTP_204_NO_CONTENT)
async def add_attachment(
    record_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Добавить прикрепленный файл к медицинской записи (только для врачей)"""
    if current_user.role != UserRole.doctor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can add attachments"
        )
    
    # Получаем запись
    result = await db.execute(
        select(MedicalRecord).where(MedicalRecord.id == record_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medical record not found"
        )
    
    # Проверяем, что это запись этого врача
    doctor_result = await db.execute(
        select(Doctor).where(Doctor.user_id == current_user.id)
    )
    doctor = doctor_result.scalar_one_or_none()
    if not doctor or doctor.id != record.doctor_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only add attachments to your own medical records"
        )
    
    # TODO: Сохранить файл и добавить ссылку на него в attachments
    # Это нужно реализовать после того, как будет готово хранилище файлов

@router.get("/patient/{patient_id}/appointments", response_model=List[PatientAppointmentWithRecords])
async def get_patient_appointments_with_records(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить приемы пациента с их медицинскими записями"""
    # Проверяем права доступа
    if current_user.role == UserRole.patient:
        # Если обычный пользователь, проверяем что это его записи
        patient_result = await db.execute(
            select(Patient).where(
                and_(
                    Patient.id == patient_id,
                    Patient.user_id == current_user.id
                )
            )
        )
        if not patient_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own medical records"
            )
    elif current_user.role == UserRole.doctor:
        # Если врач, проверяем что это его пациент
        doctor_result = await db.execute(
            select(Doctor).where(Doctor.user_id == current_user.id)
        )
        doctor = doctor_result.scalar_one_or_none()
        if not doctor:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Doctor profile not found"
            )

    # Получаем приемы пациента с их записями
    query = (
        select(Appointment)
        .where(Appointment.patient_id == patient_id)
        .options(
            joinedload(Appointment.patient).joinedload(Patient.user),
            joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Appointment.doctor).joinedload(Doctor.specialization),
            joinedload(Appointment.appointment_services).joinedload(AppointmentService.service),
            joinedload(Appointment.medical_records)
            .joinedload(MedicalRecord.doctor)
            .joinedload(Doctor.user)
        )
        .order_by(Appointment.start_time.desc())
    )
    
    result = await db.execute(query)
    appointments = result.unique().scalars().all()
    
    # Преобразуем результаты в список объектов PatientAppointmentWithRecords
    appointments_with_records = []
    for appointment in appointments:
        doctor = appointment.doctor
        patient = appointment.patient
        
        # Получаем услуги для этой записи
        service_data = None
        if hasattr(appointment, 'appointment_services') and appointment.appointment_services:
            # Берем первую услугу для совместимости с фронтендом
            first_service = next((s.service for s in appointment.appointment_services if s.service), None)
            if first_service:
                service_data = {
                    "id": first_service.id,
                    "name": first_service.name,
                    "cost": float(first_service.cost) if hasattr(first_service, 'cost') else 0.0
                }
        
        # Если услуг нет, создаем пустую услугу
        if not service_data:
            service_data = {
                "id": 0,
                "name": "Не указана",
                "cost": 0.0
            }
        
        # Преобразуем медицинские записи в формат, который ожидает модель
        medical_records = []
        if appointment.medical_records:
            for record in appointment.medical_records:
                # Преобразуем tooth_data в tooth_positions, если они есть
                tooth_positions = []
                if record.tooth_data:
                    try:
                        tooth_data = record.tooth_data
                        if isinstance(tooth_data, str):
                            tooth_data = json.loads(tooth_data)
                        tooth_positions = [
                            {"quadrant": tooth["quadrant"], "number": tooth["number"]}
                            for tooth in tooth_data
                        ]
                    except Exception as e:
                        logger.error(f"Error parsing tooth_data: {e}")
                
                # Создаем словарь с данными записи
                record_dict = {
                    "id": record.id,
                    "record_type": record.record_type,
                    "title": record.title,
                    "content": record.content,
                    "status": record.status,
                    "tooth_positions": tooth_positions,
                    "attachments": record.attachments,
                    "patient_id": record.patient_id,
                    "doctor_id": record.doctor_id,
                    "appointment_id": record.appointment_id,
                    "treatment_plan_id": record.treatment_plan_id,
                    "created_at": record.created_at,
                    "updated_at": record.updated_at
                }
                medical_records.append(record_dict)
        
        # Создаем объект с данными записи на прием
        appointment_dict = {
            "id": appointment.id,
            "start_time": appointment.start_time,
            "end_time": appointment.end_time,
            "status": appointment.status,
            "notes": appointment.notes,
            "doctor": {
                "id": doctor.id,
                "user": {
                    "id": doctor.user.id,
                    "full_name": doctor.user.full_name,
                    "email": doctor.user.email
                }
            },
            "service": service_data,
            "medical_records": medical_records
        }
        
        appointments_with_records.append(appointment_dict)
    
    return appointments_with_records

@router.get("/patient/{patient_id}/tax-deduction", response_class=StreamingResponse)
async def generate_tax_deduction_pdf(
    patient_id: int,
    year: int = Query(..., description="Год для которого нужно сформировать справку"),
    send_email: bool = Query(False, description="Отправить справку на email пациента"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Сгенерировать справку для налогового вычета в формате PDF"""
    logger.debug(f"Generating tax deduction certificate for patient {patient_id} for year {year}")
    
    # Проверяем, что пользователь имеет роль регистратора
    if current_user.role != UserRole.reception:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only reception staff can generate tax deduction certificates"
        )
    
    # Проверяем, что patient_id и year являются положительными целыми числами
    if not isinstance(patient_id, int) or patient_id <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Patient ID must be a positive integer"
        )
    if not isinstance(year, int) or year < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Year must be a positive integer"
        )
    
    # Получаем данные пациента
    patient_result = await db.execute(
        select(Patient).options(joinedload(Patient.user)).where(Patient.id == patient_id)
    )
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Получаем все оплаченные приемы пациента за указанный год
    start_date = datetime(year, 1, 1)
    end_date = datetime(year, 12, 31, 23, 59, 59)
    
    # Получаем все платежи пациента за указанный год
    payments_result = await db.execute(
        select(Payment)
        .where(
            and_(
                Payment.patient_id == patient_id,
                Payment.created_at >= start_date,
                Payment.created_at <= end_date,
                Payment.status == 'completed'
            )
        )
        .order_by(Payment.created_at)
    )
    payments = payments_result.scalars().all()
    
    if not payments:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No payments found for the specified year"
        )
    
    # Получаем все приемы, связанные с этими платежами
    appointment_ids = [payment.appointment_id for payment in payments if payment.appointment_id]
    
    if not appointment_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No appointments found for the payments"
        )
    
    appointments_result = await db.execute(
        select(Appointment)
        .where(Appointment.id.in_(appointment_ids))
        .options(
            joinedload(Appointment.doctor).joinedload(Doctor.user),
            joinedload(Appointment.service)
        )
    )
    appointments = appointments_result.scalars().all()
    
    # Получаем все услуги для этих приемов
    services_data = []
    total_amount = 0.0
    
    for appointment in appointments:
        # Получаем услуги для этого приема
        services_result = await db.execute(
            select(Service)
            .join(AppointmentService, Service.id == AppointmentService.service_id)
            .where(AppointmentService.appointment_id == appointment.id)
        )
        services = services_result.scalars().all()
        
        for service in services:
            service_date = appointment.start_time.strftime("%d.%m.%Y")
            service_cost = float(service.cost) if service.cost else 0.0
            total_amount += service_cost
            
            services_data.append({
                "name": service.name,
                "cost": service_cost,
                "date": service_date
            })
    
    # Данные клиники (в реальном приложении эти данные должны быть в базе или конфиге)
    clinic_name = "ООО 'ДантиЗТ'"
    clinic_inn = "7701234567"
    clinic_address = "г. Москва, ул. Примерная, д. 1"
    
    # Генерируем номер справки
    certificate_number = f"{year}-{patient_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    # Дата последнего платежа
    last_payment_date = max(payments, key=lambda x: x.created_at).created_at.strftime("%d.%m.%Y")
    
    # Данные сотрудника регистратуры
    staff_name = current_user.full_name
    staff_phone = current_user.phone_number or "______________"
    
    # Генерируем PDF
    pdf_content = generate_tax_deduction_certificate(
        patient_name=patient.user.full_name,
        patient_inn=patient.inn or "ИНН не указан",  # Используем ИНН пациента, если он указан
        clinic_name=clinic_name,
        clinic_inn=clinic_inn,
        clinic_address=clinic_address,
        services=services_data,
        total_amount=total_amount,
        payment_date=last_payment_date,
        certificate_number=certificate_number,
        staff_name=staff_name,
        staff_phone=staff_phone
    )
    
    # Если нужно отправить на email
    if send_email and patient.user.email:
        await send_tax_deduction_certificate(
            email=patient.user.email,
            full_name=patient.user.full_name,
            year=year,
            pdf_content=pdf_content
        )
    
    # Формируем имя файла с ФИО пациента
    filename = f"Справка для налогового вычета {patient.user.full_name}.pdf"
    # Кодируем имя файла для корректного отображения в заголовке
    encoded_filename = quote(filename)
    
    # Используем транслитерацию для имени файла в обычном параметре filename
    # Это нужно, т.к. заголовки HTTP должны быть в ASCII
    translit_filename = f"Tax_Deduction_{year}_{patient_id}.pdf"
    
    # Возвращаем PDF как поток
    return StreamingResponse(
        io.BytesIO(pdf_content),
        media_type="application/pdf",
        headers={
            # Используем ASCII-имя для filename и UTF-8 для filename*
            "Content-Disposition": f'attachment; filename="{translit_filename}"; filename*=UTF-8\'\'{encoded_filename}'
        }
    )
