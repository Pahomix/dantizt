from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete, and_
from typing import List, Optional
from datetime import datetime

from app.core.security import get_current_user
from app.db.session import get_db
from app.db.models import (
    User, Notification, UserRole, NotificationType
)
from app.schemas.notification import (
    NotificationCreate,
    NotificationUpdate,
    NotificationInDB
)

router = APIRouter()

@router.post("", response_model=NotificationInDB)
async def create_notification(
    notification: NotificationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Создать новое уведомление (только для администраторов и врачей)"""
    if current_user.role not in [UserRole.ADMIN, UserRole.DOCTOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and doctors can create notifications"
        )
    
    # Создаем уведомление
    db_notification = Notification(
        **notification.dict(),
        created_by=current_user.id
    )
    db.add(db_notification)
    await db.commit()
    await db.refresh(db_notification)
    
    return db_notification

@router.get("/user/{user_id}", response_model=List[NotificationInDB])
async def get_user_notifications(
    user_id: int,
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """Получить уведомления пользователя"""
    # Проверяем права доступа
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own notifications"
        )
    
    # Формируем запрос
    query = select(Notification).where(Notification.user_id == user_id)
    
    if unread_only:
        query = query.where(Notification.is_read == False)
    
    # Получаем уведомления
    result = await db.execute(
        query
        .order_by(Notification.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    notifications = result.scalars().all()
    
    return notifications

@router.put("/{notification_id}/read", response_model=NotificationInDB)
async def mark_notification_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Отметить уведомление как прочитанное"""
    # Получаем уведомление
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    # Проверяем права доступа
    if current_user.id != notification.user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only mark your own notifications as read"
        )
    
    # Отмечаем как прочитанное
    notification.is_read = True
    notification.read_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(notification)
    
    return notification

@router.put("/user/{user_id}/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_notifications_as_read(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Отметить все уведомления пользователя как прочитанные"""
    # Проверяем права доступа
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only mark your own notifications as read"
        )
    
    # Обновляем все непрочитанные уведомления
    await db.execute(
        update(Notification)
        .where(and_(
            Notification.user_id == user_id,
            Notification.is_read == False
        ))
        .values(
            is_read=True,
            read_at=datetime.utcnow()
        )
    )
    
    await db.commit()

@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Удалить уведомление (только для администраторов)"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete notifications"
        )
    
    # Получаем уведомление
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    # Удаляем уведомление
    await db.delete(notification)
    await db.commit()

@router.get("/unread-count/{user_id}", response_model=dict)
async def get_unread_notifications_count(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить количество непрочитанных уведомлений"""
    # Проверяем права доступа
    if current_user.id != user_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own notifications count"
        )
    
    # Получаем количество непрочитанных уведомлений
    result = await db.execute(
        select(Notification)
        .where(and_(
            Notification.user_id == user_id,
            Notification.is_read == False
        ))
    )
    count = len(result.scalars().all())
    
    return {"unread_count": count}
