from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from datetime import datetime

from app.core.security import get_current_user
from app.db.session import get_db
from app.db.models import User, ActionLog, UserRole
from app.schemas.log import LogResponse, LogList

router = APIRouter()

@router.get("", response_model=LogList)
async def get_logs(
    skip: int = 0,
    limit: int = 100,
    table_name: Optional[str] = None,
    action_type: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить список логов действий (только для администраторов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view logs"
        )
    
    # Строим запрос с фильтрами
    query = select(ActionLog)
    
    if table_name:
        query = query.where(ActionLog.table_name == table_name)
    if action_type:
        query = query.where(ActionLog.action_type == action_type)
    if start_date:
        query = query.where(ActionLog.created_at >= start_date)
    if end_date:
        query = query.where(ActionLog.created_at <= end_date)
    
    # Получаем общее количество записей для пагинации
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.execute(count_query)
    total_count = total.scalar()
    
    # Добавляем пагинацию и сортировку
    query = query.order_by(ActionLog.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return LogList(
        items=[LogResponse.from_orm(log) for log in logs],
        total=total_count,
        page=skip // limit + 1,
        size=limit
    )

@router.get("/tables", response_model=List[str])
async def get_log_tables(
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить список таблиц, для которых есть логи (только для администраторов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view logs"
        )
    
    query = select(ActionLog.table_name).distinct()
    result = await db.execute(query)
    tables = result.scalars().all()
    
    return tables

@router.get("/actions", response_model=List[str])
async def get_log_actions(
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить список типов действий в логах (только для администраторов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view logs"
        )
    
    query = select(ActionLog.action_type).distinct()
    result = await db.execute(query)
    actions = result.scalars().all()
    
    return actions

@router.get("/{log_id}", response_model=LogResponse)
async def get_log(
    log_id: int,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить детальную информацию о логе (только для администраторов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view logs"
        )
    
    result = await db.execute(
        select(ActionLog).where(ActionLog.id == log_id)
    )
    log = result.scalar_one_or_none()
    
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Log not found"
        )
    
    return LogResponse.from_orm(log)
