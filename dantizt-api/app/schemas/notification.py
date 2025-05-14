from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.db.models import NotificationType

class NotificationBase(BaseModel):
    user_id: int
    title: str
    message: str
    type: NotificationType
    is_read: bool = False
    scheduled_for: Optional[datetime] = None

class NotificationCreate(NotificationBase):
    pass

class NotificationUpdate(BaseModel):
    title: Optional[str] = None
    message: Optional[str] = None
    is_read: Optional[bool] = None
    scheduled_for: Optional[datetime] = None

class NotificationInDB(NotificationBase):
    id: int
    created_by: int
    created_at: datetime
    read_at: Optional[datetime] = None

    class Config:
        orm_mode = True
