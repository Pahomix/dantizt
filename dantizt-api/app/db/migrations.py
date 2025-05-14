from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .base import Base
from .models.models import *
from .triggers import create_triggers
from .functions import create_functions
from .views import create_views
from .indexes import create_all_indexes
import logging
from sqlalchemy import text
from asyncpg import AsyncConnection

logger = logging.getLogger(__name__)

async def init_db(conn: AsyncConnection):
    """Применяет миграции к базе данных"""
    
    # Создаем enum если его нет
    await conn.execute(text("""
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
                CREATE TYPE userrole AS ENUM ('admin', 'doctor', 'patient');
            END IF;
        END $$;
    """))
    
    # Изменяем тип колонок tooth_positions и attachments на JSONB
    await conn.execute(text("""
        DO $$ 
        BEGIN
            -- Проверяем существование таблицы и колонок
            IF EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'medical_records' 
                AND column_name IN ('tooth_positions', 'attachments')
            ) THEN
                -- Изменяем тип колонок на JSONB
                ALTER TABLE medical_records 
                ALTER COLUMN tooth_positions TYPE JSONB USING tooth_positions::JSONB,
                ALTER COLUMN attachments TYPE JSONB USING attachments::JSONB;
            END IF;
        END $$;
    """))
    
    # Создаем триггер для управления правами пользователей
    await conn.execute(text("""
        CREATE OR REPLACE FUNCTION set_user_permissions()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Для отладки
            RAISE NOTICE 'set_user_permissions: op=%, role=%, is_active=%, email_verified=%', 
                TG_OP, NEW.role, NEW._is_active, NEW._email_verified;
            
            -- Администратор получает полный доступ сразу
            IF NEW.role = 'admin' THEN
                NEW._is_active := true;
                NEW._email_verified := true;
            
            -- При создании обычного пользователя оставляем значения по умолчанию (false)
            ELSIF TG_OP = 'INSERT' THEN
                NULL;  -- Ничего не делаем, значения уже false
            
            -- При обновлении и подтверждении email
            ELSIF TG_OP = 'UPDATE' AND NEW._email_verified = true AND OLD._email_verified = false THEN
                NEW._is_active := true;
            END IF;
            
            -- Для отладки
            RAISE NOTICE 'set_user_permissions: after changes is_active=%, email_verified=%', 
                NEW._is_active, NEW._email_verified;
            
            -- Обновляем updated_at при любом изменении
            NEW.updated_at := CURRENT_TIMESTAMP;
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """))
    
    # Удаляем существующий триггер если есть
    await conn.execute(text("DROP TRIGGER IF EXISTS set_user_permissions_trigger ON users CASCADE;"))
    
    # Создаем триггер
    await conn.execute(text("""
        CREATE TRIGGER set_user_permissions_trigger
        BEFORE INSERT OR UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION set_user_permissions();
    """))
    
    # Обновляем значение по умолчанию для is_active
    await conn.execute(text("""
        ALTER TABLE users 
        ALTER COLUMN is_active SET DEFAULT false;
    """))
    
    # Обновляем существующие записи
    await conn.execute(text("""
        UPDATE users 
        SET is_active = false 
        WHERE email_verified = false;
    """))

def drop_db(database_url: str):
    """
    Удаление всех объектов базы данных
    
    :param database_url: URL для подключения к базе данных
    """
    engine = create_engine(database_url)
    
    try:
        # Удаление всех таблиц
        Base.metadata.drop_all(bind=engine)
        logger.info("Database objects dropped successfully")
        
    except Exception as e:
        logger.error(f"Error during database cleanup: {e}")
        raise
