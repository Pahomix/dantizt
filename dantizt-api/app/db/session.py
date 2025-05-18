from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text, select
from app.core.config import settings
from app.db.base import Base
from app.db.models import (
    User, UserRole, Service, ServiceCategory, 
    Specialization, Doctor, DoctorSchedule, DoctorService,
    DoctorReview, TreatmentPlan, MedicalRecord, Payment,
    Notification, DoctorSpecialDay, Patient
)
from app.core.utils import get_password_hash
import logging
from datetime import datetime, time, timezone
from app.db.triggers import create_triggers
from app.db.procedures import create_procedures
import random

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600
)

AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

logger = logging.getLogger(__name__)

async def create_initial_data(session: AsyncSession):
    try:
        # Создаем специализации если их нет
        result = await session.execute(select(Specialization))
        specializations = result.scalars().all()
        logging.info(f"Found {len(specializations)} existing specializations")
        
        if not specializations:
            logging.info("Creating specializations...")
            specializations = [
                Specialization(
                    name="Терапевт",
                    description="Лечение зубов и десен, пломбирование, лечение кариеса",
                    appointment_duration=30
                ),
                Specialization(
                    name="Ортодонт",
                    description="Исправление прикуса, установка брекетов и элайнеров",
                    appointment_duration=45
                ),
                Specialization(
                    name="Хирург",
                    description="Удаление зубов, имплантация, костная пластика",
                    appointment_duration=60
                ),
                Specialization(
                    name="Ортопед",
                    description="Протезирование зубов, установка коронок и мостов",
                    appointment_duration=60
                ),
                Specialization(
                    name="Пародонтолог",
                    description="Лечение заболеваний десен и пародонта",
                    appointment_duration=45
                ),
                Specialization(
                    name="Эндодонтист",
                    description="Лечение корневых каналов зубов",
                    appointment_duration=60
                ),
                Specialization(
                    name="Детский стоматолог",
                    description="Стоматологическая помощь детям",
                    appointment_duration=30
                ),
                Specialization(
                    name="Гигиенист",
                    description="Профессиональная чистка зубов и профилактика",
                    appointment_duration=40
                )
            ]
            session.add_all(specializations)
            await session.commit()
            logging.info("Specializations created successfully")
            
            # Перезагружаем специализации после создания
            result = await session.execute(select(Specialization))
            specializations = result.scalars().all()
            logging.info(f"Reloaded {len(specializations)} specializations")
        
        # Создаем базовые услуги если их нет
        result = await session.execute(select(Service))
        services = result.scalars().all()
        logging.info(f"Found {len(services)} existing services")
        
        if not services:
            logging.info("Creating services...")
            services = [
                # Услуги терапевта
                Service(
                    name="Консультация и осмотр",
                    description="Первичный осмотр и консультация стоматолога",
                    cost=1000,
                    category=ServiceCategory.consultation,
                    is_active=True
                ),
                Service(
                    name="Лечение кариеса",
                    description="Лечение кариеса с установкой пломбы",
                    cost=5000,
                    category=ServiceCategory.therapy,
                    is_active=True
                ),
                Service(
                    name="Лечение пульпита",
                    description="Лечение воспаления пульпы зуба",
                    cost=8000,
                    category=ServiceCategory.therapy,
                    is_active=True
                ),
                Service(
                    name="Лечение периодонтита",
                    description="Лечение воспаления тканей вокруг корня зуба",
                    cost=9000,
                    category=ServiceCategory.therapy,
                    is_active=True
                ),
                
                # Услуги ортодонта
                Service(
                    name="Консультация ортодонта",
                    description="Консультация и диагностика проблем прикуса",
                    cost=1500,
                    category=ServiceCategory.consultation,
                    is_active=True
                ),
                Service(
                    name="Установка металлических брекетов",
                    description="Установка классических металлических брекетов",
                    cost=30000,
                    category=ServiceCategory.therapy,
                    is_active=True
                ),
                Service(
                    name="Установка керамических брекетов",
                    description="Установка эстетичных керамических брекетов",
                    cost=45000,
                    category=ServiceCategory.therapy,
                    is_active=True
                ),
                Service(
                    name="Установка сапфировых брекетов",
                    description="Установка прозрачных сапфировых брекетов",
                    cost=55000,
                    category=ServiceCategory.therapy,
                    is_active=True
                ),
                Service(
                    name="Изготовление элайнеров",
                    description="Изготовление прозрачных капп для коррекции прикуса",
                    cost=120000,
                    category=ServiceCategory.therapy,
                    is_active=True
                ),
                
                # Услуги хирурга
                Service(
                    name="Консультация хирурга",
                    description="Консультация и диагностика хирургических проблем",
                    cost=1500,
                    category=ServiceCategory.consultation,
                    is_active=True
                ),
                Service(
                    name="Простое удаление зуба",
                    description="Удаление зуба без осложнений",
                    cost=3000,
                    category=ServiceCategory.surgery,
                    is_active=True
                ),
                Service(
                    name="Сложное удаление зуба",
                    description="Удаление зуба с осложнениями или ретинированного зуба",
                    cost=7000,
                    category=ServiceCategory.surgery,
                    is_active=True
                ),
                Service(
                    name="Установка импланта",
                    description="Установка дентального импланта",
                    cost=35000,
                    category=ServiceCategory.surgery,
                    is_active=True
                ),
                Service(
                    name="Синус-лифтинг",
                    description="Операция по наращиванию костной ткани в области верхнечелюстной пазухи",
                    cost=25000,
                    category=ServiceCategory.surgery,
                    is_active=True
                ),
                
                # Услуги ортопеда
                Service(
                    name="Консультация ортопеда",
                    description="Консультация и диагностика для протезирования",
                    cost=1500,
                    category=ServiceCategory.consultation,
                    is_active=True
                ),
                Service(
                    name="Установка металлокерамической коронки",
                    description="Изготовление и установка металлокерамической коронки",
                    cost=15000,
                    category=ServiceCategory.therapy,
                    is_active=True
                ),
                Service(
                    name="Установка циркониевой коронки",
                    description="Изготовление и установка циркониевой коронки",
                    cost=25000,
                    category=ServiceCategory.therapy,
                    is_active=True
                ),
                Service(
                    name="Изготовление съемного протеза",
                    description="Изготовление и установка съемного протеза",
                    cost=40000,
                    category=ServiceCategory.therapy,
                    is_active=True
                ),
                
                # Услуги пародонтолога
                Service(
                    name="Консультация пародонтолога",
                    description="Консультация и диагностика заболеваний десен",
                    cost=1500,
                    category=ServiceCategory.consultation,
                    is_active=True
                ),
                Service(
                    name="Лечение гингивита",
                    description="Лечение воспаления десен",
                    cost=4000,
                    category=ServiceCategory.therapy,
                    is_active=True
                ),
                Service(
                    name="Лечение пародонтита",
                    description="Комплексное лечение воспаления тканей пародонта",
                    cost=8000,
                    category=ServiceCategory.therapy,
                    is_active=True
                ),
                Service(
                    name="Закрытый кюретаж",
                    description="Удаление поддесневых зубных отложений без разреза десны",
                    cost=3500,
                    category=ServiceCategory.therapy,
                    is_active=True
                ),
                
                # Услуги эндодонтиста
                Service(
                    name="Консультация эндодонтиста",
                    description="Консультация и диагностика проблем с корневыми каналами",
                    cost=1500,
                    category=ServiceCategory.consultation,
                    is_active=True
                ),
                Service(
                    name="Лечение канала зуба",
                    description="Механическая и медикаментозная обработка одного канала",
                    cost=4000,
                    category=ServiceCategory.therapy,
                    is_active=True
                ),
                Service(
                    name="Пломбирование канала зуба",
                    description="Пломбирование одного корневого канала",
                    cost=3000,
                    category=ServiceCategory.therapy,
                    is_active=True
                ),
                
                # Услуги детского стоматолога
                Service(
                    name="Консультация детского стоматолога",
                    description="Осмотр и консультация ребенка",
                    cost=1200,
                    category=ServiceCategory.consultation,
                    is_active=True
                ),
                Service(
                    name="Лечение кариеса молочного зуба",
                    description="Лечение кариеса молочного зуба с установкой пломбы",
                    cost=3500,
                    category=ServiceCategory.therapy,
                    is_active=True
                ),
                Service(
                    name="Герметизация фиссур",
                    description="Профилактическая процедура для защиты от кариеса",
                    cost=2000,
                    category=ServiceCategory.prevention,
                    is_active=True
                ),
                
                # Услуги гигиениста
                Service(
                    name="Профессиональная гигиена",
                    description="Чистка зубов ультразвуком и Air Flow",
                    cost=4000,
                    category=ServiceCategory.prevention,
                    is_active=True
                ),
                Service(
                    name="Фторирование зубов",
                    description="Нанесение фторсодержащих препаратов для укрепления эмали",
                    cost=1500,
                    category=ServiceCategory.prevention,
                    is_active=True
                ),
                Service(
                    name="Обучение гигиене полости рта",
                    description="Индивидуальный подбор средств гигиены и обучение технике чистки",
                    cost=1000,
                    category=ServiceCategory.prevention,
                    is_active=True
                )
            ]
            session.add_all(services)
            await session.commit()
            logging.info("Services created successfully")
            
        # Удаляем всех существующих пользователей для чистого старта
        await session.execute(text("TRUNCATE users CASCADE"))
        await session.commit()
        logging.info("Cleared existing users")
        
        # 1. Создаем администратора
        admin_user = User(
            email="admin@example.com",
            full_name="Администратор Системы",
            phone_number="+79001234567",
            role=UserRole.admin,
            is_active=True,
            is_superuser=True,
            email_verified=True,
            hashed_password=get_password_hash("password")
        )
        session.add(admin_user)
        await session.commit()
        logging.info("Admin user created successfully")
        
        # 2. Создаем сотрудника регистратуры
        reception_user = User(
            email="reception@example.com",
            full_name="Сотрудник Регистратуры",
            phone_number="+79002345678",
            role=UserRole.reception,
            is_active=True,
            is_superuser=False,
            email_verified=True,
            hashed_password=get_password_hash("password")
        )
        session.add(reception_user)
        await session.commit()
        logging.info("Reception user created successfully")
        
        # 3. Создаем пациентов
        patient_users = []
        for patient_info in [
            {
                "email": "patient1@example.com",
                "full_name": "Иванов Иван Иванович",
                "phone_number": "+79111234567",
                "birth_date": datetime(1985, 5, 15).date(),
                "gender": "male",
                "address": "г. Москва, ул. Ленина, д. 10, кв. 25",
                "contraindications": "Аллергия на лидокаин"
            },
            {
                "email": "patient2@example.com",
                "full_name": "Петрова Анна Сергеевна",
                "phone_number": "+79112345678",
                "birth_date": datetime(1990, 8, 22).date(),
                "gender": "female",
                "address": "г. Санкт-Петербург, пр. Невский, д. 15, кв. 7",
                "contraindications": "Нет"
            },
            {
                "email": "patient3@example.com",
                "full_name": "Сидоров Алексей Петрович",
                "phone_number": "+79113456789",
                "birth_date": datetime(1978, 11, 3).date(),
                "gender": "male",
                "address": "г. Екатеринбург, ул. Мира, д. 8, кв. 12",
                "contraindications": "Гипертония"
            }
        ]:
            patient_user = User(
                email=patient_info["email"],
                hashed_password=get_password_hash("password"),
                full_name=patient_info["full_name"],
                phone_number=patient_info["phone_number"],
                role=UserRole.patient,
                is_active=True,
                is_superuser=False,
                email_verified=True
            )
            session.add(patient_user)
            patient_users.append((patient_user, patient_info))
        
        await session.commit()  # Коммитим, чтобы сработал триггер и создались записи пациентов
        logging.info("Patient users created successfully")
        
        # Обновляем созданные триггером записи пациентов
        for patient_user, patient_info in patient_users:
            # Получаем запись пациента, созданную триггером
            result = await session.execute(
                select(Patient).where(Patient.user_id == patient_user.id)
            )
            patient = result.scalar_one_or_none()
            
            if patient:
                # Обновляем данные пациента
                patient.birth_date = patient_info["birth_date"]
                patient.gender = patient_info["gender"]
                patient.address = patient_info["address"]
                patient.contraindications = patient_info["contraindications"]
                session.add(patient)
            else:
                logging.warning(f"Patient record not found for user {patient_user.id}")
        
        await session.commit()
        logging.info("Patient records updated successfully")
        
        # 4. Создаем врачей с разными специализациями
        # Получаем специализации
        result = await session.execute(select(Specialization))
        specializations_list = result.scalars().all()
        
        # Создаем словарь для быстрого доступа к специализациям по имени
        specializations_dict = {spec.name: spec for spec in specializations_list}
        
        # Данные врачей
        doctors_data = [
            {
                "email": "terapevt@example.com",
                "full_name": "Смирнов Дмитрий Александрович",
                "phone_number": "+79121234567",
                "specialization_name": "Терапевт",
                "experience_years": 12,
                "education": "Московский государственный медико-стоматологический университет",
                "bio": "Врач-стоматолог терапевт высшей категории, специализируется на эстетической реставрации зубов"
            },
            {
                "email": "ortodont@example.com",
                "full_name": "Козлова Елена Викторовна",
                "phone_number": "+79122345678",
                "specialization_name": "Ортодонт",
                "experience_years": 15,
                "education": "Российский национальный исследовательский медицинский университет",
                "bio": "Врач-ортодонт высшей категории, специализируется на исправлении прикуса у взрослых и детей"
            },
            {
                "email": "surgeon@example.com",
                "full_name": "Новиков Игорь Владимирович",
                "phone_number": "+79123456789",
                "specialization_name": "Хирург",
                "experience_years": 18,
                "education": "Первый Московский государственный медицинский университет им. И.М. Сеченова",
                "bio": "Врач-стоматолог хирург с большим опытом в области имплантации и сложного удаления зубов"
            },
            {
                "email": "orthoped@example.com",
                "full_name": "Морозов Андрей Николаевич",
                "phone_number": "+79124567890",
                "specialization_name": "Ортопед",
                "experience_years": 14,
                "education": "Санкт-Петербургский государственный медицинский университет",
                "bio": "Врач-стоматолог ортопед, специализируется на протезировании и восстановлении зубного ряда"
            },
            {
                "email": "periodontist@example.com",
                "full_name": "Соколова Мария Александровна",
                "phone_number": "+79125678901",
                "specialization_name": "Пародонтолог",
                "experience_years": 10,
                "education": "Московский государственный медико-стоматологический университет",
                "bio": "Врач-пародонтолог, специализируется на лечении заболеваний десен и тканей пародонта"
            },
            {
                "email": "endodontist@example.com",
                "full_name": "Кузнецов Сергей Петрович",
                "phone_number": "+79126789012",
                "specialization_name": "Эндодонтист",
                "experience_years": 13,
                "education": "Российский университет дружбы народов",
                "bio": "Врач-эндодонтист, специализируется на лечении корневых каналов и сложных случаях эндодонтии"
            },
            {
                "email": "pediatric@example.com",
                "full_name": "Белова Екатерина Сергеевна",
                "phone_number": "+79127890123",
                "specialization_name": "Детский стоматолог",
                "experience_years": 9,
                "education": "Российский национальный исследовательский медицинский университет",
                "bio": "Детский стоматолог, специализируется на лечении и профилактике стоматологических заболеваний у детей"
            },
            {
                "email": "hygienist@example.com",
                "full_name": "Волкова Ольга Дмитриевна",
                "phone_number": "+79128901234",
                "specialization_name": "Гигиенист",
                "experience_years": 7,
                "education": "Московский медицинский колледж",
                "bio": "Стоматолог-гигиенист, специализируется на профессиональной чистке зубов и профилактике заболеваний полости рта"
            }
        ]
        
        # Создаем пользователей-врачей
        doctor_users = []
        for doctor_info in doctors_data:
            specialization = specializations_dict.get(doctor_info["specialization_name"])
            if not specialization:
                logging.warning(f"Специализация {doctor_info['specialization_name']} не найдена")
                continue
                
            doctor_user = User(
                email=doctor_info["email"],
                hashed_password=get_password_hash("password"),
                full_name=doctor_info["full_name"],
                phone_number=doctor_info["phone_number"],
                role=UserRole.doctor,
                is_active=True,
                is_superuser=False,
                email_verified=True
            )
            session.add(doctor_user)
            doctor_users.append((doctor_user, doctor_info, specialization))
        
        await session.commit()
        logging.info("Doctor users created successfully")
        
        # Создаем записи врачей вручную
        for doctor_user, doctor_info, specialization in doctor_users:
            # Получаем запись врача, созданную триггером
            result = await session.execute(
                select(Doctor).where(Doctor.user_id == doctor_user.id)
            )
            doctor = result.scalar_one_or_none()
            
            if doctor:
                # Обновляем данные врача
                doctor.specialization_id = specialization.id
                doctor.experience_years = doctor_info["experience_years"]
                doctor.education = doctor_info["education"]
                doctor.bio = doctor_info["bio"]
                doctor.average_rating = random.uniform(4.0, 5.0)  # Случайный рейтинг от 4.0 до 5.0
                doctor.rating_count = random.randint(10, 50)  # Случайное количество отзывов
                doctor.is_available = True
                session.add(doctor)
            else:
                logging.warning(f"Doctor record not found for user {doctor_user.id}")
        
        await session.commit()
        logging.info("Doctor profiles updated successfully")
        
        # 5. Связываем врачей с услугами
        # Получаем всех врачей
        result = await session.execute(select(Doctor))
        doctors = result.scalars().all()
        
        # Получаем все услуги
        result = await session.execute(select(Service))
        all_services = result.scalars().all()
        
        # Создаем словарь категорий услуг для каждой специализации
        specialization_services = {
            "Терапевт": ["consultation", "therapy"],
            "Ортодонт": ["consultation", "orthodontics"],
            "Хирург": ["consultation", "surgery"],
            "Ортопед": ["consultation", "orthopedics"],
            "Пародонтолог": ["consultation", "periodontics"],
            "Эндодонтист": ["consultation", "endodontics"],
            "Детский стоматолог": ["consultation", "pediatric", "prevention"],
            "Гигиенист": ["consultation", "prevention"]
        }
        
        # Связываем врачей с услугами их специализации
        for doctor in doctors:
            # Получаем специализацию врача
            result = await session.execute(
                select(Specialization).where(Specialization.id == doctor.specialization_id)
            )
            specialization = result.scalar_one_or_none()
            
            if not specialization:
                logging.warning(f"Specialization not found for doctor {doctor.id}")
                continue
                
            # Получаем категории услуг для данной специализации
            allowed_categories = specialization_services.get(specialization.name, [])
            
            for service in all_services:
                # Проверяем, соответствует ли услуга специализации врача
                if service.category.value in allowed_categories:
                    doctor_service = DoctorService(
                        doctor_id=doctor.id,
                        service_id=service.id
                    )
                    session.add(doctor_service)
        
        # 6. Создаем расписание для врачей
        for doctor in doctors:
            # Создаем базовое расписание для врача
            schedules = []
            for day in range(7):
                schedule = DoctorSchedule(
                    doctor_id=doctor.id,
                    day_of_week=day,
                    start_time=time(9, 0) if day < 5 else None,  # 9:00 для пн-пт
                    end_time=time(18, 0) if day < 5 else None,   # 18:00 для пн-пт
                    is_active=day < 5  # Работаем пн-пт
                )
                schedules.append(schedule)
            
            session.add_all(schedules)
        
        # Сохраняем все изменения
        await session.commit()
        logging.info("All initial data created successfully")
            
    except Exception as e:
        await session.rollback()
        logging.error(f"Error creating initial data: {str(e)}")
        raise

async def create_enum_types():
    """Creates all necessary ENUM types and casting functions in the database."""
    try:
        async with engine.connect() as conn:
            # Создаем все необходимые ENUM типы и функции приведения типов
            await conn.execute(text("""
                DO $BODY$
                BEGIN
                    -- UserRole
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
                        CREATE TYPE "userrole" AS ENUM ('admin', 'doctor', 'patient', 'reception');
                    END IF;
                    
                    -- Создаем функцию приведения типа
                    CREATE OR REPLACE FUNCTION text_to_userrole(text) RETURNS "userrole" AS $FUNC$
                    BEGIN
                        RETURN $1::"userrole";
                    EXCEPTION
                        WHEN invalid_text_representation THEN
                            RETURN 'patient'::"userrole";
                    END;
                    $FUNC$ LANGUAGE plpgsql IMMUTABLE;
                    
                    -- Создаем оператор приведения
                    DROP CAST IF EXISTS (text AS "userrole");
                    CREATE CAST (text AS "userrole") WITH FUNCTION text_to_userrole(text) AS IMPLICIT;
                    
                    -- AppointmentStatus
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointmentstatus') THEN
                        CREATE TYPE "appointmentstatus" AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');
                    END IF;
                    
                    -- Создаем функцию приведения типа
                    CREATE OR REPLACE FUNCTION text_to_appointmentstatus(text) RETURNS "appointmentstatus" AS $FUNC$
                    BEGIN
                        RETURN $1::"appointmentstatus";
                    EXCEPTION
                        WHEN invalid_text_representation THEN
                            RETURN 'scheduled'::"appointmentstatus";
                    END;
                    $FUNC$ LANGUAGE plpgsql IMMUTABLE;
                    
                    -- Создаем оператор приведения
                    DROP CAST IF EXISTS (text AS "appointmentstatus");
                    CREATE CAST (text AS "appointmentstatus") WITH FUNCTION text_to_appointmentstatus(text) AS IMPLICIT;
                    
                    -- ServiceCategory
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'servicecategory') THEN
                        CREATE TYPE "servicecategory" AS ENUM ('therapy', 'surgery', 'diagnostics', 'consultation', 'prevention');
                    END IF;
                    
                    -- Создаем функцию приведения типа
                    CREATE OR REPLACE FUNCTION text_to_servicecategory(text) RETURNS "servicecategory" AS $FUNC$
                    BEGIN
                        RETURN $1::"servicecategory";
                    EXCEPTION
                        WHEN invalid_text_representation THEN
                            RETURN 'consultation'::"servicecategory";
                    END;
                    $FUNC$ LANGUAGE plpgsql IMMUTABLE;
                    
                    -- Создаем оператор приведения
                    DROP CAST IF EXISTS (text AS "servicecategory");
                    CREATE CAST (text AS "servicecategory") WITH FUNCTION text_to_servicecategory(text) AS IMPLICIT;
                    
                    -- PaymentStatus
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'paymentstatus') THEN
                        CREATE TYPE "paymentstatus" AS ENUM ('pending', 'completed', 'failed', 'refunded');
                    END IF;
                    
                    -- Создаем функцию приведения типа
                    CREATE OR REPLACE FUNCTION text_to_paymentstatus(text) RETURNS "paymentstatus" AS $FUNC$
                    BEGIN
                        RETURN $1::"paymentstatus";
                    EXCEPTION
                        WHEN invalid_text_representation THEN
                            RETURN 'pending'::"paymentstatus";
                    END;
                    $FUNC$ LANGUAGE plpgsql IMMUTABLE;
                    
                    -- Создаем оператор приведения
                    DROP CAST IF EXISTS (text AS "paymentstatus");
                    CREATE CAST (text AS "paymentstatus") WITH FUNCTION text_to_paymentstatus(text) AS IMPLICIT;
                    
                    -- PaymentMethod
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'paymentmethod') THEN
                        CREATE TYPE "paymentmethod" AS ENUM ('cash', 'card', 'insurance');
                    END IF;
                    
                    -- Создаем функцию приведения типа
                    CREATE OR REPLACE FUNCTION text_to_paymentmethod(text) RETURNS "paymentmethod" AS $FUNC$
                    BEGIN
                        RETURN $1::"paymentmethod";
                    EXCEPTION
                        WHEN invalid_text_representation THEN
                            RETURN 'card'::"paymentmethod";
                    END;
                    $FUNC$ LANGUAGE plpgsql IMMUTABLE;
                    
                    -- Создаем оператор приведения
                    DROP CAST IF EXISTS (text AS "paymentmethod");
                    CREATE CAST (text AS "paymentmethod") WITH FUNCTION text_to_paymentmethod(text) AS IMPLICIT;
                    
                    -- NotificationType
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notificationtype') THEN
                        CREATE TYPE "notificationtype" AS ENUM ('appointment', 'reminder', 'system', 'payment');
                    END IF;
                    
                    -- Создаем функцию приведения типа
                    CREATE OR REPLACE FUNCTION text_to_notificationtype(text) RETURNS "notificationtype" AS $FUNC$
                    BEGIN
                        RETURN $1::"notificationtype";
                    EXCEPTION
                        WHEN invalid_text_representation THEN
                            RETURN 'system'::"notificationtype";
                    END;
                    $FUNC$ LANGUAGE plpgsql IMMUTABLE;
                    
                    -- Создаем оператор приведения
                    DROP CAST IF EXISTS (text AS "notificationtype");
                    CREATE CAST (text AS "notificationtype") WITH FUNCTION text_to_notificationtype(text) AS IMPLICIT;
                    
                    -- SpecialDayType
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'specialdaytype') THEN
                        CREATE TYPE "specialdaytype" AS ENUM ('holiday', 'vacation', 'sick_leave', 'training');
                    END IF;
                    
                    -- Создаем функцию приведения типа
                    CREATE OR REPLACE FUNCTION text_to_specialdaytype(text) RETURNS "specialdaytype" AS $FUNC$
                    BEGIN
                        RETURN $1::"specialdaytype";
                    EXCEPTION
                        WHEN invalid_text_representation THEN
                            RETURN 'holiday'::"specialdaytype";
                    END;
                    $FUNC$ LANGUAGE plpgsql IMMUTABLE;
                    
                    -- Создаем оператор приведения
                    DROP CAST IF EXISTS (text AS "specialdaytype");
                    CREATE CAST (text AS "specialdaytype") WITH FUNCTION text_to_specialdaytype(text) AS IMPLICIT;
                    
                    -- TreatmentStatus
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'treatmentstatus') THEN
                        CREATE TYPE "treatmentstatus" AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
                    END IF;
                    
                    -- Создаем функцию приведения типа
                    CREATE OR REPLACE FUNCTION text_to_treatmentstatus(text) RETURNS "treatmentstatus" AS $FUNC$
                    BEGIN
                        RETURN $1::"treatmentstatus";
                    EXCEPTION
                        WHEN invalid_text_representation THEN
                            RETURN 'planned'::"treatmentstatus";
                    END;
                    $FUNC$ LANGUAGE plpgsql IMMUTABLE;
                    
                    -- Создаем оператор приведения
                    DROP CAST IF EXISTS (text AS "treatmentstatus");
                    CREATE CAST (text AS "treatmentstatus") WITH FUNCTION text_to_treatmentstatus(text) AS IMPLICIT;
                    
                    -- RecordType
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recordtype') THEN
                        CREATE TYPE "recordtype" AS ENUM ('note', 'prescription', 'diagnosis', 'test_result', 'examination');
                    END IF;
                    
                    -- Создаем функцию приведения типа
                    CREATE OR REPLACE FUNCTION text_to_recordtype(text) RETURNS "recordtype" AS $FUNC$
                    BEGIN
                        RETURN $1::"recordtype";
                    EXCEPTION
                        WHEN invalid_text_representation THEN
                            RETURN 'note'::"recordtype";
                    END;
                    $FUNC$ LANGUAGE plpgsql IMMUTABLE;
                    
                    -- Создаем оператор приведения
                    DROP CAST IF EXISTS (text AS "recordtype");
                    CREATE CAST (text AS "recordtype") WITH FUNCTION text_to_recordtype(text) AS IMPLICIT;
                    
                    -- RecordStatus
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recordstatus') THEN
                        CREATE TYPE "recordstatus" AS ENUM ('active', 'archived', 'deleted');
                    END IF;
                    
                    -- Создаем функцию приведения типа
                    CREATE OR REPLACE FUNCTION text_to_recordstatus(text) RETURNS "recordstatus" AS $FUNC$
                    BEGIN
                        RETURN $1::"recordstatus";
                    EXCEPTION
                        WHEN invalid_text_representation THEN
                            RETURN 'active'::"recordstatus";
                    END;
                    $FUNC$ LANGUAGE plpgsql IMMUTABLE;
                    
                    -- Создаем оператор приведения
                    DROP CAST IF EXISTS (text AS "recordstatus");
                    CREATE CAST (text AS "recordstatus") WITH FUNCTION text_to_recordstatus(text) AS IMPLICIT;
                    
                    -- CertificateStatus
                    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'certificatestatus') THEN
                        CREATE TYPE "certificatestatus" AS ENUM ('issued', 'cancelled');
                    END IF;
                    
                    -- Создаем функцию приведения типа
                    CREATE OR REPLACE FUNCTION text_to_certificatestatus(text) RETURNS "certificatestatus" AS $FUNC$
                    BEGIN
                        RETURN $1::"certificatestatus";
                    EXCEPTION
                        WHEN invalid_text_representation THEN
                            RETURN 'issued'::"certificatestatus";
                    END;
                    $FUNC$ LANGUAGE plpgsql IMMUTABLE;
                    
                    -- Создаем оператор приведения
                    DROP CAST IF EXISTS (text AS "certificatestatus");
                    CREATE CAST (text AS "certificatestatus") WITH FUNCTION text_to_certificatestatus(text) AS IMPLICIT;
                END
                $BODY$;
            """))
            await conn.commit()
            logging.info("Created ENUM types and casting functions successfully")
    except Exception as e:
        logging.error(f"Error creating ENUM types: {e}")
        raise

async def init_db():
    """Initialize database."""
    try:
        # Создаем все необходимые ENUM типы и функции приведения типов
        await create_enum_types()
        
        # Проверяем, существуют ли уже таблицы
        async with engine.connect() as conn:
            # Проверяем существование таблицы users как индикатор инициализации БД
            result = await conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'users'
                );
            """))
            table_exists = result.scalar()
            
            if not table_exists:
                logging.info("Database tables do not exist. Creating tables and initial data...")
                
                # Шаг 1: Создаем таблицы и индексы
                async with engine.begin() as conn:
                    # Create tables first
                    await conn.run_sync(Base.metadata.create_all)
                    
                    # Create indices
                    await conn.execute(text("""
                        CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date
                        ON appointments (doctor_id, start_time)
                    """))
                    
                    await conn.execute(text("""
                        CREATE INDEX IF NOT EXISTS idx_appointments_patient_date
                        ON appointments (patient_id, start_time)
                    """))
                    
                    await conn.execute(text("""
                        CREATE INDEX IF NOT EXISTS idx_doctor_schedules_composite
                        ON doctor_schedules (doctor_id, day_of_week, is_active)
                    """))
                    
                    # Создаем все триггеры
                    await create_triggers(conn)
                    
                    # Создаем все процедуры
                    await create_procedures(conn)

                # Шаг 2: Создаем начальные данные
                async with AsyncSessionLocal() as session:
                    await create_initial_data(session)

                # Шаг 3: Создаем представления после того, как данные созданы
                async with engine.begin() as conn:
                    # Создаем представление для просмотра загруженности врачей
                    await conn.execute(text("""
                        CREATE OR REPLACE VIEW doctor_workload_view AS
                        SELECT
                            d.id as doctor_id,
                            u.full_name as doctor_name,
                            d.experience_years,
                            s.name as specialization,
                            COUNT(a.id) as total_appointments,
                            COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
                            COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled_appointments,
                            d.average_rating,
                            d.rating_count
                        FROM doctors d
                        JOIN users u ON d.user_id = u.id
                        JOIN specializations s ON d.specialization_id = s.id
                        LEFT JOIN appointments a ON d.id = a.doctor_id
                        GROUP BY
                            d.id, u.full_name, d.experience_years, s.name, d.average_rating, d.rating_count;
                    """))
                    
                    # Создаем представление для расписания врачей
                    await conn.execute(text("""
                        CREATE OR REPLACE VIEW doctor_schedule_view AS
                        SELECT
                            d.id as doctor_id,
                            u.full_name as doctor_name,
                            ds.day_of_week,
                            ds.start_time,
                            ds.end_time,
                            ds.is_active,
                            ARRAY(
                                SELECT json_build_object(
                                    'id', a.id,
                                    'patient_name', pu.full_name,
                                    'service_name', s.name,
                                    'start_time', a.start_time,
                                    'end_time', a.end_time,
                                    'status', a.status
                                )
                                FROM appointments a
                                JOIN users pu ON a.patient_id = pu.id
                                JOIN services s ON a.service_id = s.id
                                WHERE 
                                    a.doctor_id = d.id 
                                    AND EXTRACT(DOW FROM a.start_time) = ds.day_of_week
                                    AND a.status != 'cancelled'
                                ORDER BY a.start_time
                            ) as appointments
                        FROM doctors d
                        JOIN users u ON d.user_id = u.id
                        JOIN doctor_schedules ds ON d.id = ds.doctor_id
                    """))
                logging.info("Database initialization completed successfully")
            else:
                logging.info("Database tables already exist. Skipping initialization.")
                
                # Проверяем, нужно ли обновить представления
                async with engine.begin() as conn:
                    # Обновляем представления, так как они могли измениться
                    await conn.execute(text("""
                        CREATE OR REPLACE VIEW doctor_workload_view AS
                        SELECT
                            d.id as doctor_id,
                            u.full_name as doctor_name,
                            d.experience_years,
                            s.name as specialization,
                            COUNT(a.id) as total_appointments,
                            COUNT(CASE WHEN a.status = 'completed' THEN 1 END) as completed_appointments,
                            COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) as cancelled_appointments,
                            d.average_rating,
                            d.rating_count
                        FROM doctors d
                        JOIN users u ON d.user_id = u.id
                        JOIN specializations s ON d.specialization_id = s.id
                        LEFT JOIN appointments a ON d.id = a.doctor_id
                        GROUP BY
                            d.id, u.full_name, d.experience_years, s.name, d.average_rating, d.rating_count;
                    """))
                    
                    await conn.execute(text("""
                        CREATE OR REPLACE VIEW doctor_schedule_view AS
                        SELECT
                            d.id as doctor_id,
                            u.full_name as doctor_name,
                            ds.day_of_week,
                            ds.start_time,
                            ds.end_time,
                            ds.is_active,
                            ARRAY(
                                SELECT json_build_object(
                                    'id', a.id,
                                    'patient_name', pu.full_name,
                                    'service_name', s.name,
                                    'start_time', a.start_time,
                                    'end_time', a.end_time,
                                    'status', a.status
                                )
                                FROM appointments a
                                JOIN users pu ON a.patient_id = pu.id
                                JOIN services s ON a.service_id = s.id
                                WHERE 
                                    a.doctor_id = d.id 
                                    AND EXTRACT(DOW FROM a.start_time) = ds.day_of_week
                                    AND a.status != 'cancelled'
                                ORDER BY a.start_time
                            ) as appointments
                        FROM doctors d
                        JOIN users u ON d.user_id = u.id
                        JOIN doctor_schedules ds ON d.id = ds.doctor_id
                    """))
                    
                    # Обновляем индексы
                    await conn.execute(text("""
                        CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date
                        ON appointments (doctor_id, start_time)
                    """))
                    
                    await conn.execute(text("""
                        CREATE INDEX IF NOT EXISTS idx_appointments_patient_date
                        ON appointments (patient_id, start_time)
                    """))
                    
                    await conn.execute(text("""
                        CREATE INDEX IF NOT EXISTS idx_doctor_schedules_composite
                        ON doctor_schedules (doctor_id, day_of_week, is_active)
                    """))
                logging.info("Database views and indices updated successfully")
                
    except Exception as e:
        logging.error(f"Error initializing database: {str(e)}")
        raise

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            raise e
        finally:
            await session.close()