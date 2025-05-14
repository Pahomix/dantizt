from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.security import (
    verify_password,
    create_tokens,
    set_auth_cookies,
    clear_auth_cookies,
    get_current_user,
    get_password_hash,
    decode_token,
    create_access_token
)
from app.db.session import get_db
from app.db.models import User, UserRole, Patient
from pydantic import BaseModel, EmailStr, constr
from typing import Optional
from datetime import datetime, timedelta, date
import logging
from secrets import token_urlsafe
from app.utils.email import send_verification_email_new
from app.core.config import settings
import sys
import os
import traceback
from sqlalchemy import text

# Создаем директорию для логов, используя абсолютный путь
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, "../../../../"))
debug_logs_dir = os.path.join(project_root, "debug_logs")

# Выводим информацию о путях для отладки
print(f"Current directory: {current_dir}")
print(f"Project root: {project_root}")
print(f"Debug logs directory: {debug_logs_dir}")

# Создаем директорию, если она не существует
try:
    os.makedirs(debug_logs_dir, exist_ok=True)
    print(f"Debug logs directory created: {debug_logs_dir}")
except Exception as e:
    print(f"Error creating debug logs directory: {e}")
    traceback.print_exc()

# Создаем файл для логирования процесса регистрации
debug_log_file = os.path.join(debug_logs_dir, "registration_debug.log")
print(f"Log file: {debug_log_file}")

# Функция для записи в файл логов
def write_debug_log(message):
    try:
        # Проверяем, существует ли директория
        if not os.path.exists(debug_logs_dir):
            os.makedirs(debug_logs_dir, exist_ok=True)
            print(f"Debug logs directory created inside function: {debug_logs_dir}")
        
        # Используем абсолютный путь для файла логов
        log_file_path = os.path.join(debug_logs_dir, "registration_debug.log")
        
        # Проверяем, доступен ли файл для записи
        print(f"Writing to file: {log_file_path}")
        print(f"File exists: {os.path.exists(log_file_path)}")
        
        # Пробуем записать в файл
        with open(log_file_path, "a", encoding="utf-8") as f:
            f.write(f"{message}\n")
        
        # Выводим сообщение в консоль
        print(f"Log written: {message[:50]}...")
        
        # Также выводим в stderr для гарантии
        sys.stderr.write(f"LOG: {message[:50]}...\n")
        sys.stderr.flush()
    except Exception as e:
        print(f"Error writing to log file: {e}")
        traceback.print_exc()
        
        # Пробуем записать в файл в текущей директории
        try:
            with open("registration_debug.log", "a", encoding="utf-8") as f:
                f.write(f"{message}\n")
            print(f"Log written to current directory")
        except Exception as e2:
            print(f"Error writing to log file in current directory: {e2}")
            traceback.print_exc()

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Добавляем обработчик для вывода в консоль, если его еще нет
if not logger.handlers:
    console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setLevel(logging.DEBUG)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

router = APIRouter()

class UserCreate(BaseModel):
    email: EmailStr
    password: constr(min_length=8)
    full_name: constr(min_length=2, max_length=100)
    phone_number: Optional[str] = None
    patient: Optional[dict] = None

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    email: str
    full_name: str
    role: str
    access_token: str
    refresh_token: str
    message: str = "Successfully logged in"

class RefreshRequest(BaseModel):
    refresh_token: str

class EmailVerificationRequest(BaseModel):
    token: str

class MessageResponse(BaseModel):
    """Модель для ответов с сообщением"""
    message: str

@router.post("/login", response_model=LoginResponse)
async def login(
    response: Response,
    credentials: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Аутентификация пользователя"""
    # Ищем пользователя в БД
    result = await db.execute(
        select(User).where(User.email == credentials.email)
    )
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Аккаунт не активирован. Пожалуйста, подтвердите ваш email.",
        )
    
    # Создаем токены и устанавливаем их в куки
    access_token, refresh_token = create_tokens(user.id, user.email)
    set_auth_cookies(response, access_token, refresh_token, str(user.role))
    
    return LoginResponse(
        email=user.email,
        full_name=user.full_name,
        role=str(user.role),
        access_token=access_token,
        refresh_token=refresh_token,
        message="Successfully logged in"
    )

# Поддержка form-data для совместимости с OAuth2
@router.post("/login/form", response_model=LoginResponse)
async def login_form(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Аутентификация пользователя через form-data"""
    credentials = LoginRequest(email=form_data.username, password=form_data.password)
    return await login(response, credentials, db)

@router.post("/register", response_model=LoginResponse)
async def register(
    response: Response,
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Регистрация нового пользователя"""
    try:
        # Очищаем файл логов перед началом
        try:
            log_file_path = os.path.join(debug_logs_dir, "registration_debug.log")
            with open(log_file_path, "w", encoding="utf-8") as f:
                f.write(f"===== START REGISTRATION {datetime.now()} =====\n")
            print(f"Log file cleared: {log_file_path}")
        except Exception as e:
            print(f"Error clearing log file: {e}")
            traceback.print_exc()
        
        write_debug_log("DIRECT DEBUG: Logger settings check")
        write_debug_log(f"Logger name: {logger.name}")
        write_debug_log(f"Logger level: {logger.level}")
        write_debug_log(f"Logger handlers: {logger.handlers}")
        write_debug_log(f"Logger propagate: {logger.propagate}")
        
        write_debug_log(f"User data: {user_data}")
        
        # Проверяем, не существует ли уже пользователь с таким email
        result = await db.execute(
            select(User).where(User.email == user_data.email)
        )
        if result.scalar_one_or_none():
            write_debug_log(f"User with email {user_data.email} already exists")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Создаем хеш пароля
        hashed_password = get_password_hash(user_data.password)
        
        # Генерируем токен для подтверждения email
        token = token_urlsafe(32)
        
        # Создаем нового пользователя
        write_debug_log(f"Creating new user with email: {user_data.email}")
        new_user = User(
            email=user_data.email,
            hashed_password=hashed_password,
            full_name=user_data.full_name,
            phone_number=user_data.phone_number,
            role=UserRole.patient,  # По умолчанию - пациент
            is_active=False,  # Пока не подтвердит email
            email_verified=False,
            email_verification_token=token,
            email_verification_token_expires=datetime.utcnow() + timedelta(hours=24)
        )
        
        db.add(new_user)
        await db.flush()
        write_debug_log(f"User created with ID: {new_user.id}")
        
        # Отправляем email для подтверждения
        try:
            # Формируем URL для подтверждения
            base_url = settings.FRONTEND_DEV_URL if settings.DEBUG_MODE else settings.FRONTEND_URL
            verification_url = f"{base_url}/verify-email?token={token}"
            
            await send_verification_email_new(
                email=new_user.email,
                full_name=new_user.full_name,
                verification_url=verification_url
            )
            write_debug_log(f"Verification email sent to: {new_user.email}")
        except Exception as e:
            write_debug_log(f"Error sending verification email: {e}")
            logger.error(f"Error sending verification email: {str(e)}")
        
        # Создаем или обновляем запись пациента
        try:
            write_debug_log("Checking if patient record exists")
            # Проверяем, существует ли уже запись пациента
            check_sql = """
            SELECT id FROM patients WHERE user_id = :user_id
            """
            check_result = await db.execute(text(check_sql), {"user_id": new_user.id})
            existing_patient = check_result.scalar_one_or_none()
            
            # Получаем данные пациента из запроса
            patient_data = None
            if hasattr(user_data, 'patient') and user_data.patient:
                patient_data = user_data.patient
                write_debug_log(f"Patient data from request: {patient_data}")
            
            if existing_patient:
                write_debug_log(f"Patient record already exists with ID: {existing_patient}")
                # Обновляем существующую запись пациента, если есть данные
                if patient_data:
                    # Преобразуем строку даты в объект date, если она есть
                    birth_date_str = patient_data.get('birth_date')
                    birth_date = None
                    if birth_date_str:
                        try:
                            birth_date = date.fromisoformat(birth_date_str)
                            write_debug_log(f"Converted birth_date from {birth_date_str} to {birth_date}")
                        except ValueError as e:
                            write_debug_log(f"Error converting birth_date: {e}")
                    
                    update_sql = """
                    UPDATE patients 
                    SET birth_date = :birth_date,
                        gender = :gender,
                        address = :address,
                        contraindications = :contraindications,
                        inn = :inn,
                        updated_at = NOW()
                    WHERE id = :patient_id
                    """
                    await db.execute(
                        text(update_sql), 
                        {
                            "patient_id": existing_patient,
                            "birth_date": birth_date,
                            "gender": patient_data.get('gender'),
                            "address": patient_data.get('address'),
                            "contraindications": patient_data.get('contraindications'),
                            "inn": patient_data.get('inn')
                        }
                    )
                    write_debug_log(f"Patient record updated with data: {patient_data}")
            else:
                write_debug_log("Creating patient record")
                # Создаем новую запись пациента с данными из запроса
                if patient_data:
                    # Преобразуем строку даты в объект date, если она есть
                    birth_date_str = patient_data.get('birth_date')
                    birth_date = None
                    if birth_date_str:
                        try:
                            birth_date = date.fromisoformat(birth_date_str)
                            write_debug_log(f"Converted birth_date from {birth_date_str} to {birth_date}")
                        except ValueError as e:
                            write_debug_log(f"Error converting birth_date: {e}")
                    
                    patient = Patient(
                        user_id=new_user.id,
                        gender=patient_data.get('gender'),
                        address=patient_data.get('address'),
                        birth_date=birth_date,
                        contraindications=patient_data.get('contraindications'),
                        inn=patient_data.get('inn')
                    )
                else:
                    patient = Patient(
                        user_id=new_user.id,
                        gender=None,
                        address=None,
                        birth_date=None,
                        contraindications=None,
                        inn=None
                    )
                db.add(patient)
                await db.flush()
                write_debug_log(f"Patient record created with ID: {patient.id}")
        except Exception as e:
            write_debug_log(f"Error creating patient record: {e}")
            logger.error(f"Error creating patient record: {str(e)}")
        
        await db.commit()
        write_debug_log("Changes committed to database")
        
        # Создаем токены и устанавливаем их в куки
        access_token, refresh_token = create_tokens(new_user.id, new_user.email)
        set_auth_cookies(response, access_token, refresh_token, str(new_user.role))
        
        write_debug_log(f"===== END OF REGISTRATION {datetime.now()} =====")
        
        return LoginResponse(
            email=new_user.email,
            full_name=new_user.full_name,
            role=str(new_user.role),
            access_token=access_token,
            refresh_token=refresh_token,
            message="User registered successfully. Please check your email to verify your account."
        )
        
    except HTTPException as e:
        write_debug_log(f"HTTP Exception: {e.detail}")
        raise
    except Exception as e:
        write_debug_log(f"Unexpected error during registration: {str(e)}")
        logger.error(f"Registration error: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during registration: {str(e)}"
        )

@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(
    verification: EmailVerificationRequest,
    db: AsyncSession = Depends(get_db)
):
    """Подтверждение email адреса"""
    try:
        logger.info(f"Verifying email with token: {verification.token}")
        
        # Ищем пользователя по токену
        result = await db.execute(
            select(User).where(
                User.email_verification_token == verification.token,
                User.email_verification_token_expires > datetime.utcnow()
            )
        )
        user = result.scalar_one_or_none()
        
        if not user:
            logger.warning(f"Invalid or expired token: {verification.token}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token"
            )
        
        logger.info(f"Found user: {user.email}")
        
        # Обновляем статус пользователя
        user.email_verified = True
        user.is_active = True
        user.email_verification_token = None  # Очищаем токен
        user.email_verification_token_expires = None
        
        await db.commit()
        logger.info(f"User {user.email} verified successfully")
        
        return MessageResponse(message="Email successfully verified")
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Email verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error during email verification: {str(e)}"
        )

@router.post("/refresh", response_model=Token)
async def refresh_token(
    response: Response,
    refresh_request: RefreshRequest,
    db: AsyncSession = Depends(get_db)
):
    """Обновление access token с помощью refresh token"""
    try:
        # Декодируем refresh token
        payload = decode_token(refresh_request.refresh_token)
        
        # Проверяем, что это refresh token
        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid token type"
            )
        
        # Получаем пользователя
        result = await db.execute(
            select(User).where(User.id == payload.get("user_id"))
        )
        user = result.scalar_one_or_none()
        
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        # Создаем новые токены
        access_token, refresh_token = create_tokens(user.id, user.email)
        
        # Устанавливаем куки
        set_auth_cookies(response, access_token, refresh_token, str(user.role))
        
        return Token(
            access_token=access_token,
            refresh_token=refresh_token
        )
        
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate refresh token"
        )

@router.get("/me", response_model=LoginResponse)
async def read_users_me(
    current_user: User = Depends(get_current_user)
):
    """Получение информации о текущем пользователе"""
    # Создаем новые токены при каждом запросе
    access_token, refresh_token = create_tokens(current_user.id, current_user.email)
    
    return LoginResponse(
        email=current_user.email,
        full_name=current_user.full_name,
        role=str(current_user.role),
        access_token=access_token,
        refresh_token=refresh_token,
        message="Current user info"
    )

@router.post("/logout")
async def logout(
    response: Response,
    current_user: User = Depends(get_current_user)
):
    """Выход пользователя из системы"""
    clear_auth_cookies(response)
    return {"message": "Successfully logged out"}
