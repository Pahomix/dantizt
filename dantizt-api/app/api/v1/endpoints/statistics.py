from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_, extract, case
from sqlalchemy.orm import joinedload
from typing import List, Optional
from datetime import datetime, timedelta, time

from app.core.security import get_current_user
from app.db.session import get_db
from app.db.models import (
    User, Doctor, Patient, Appointment, Payment,
    UserRole, AppointmentStatus, TreatmentStatus, PaymentStatus,
    TreatmentPlan, MedicalRecord, RecordStatus, DoctorSchedule, SpecialDayType, DoctorSpecialDay, RecordType
)

router = APIRouter()

@router.get("/doctor/{doctor_id}")
async def get_doctor_statistics(
    doctor_id: int,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получить статистику врача
    """
    # Проверяем права доступа
    if not current_user.is_superuser:
        # Загружаем связь с доктором для текущего пользователя
        result = await db.execute(
            select(Doctor)
            .join(User)
            .where(User.id == current_user.id)
        )
        user_doctor = result.scalar_one_or_none()
        if not user_doctor or user_doctor.id != doctor_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
    
    # Проверяем существование врача
    result = await db.execute(select(Doctor).where(Doctor.id == doctor_id))
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )
    
    # Устанавливаем период по умолчанию (последний месяц)
    if not end_date:
        end_date = datetime.now()
    if not start_date:
        start_date = end_date - timedelta(days=30)
    
    # Получаем статистику по приемам
    appointments_query = select(
        func.count(Appointment.id).label('total_appointments'),
        func.count(case((Appointment.status == AppointmentStatus.completed, 1))).label('completed_appointments'),
        func.count(case((Appointment.status == AppointmentStatus.cancelled, 1))).label('cancelled_appointments')
    ).where(
        and_(
            Appointment.doctor_id == doctor_id,
            Appointment.start_time >= start_date,
            Appointment.start_time <= end_date
        )
    )
    appointments_result = await db.execute(appointments_query)
    appointments_stats = appointments_result.mappings().first()
    
    # Получаем статистику по оплатам
    payments_query = select(
        func.count(Payment.id).label('total_payments'),
        func.count(case((Payment.status == PaymentStatus.pending, 1))).label('pending_payments'),
        func.sum(Payment.amount).label('total_amount'),
        func.avg(Payment.amount).label('average_amount')
    ).join(
        Appointment,
        and_(
            Payment.appointment_id == Appointment.id,
            Payment.status == PaymentStatus.completed
        )
    ).where(
        and_(
            Appointment.doctor_id == doctor_id,
            Payment.created_at >= start_date,
            Payment.created_at <= end_date
        )
    )
    payments_result = await db.execute(payments_query)
    payments_stats = payments_result.mappings().first()
    
    # Получаем статистику по планам лечения
    treatment_plans_query = select(
        func.count(TreatmentPlan.id).label('total_plans'),
        func.count(case(
            (TreatmentPlan.status == TreatmentStatus.completed, 1)
        )).label('completed_plans')
    ).where(
        and_(
            TreatmentPlan.doctor_id == doctor_id,
            TreatmentPlan.start_date >= start_date,
            TreatmentPlan.start_date <= end_date
        )
    )
    treatment_plans_result = await db.execute(treatment_plans_query)
    treatment_plans_stats = treatment_plans_result.mappings().first()
    
    return {
        "period": {
            "start_date": start_date,
            "end_date": end_date
        },
        "appointments": {
            "total": appointments_stats.total_appointments or 0,
            "completed": appointments_stats.completed_appointments or 0,
            "cancelled": appointments_stats.cancelled_appointments or 0,
            "completion_rate": (
                appointments_stats.completed_appointments / appointments_stats.total_appointments * 100
                if appointments_stats.total_appointments
                else 0
            )
        },
        "payments": {
            "total_count": payments_stats.total_payments or 0,
            "pending_count": payments_stats.pending_payments or 0,
            "total_amount": payments_stats.total_amount or 0,
            "average_amount": payments_stats.average_amount or 0
        },
        "treatment_plans": {
            "total": treatment_plans_stats.total_plans or 0,
            "completed": treatment_plans_stats.completed_plans or 0,
            "completion_rate": (
                treatment_plans_stats.completed_plans / treatment_plans_stats.total_plans * 100
                if treatment_plans_stats.total_plans
                else 0
            )
        }
    }

@router.get("/patient/{patient_id}")
async def get_patient_statistics(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получить статистику пациента
    """
    # Проверяем существование пациента
    query = select(Patient).where(Patient.id == patient_id)
    result = await db.execute(query)
    patient = result.scalar_one_or_none()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )

    if not current_user.is_superuser:
        # Проверяем, является ли текущий пользователь этим пациентом
        query = select(Patient).join(User).where(
            and_(
                Patient.id == patient_id,
                User.id == current_user.id
            )
        )
        result = await db.execute(query)
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
    
    # Получаем статистику по приемам
    appointments_query = select(
        func.count(Appointment.id).label('total_appointments'),
        func.count(case((Appointment.status == AppointmentStatus.completed, 1))).label('completed_appointments'),
        func.count(case((Appointment.status == AppointmentStatus.cancelled, 1))).label('cancelled_appointments')
    ).where(Appointment.patient_id == patient_id)
    appointments_result = await db.execute(appointments_query)
    appointments_stats = appointments_result.mappings().first()
    
    # Получаем статистику по оплатам
    payments_query = select(
        func.count(Payment.id).label('total_payments'),
        func.count(case((Payment.status == PaymentStatus.pending, 1))).label('pending_payments'),
        func.sum(Payment.amount).label('total_amount'),
        func.avg(Payment.amount).label('average_amount')
    ).where(Payment.patient_id == patient_id)
    payments_result = await db.execute(payments_query)
    payments_stats = payments_result.mappings().first()
    
    # Получаем статистику по планам лечения
    treatments_query = select(
        func.count(TreatmentPlan.id).label('total_treatments'),
        func.count(case((TreatmentPlan.status == TreatmentStatus.completed, 1))).label('completed_treatments')
    ).where(TreatmentPlan.patient_id == patient_id)
    treatments_result = await db.execute(treatments_query)
    treatments_stats = treatments_result.mappings().first()
    
    # Получаем статистику по медицинским записям
    records_query = select(
        func.count(MedicalRecord.id).label('total_records'),
        func.count(case((MedicalRecord.status == RecordStatus.active, 1))).label('active_records')
    ).where(MedicalRecord.patient_id == patient_id)
    records_result = await db.execute(records_query)
    records_stats = records_result.mappings().first()
    
    return {
        "appointments": {
            "total": appointments_stats.total_appointments or 0,
            "completed": appointments_stats.completed_appointments or 0,
            "cancelled": appointments_stats.cancelled_appointments or 0,
            "completion_rate": (
                appointments_stats.completed_appointments / appointments_stats.total_appointments * 100
                if appointments_stats.total_appointments
                else 0
            )
        },
        "payments": {
            "total_count": payments_stats.total_payments or 0,
            "pending_count": payments_stats.pending_payments or 0,
            "total_amount": payments_stats.total_amount or 0,
            "average_amount": payments_stats.average_amount or 0
        },
        "treatments": {
            "total": treatments_stats.total_treatments or 0,
            "completed": treatments_stats.completed_treatments or 0,
            "completion_rate": (
                treatments_stats.completed_treatments / treatments_stats.total_treatments * 100
                if treatments_stats.total_treatments
                else 0
            )
        },
        "medical_records": {
            "total": records_stats.total_records or 0,
            "active": records_stats.active_records or 0
        }
    }

@router.get("/clinic")
async def get_clinic_statistics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получить общую статистику клиники (только для администраторов)
    """
    # Проверяем права доступа
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Получаем статистику по пользователям
    users_query = select(
        func.count(User.id).label('total_users'),
        func.count(case((User.role == UserRole.doctor, 1))).label('total_doctors'),
        func.count(case((User.role == UserRole.patient, 1))).label('total_patients')
    )
    users_result = await db.execute(users_query)
    users_stats = users_result.mappings().first()
    
    # Получаем статистику по приемам
    appointments_query = select(
        func.count(Appointment.id).label('total_appointments'),
        func.count(case((Appointment.status == AppointmentStatus.completed, 1))).label('completed_appointments'),
        func.count(case((Appointment.status == AppointmentStatus.cancelled, 1))).label('cancelled_appointments')
    )
    appointments_result = await db.execute(appointments_query)
    appointments_stats = appointments_result.mappings().first()
    
    # Получаем статистику по оплатам
    payments_query = select(
        func.count(Payment.id).label('total_payments'),
        func.count(case((Payment.status == PaymentStatus.pending, 1))).label('pending_payments'),
        func.sum(Payment.amount).label('total_amount'),
        func.avg(Payment.amount).label('average_amount')
    ).where(Payment.status == PaymentStatus.completed)
    payments_result = await db.execute(payments_query)
    payments_stats = payments_result.mappings().first()
    
    # Получаем статистику по планам лечения
    treatments_query = select(
        func.count(TreatmentPlan.id).label('total_treatments'),
        func.count(case((TreatmentPlan.status == TreatmentStatus.completed, 1))).label('completed_treatments')
    )
    treatments_result = await db.execute(treatments_query)
    treatments_stats = treatments_result.mappings().first()
    
    return {
        "users": {
            "total": users_stats.total_users or 0,
            "doctors": users_stats.total_doctors or 0,
            "patients": users_stats.total_patients or 0
        },
        "appointments": {
            "total": appointments_stats.total_appointments or 0,
            "completed": appointments_stats.completed_appointments or 0,
            "cancelled": appointments_stats.cancelled_appointments or 0,
            "completion_rate": (
                appointments_stats.completed_appointments / appointments_stats.total_appointments * 100
                if appointments_stats.total_appointments
                else 0
            )
        },
        "payments": {
            "total_count": payments_stats.total_payments or 0,
            "pending_count": payments_stats.pending_payments or 0,
            "total_amount": payments_stats.total_amount or 0,
            "average_amount": payments_stats.average_amount or 0
        },
        "treatments": {
            "total": treatments_stats.total_treatments or 0,
            "completed": treatments_stats.completed_treatments or 0,
            "completion_rate": (
                treatments_stats.completed_treatments / treatments_stats.total_treatments * 100
                if treatments_stats.total_treatments
                else 0
            )
        }
    }

@router.get("/reception/dashboard")
async def get_reception_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Получить статистику для дашборда регистратуры
    """
    # Проверяем права доступа
    if current_user.role not in [UserRole.admin, UserRole.reception]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Получаем текущую дату
    today = datetime.now().date()
    start_of_day = datetime.combine(today, time.min)
    end_of_day = datetime.combine(today, time.max)
    
    # Получаем количество записей на сегодня
    today_appointments_query = select(
        func.count(Appointment.id).label('total')
    ).where(
        and_(
            Appointment.start_time >= start_of_day,
            Appointment.start_time <= end_of_day,
            Appointment.status != AppointmentStatus.cancelled
        )
    )
    today_appointments_result = await db.execute(today_appointments_query)
    today_appointments = today_appointments_result.scalar() or 0
    
    # Получаем количество ожидающих оплаты
    pending_payments_query = select(
        func.count(Payment.id).label('total')
    ).where(
        Payment.status == PaymentStatus.pending
    )
    pending_payments_result = await db.execute(pending_payments_query)
    pending_payments = pending_payments_result.scalar() or 0
    
    # Получаем количество пациентов, ожидающих приема сегодня
    waiting_patients_query = select(
        func.count(Appointment.id).label('total')
    ).where(
        and_(
            Appointment.start_time >= start_of_day,
            Appointment.start_time <= end_of_day,
            Appointment.status == AppointmentStatus.scheduled
        )
    )
    waiting_patients_result = await db.execute(waiting_patients_query)
    waiting_patients = waiting_patients_result.scalar() or 0
    
    # Получаем количество медицинских документов, ожидающих выдачи
    documents_to_issue_query = select(
        func.count(MedicalRecord.id).label('total')
    ).where(
        and_(
            MedicalRecord.status == RecordStatus.active,
            MedicalRecord.record_type.in_([RecordType.prescription, RecordType.test_result])
        )
    )
    documents_to_issue_result = await db.execute(documents_to_issue_query)
    documents_to_issue = documents_to_issue_result.scalar() or 0
    
    # Получаем расписание врачей на сегодня
    doctors_schedule_query = select(
        Doctor,
        User,
        DoctorSchedule
    ).join(
        User, Doctor.user_id == User.id
    ).join(
        DoctorSchedule, 
        and_(
            Doctor.id == DoctorSchedule.doctor_id,
            DoctorSchedule.day_of_week == today.weekday(),
            DoctorSchedule.is_active == True
        )
    ).options(
        joinedload(Doctor.specialization)
    )
    
    doctors_schedule_result = await db.execute(doctors_schedule_query)
    doctors_schedule_data = doctors_schedule_result.unique().all()
    
    doctors_schedule = []
    for doctor, user, schedule in doctors_schedule_data:
        # Получаем количество записей на сегодня для этого врача
        doctor_appointments_query = select(
            func.count(Appointment.id).label('total')
        ).where(
            and_(
                Appointment.doctor_id == doctor.id,
                Appointment.start_time >= start_of_day,
                Appointment.start_time <= end_of_day,
                Appointment.status != AppointmentStatus.cancelled
            )
        )
        doctor_appointments_result = await db.execute(doctor_appointments_query)
        doctor_appointments_count = doctor_appointments_result.scalar() or 0
        
        # Получаем общее количество возможных слотов для этого врача
        appointment_duration = doctor.specialization.appointment_duration if doctor.specialization else 30
        total_minutes = (datetime.combine(today, schedule.end_time) - datetime.combine(today, schedule.start_time)).total_seconds() / 60
        total_slots = int(total_minutes / appointment_duration)
        
        # Проверяем, есть ли у врача особый день на сегодня
        special_day_query = select(DoctorSpecialDay).where(
            and_(
                DoctorSpecialDay.doctor_id == doctor.id,
                DoctorSpecialDay.date == today
            )
        )
        special_day_result = await db.execute(special_day_query)
        special_day = special_day_result.scalar_one_or_none()
        
        status = "Работает"
        if special_day:
            if special_day.type == SpecialDayType.vacation:
                status = "Отпуск"
            elif special_day.type == SpecialDayType.sick_leave:
                status = "Больничный"
            elif special_day.type == SpecialDayType.holiday:
                status = "Выходной"
        
        doctors_schedule.append({
            "id": doctor.id,
            "name": user.full_name,
            "specialty": doctor.specialization.name if doctor.specialization else "Не указана",
            "work_hours": f"{schedule.start_time.strftime('%H:%M')} - {schedule.end_time.strftime('%H:%M')}",
            "appointments": f"{doctor_appointments_count} из {total_slots}",
            "status": status
        })
    
    return {
        "todayAppointments": today_appointments,
        "pendingPayments": pending_payments,
        "waitingPatients": waiting_patients,
        "documentsToIssue": documents_to_issue,
        "doctorsSchedule": doctors_schedule
    }
