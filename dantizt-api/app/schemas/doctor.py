from pydantic import BaseModel, Field, validator
from typing import Optional
from app.schemas.user import UserOut

class DoctorBase(BaseModel):
    specialization_id: Optional[int] = None
    experience_years: Optional[int] = Field(default=0)  # Разрешаем None
    education: Optional[str] = None
    bio: Optional[str] = None
    average_rating: float = 0.0
    rating_count: int = 0

    @validator('experience_years')
    def validate_experience_years(cls, v):
        if v is not None and v < 0:
            raise ValueError('Experience years cannot be negative')
        return v or 0  # Преобразуем None в 0

    @validator('average_rating')
    def validate_rating(cls, v):
        if v < 0 or v > 5:
            raise ValueError('Rating must be between 0 and 5')
        return v

    @validator('rating_count')
    def validate_rating_count(cls, v):
        if v < 0:
            raise ValueError('Rating count cannot be negative')
        return v

class DoctorCreate(DoctorBase):
    user_id: int

class DoctorUpdateBase(BaseModel):
    email: str
    full_name: str
    phone_number: Optional[str]
    specialization_id: Optional[int] = None
    experience_years: Optional[int] = None  # Разрешаем None
    education: Optional[str]
    bio: Optional[str] = None

    @validator('experience_years')
    def validate_experience_years(cls, v):
        if v is not None and v < 0:
            raise ValueError('Experience years cannot be negative')
        return v  # Оставляем None как есть

class DoctorUpdate(DoctorUpdateBase):
    is_active: bool
    password: Optional[str] = None

class DoctorProfileUpdate(BaseModel):
    email: str
    full_name: str
    phone_number: Optional[str] = None
    specialization_id: Optional[int] = None
    experience_years: Optional[int] = None
    education: Optional[str] = None
    bio: Optional[str] = None

    class Config:
        from_attributes = True

class SpecializationInfo(BaseModel):
    id: int
    name: str
    appointment_duration: Optional[int] = 30

    class Config:
        from_attributes = True

class DoctorInDB(DoctorBase):
    id: int
    user_id: int
    full_name: str
    specialization: Optional[SpecializationInfo] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, doctor):
        if not doctor:
            raise ValueError("Doctor object is required")
            
        # Создаем объект специализации только если она существует
        specialization = None
        if doctor.specialization_id is not None and doctor.specialization is not None:
            specialization = SpecializationInfo(
                id=doctor.specialization_id,
                name=doctor.specialization.name,
                appointment_duration=doctor.specialization.appointment_duration
            )
        elif doctor.specialization_id is not None:
            # Есть ID, но нет объекта специализации
            specialization = SpecializationInfo(
                id=doctor.specialization_id,
                name='Без специализации',
                appointment_duration=30
            )
        
        return cls(
            id=doctor.id,
            user_id=doctor.user_id,
            full_name=doctor.user.full_name if doctor.user else 'Без имени',
            specialization=specialization,
            specialization_id=doctor.specialization_id,
            experience_years=doctor.experience_years,  # Будет преобразовано в 0 если None
            education=doctor.education,
            bio=doctor.bio
        )

class DoctorWithUser(DoctorBase):
    id: int
    user: UserOut
    specialization: Optional[SpecializationInfo] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, doctor):
        if not doctor:
            raise ValueError("Doctor object is required")
            
        if not doctor.user:
            raise ValueError("Doctor must have associated user")

        # Создаем объект специализации только если она существует
        specialization = None
        if doctor.specialization_id is not None and doctor.specialization is not None:
            specialization = SpecializationInfo(
                id=doctor.specialization_id,
                name=doctor.specialization.name,
                appointment_duration=doctor.specialization.appointment_duration
            )
        elif doctor.specialization_id is not None:
            # Есть ID, но нет объекта специализации
            specialization = SpecializationInfo(
                id=doctor.specialization_id,
                name='Без специализации',
                appointment_duration=30
            )

        return cls(
            id=doctor.id,
            user=UserOut.from_orm(doctor.user),
            specialization=specialization,
            specialization_id=doctor.specialization_id,
            experience_years=doctor.experience_years,  # Будет преобразовано в 0 если None
            education=doctor.education,
            bio=doctor.bio,
            average_rating=doctor.average_rating,
            rating_count=doctor.rating_count
        )