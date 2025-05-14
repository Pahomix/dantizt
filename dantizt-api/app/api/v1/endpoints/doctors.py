from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete, text
from sqlalchemy.orm import joinedload
from typing import List, Optional
from sqlalchemy import and_, or_
from app.core.security import get_current_user, get_password_hash
from app.db.session import get_db
from app.db.models import User, Doctor, UserRole, Specialization
from app.schemas.doctor import (
    DoctorCreate,
    DoctorUpdate,
    DoctorWithUser,
    DoctorProfileUpdate
)

router = APIRouter()

@router.get("/me", response_model=DoctorWithUser)
async def get_my_doctor_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить профиль текущего врача"""
    if current_user.role != UserRole.doctor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can access this endpoint"
        )
    
    result = await db.execute(
        select(Doctor)
        .options(joinedload(Doctor.specialization))
        .where(Doctor.user_id == current_user.id)
    )
    doctor = result.unique().scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found"
        )
    
    return DoctorWithUser.from_orm(doctor)

@router.put("/me", response_model=DoctorWithUser)
async def update_my_doctor_profile(
    profile_update: DoctorProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить профиль текущего врача"""
    if current_user.role != UserRole.doctor:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only doctors can update their profile"
        )
    
    # Обновляем данные пользователя
    user_update = {
        "email": profile_update.email,
        "full_name": profile_update.full_name,
        "phone_number": profile_update.phone_number
    }
    
    await db.execute(
        update(User)
        .where(User.id == current_user.id)
        .values(**user_update)
    )
    
    # Получаем или создаем профиль врача
    result = await db.execute(
        select(Doctor)
        .options(joinedload(Doctor.specialization))
        .where(Doctor.user_id == current_user.id)
    )
    doctor = result.unique().scalar_one_or_none()
    
    # Обновляем данные врача
    doctor_data = {
        "specialization_id": profile_update.specialization_id,
        "experience_years": profile_update.experience_years,
        "education": profile_update.education,
        "bio": profile_update.bio
    }
    
    if doctor:
        # Обновляем существующий профиль
        await db.execute(
            update(Doctor)
            .where(Doctor.id == doctor.id)
            .values(**doctor_data)
        )
    else:
        # Создаем новый профиль
        doctor = Doctor(user_id=current_user.id, **doctor_data)
        db.add(doctor)
    
    await db.commit()
    
    # Получаем обновленные данные со всеми связями
    result = await db.execute(
        select(Doctor)
        .options(
            joinedload(Doctor.specialization),
            joinedload(Doctor.user)
        )
        .where(Doctor.user_id == current_user.id)
    )
    doctor = result.unique().scalar_one_or_none()
    
    return DoctorWithUser.from_orm(doctor)

# Эндпоинты для администраторов

@router.get("", response_model=List[DoctorWithUser])
async def get_doctors(
    skip: int = 0,
    limit: int = 100,
    specialization_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить список всех врачей"""
    if current_user.role not in [UserRole.admin, UserRole.reception, UserRole.patient]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators, receptionists and patients can view all doctors"
        )

    # Базовый запрос
    query = (
        select(Doctor)
        .join(User)  # Явно присоединяем User
        .options(
            joinedload(Doctor.user),
            joinedload(Doctor.specialization)
        )
    )

    # Добавляем фильтры
    conditions = []
    if specialization_id:
        conditions.append(Doctor.specialization_id == specialization_id)
    if is_active is not None:
        conditions.append(User.is_active == is_active)

    if conditions:
        query = query.where(and_(*conditions))

    # Добавляем пагинацию
    query = query.offset(skip).limit(limit)

    # Выполняем запрос
    result = await db.execute(query)
    doctors = result.scalars().unique().all()

    return doctors

@router.get("/{doctor_id}", response_model=DoctorWithUser)
async def get_doctor(
    doctor_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить информацию о конкретном враче"""
    # Разрешаем доступ администраторам, регистратуре и пациентам
    if current_user.role not in [UserRole.admin, UserRole.reception, UserRole.patient]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this endpoint"
        )
    
    result = await db.execute(
        select(Doctor)
        .options(
            joinedload(Doctor.user),
            joinedload(Doctor.specialization)
        )
        .where(Doctor.id == doctor_id)
    )
    doctor = result.unique().scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )
    
    return doctor

@router.post("", response_model=DoctorWithUser)
async def create_doctor(
    doctor_data: DoctorUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Создать нового врача (только для администраторов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create doctors"
        )

    try:
        print(f"Creating doctor with email: {doctor_data.email}")
        
        # Проверяем существование пользователя по email
        result = await db.execute(
            select(User)
            .where(User.email == doctor_data.email)
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            print(f"Found existing user with id: {existing_user.id}")
            
            # Проверяем, является ли пользователь уже врачом с такой специализацией
            result = await db.execute(
                select(Doctor)
                .where(
                    and_(
                        Doctor.user_id == existing_user.id,
                        Doctor.specialization_id == doctor_data.specialization_id
                    )
                )
            )
            existing_doctor = result.scalar_one_or_none()
            
            if existing_doctor:
                print(f"User is already a doctor with id: {existing_doctor.id} and specialization_id: {existing_doctor.specialization_id}")
                result = await db.execute(
                    select(Specialization)
                    .where(Specialization.id == existing_doctor.specialization_id)
                )
                specialization = result.scalar_one()
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Пользователь {doctor_data.email} уже является врачом со специализацией '{specialization.name}'"
                )
            
            print("Updating existing user")
            # Обновляем существующего пользователя
            existing_user.full_name = doctor_data.full_name
            existing_user.phone_number = doctor_data.phone_number
            existing_user.is_active = doctor_data.is_active
            if doctor_data.password:
                existing_user.hashed_password = get_password_hash(doctor_data.password)
            
            # Если пользователь еще не врач, меняем его роль
            if existing_user.role != UserRole.doctor:
                existing_user.role = UserRole.doctor
            
            await db.flush()
            user = existing_user
        else:
            print("Creating new user")
            # Проверяем наличие пароля для нового пользователя
            if not doctor_data.password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Password is required for new user"
                )
            
            # Создаем нового пользователя
            user = User(
                email=doctor_data.email,
                full_name=doctor_data.full_name,
                phone_number=doctor_data.phone_number,
                role=UserRole.doctor,  # Триггер создаст запись в таблице doctors
                is_active=doctor_data.is_active,
                hashed_password=get_password_hash(doctor_data.password)
            )
            db.add(user)
            await db.flush()
            print(f"Created new user with id: {user.id}")
        
        # Ждем немного, чтобы триггер успел сработать
        await db.execute(text("SELECT pg_sleep(0.1)"))
        
        # Получаем или обновляем запись врача
        result = await db.execute(
            select(Doctor)
            .where(Doctor.user_id == user.id)
            .order_by(Doctor.id.desc())  # Берем самую последнюю запись
            .limit(1)  # Ограничиваем одной записью
        )
        doctor = result.scalar_one_or_none()
        
        if doctor:
            # Обновляем существующую запись
            doctor.specialization_id = doctor_data.specialization_id
            doctor.experience_years = doctor_data.experience_years
            doctor.education = doctor_data.education
            doctor.photo_url = doctor_data.photo_url if hasattr(doctor_data, 'photo_url') else None
            doctor.bio = doctor_data.bio if hasattr(doctor_data, 'bio') else None
            await db.flush()
        else:
            print("Error: Doctor record not created by trigger")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create doctor record"
            )
        
        # Получаем полные данные
        result = await db.execute(
            select(Doctor)
            .options(
                joinedload(Doctor.user),
                joinedload(Doctor.specialization)
            )
            .where(Doctor.id == doctor.id)
        )
        updated_doctor = result.scalar_one_or_none()
        
        if not updated_doctor:
            print("Failed to retrieve updated doctor")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update doctor"
            )
        
        await db.commit()
        print(f"Successfully updated doctor with id: {updated_doctor.id}")
        return DoctorWithUser.from_orm(updated_doctor)

    except Exception as e:
        print(f"Error occurred: {str(e)}")
        await db.rollback()
        if isinstance(e, HTTPException):
            raise e
        
        # Логируем подробную информацию об ошибке
        error_msg = str(e)
        if hasattr(e, '__cause__'):
            error_msg += f"\nCaused by: {str(e.__cause__)}"
        if hasattr(e, '__context__'):
            error_msg += f"\nContext: {str(e.__context__)}"
        print(f"Detailed error creating/updating doctor: {error_msg}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating/updating doctor: {error_msg}"
        )

@router.put("/{doctor_id}", response_model=DoctorWithUser)
async def update_doctor(
    doctor_id: int,
    doctor_update: DoctorUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить информацию о враче (только для администраторов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update doctors"
        )
    
    # Проверяем существование врача
    result = await db.execute(
        select(Doctor)
        .options(
            joinedload(Doctor.user),
            joinedload(Doctor.specialization)
        )
        .where(Doctor.id == doctor_id)
    )
    doctor = result.unique().scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )
    
    # Проверяем существование специализации
    result = await db.execute(
        select(Specialization).where(Specialization.id == doctor_update.specialization_id)
    )
    specialization = result.scalar_one_or_none()
    
    if not specialization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Specialization not found"
        )
    
    # Проверяем уникальность email
    if doctor_update.email != doctor.user.email:
        result = await db.execute(
            select(User).where(
                and_(
                    User.email == doctor_update.email,
                    or_(
                        User.role == UserRole.doctor,
                        User.id.in_(
                            select(Doctor.user_id).select_from(Doctor)
                        )
                    )
                )
            )
        )
        existing_user = result.scalar_one_or_none()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with email {doctor_update.email} already exists as a doctor"
            )

    # Обновляем информацию о пользователе
    user_update = {
        "email": doctor_update.email,
        "full_name": doctor_update.full_name,
        "phone_number": doctor_update.phone_number,
        "is_active": doctor_update.is_active
    }
    
    if doctor_update.password:
        user_update["hashed_password"] = get_password_hash(doctor_update.password)
    
    await db.execute(
        update(User)
        .where(User.id == doctor.user_id)
        .values(**user_update)
    )
    
    # Обновляем информацию о враче
    doctor_data = {
        "specialization_id": doctor_update.specialization_id,
        "experience_years": doctor_update.experience_years,
        "education": doctor_update.education
    }
    
    await db.execute(
        update(Doctor)
        .where(Doctor.id == doctor_id)
        .values(**doctor_data)
    )
    
    await db.commit()
    
    # Получаем обновленные данные с предварительной загрузкой всех связей
    result = await db.execute(
        select(Doctor)
        .options(
            joinedload(Doctor.user),
            joinedload(Doctor.specialization)
        )
        .where(Doctor.id == doctor_id)
    )
    doctor = result.unique().scalar_one()
    
    return doctor

@router.delete("/{doctor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doctor(
    doctor_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Удалить врача"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete doctors"
        )
    
    # Получаем врача
    result = await db.execute(
        select(Doctor)
        .options(joinedload(Doctor.user))
        .where(Doctor.id == doctor_id)
    )
    doctor = result.unique().scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor not found"
        )
    
    # Удаляем врача и связанного пользователя
    await db.delete(doctor.user)
    await db.commit()
    
    return None
