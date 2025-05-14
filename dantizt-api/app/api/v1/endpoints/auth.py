from datetime import datetime, timedelta, date
from dateutil.parser import parse
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, update
from typing import Any
from secrets import token_urlsafe
import asyncio
from app.core.security import get_password_hash, create_access_token
from app.db.models import User, Patient
from app.schemas.user import UserCreate, UserOut
from app.api.deps import get_db
from app.core.config import settings
from app.utils.email import send_verification_email_new
from app.db.session import AsyncSessionLocal
import logging
import sys
import os
from pathlib import Path
import traceback

# Создаем директорию для логов, используя абсолютный путь
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, "../../../../../"))
debug_logs_dir = os.path.join(project_root, "debug_logs")

# Выводим информацию о путях для отладки
print(f"Current directory: {current_dir}")
print(f"Project root: {project_root}")
print(f"Debug logs directory: {debug_logs_dir}")

# Создаем директорию, если она не существует
try:
    os.makedirs(debug_logs_dir, exist_ok=True)
    print(f"Директория для логов создана: {debug_logs_dir}")
except Exception as e:
    print(f"Ошибка при создании директории для логов: {e}")
    traceback.print_exc()

# Проверяем права доступа к директории
try:
    print(f"Проверка прав доступа к директории: {debug_logs_dir}")
    print(f"Директория существует: {os.path.exists(debug_logs_dir)}")
    print(f"Права доступа: {oct(os.stat(debug_logs_dir).st_mode)}")
    print(f"Текущий пользователь: {os.getlogin()}")
except Exception as e:
    print(f"Ошибка при проверке прав доступа: {e}")
    traceback.print_exc()

# Создаем файл для логирования процесса регистрации
debug_log_file = os.path.join(debug_logs_dir, "registration_debug.log")
print(f"Файл логов: {debug_log_file}")

# Функция для записи в файл логов
def write_debug_log(message):
    try:
        # Проверяем, существует ли директория
        if not os.path.exists(debug_logs_dir):
            os.makedirs(debug_logs_dir, exist_ok=True)
            print(f"Директория для логов создана внутри функции: {debug_logs_dir}")
        
        # Используем абсолютный путь для файла логов
        log_file_path = os.path.join(debug_logs_dir, "registration_debug.log")
        
        # Проверяем, доступен ли файл для записи
        print(f"Запись в файл: {log_file_path}")
        print(f"Файл существует: {os.path.exists(log_file_path)}")
        
        # Пробуем записать в файл
        with open(log_file_path, "a", encoding="utf-8") as f:
            f.write(f"{message}\n")
        
        # Выводим сообщение в консоль
        print(f"Лог записан: {message[:50]}...")
        
        # Также выводим в stderr для гарантии
        sys.stderr.write(f"LOG: {message[:50]}...\n")
        sys.stderr.flush()
    except Exception as e:
        print(f"Ошибка при записи в файл логов: {e}")
        traceback.print_exc()
        
        # Пробуем записать в файл в текущей директории
        try:
            with open("registration_debug.log", "a", encoding="utf-8") as f:
                f.write(f"{message}\n")
            print(f"Лог записан в текущую директорию")
        except Exception as e2:
            print(f"Ошибка при записи в файл логов в текущей директории: {e2}")
            traceback.print_exc()

# Создаем логгер с явным указанием имени и уровня логирования
logger = logging.getLogger("app.api.v1.endpoints.auth")
logger.setLevel(logging.DEBUG)

# Добавляем обработчик для вывода в консоль, если его еще нет
if not logger.handlers:
    console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setLevel(logging.DEBUG)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

router = APIRouter()

async def create_or_update_patient_record(db, user_id, gender, address, birth_date, contraindications, inn):
    """Создает или обновляет запись пациента с гарантированным сохранением данных"""
    
    # Проверяем, существует ли уже запись пациента
    check_sql = """
    SELECT id FROM patients WHERE user_id = :user_id
    """
    
    try:
        result = await db.execute(text(check_sql), {"user_id": user_id})
        existing_patient_id = result.scalar_one_or_none()
        
        if existing_patient_id:
            logger.error(f"Found existing patient record with ID: {existing_patient_id}, updating...")
            
            # Обновляем существующую запись
            update_sql = """
            UPDATE patients
            SET gender = :gender,
                address = :address,
                birth_date = :birth_date,
                contraindications = :contraindications,
                inn = :inn,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = :user_id
            RETURNING id, gender, address, birth_date, contraindications, inn
            """
            
            params = {
                "user_id": user_id,
                "gender": gender,
                "address": address,
                "birth_date": birth_date,
                "contraindications": contraindications,
                "inn": inn
            }
            
            logger.error(f"Executing SQL update with params: {params}")
            
            result = await db.execute(text(update_sql), params)
            await db.flush()
            updated_patient_row = result.fetchone()
            
            if updated_patient_row:
                logger.error(f"Updated patient record with ID: {updated_patient_row[0]}")
                logger.error(f"Updated patient data: gender={updated_patient_row[1]}, address={updated_patient_row[2]}, birth_date={updated_patient_row[3]}, contraindications={updated_patient_row[4]}, inn={updated_patient_row[5]}")
                
                # Явно коммитим изменения
                await db.commit()
                logger.error("Изменения сохранены в базе данных (commit в create_or_update_patient_record)")
                
                return updated_patient_row[0]
            else:
                logger.error("Failed to update patient record, no data returned")
                return None
        else:
            logger.error("No existing patient record found, creating new one")
            
            # Создаем новую запись
            insert_sql = """
            INSERT INTO patients (
                user_id, gender, address, birth_date, contraindications, inn, created_at, updated_at
            ) VALUES (
                :user_id, :gender, :address, :birth_date, :contraindications, :inn, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            ) RETURNING id, gender, address, birth_date, contraindications, inn
            """
            
            params = {
                "user_id": user_id,
                "gender": gender,
                "address": address,
                "birth_date": birth_date,
                "contraindications": contraindications,
                "inn": inn
            }
            
            logger.error(f"Executing SQL insert with params: {params}")
            
            result = await db.execute(text(insert_sql), params)
            await db.flush()
            new_patient_row = result.fetchone()
            
            if new_patient_row:
                logger.error(f"Created new patient record with ID: {new_patient_row[0]}")
                logger.error(f"Patient data: gender={new_patient_row[1]}, address={new_patient_row[2]}, birth_date={new_patient_row[3]}, contraindications={new_patient_row[4]}, inn={new_patient_row[5]}")
                
                # Явно коммитим изменения
                await db.commit()
                logger.error("Изменения сохранены в базе данных (commit в create_or_update_patient_record)")
                
                return new_patient_row[0]
            else:
                logger.error("Failed to create patient record, no data returned")
                return None
    except Exception as e:
        logger.error(f"Error in create_or_update_patient_record: {e}")
        await db.rollback()
        logger.error("Изменения отменены (rollback в create_or_update_patient_record)")
        return None

@router.post("/register", response_model=UserOut)
async def register(
    *,
    user_in: UserCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Регистрация нового пользователя
    """
    # Очищаем файл логов перед началом
    try:
        log_file_path = os.path.join(debug_logs_dir, "registration_debug.log")
        with open(log_file_path, "w", encoding="utf-8") as f:
            f.write(f"===== START REGISTRATION {datetime.now()} =====\n")
        print(f"Log file cleared: {log_file_path}")
    except Exception as e:
        print(f"Error clearing log file: {e}")
        traceback.print_exc()
    
    # Проверяем настройки логгера
    write_debug_log("DIRECT DEBUG: Logger settings check")
    
    # Выводим информацию о логгере
    write_debug_log(f"Logger name: {logger.name}")
    write_debug_log(f"Logger level: {logger.level}")
    write_debug_log(f"Logger handlers: {logger.handlers}")
    write_debug_log(f"Logger propagate: {logger.propagate}")
    
    # Пробуем разные уровни логирования
    logger.debug("DEBUG: Test message from register")
    logger.info("INFO: Test message from register")
    logger.warning("WARNING: Test message from register")
    logger.error("ERROR: Test message from register")
    logger.critical("CRITICAL: Test message from register")
    
    message = "===== START REGISTRATION (STDERR) ====="
    write_debug_log(message)
    sys.stderr.write(message + "\n")
    sys.stderr.flush()
    logger.error(message)
    print(message)
    
    # Логирование информации о запросе
    message = f"Request type: {request.client.host if hasattr(request, 'client') else 'Unknown'}"
    write_debug_log(message)
    sys.stderr.write(message + "\n")
    sys.stderr.flush()
    logger.error(message)
    
    # Логируем заголовки запроса
    write_debug_log(f"User-Agent: {request.headers.get('user-agent', 'Unknown')}")
    write_debug_log(f"Content-Type: {request.headers.get('content-type', 'Unknown')}")
    write_debug_log(f"Origin: {request.headers.get('origin', 'Unknown')}")
    write_debug_log(f"Referer: {request.headers.get('referer', 'Unknown')}")
    
    # Определяем источник запроса
    user_agent = request.headers.get('user-agent', '').lower()
    if 'postman' in user_agent:
        source = 'Postman'
    elif 'mozilla' in user_agent or 'chrome' in user_agent or 'safari' in user_agent:
        source = 'Browser'
    else:
        source = 'Unknown'
    
    message = f"Request source: {source}"
    write_debug_log(message)
    sys.stderr.write(message + "\n")
    sys.stderr.flush()
    logger.error(message)
    
    # Логируем сырые данные запроса
    try:
        body = await request.json()
        message = f"Raw request data: {body}"
        write_debug_log(message)
        
        message = f"Patient data type in request: {type(body.get('patient'))}"
        write_debug_log(message)
        
        message = f"Patient content in request: {body.get('patient')}"
        write_debug_log(message)
    except Exception as e:
        message = f"Error getting raw request data: {e}"
        write_debug_log(message)
    
    message = f"User data: {user_in.dict()}"
    write_debug_log(message)
    
    # Проверяем, существует ли пользователь с таким email
    message = f"Checking if user exists with email: {user_in.email}"
    write_debug_log(message)
    
    result = await db.execute(
        select(User).where(User.email == user_in.email)
    )
    user = result.scalar_one_or_none()
    
    if user:
        message = f"User with email {user_in.email} already exists (DEBUG)"
        write_debug_log(message)
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    # Подробное логирование структуры входящих данных
    message = f"Structure of user_in data: {dir(user_in)}"
    write_debug_log(message)
    
    message = f"Type of user_in.patient: {type(user_in.patient)}"
    write_debug_log(message)
    
    if user_in.patient:
        message = f"Content of user_in.patient: {user_in.patient}"
        write_debug_log(message)
        
        if isinstance(user_in.patient, dict):
            message = f"Keys in user_in.patient: {user_in.patient.keys()}"
            write_debug_log(message)
    
    # Генерируем токен для подтверждения email
    token = token_urlsafe(32)
    
    # Создаем пользователя
    db_user = User(
        email=user_in.email,
        phone_number=user_in.phone_number,
        full_name=user_in.full_name,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
        email_verified=False,
        email_verification_token=token,
        email_verification_token_expires=datetime.utcnow() + timedelta(hours=24)
    )
    
    message = f"Creating user: {user_in.email}, role: {user_in.role}"
    write_debug_log(message)
    
    # Добавляем пользователя в базу данных
    db.add(db_user)
    try:
        await db.flush()
        message = f"User created with ID: {db_user.id}"
        write_debug_log(message)
        
        # Явно коммитим создание пользователя
        await db.commit()
        message = "User saved to database (commit)"
        write_debug_log(message)
        
        # Обновляем объект пользователя из базы данных
        await db.refresh(db_user)
        message = f"User updated from database: {db_user.id}"
        write_debug_log(message)
    except Exception as e:
        message = f"Error creating user: {e}"
        write_debug_log(message)
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"Error creating user: {str(e)}"
        )
    
    # Если пользователь - пациент, создаем запись пациента
    if user_in.role == "patient":
        message = "==== CREATING PATIENT RECORD ===="
        write_debug_log(message)
        
        message = f"Patient data from request: {user_in.patient}"
        write_debug_log(message)
        
        # Проверяем, что данные пациента не None
        if user_in.patient is None:
            message = "Patient data is missing (None)"
            write_debug_log(message)
            user_in.patient = {}
        
        # Получаем данные пациента
        patient_data = user_in.patient
        
        message = f"Type of patient data: {type(patient_data)}"
        write_debug_log(message)
        
        message = f"Content of patient_data: {patient_data}"
        write_debug_log(message)
        
        # Получаем отдельные поля
        gender = patient_data.get("gender")
        address = patient_data.get("address")
        birth_date_str = patient_data.get("birth_date")
        contraindications = patient_data.get("contraindications")
        inn = patient_data.get("inn")
        
        message = f"Extracted patient data:"
        write_debug_log(message)
        
        message = f"gender: {gender}, type: {type(gender)}"
        write_debug_log(message)
        
        message = f"address: {address}, type: {type(address)}"
        write_debug_log(message)
        
        message = f"birth_date_str: {birth_date_str}, type: {type(birth_date_str)}"
        write_debug_log(message)
        
        message = f"contraindications: {contraindications}, type: {type(contraindications)}"
        write_debug_log(message)
        
        message = f"inn: {inn}, type: {type(inn)}"
        write_debug_log(message)
        
        # Преобразуем дату рождения из строки в объект date
        birth_date = None
        if birth_date_str:
            try:
                if isinstance(birth_date_str, str):
                    birth_date = parse(birth_date_str).date()
                    message = f"Birth date converted: {birth_date}"
                    write_debug_log(message)
                else:
                    birth_date = birth_date_str
                    message = f"Birth date is already in correct format: {birth_date}"
                    write_debug_log(message)
            except Exception as e:
                message = f"Error converting birth date: {e}"
                write_debug_log(message)
        
        # Создаем запись пациента
        try:
            message = "Calling create_or_update_patient_record"
            write_debug_log(message)
            
            patient_id = await create_or_update_patient_record(
                db=db,
                user_id=db_user.id,
                gender=gender,
                address=address,
                birth_date=birth_date,
                contraindications=contraindications,
                inn=inn
            )
            
            message = f"Patient record created with ID: {patient_id}"
            write_debug_log(message)
            
        except Exception as e:
            message = f"Error creating patient record: {e}"
            write_debug_log(message)
            
            await db.rollback()
            message = "Changes rolled back"
            write_debug_log(message)
            
            raise HTTPException(
                status_code=400,
                detail=f"Error creating patient record: {str(e)}"
            )
    
    # Отправляем email для подтверждения
    try:
        background_tasks.add_task(
            send_verification_email_new,
            email_to=user_in.email,
            token=token
        )
    except Exception as e:
        write_debug_log(f"Error sending verification email: {e}")
    
    # Финальная проверка данных пациента
    if user_in.role == "patient":
        message = "==== FINAL CHECK OF PATIENT DATA ===="
        write_debug_log(message)
        
        try:
            # Проверяем, что запись пациента действительно создана
            check_sql = text("""
            SELECT id, gender, address, birth_date, contraindications, inn FROM patients
            WHERE user_id = :user_id
            """)
            
            message = f"SQL query:\n{check_sql}, params: {{'user_id': {db_user.id}}}"
            write_debug_log(message)
            
            # Создаем новую сессию для проверки
            async with AsyncSessionLocal() as check_db:
                check_result = await check_db.execute(check_sql, {"user_id": db_user.id})
                check_row = check_result.fetchone()
                
                if check_row:
                    message = "FINAL CHECK - PATIENT DATA FOUND!"
                    write_debug_log(message)
                    
                    message = f"Patient ID: {check_row[0]}"
                    write_debug_log(message)
                    
                    message = f"Gender: {check_row[1]}, type: {type(check_row[1])}"
                    write_debug_log(message)
                    
                    message = f"Address: {check_row[2]}, type: {type(check_row[2])}"
                    write_debug_log(message)
                    
                    message = f"Birth date: {check_row[3]}, type: {type(check_row[3])}"
                    write_debug_log(message)
                    
                    message = f"Contraindications: {check_row[4]}, type: {type(check_row[4])}"
                    write_debug_log(message)
                    
                    message = f"INN: {check_row[5]}, type: {type(check_row[5])}"
                    write_debug_log(message)
                else:
                    message = "FINAL CHECK - PATIENT DATA NOT FOUND!"
                    write_debug_log(message)
        except Exception as e:
            message = f"Error during final check of patient data: {e}"
            write_debug_log(message)
    
    # Завершаем логирование
    write_debug_log(f"===== END OF REGISTRATION {datetime.now()} =====")
    
    # Преобразуем объект пользователя в схему UserOut
    return UserOut.from_orm(db_user)

@router.post("/verify-email/")
async def verify_email(
    token: str,
    db: AsyncSession = Depends(get_db)
) -> dict:
    """Подтверждение email адреса"""
    
    logger.error(f"Verifying email with token: {token}")
    logger.info(f"Verifying email with token: {token}")
    
    # Ищем пользователя по токену
    result = await db.execute(
        select(User).where(
            User.email_verification_token == token,
            User.email_verification_token_expires > datetime.utcnow()
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        logger.error(f"Invalid or expired verification token: {token}")
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired verification token"
        )
    
    logger.error(f"Found user: {user.email}")
    logger.info(f"Found user: {user.email}")
    
    # Подтверждаем email
    user.email_verified = True
    user.is_active = True
    user.email_verification_token = None
    user.email_verification_token_expires = None
    
    try:
        await db.commit()
        
        # Проверяем, что пользователь действительно активирован
        check_result = await db.execute(
            select(User).where(User.id == user.id)
        )
        updated_user = check_result.scalar_one_or_none()
        
        if updated_user:
            logger.error(f"User {updated_user.email} verified successfully. is_active={updated_user.is_active}, email_verified={updated_user.email_verified}")
            logger.info(f"User {updated_user.email} verified successfully")
            
            # Если пользователь - пациент, проверяем запись пациента
            if updated_user.role == "patient":
                logger.error(f"Checking patient record for user_id={updated_user.id}")
                
                check_sql = """
                SELECT id, gender, address, birth_date, contraindications, inn
                FROM patients
                WHERE user_id = :user_id
                """
                
                try:
                    check_result = await db.execute(text(check_sql), {"user_id": updated_user.id})
                    patient_row = check_result.fetchone()
                    
                    if patient_row:
                        logger.error(f"Patient record found: ID={patient_row[0]}, gender={patient_row[1]}, address={patient_row[2]}, birth_date={patient_row[3]}")
                    else:
                        logger.error(f"No patient record found for user_id={updated_user.id}")
                except Exception as e:
                    logger.error(f"Error checking patient record: {e}")
        
        return {"message": "Email verified successfully"}
    except Exception as e:
        logger.error(f"Error verifying email: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Error verifying email"
        )
