from sqlalchemy import create_engine, MetaData, text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy_utils import database_exists, create_database
import logging
from app.core.config import settings
from app.db.models import Base, MedicalRecord, User, Permission, Specialization, Doctor, DoctorSchedule, Patient
from app.db.triggers import (
    create_appointment_update_trigger,
    create_payment_on_completion_trigger
)

# Настраиваем логирование
logging.basicConfig()
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)

async def create_initial_data(session):
    """Создает начальные данные в базе"""
    # Создаем базовые разрешения
    base_permissions = [
        Permission(name="view_profile", description="Просмотр профиля"),
        Permission(name="edit_profile", description="Редактирование профиля"),
        Permission(name="view_patients", description="Просмотр пациентов"),
        Permission(name="edit_medical_records", description="Редактирование медицинских записей"),
        Permission(name="manage_appointments", description="Управление приемами"),
        Permission(name="manage_users", description="Управление пользователями"),
        Permission(name="manage_permissions", description="Управление разрешениями"),
        Permission(name="edit_patient_data", description="Редактирование данных пациента"),
        Permission(name="process_payments", description="Обработка платежей"),
        Permission(name="issue_tax_documents", description="Выдача справок для налогового вычета"),
    ]
    
    for permission in base_permissions:
        existing = session.query(Permission).filter_by(name=permission.name).first()
        if not existing:
            session.add(permission)
    
    await session.flush()  # Нужен flush чтобы получить id разрешений

    # Создаем специализации с разной длительностью приема
    specializations = [
        Specialization(name="Терапевт", description="Лечение зубов", appointment_duration=30),
        Specialization(name="Хирург", description="Удаление зубов", appointment_duration=60),
        Specialization(name="Ортодонт", description="Исправление прикуса", appointment_duration=45),
    ]
    
    for spec in specializations:
        existing = session.query(Specialization).filter_by(name=spec.name).first()
        if not existing:
            session.add(spec)
    
    await session.flush()  # Нужен flush чтобы получить id специализаций

    # Получаем созданные специализации
    specialization_ids = {}
    for spec_name in ["Терапевт", "Хирург", "Ортодонт"]:
        spec = session.query(Specialization).filter_by(name=spec_name).first()
        if spec:
            specialization_ids[spec_name] = spec.id

    # Создаем тестовых пользователей
    admin = User(
        email="admin@example.com",
        hashed_password="$2b$12$mYby9B9Oz84fofDmcAxjEOtPzgdkmX4m3XTo.5nBkYcv6iL9UNsWq",  # password
        full_name="Admin User",
        role="admin",
        _is_active=True,
        _email_verified=True
    )
    
    # Создаем пользователя регистратуры
    reception = User(
        email="reception@example.com",
        hashed_password="$2b$12$ut2viEdqOgiUsIywUPSd5uMw6ab4urUDQFz9Xhc.V0YcAQu5rWkLC",  # password
        full_name="Сотрудник Регистратуры",
        role="reception",
        _is_active=True,
        _email_verified=True
    )
    
    # Создаем трех врачей с разными специализациями
    doctor1 = User(
        email="doctor1@example.com",
        hashed_password="$2b$12$ut2viEdqOgiUsIywUPSd5uMw6ab4urUDQFz9Xhc.V0YcAQu5rWkLC",  # password
        full_name="Иванов Иван Иванович",
        role="doctor",
        _is_active=True,
        _email_verified=True
    )
    
    doctor2 = User(
        email="doctor2@example.com",
        hashed_password="$2b$12$ut2viEdqOgiUsIywUPSd5uMw6ab4urUDQFz9Xhc.V0YcAQu5rWkLC",  # password
        full_name="Петров Петр Петрович",
        role="doctor",
        _is_active=True,
        _email_verified=True
    )
    
    doctor3 = User(
        email="doctor3@example.com",
        hashed_password="$2b$12$ut2viEdqOgiUsIywUPSd5uMw6ab4urUDQFz9Xhc.V0YcAQu5rWkLC",  # password
        full_name="Сидорова Анна Сергеевна",
        role="doctor",
        _is_active=True,
        _email_verified=True
    )
    
    # Создаем тестового пациента
    patient = User(
        email="patient@example.com",
        hashed_password="$2b$12$ut2viEdqOgiUsIywUPSd5uMw6ab4urUDQFz9Xhc.V0YcAQu5rWkLC",  # password
        full_name="Тестовый Пациент",
        role="patient",
        _is_active=True,
        _email_verified=True
    )
    
    session.add(admin)
    session.add(reception)
    session.add(doctor1)
    session.add(doctor2)
    session.add(doctor3)
    session.add(patient)
    await session.flush()  # Нужен flush чтобы получить id пользователей
    
    # Создаем профили врачей
    from datetime import time
    
    doctor1_profile = Doctor(
        user_id=doctor1.id,
        specialization_id=specialization_ids.get("Терапевт"),
        experience_years=5,
        bio="Опытный терапевт. Специализируется на лечении кариеса и пульпита.",
        education="Московский государственный медико-стоматологический университет",
        photo_url="https://randomuser.me/api/portraits/men/32.jpg"
    )
    
    doctor2_profile = Doctor(
        user_id=doctor2.id,
        specialization_id=specialization_ids.get("Хирург"),
        experience_years=10,
        bio="Хирург-стоматолог высшей категории. Специализируется на сложных удалениях зубов мудрости.",
        education="Российский национальный исследовательский медицинский университет имени Н.И. Пирогова",
        photo_url="https://randomuser.me/api/portraits/men/45.jpg"
    )
    
    doctor3_profile = Doctor(
        user_id=doctor3.id,
        specialization_id=specialization_ids.get("Ортодонт"),
        experience_years=7,
        bio="Ортодонт с большим опытом работы. Специализируется на исправлении прикуса у детей и взрослых.",
        education="Санкт-Петербургский государственный медицинский университет",
        photo_url="https://randomuser.me/api/portraits/women/28.jpg"
    )
    
    session.add(doctor1_profile)
    session.add(doctor2_profile)
    session.add(doctor3_profile)
    await session.flush()
    
    # Создаем расписание для врачей
    # Расписание для первого врача (Терапевт)
    for day in range(5):  # Пн-Пт
        schedule = DoctorSchedule(
            doctor_id=doctor1_profile.id,
            day_of_week=day,
            start_time=time(9, 0),  # 9:00
            end_time=time(18, 0),   # 18:00
            is_active=True
        )
        session.add(schedule)
    
    # Расписание для второго врача (Хирург)
    for day in range(5):  # Пн-Пт
        schedule = DoctorSchedule(
            doctor_id=doctor2_profile.id,
            day_of_week=day,
            start_time=time(10, 0),  # 10:00
            end_time=time(19, 0),    # 19:00
            is_active=True
        )
        session.add(schedule)
    
    # Расписание для третьего врача (Ортодонт)
    for day in range(3):  # Пн-Ср
        schedule = DoctorSchedule(
            doctor_id=doctor3_profile.id,
            day_of_week=day,
            start_time=time(8, 0),   # 8:00
            end_time=time(16, 0),    # 16:00
            is_active=True
        )
        session.add(schedule)
    
    # Создаем профиль пациента
    from datetime import date
    
    patient_profile = Patient(
        user_id=patient.id,
        birth_date=date(1990, 1, 1),
        gender="male",
        address="г. Москва, ул. Примерная, д. 123",
        contraindications="Аллергия на лидокаин"
    )
    
    session.add(patient_profile)
    await session.commit()

def init_db():
    """Инициализирует базу данных"""
    # Создаем синхронный движок для проверки существования базы
    sync_url = settings.SQLALCHEMY_DATABASE_URI.replace('postgresql+asyncpg', 'postgresql')
    sync_engine = create_engine(sync_url, echo=True)

    # Создаем базу данных если она не существует
    if not database_exists(sync_engine.url):
        create_database(sync_engine.url)

    # Создаем метаданные
    metadata = MetaData()
    
    with sync_engine.connect() as conn:
        # Создаем типы enum
        create_enum_types = """
        DO $$ BEGIN
            -- Создаем enum для статуса платежа
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'paymentstatus') THEN
                CREATE TYPE paymentstatus AS ENUM ('pending', 'completed', 'cancelled', 'refunded');
            END IF;

            -- Создаем enum для метода оплаты
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'paymentmethod') THEN
                CREATE TYPE paymentmethod AS ENUM ('cash', 'card', 'insurance');
            END IF;

            -- Создаем enum для статуса приема
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointmentstatus') THEN
                CREATE TYPE appointmentstatus AS ENUM (
                    'scheduled', 'started', 'in_progress', 'completed', 
                    'cancelled', 'postponed', 'no_show'
                );
            END IF;

            -- Создаем enum для категории услуг
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'servicecategory') THEN
                CREATE TYPE servicecategory AS ENUM (
                    'diagnostic',
                    'preventive',
                    'restorative',
                    'endodontic',
                    'periodontic',
                    'prosthodontic',
                    'orthodontic',
                    'surgical',
                    'cosmetic'
                );
            END IF;

            -- Создаем enum для роли пользователя
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
                CREATE TYPE userrole AS ENUM ('admin', 'doctor', 'patient', 'reception');
            END IF;

            -- Создаем enum для статуса лечения
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'treatmentstatus') THEN
                CREATE TYPE treatmentstatus AS ENUM ('planned', 'in_progress', 'completed', 'cancelled', 'on_hold');
            END IF;

            -- Создаем enum для типа записи
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recordtype') THEN
                CREATE TYPE recordtype AS ENUM (
                    'examination',
                    'diagnosis',
                    'treatment',
                    'procedure',
                    'prescription',
                    'xray',
                    'note',
                    'lab_result'
                );
            END IF;

            -- Создаем enum для приоритета лечения
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'treatmentpriority') THEN
                CREATE TYPE treatmentpriority AS ENUM ('low', 'medium', 'high', 'urgent');
            END IF;

            -- Создаем enum для статуса диагноза
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'diagnosisstatus') THEN
                CREATE TYPE diagnosisstatus AS ENUM ('active', 'resolved', 'recurring', 'chronic');
            END IF;

        END $$;
        """
        conn.execute(text(create_enum_types))
        conn.commit()
        logging.info("Created enum types successfully")

    # Удаляем все существующие таблицы
    Base.metadata.drop_all(sync_engine)
    
    # Создаем все таблицы заново
    Base.metadata.create_all(sync_engine)
    
    # Проверяем, что таблица medical_records создалась правильно
    inspector = sync_engine.inspect()
    columns = inspector.get_columns('medical_records')
    column_names = [c['name'] for c in columns]
    logging.info(f"Columns in medical_records: {column_names}")
    
    from app.db.session import async_session
    async with async_session() as session:
        await create_initial_data(session)
    
    with sync_engine.connect() as conn:
        # SQL для пересоздания таблицы appointments
        recreate_appointments_table = """
        DROP TABLE IF EXISTS appointments CASCADE;

        CREATE TABLE appointments (
            id SERIAL PRIMARY KEY,
            patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP NOT NULL,
            appointment_date DATE NOT NULL,
            status appointmentstatus NOT NULL DEFAULT 'scheduled',
            notes VARCHAR,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP,
            CONSTRAINT check_end_time_after_start_time CHECK (end_time > start_time)
        );

        CREATE INDEX idx_appointments_patient ON appointments(patient_id);
        CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
        CREATE INDEX idx_appointments_date ON appointments(appointment_date);
        """

        conn.execute(text(recreate_appointments_table))
        conn.commit()
        logging.info("Recreated appointments table successfully")

        # Удаляем существующие триггеры
        conn.execute(text("DROP TRIGGER IF EXISTS update_appointment_status_trigger ON medical_records;"))
        conn.execute(text("DROP FUNCTION IF EXISTS update_appointment_status();"))
        conn.execute(text("DROP TRIGGER IF EXISTS create_payment_on_appointment_completion_trigger ON appointments;"))
        conn.execute(text("DROP FUNCTION IF EXISTS create_payment_on_appointment_completion();"))
        conn.execute(text("DROP TRIGGER IF EXISTS payment_on_completion_trigger ON appointments;"))
        conn.execute(text("DROP FUNCTION IF EXISTS create_payment_on_completion();"))
        
        # Создаем функции триггеров
        conn.execute(text(create_appointment_update_trigger))
        conn.execute(text(create_payment_on_completion_trigger))
        
        # Создаем триггеры
        conn.execute(text("""
            CREATE TRIGGER update_appointment_status_trigger
            AFTER INSERT ON medical_records
            FOR EACH ROW
            EXECUTE FUNCTION update_appointment_status();
        """))
        
        conn.execute(text("""
            CREATE TRIGGER payment_on_completion_trigger
            AFTER UPDATE ON appointments
            FOR EACH ROW
            WHEN (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed'))
            EXECUTE FUNCTION create_payment_on_completion();
        """))
        
        conn.commit()
        logging.info("Created all triggers successfully")

if __name__ == "__main__":
    init_db()
