from datetime import datetime, date, time, timedelta, timezone
import json
import zoneinfo

from fastapi import APIRouter, HTTPException, Query, Depends, status
from sqlalchemy import select, and_, update, extract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload
from typing import List, Optional

from app.db.session import get_db
from app.core.security import get_current_user
from app.db.models import User, Doctor, DoctorSchedule, DoctorSpecialDay, Service, Appointment, AppointmentStatus, DoctorService, SpecialDayType
from app.schemas.schedule import (
    DoctorScheduleCreate,
    DoctorScheduleUpdate,
    DoctorScheduleInDB,
    DoctorSpecialDayCreate,
    DoctorSpecialDayUpdate,
    DoctorSpecialDayInDB,
    TimeSlotResponse,
    AvailableSlotsResponse,
    DoctorScheduleBulkUpdate
)

router = APIRouter()

@router.get("/doctors/{doctor_id}/schedules", response_model=List[DoctorScheduleInDB])
async def get_doctor_schedules(
    doctor_id: int,
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получить расписание врача"""
    query = select(DoctorSchedule).where(
        and_(
            DoctorSchedule.doctor_id == doctor_id,
            DoctorSchedule.is_active == True
        )
    )
    
    result = await db.execute(query)
    return result.scalars().all()

@router.put("/doctors/{doctor_id}/schedules", response_model=List[DoctorScheduleInDB])
async def update_doctor_schedules(
    doctor_id: int,
    schedules_update: DoctorScheduleBulkUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Массовое обновление расписания врача"""
    # Проверяем права доступа
    if not current_user.is_superuser and (not hasattr(current_user, 'doctor') or current_user.doctor.id != doctor_id):
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
    
    # Получаем все текущие расписания врача
    result = await db.execute(
        select(DoctorSchedule)
        .where(DoctorSchedule.doctor_id == doctor_id)
    )
    current_schedules = {schedule.day_of_week: schedule for schedule in result.scalars().all()}
    
    updated_schedules = []
    for schedule_update in schedules_update.schedules:
        if schedule_update.day_of_week is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="day_of_week is required for each schedule"
            )
        
        # Если расписание на этот день уже существует, обновляем его
        if schedule_update.day_of_week in current_schedules:
            db_schedule = current_schedules[schedule_update.day_of_week]
            for field, value in schedule_update.model_dump(exclude_unset=True).items():
                setattr(db_schedule, field, value)
            updated_schedules.append(db_schedule)
        else:
            # Если расписания нет, создаем новое
            db_schedule = DoctorSchedule(
                doctor_id=doctor_id,
                day_of_week=schedule_update.day_of_week,
                start_time=schedule_update.start_time,
                end_time=schedule_update.end_time,
                is_active=schedule_update.is_active if schedule_update.is_active is not None else True
            )
            db.add(db_schedule)
            updated_schedules.append(db_schedule)
    
    await db.commit()
    for schedule in updated_schedules:
        await db.refresh(schedule)
    
    return updated_schedules

@router.get("/doctors/{doctor_id}/special-days", response_model=List[DoctorSpecialDayInDB])
async def get_doctor_special_days(
    doctor_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получить особые дни врача"""
    # Проверяем существование врача
    result = await db.execute(select(Doctor).where(Doctor.id == doctor_id))
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )
    
    # Получаем особые дни
    result = await db.execute(
        select(DoctorSpecialDay)
        .where(DoctorSpecialDay.doctor_id == doctor_id)
        .order_by(DoctorSpecialDay.date)
    )
    return result.scalars().all()

@router.post("/doctors/{doctor_id}/special-days", response_model=DoctorSpecialDayInDB)
async def create_special_day(
    doctor_id: int,
    special_day: DoctorSpecialDayCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Создать особый день"""
    # Проверяем права доступа
    if not current_user.is_superuser and (not hasattr(current_user, 'doctor') or current_user.doctor.id != doctor_id):
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
    
    # Проверяем, нет ли уже особого дня на эту дату
    result = await db.execute(
        select(DoctorSpecialDay).where(
            and_(
                DoctorSpecialDay.doctor_id == doctor_id,
                DoctorSpecialDay.date == special_day.date
            )
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Special day for date {special_day.date} already exists"
        )
    
    # Создаем особый день
    db_special_day = DoctorSpecialDay(
        doctor_id=doctor_id,
        **special_day.model_dump()
    )
    db.add(db_special_day)
    await db.commit()
    await db.refresh(db_special_day)
    return db_special_day

@router.put("/doctors/{doctor_id}/special-days/{special_day_id}", response_model=DoctorSpecialDayInDB)
async def update_special_day(
    doctor_id: int,
    special_day_id: int,
    special_day: DoctorSpecialDayUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Обновить особый день"""
    # Проверяем права доступа
    if not current_user.is_superuser and (not hasattr(current_user, 'doctor') or current_user.doctor.id != doctor_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Проверяем существование особого дня
    result = await db.execute(
        select(DoctorSpecialDay).where(
            and_(
                DoctorSpecialDay.id == special_day_id,
                DoctorSpecialDay.doctor_id == doctor_id
            )
        )
    )
    db_special_day = result.scalar_one_or_none()
    if not db_special_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Special day not found"
        )
    
    # Если меняется дата, проверяем, нет ли уже особого дня на новую дату
    if special_day.date is not None and special_day.date != db_special_day.date:
        result = await db.execute(
            select(DoctorSpecialDay).where(
                and_(
                    DoctorSpecialDay.doctor_id == doctor_id,
                    DoctorSpecialDay.date == special_day.date,
                    DoctorSpecialDay.id != special_day_id
                )
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Special day for date {special_day.date} already exists"
            )
    
    # Обновляем особый день
    for field, value in special_day.model_dump(exclude_unset=True).items():
        setattr(db_special_day, field, value)
    
    await db.commit()
    await db.refresh(db_special_day)
    return db_special_day

@router.delete("/doctors/{doctor_id}/special-days/{special_day_id}")
async def delete_special_day(
    doctor_id: int,
    special_day_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Удалить особый день"""
    # Проверяем права доступа
    if not current_user.is_superuser and (not hasattr(current_user, 'doctor') or current_user.doctor.id != doctor_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Проверяем существование особого дня
    result = await db.execute(
        select(DoctorSpecialDay).where(
            and_(
                DoctorSpecialDay.id == special_day_id,
                DoctorSpecialDay.doctor_id == doctor_id
            )
        )
    )
    db_special_day = result.scalar_one_or_none()
    if not db_special_day:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Special day not found"
        )
    
    # Удаляем особый день
    await db.delete(db_special_day)
    await db.commit()
    return {"message": "Special day deleted successfully"}

@router.get("/doctors/{doctor_id}/availability", response_model=AvailableSlotsResponse)
async def get_doctor_availability(
    doctor_id: int,
    date: date = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получить доступные слоты врача на определенную дату"""
    # Получаем информацию о враче и его специализации
    result = await db.execute(
        select(Doctor).options(
            selectinload(Doctor.specialization)
        ).where(Doctor.id == doctor_id)
    )
    doctor = result.scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )
    
    # Определяем день недели для запрошенной даты (0 - понедельник, 6 - воскресенье)
    day_of_week = date.weekday()
    
    # Получаем расписание врача на этот день недели
    result = await db.execute(
        select(DoctorSchedule).where(
            and_(
                DoctorSchedule.doctor_id == doctor_id,
                DoctorSchedule.day_of_week == day_of_week,
                DoctorSchedule.is_active == True
            )
        )
    )
    db_schedule = result.scalar_one_or_none()
    if not db_schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No schedule found for doctor on day {day_of_week}"
        )
    
    # Проверяем, нет ли у врача особого дня на эту дату
    result = await db.execute(
        select(DoctorSpecialDay).where(
            and_(
                DoctorSpecialDay.doctor_id == doctor_id,
                DoctorSpecialDay.date == date
            )
        )
    )
    special_day = result.scalar_one_or_none()
    
    # Если это выходной, отпуск или больничный, возвращаем пустой список слотов
    if special_day and special_day.type in [SpecialDayType.holiday, SpecialDayType.vacation, SpecialDayType.sick_leave]:
        current_datetime = datetime.now(timezone.utc)
        return AvailableSlotsResponse(
            date=date,
            slots=[],
            created_at=current_datetime,
            updated_at=current_datetime
        )
    
    # Если это рабочий особый день, используем его расписание
    if special_day and special_day.type == SpecialDayType.working_day:
        if special_day.start_time and special_day.end_time:
            db_schedule.start_time = special_day.start_time
            db_schedule.end_time = special_day.end_time

    # Используем длительность слота из специализации врача
    appointment_duration = doctor.specialization.appointment_duration if doctor.specialization else 30
    slot_duration = timedelta(minutes=appointment_duration)
    
    # Генерируем слоты
    slots = []
    tz = zoneinfo.ZoneInfo("Europe/Moscow")
    current_time = datetime.combine(date, db_schedule.start_time).replace(tzinfo=tz)
    end_time = datetime.combine(date, db_schedule.end_time).replace(tzinfo=tz)
    
    # Получаем существующие приемы на этот день
    result = await db.execute(
        select(Appointment.id, Appointment.start_time, Appointment.end_time).where(
            Appointment.doctor_id == doctor_id,
            Appointment.start_time >= datetime.combine(date, time.min).replace(tzinfo=tz),
            Appointment.end_time <= datetime.combine(date, time.max).replace(tzinfo=tz),
            Appointment.status != AppointmentStatus.cancelled
        )
    )
    appointments = result.all()

    while current_time + slot_duration <= end_time:
        # Проверяем, не пересекается ли слот с существующими приемами
        is_occupied = False
        for appointment in appointments:
            appointment_start = appointment[1]  # start_time
            appointment_end = appointment[2]    # end_time
            
            if (current_time >= appointment_start and current_time < appointment_end) or \
               (current_time + slot_duration > appointment_start and current_time + slot_duration <= appointment_end) or \
               (current_time <= appointment_start and current_time + slot_duration >= appointment_end):
                is_occupied = True
                break

        if not is_occupied:
            slots.append(
                TimeSlotResponse(
                    start_time=current_time.time().isoformat(),
                    end_time=(current_time + slot_duration).time().isoformat(),
                    is_available=True
                )
            )

        current_time += slot_duration  # Убираем перерыв между слотами

    current_datetime = datetime.now(timezone.utc)
    return AvailableSlotsResponse(
        date=date,
        slots=slots,
        created_at=current_datetime,
        updated_at=current_datetime
    )