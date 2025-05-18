from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.db.models import User, Specialization, UserRole
from app.schemas.specialization import SpecializationCreate, SpecializationUpdate, SpecializationInDB

router = APIRouter()

@router.get("/", response_model=List[SpecializationInDB])
async def get_specializations(
    db: AsyncSession = Depends(get_db)
):
    """Получить список всех специализаций"""
    result = await db.execute(select(Specialization))
    return result.scalars().all()

@router.post("/", response_model=SpecializationInDB)
async def create_specialization(
    specialization: SpecializationCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Создать новую специализацию (только для администраторов)"""
    # Проверяем роль пользователя
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create specializations"
        )
    
    db_specialization = Specialization(**specialization.model_dump())
    db.add(db_specialization)
    await db.commit()
    await db.refresh(db_specialization)
    return db_specialization

@router.get("/{specialization_id}", response_model=SpecializationInDB)
async def get_specialization(
    specialization_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Получить информацию о конкретной специализации"""
    result = await db.execute(
        select(Specialization).where(Specialization.id == specialization_id)
    )
    specialization = result.scalar_one_or_none()
    
    if not specialization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specialization not found"
        )
    
    return specialization

@router.put("/{specialization_id}", response_model=SpecializationInDB)
async def update_specialization(
    specialization_id: int,
    specialization_update: SpecializationUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить информацию о специализации (только для администраторов)"""
    # Проверяем роль пользователя
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update specializations"
        )
    
    result = await db.execute(
        select(Specialization).where(Specialization.id == specialization_id)
    )
    db_specialization = result.scalar_one_or_none()
    
    if not db_specialization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specialization not found"
        )
    
    for field, value in specialization_update.model_dump(exclude_unset=True).items():
        setattr(db_specialization, field, value)
    
    await db.commit()
    await db.refresh(db_specialization)
    return db_specialization

@router.delete("/{specialization_id}")
async def delete_specialization(
    specialization_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Удалить специализацию (только для администраторов)"""
    # Проверяем роль пользователя
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete specializations"
        )
    
    # Проверяем существование специализации
    result = await db.execute(
        select(Specialization).where(Specialization.id == specialization_id)
    )
    specialization = result.scalar_one_or_none()
    
    if not specialization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specialization not found"
        )
    
    # Находим всех врачей с этой специализацией и устанавливаем specialization_id в NULL
    # Это сработает благодаря изменению модели Doctor и установке ondelete="SET NULL"
    # в ForeignKey для specialization_id
    
    # Удаляем специализацию
    await db.delete(specialization)
    await db.commit()
    
    return {"message": "Specialization deleted successfully"}
