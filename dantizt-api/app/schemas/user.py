from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict
from datetime import date, datetime
from app.db.models import UserRole, User

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    birth_date: Optional[date] = None
    phone_number: Optional[str] = None
    avatar: Optional[str] = None

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "patient"
    birth_date: Optional[date] = None
    phone_number: Optional[str] = None
    avatar: Optional[str] = None
    patient: Optional[Dict] = None

class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: str
    phone_number: Optional[str] = None
    is_active: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, user: User):
        return cls(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            phone_number=user.phone_number,
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at
        )

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    birth_date: Optional[date] = None
    phone_number: Optional[str] = None
    avatar: Optional[str] = None

    class Config:
        from_attributes = True

class UserBulkUpdate(BaseModel):
    user_ids: List[int]
    is_active: bool

    class Config:
        json_schema_extra = {
            "example": {
                "user_ids": [1, 2, 3],
                "is_active": True
            }
        }

class PaginatedUsers(BaseModel):
    items: List[UserOut]
    total: int
    skip: int
    limit: int
