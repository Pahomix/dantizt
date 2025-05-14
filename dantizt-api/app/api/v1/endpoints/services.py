from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete
from typing import List, Optional

from app.core.security import get_current_user
from app.db.session import get_db
from app.db.models import User, Service, UserRole, Doctor, DoctorService
from app.schemas.service import (
    ServiceCreate,
    ServiceUpdate,
    ServiceInDB
)

router = APIRouter()

@router.get("", response_model=List[ServiceInDB])
async def get_services(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Получить список всех услуг"""
    result = await db.execute(
        select(Service)
        .offset(skip)
        .limit(limit)
    )
    services = result.scalars().all()
    return services

@router.get("/{service_id}", response_model=ServiceInDB)
async def get_service(
    service_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Получить информацию о конкретной услуге"""
    result = await db.execute(
        select(Service).where(Service.id == service_id)
    )
    service = result.scalar_one_or_none()
    
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    return service

@router.post("", response_model=ServiceInDB)
async def create_service(
    service: ServiceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Создать новую услугу (только для администраторов)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create services"
        )
    
    # Проверяем уникальность названия
    result = await db.execute(
        select(Service).where(Service.name == service.name)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Service with this name already exists"
        )
    
    db_service = Service(**service.dict())
    db.add(db_service)
    await db.commit()
    await db.refresh(db_service)
    
    return db_service

@router.put("/{service_id}", response_model=ServiceInDB)
async def update_service(
    service_id: int,
    service_update: ServiceUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить информацию об услуге (только для администраторов)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update services"
        )
    
    # Проверяем существование услуги
    service_result = await db.execute(
        select(Service).where(Service.id == service_id)
    )
    service = service_result.scalar_one_or_none()
    
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    # Проверяем уникальность названия
    if service_update.name != service.name:
        name_result = await db.execute(
            select(Service).where(Service.name == service_update.name)
        )
        if name_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Service with this name already exists"
            )
    
    # Обновляем услугу
    await db.execute(
        update(Service)
        .where(Service.id == service_id)
        .values(**service_update.dict())
    )
    
    await db.commit()
    
    # Получаем обновленную услугу
    result = await db.execute(
        select(Service).where(Service.id == service_id)
    )
    updated_service = result.scalar_one()
    return updated_service

@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Удалить услугу (только для администраторов)"""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete services"
        )
    
    # Проверяем существование услуги
    result = await db.execute(
        select(Service).where(Service.id == service_id)
    )
    service = result.scalar_one_or_none()
    
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service not found"
        )
    
    # Удаляем услугу
    await db.execute(
        delete(Service).where(Service.id == service_id)
    )
    
    await db.commit()

@router.get("/specialty/{specialty_id}", response_model=List[ServiceInDB])
async def get_services_by_specialty(
    specialty_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Получить список услуг для конкретной специализации врача"""
    # Получаем всех врачей с данной специализацией
    doctors_result = await db.execute(
        select(Doctor).where(Doctor.specialization_id == specialty_id)
    )
    doctors = doctors_result.scalars().all()
    
    if not doctors:
        return []
    
    # Получаем все услуги для этих врачей через таблицу doctor_services
    doctor_ids = [doctor.id for doctor in doctors]
    
    # Используем JOIN для получения услуг, связанных с врачами данной специализации
    result = await db.execute(
        select(Service)
        .join(DoctorService, Service.id == DoctorService.service_id)
        .where(DoctorService.doctor_id.in_(doctor_ids))
        .distinct()
    )
    
    services = result.scalars().all()
    return services

@router.get("/doctor/{doctor_id}", response_model=List[ServiceInDB])
async def get_services_by_doctor(
    doctor_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Получить список услуг для конкретного врача"""
    # Сначала получаем информацию о враче
    doctor_result = await db.execute(
        select(Doctor).where(Doctor.id == doctor_id)
    )
    doctor = doctor_result.scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )
    
    # Получаем услуги, связанные с данным врачом через таблицу doctor_services
    result = await db.execute(
        select(Service)
        .join(DoctorService, Service.id == DoctorService.service_id)
        .where(DoctorService.doctor_id == doctor_id)
    )
    
    services = result.scalars().all()
    return services
