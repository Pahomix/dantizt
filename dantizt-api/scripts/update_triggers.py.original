"""
Скрипт для обновления триггеров в базе данных
"""
import asyncio
import sys
import os

# Добавляем корневую директорию проекта в sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
from app.db.triggers import create_role_records_trigger

async def update_triggers():
    """Обновляет триггер create_role_records в базе данных"""
    
    # Создаем подключение к базе данных
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        # Удаляем старый триггер
        await conn.execute(text("DROP TRIGGER IF EXISTS create_role_records_trigger ON users"))
        
        # Удаляем старую функцию триггера
        await conn.execute(text("DROP FUNCTION IF EXISTS create_role_records()"))
        
        # Создаем новую функцию триггера
        await conn.execute(text(create_role_records_trigger))
        
        # Создаем новый триггер
        await conn.execute(text("""
            CREATE TRIGGER create_role_records_trigger
            AFTER INSERT OR UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION create_role_records()
        """))
        
        print("Триггер create_role_records успешно обновлен!")

if __name__ == "__main__":
    asyncio.run(update_triggers())
