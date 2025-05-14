from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete, or_, and_
from typing import List, Optional

from app.core.security import get_current_user, get_password_hash
from app.db.session import get_db
from app.db.models import User, UserRole, Doctor, Patient, Notification
from app.schemas.user import UserCreate, UserUpdate, UserOut, PaginatedUsers, UserBulkUpdate

router = APIRouter()

@router.get("/", response_model=PaginatedUsers)
async def get_users(
    skip: int = 0,
    limit: int = 10,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    sort_desc: bool = False,
    role: Optional[UserRole] = None,
    _is_active: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить список всех пользователей (только для администраторов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view users"
        )
    
    filters = []
    
    # Поиск по email или имени
    if search:
        search = f"%{search}%"
        filters.append(
            or_(
                User.email.ilike(search),
                User.full_name.ilike(search)
            )
        )

    # Фильтр по роли
    if role:
        filters.append(User.role == role)

    # Фильтр по статусу
    if _is_active is not None:
        filters.append(User.is_active == _is_active)

    # Применяем все фильтры
    query = select(User)
    if filters:
        query = query.where(and_(*filters))

    # Сортировка
    if sort_by:
        if sort_by not in ["email", "full_name", "role", "is_active"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid sort field"
            )
        
        # Преобразуем is_active в _is_active для сортировки
        if sort_by == "is_active":
            sort_by = "_is_active"
            
        order_field = getattr(User, sort_by)
        if sort_desc:
            order_field = order_field.desc()
        query = query.order_by(order_field)
    else:
        # По умолчанию сортируем по ID
        query = query.order_by(User.id)

    # Получаем общее количество пользователей для пагинации
    total_query = select(User)
    if filters:
        total_query = total_query.where(and_(*filters))
    total_result = await db.execute(total_query)
    total = len(total_result.scalars().all())

    # Пагинация
    query = query.offset(skip).limit(limit)
    
    # Получаем пользователей
    result = await db.execute(query)
    users = result.scalars().all()
    
    return PaginatedUsers(
        items=[UserOut.from_orm(user) for user in users],
        total=total,
        skip=skip,
        limit=limit
    )

@router.post("/", response_model=UserOut)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Создать нового пользователя (только для администраторов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create users"
        )

    # Проверяем, существует ли пользователь с таким email или телефоном
    result = await db.execute(
        select(User).where(
            or_(
                User.email == user_data.email,
                and_(
                    User.phone_number == user_data.phone_number,
                    User.phone_number.is_not(None)
                )
            )
        )
    )
    existing_user = result.scalar_one_or_none()
    if existing_user:
        if existing_user.email == user_data.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number already registered"
            )

    # Создаем нового пользователя
    user_dict = user_data.dict(exclude={'password', 'birth_date', 'phone_number', 'avatar'})
    db_user = User(**user_dict)
    db_user.hashed_password = get_password_hash(user_data.password)
    db_user.is_active = True  # По умолчанию активируем пользователя
    
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    
    return UserOut.from_orm(db_user)

@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Обновить пользователя (только для администраторов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update users"
        )

    # Получаем пользователя
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Обновляем поля пользователя
    update_data = user_data.dict(exclude_unset=True)
    if "password" in update_data and update_data["password"]:  # Проверяем, что пароль не пустой
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    elif "password" in update_data:  # Если пароль пустой, просто удаляем его из данных
        update_data.pop("password")

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return user

@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Удалить пользователя (только для администраторов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete users"
        )

    # Получаем пользователя
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Нельзя удалить самого себя
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )

    # Сначала удаляем все связанные записи
    if user.role == UserRole.doctor:
        # Удаляем запись врача
        await db.execute(delete(Doctor).where(Doctor.user_id == user.id))
    elif user.role == UserRole.patient:
        # Удаляем запись пациента
        await db.execute(delete(Patient).where(Patient.user_id == user.id))

    # Удаляем уведомления
    await db.execute(delete(Notification).where(Notification.user_id == user.id))

    # Теперь удаляем самого пользователя
    await db.delete(user)
    await db.commit()
    return {"message": "User deleted successfully"}

@router.post("/bulk-update", response_model=List[UserOut])
async def bulk_update_users(
    data: UserBulkUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Массовое обновление статуса пользователей (только для администраторов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update users"
        )

    # Проверяем, что админ не пытается деактивировать себя
    if current_user.id in data.user_ids and not data.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate yourself"
        )

    # Обновляем статус пользователей
    await db.execute(
        update(User)
        .where(User.id.in_(data.user_ids))
        .values(is_active=data.is_active)  # Используем is_active
    )

    await db.commit()

    # Получаем обновленных пользователей
    result = await db.execute(
        select(User).where(User.id.in_(data.user_ids))
    )
    users = result.scalars().all()
    
    return users
