from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional
import logging
from app.core.security import get_current_user
from app.db.session import get_db
from app.db.models import User, Patient, UserRole
from app.schemas.patient import (
    PatientCreate,
    PatientUpdate,
    PatientInDB,
    PatientWithUser,
    PatientProfileUpdate,
    UserOut
)
from app.core.security import get_password_hash
from sqlalchemy import text
from app.api.v1.endpoints.auth import create_or_update_patient_record

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/me", response_model=PatientWithUser)
async def get_my_patient_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить профиль текущего пациента"""
    logger.info(f"Getting patient profile for user ID: {current_user.id}")
    
    if current_user.role != UserRole.patient:
        logger.warning(f"User with ID {current_user.id} is not a patient, role: {current_user.role}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only patients can access this endpoint"
        )
    
    # Используем прямой SQL-запрос для получения данных пациента
    try:
        sql = """
        SELECT p.id, p.gender, p.address, p.contraindications, p.birth_date, p.inn
        FROM patients p
        WHERE p.user_id = :user_id
        """
        result = await db.execute(text(sql), {"user_id": current_user.id})
        patient_data = result.fetchone()
        
        if patient_data:
            logger.info(f"Patient data from SQL: {patient_data}")
            
            # Получаем данные пользователя
            user_result = await db.execute(
                select(User).where(User.id == current_user.id)
            )
            user = user_result.scalar_one_or_none()
            
            # Создаем объект PatientWithUser
            return PatientWithUser(
                id=patient_data[0],
                gender=patient_data[1],
                address=patient_data[2],
                contraindications=patient_data[3],
                birth_date=patient_data[4],
                inn=patient_data[5],
                user=UserOut.from_orm(user)
            )
        else:
            logger.warning(f"No patient data found for user ID: {current_user.id}")
            
            # Пробуем получить данные через ORM
            result = await db.execute(
                select(Patient)
                .options(selectinload(Patient.user))
                .where(Patient.user_id == current_user.id)
            )
            patient = result.scalar_one_or_none()
            
            if patient:
                logger.info(f"Patient data from ORM: id={patient.id}, gender={patient.gender}, address={patient.address}, birth_date={patient.birth_date}, contraindications={patient.contraindications}, inn={patient.inn}")
                
                return PatientWithUser(
                    id=patient.id,
                    gender=patient.gender,
                    address=patient.address,
                    contraindications=patient.contraindications,
                    birth_date=patient.birth_date,
                    inn=patient.inn,
                    user=UserOut.from_orm(patient.user)
                )
            else:
                logger.error(f"Patient profile not found for user ID: {current_user.id}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Patient profile not found"
                )
    except Exception as e:
        logger.error(f"Error getting patient profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting patient profile: {str(e)}"
        )

@router.put("/me", response_model=PatientWithUser)
async def update_my_patient_profile(
    profile_update: PatientProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить профиль текущего пациента"""
    try:
        if current_user.role != UserRole.patient:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only patients can update their profile"
            )
        
        # Обновляем данные пользователя
        user_update = {}
        if profile_update.email is not None:
            user_update["email"] = profile_update.email
        if profile_update.full_name is not None:
            user_update["full_name"] = profile_update.full_name
        if profile_update.phone_number is not None:
            user_update["phone_number"] = profile_update.phone_number
        
        if user_update:  # Обновляем только если есть что обновлять
            logger.info(f"Updating user data for current user: {user_update}")
            await db.execute(
                update(User)
                .where(User.id == current_user.id)
                .values(**user_update)
            )
        
        # Получаем или создаем профиль пациента
        result = await db.execute(
            select(Patient).where(Patient.user_id == current_user.id)
        )
        patient = result.scalar_one_or_none()
        
        if patient:
            # Обновляем существующий профиль
            patient_data = {}
            
            # Обновляем все поля, даже если они пустые
            if profile_update.gender is not None:
                patient_data["gender"] = profile_update.gender if profile_update.gender != "" else None
            if profile_update.address is not None:
                patient_data["address"] = profile_update.address if profile_update.address != "" else None
            if profile_update.contraindications is not None:
                patient_data["contraindications"] = profile_update.contraindications if profile_update.contraindications != "" else None
            if profile_update.birth_date is not None:
                patient_data["birth_date"] = profile_update.birth_date
            if profile_update.inn is not None:
                patient_data["inn"] = profile_update.inn if profile_update.inn != "" else None
            
            if patient_data:  # Обновляем только если есть что обновлять
                logger.info(f"Updating patient data for current user: {patient_data}")
                
                # Используем функцию для гарантированного обновления данных пациента
                gender = patient_data.get("gender")
                address = patient_data.get("address")
                birth_date = patient_data.get("birth_date")
                contraindications = patient_data.get("contraindications")
                inn = patient_data.get("inn")
                
                # Вызываем функцию для создания или обновления записи пациента
                patient_id = await create_or_update_patient_record(
                    db, 
                    current_user.id, 
                    gender, 
                    address, 
                    birth_date, 
                    contraindications, 
                    inn
                )
                
                if patient_id:
                    logger.info(f"Successfully updated patient record with ID: {patient_id}")
                else:
                    logger.error("Failed to update patient record")
                    # Если функция не смогла обновить запись, пробуем использовать ORM
                    await db.execute(
                        update(Patient)
                        .where(Patient.user_id == current_user.id)
                        .values(**patient_data)
                    )
                    logger.info("Fallback to ORM update after error")
        else:
            # Создаем новый профиль пациента с помощью функции create_or_update_patient_record
            logger.info(f"Creating new patient profile for user {current_user.id}")
            
            # Используем функцию для гарантированного создания записи пациента
            patient_id = await create_or_update_patient_record(
                db, 
                current_user.id, 
                profile_update.gender if profile_update.gender and profile_update.gender != "" else None,
                profile_update.address if profile_update.address and profile_update.address != "" else None,
                profile_update.birth_date,
                profile_update.contraindications if profile_update.contraindications and profile_update.contraindications != "" else None,
                profile_update.inn if profile_update.inn and profile_update.inn != "" else None
            )
            
            if patient_id:
                logger.info(f"Successfully created patient record with ID: {patient_id}")
            else:
                logger.error("Failed to create patient record using create_or_update_patient_record, falling back to ORM")
                
                # Если функция не смогла создать запись, пробуем использовать ORM
                new_patient = Patient(
                    user_id=current_user.id,
                    gender=profile_update.gender if profile_update.gender and profile_update.gender != "" else None,
                    address=profile_update.address if profile_update.address and profile_update.address != "" else None,
                    contraindications=profile_update.contraindications if profile_update.contraindications and profile_update.contraindications != "" else None,
                    birth_date=profile_update.birth_date,
                    inn=profile_update.inn if profile_update.inn and profile_update.inn != "" else None
                )
                db.add(new_patient)
                logger.info(f"Created new patient profile for user {current_user.id} using ORM")
                await db.flush()
        
        await db.commit()
        
        # Получаем обновленные данные
        result = await db.execute(
            select(Patient)
            .options(selectinload(Patient.user))
            .where(Patient.user_id == current_user.id)
        )
        updated_patient = result.scalar_one()
        
        return PatientWithUser(
            id=updated_patient.id,
            gender=updated_patient.gender,
            address=updated_patient.address,
            contraindications=updated_patient.contraindications,
            birth_date=updated_patient.birth_date,
            inn=updated_patient.inn,
            user=UserOut.from_orm(updated_patient.user)
        )
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating patient profile: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating patient profile: {str(e)}"
        )

# Эндпоинты для администраторов

@router.get("", response_model=List[PatientWithUser])
async def get_patients(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить список всех пациентов (только для администраторов и сотрудников регистратуры)"""
    if current_user.role != UserRole.admin and current_user.role != UserRole.reception:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and reception staff can access this endpoint"
        )
    
    # Получаем пациентов вместе с их пользователями
    result = await db.execute(
        select(Patient, User)
        .join(User, Patient.user_id == User.id)
        .offset(skip)
        .limit(limit)
    )
    patient_users = result.all()
    
    # Создаем список PatientWithUser объектов
    return [
        PatientWithUser(
            id=patient.id,
            gender=patient.gender,
            address=patient.address,
            contraindications=patient.contraindications,
            birth_date=patient.birth_date,
            inn=patient.inn,
            user=UserOut.from_orm(user)
        )
        for patient, user in patient_users
    ]

@router.get("/{patient_id}", response_model=PatientWithUser)
async def get_patient(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить информацию о конкретном пациенте (только для администраторов, врачей и сотрудников регистратуры)"""
    if current_user.role != UserRole.admin and current_user.role != UserRole.doctor and current_user.role != UserRole.reception:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators, doctors and reception staff can access this endpoint"
        )
    
    # Получаем пациента вместе с пользователем
    result = await db.execute(
        select(Patient, User)
        .join(User, Patient.user_id == User.id)
        .where(Patient.id == patient_id)
    )
    patient_user = result.first()
    
    if not patient_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    patient, user = patient_user
    return PatientWithUser(
        id=patient.id,
        gender=patient.gender,
        address=patient.address,
        contraindications=patient.contraindications,
        birth_date=patient.birth_date,
        inn=patient.inn,
        user=UserOut.from_orm(user)
    )

@router.put("/{patient_id}", response_model=PatientWithUser)
async def update_patient(
    patient_id: int,
    patient_update: PatientProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить информацию о пациенте (только для администраторов и сотрудников регистратуры)"""
    if current_user.role != UserRole.admin and current_user.role != UserRole.reception:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and reception staff can update patient information"
        )
    
    try:
        # Проверяем существование пациента
        result = await db.execute(
            select(Patient)
            .options(selectinload(Patient.user))
            .where(Patient.id == patient_id)
        )
        patient = result.scalar_one_or_none()
        
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found"
            )
        
        # Обновляем данные пользователя
        user_update = {}
        if patient_update.email is not None:
            user_update["email"] = patient_update.email
        if patient_update.full_name is not None:
            user_update["full_name"] = patient_update.full_name
        if patient_update.phone_number is not None:
            user_update["phone_number"] = patient_update.phone_number
        if patient_update.is_active is not None:
            user_update["is_active"] = patient_update.is_active
        
        if user_update:  # Обновляем только если есть что обновлять
            await db.execute(
                update(User)
                .where(User.id == patient.user_id)
                .values(**user_update)
            )
        
        # Обновляем данные пациента
        patient_data = {}
        if patient_update.gender is not None:
            patient_data["gender"] = patient_update.gender
        if patient_update.address is not None:
            patient_data["address"] = patient_update.address
        if patient_update.contraindications is not None:
            patient_data["contraindications"] = patient_update.contraindications
        if patient_update.birth_date is not None:
            patient_data["birth_date"] = patient_update.birth_date
        if patient_update.inn is not None:
            patient_data["inn"] = patient_update.inn
        
        if patient_data:  # Обновляем только если есть что обновлять
            await db.execute(
                update(Patient)
                .where(Patient.id == patient_id)
                .values(**patient_data)
            )
        
        # Обновляем пароль, если он предоставлен
        if patient_update.password:
            hashed_password = get_password_hash(patient_update.password)
            await db.execute(
                update(User)
                .where(User.id == patient.user_id)
                .values(hashed_password=hashed_password)
            )
        
        await db.commit()
        
        # Получаем обновленные данные
        result = await db.execute(
            select(Patient)
            .options(selectinload(Patient.user))
            .where(Patient.id == patient_id)
        )
        updated_patient = result.scalar_one()
        
        return PatientWithUser(
            id=updated_patient.id,
            gender=updated_patient.gender,
            address=updated_patient.address,
            contraindications=updated_patient.contraindications,
            birth_date=updated_patient.birth_date,
            inn=updated_patient.inn,
            user=UserOut.from_orm(updated_patient.user)
        )
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating patient: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating patient: {str(e)}"
        )

@router.post("", response_model=PatientWithUser, status_code=status.HTTP_201_CREATED)
async def create_patient(
    patient_data: PatientProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Создать нового пациента (только для администраторов и сотрудников регистратуры)"""
    try:
        if current_user.role != UserRole.admin and current_user.role != UserRole.reception:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only administrators and reception staff can create patients"
            )
        
        # Проверяем, существует ли пользователь с таким email
        if patient_data.email:
            result = await db.execute(
                select(User).where(User.email == patient_data.email)
            )
            existing_user = result.scalar_one_or_none()
            
            if existing_user:
                # Если пользователь существует, проверяем, есть ли у него профиль пациента
                result = await db.execute(
                    select(Patient).where(Patient.user_id == existing_user.id)
                )
                existing_patient = result.scalar_one_or_none()
                
                if existing_patient:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="A patient with this email al y exists"
                    )
                
                # Если профиля пациента нет, но пользователь есть, создаем профиль
                created_patient = Patient(
                    user_id=existing_user.id,
                    gender=patient_data.gender,
                    address=patient_data.address,
                    contraindications=patient_data.contraindications
                )
                db.add(created_patient)
                await db.commit()
                
                # Обновляем роль пользователя на patient, если она другая
                if existing_user.role != UserRole.patient:
                    await db.execute(
                        update(User)
                        .where(User.id == existing_user.id)
                        .values(role=UserRole.patient)
                    )
                    await db.commit()
                
                # Получаем созданного пациента с данными пользователя
                result = await db.execute(
                    select(Patient)
                    .options(joinedload(Patient.user))
                    .where(Patient.user_id == existing_user.id)
                )
                created_patient = result.unique().scalar_one()
                
                response_data = PatientWithUser(
                    id=created_patient.id,
                    gender=created_patient.gender,
                    address=created_patient.address,
                    contraindications=created_patient.contraindications,
                    user=UserOut.from_orm(created_patient.user)
                )
                return response_data
        
        # Проверяем, что все необходимые данные предоставлены
        if not patient_data.email or not patient_data.full_name or not patient_data.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email, full name and password are required"
            )
        
        # Проверяем, существует ли пользователь с таким телефоном
        if patient_data.phone_number:
            result = await db.execute(
                select(User).where(User.phone_number == patient_data.phone_number)
            )
            existing_user_by_phone = result.scalar_one_or_none()
            
            if existing_user_by_phone:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A user with this phone number already exists"
                )
        
        # Создаем нового пользователя с ролью patient
        new_user = User(
            email=patient_data.email,
            full_name=patient_data.full_name,
            phone_number=patient_data.phone_number,
            hashed_password=get_password_hash(patient_data.password),
            is_active=patient_data.is_active if patient_data.is_active is not None else True,
            role=UserRole.patient
        )
        db.add(new_user)
        await db.commit()
        
        # Создаем профиль пациента
        created_patient = Patient(
            user_id=new_user.id,
            gender=patient_data.gender,
            address=patient_data.address,
            contraindications=patient_data.contraindications
        )
        db.add(created_patient)
        await db.commit()
        
        response_data = PatientWithUser(
            id=created_patient.id,
            gender=created_patient.gender,
            address=created_patient.address,
            contraindications=created_patient.contraindications,
            user=UserOut.from_orm(created_patient.user)
        )
        logger.info(f"Successfully created new patient with user_id {new_user.id}")
        logger.info(f"Returning created patient data: {response_data.model_dump()}")
        return response_data
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error creating patient: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating patient: {str(e)}"
        )

@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_patient(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Удалить пациента (только для администраторов и сотрудников регистратуры)"""
    if current_user.role != UserRole.admin and current_user.role != UserRole.reception:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and reception staff can delete patients"
        )
    
    # Проверяем существование пациента
    result = await db.execute(
        select(Patient).where(Patient.id == patient_id)
    )
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Удаляем пациента
    await db.execute(
        delete(Patient).where(Patient.id == patient_id)
    )
    
    # Удаляем связанного пользователя
    await db.execute(
        delete(User).where(User.id == patient.user_id)
    )
    
    await db.commit()
