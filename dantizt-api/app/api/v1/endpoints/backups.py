from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from datetime import datetime
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import os
from pathlib import Path

from app.core.security import get_current_user
from app.db.session import get_db
from app.db.models import User, UserRole
from app.db.backup import DatabaseBackup
from app.schemas.backup import BackupBase, BackupList
from app.core.config import settings

router = APIRouter()

# Получаем имя базы данных из настроек
db_name = settings.POSTGRES_DB

@router.get("", response_model=BackupList)
async def list_backups(
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Получить список резервных копий базы данных (только для администраторов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view backups"
        )
    
    backup_manager = DatabaseBackup(db_name)
    backup_files = backup_manager.list_backups()
    
    backups = []
    for backup_file in backup_files:
        stat = backup_file.stat()
        backups.append(
            BackupBase(
                filename=backup_file.name,
                created_at=datetime.fromtimestamp(stat.st_mtime),
                size_bytes=stat.st_size,
                size_human=f"{stat.st_size / (1024*1024):.2f} MB"
            )
        )
    
    # Сортируем по дате создания (новые вначале)
    backups.sort(key=lambda x: x.created_at, reverse=True)
    
    return BackupList(items=backups, total=len(backups))

@router.post("/create", response_model=BackupBase)
async def create_backup(
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Создать новую резервную копию базы данных (только для администраторов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create backups"
        )
    
    backup_manager = DatabaseBackup(db_name)
    
    # Создаем резервную копию синхронно
    try:
        backup_file = backup_manager.create_backup()
        # Очищаем старые бэкапы после создания нового
        backup_manager.cleanup_old_backups(keep_last=10)
        
        # Получаем информацию о созданном файле
        stat = backup_file.stat()
        size_bytes = stat.st_size
        
        # Формируем человекочитаемый размер файла
        if size_bytes < 1024:
            size_human = f"{size_bytes} байт"
        elif size_bytes < 1024 * 1024:
            size_human = f"{size_bytes / 1024:.1f} КБ"
        else:
            size_human = f"{size_bytes / (1024 * 1024):.1f} МБ"
        
        return BackupBase(
            filename=backup_file.name,
            size_bytes=size_bytes,
            size_human=size_human,
            created_at=datetime.fromtimestamp(stat.st_mtime)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create backup: {str(e)}"
        )

@router.get("/download/{filename}")
async def download_backup(
    filename: str,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Скачать резервную копию базы данных (только для администраторов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can download backups"
        )
    
    backup_manager = DatabaseBackup(db_name)
    backup_dir = backup_manager.backup_dir
    backup_file = backup_dir / filename
    
    if not backup_file.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup file not found"
        )
    
    return FileResponse(
        path=str(backup_file),
        filename=filename,
        media_type="application/octet-stream"
    )

@router.post("/restore/{filename}")
async def restore_backup(
    filename: str,
    background_tasks: BackgroundTasks,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Восстановить базу данных из резервной копии (только для администраторов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can restore backups"
        )
    
    backup_manager = DatabaseBackup(db_name)
    backup_dir = backup_manager.backup_dir
    backup_file = backup_dir / filename
    
    if not backup_file.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup file not found"
        )
    
    # Восстанавливаем из бэкапа в фоновом режиме
    def restore_backup_task():
        backup_manager.restore_backup(backup_file)
    
    background_tasks.add_task(restore_backup_task)
    
    return {"message": "Database restoration started"}

@router.delete("/{filename}")
async def delete_backup(
    filename: str,
    request: Request = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Удалить резервную копию базы данных (только для администраторов)"""
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete backups"
        )
    
    backup_manager = DatabaseBackup(db_name)
    backup_dir = backup_manager.backup_dir
    backup_file = backup_dir / filename
    
    if not backup_file.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup file not found"
        )
    
    try:
        os.remove(backup_file)
        return {"message": "Backup deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete backup: {str(e)}"
        )
