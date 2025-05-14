from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.db.models import User, Specialization
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Создать новую специализацию (только для администраторов)"""
    if not current_user.is_superuser:
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить информацию о специализации (только для администраторов)"""
    if not current_user.is_superuser:
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Удалить специализацию (только для администраторов)"""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete specializations"
        )
    
    result = await db.execute(
        select(Specialization).where(Specialization.id == specialization_id)
    )
    specialization = result.scalar_one_or_none()
    
    if not specialization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specialization not found"
        )
    
    await db.delete(specialization)
    await db.commit()
    return {"message": "Specialization deleted successfully"}
