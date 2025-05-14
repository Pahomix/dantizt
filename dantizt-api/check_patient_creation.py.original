"""
Скрипт для проверки создания записей пациентов в базе данных.
Проверяет существующие записи и их содержимое.
"""
import asyncio
import logging
from sqlalchemy import text
from app.db.session import AsyncSessionLocal

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def check_patients():
    """Проверяет записи пациентов в базе данных"""
    logger.info("Начинаем проверку записей пациентов")
    
    async with AsyncSessionLocal() as db:
        # Получаем структуру таблицы patients
        structure_query = """
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'patients'
        ORDER BY ordinal_position;
        """
        
        result = await db.execute(text(structure_query))
        columns = result.fetchall()
        
        logger.info("Структура таблицы patients:")
        for column in columns:
            logger.info(f"  {column[0]}: {column[1]} (nullable: {column[2]})")
        
        # Получаем количество записей
        count_query = "SELECT COUNT(*) FROM patients;"
        result = await db.execute(text(count_query))
        count = result.scalar()
        
        logger.info(f"Всего записей в таблице patients: {count}")
        
        if count > 0:
            # Получаем все записи пациентов
            patients_query = """
            SELECT p.id, p.user_id, p.gender, p.address, p.birth_date, p.contraindications, p.inn,
                   u.email, u.full_name
            FROM patients p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.id DESC
            LIMIT 10;
            """
            
            result = await db.execute(text(patients_query))
            patients = result.fetchall()
            
            logger.info(f"Последние {len(patients)} записей пациентов:")
            for patient in patients:
                logger.info("-" * 50)
                logger.info(f"ID: {patient[0]}")
                logger.info(f"User ID: {patient[1]}")
                logger.info(f"Email: {patient[7]}")
                logger.info(f"Full Name: {patient[8]}")
                logger.info(f"Gender: {patient[2]}")
                logger.info(f"Address: {patient[3]}")
                logger.info(f"Birth Date: {patient[4]} (type: {type(patient[4])})")
                logger.info(f"Contraindications: {patient[5]}")
                logger.info(f"INN: {patient[6]}")
        else:
            logger.info("В таблице patients нет записей")
            
        # Проверяем записи с NULL значениями
        null_query = """
        SELECT COUNT(*) 
        FROM patients 
        WHERE gender IS NULL 
          AND address IS NULL 
          AND birth_date IS NULL 
          AND contraindications IS NULL 
          AND inn IS NULL;
        """
        
        result = await db.execute(text(null_query))
        null_count = result.scalar()
        
        logger.info(f"Количество записей с NULL значениями во всех полях: {null_count}")
        
        if null_count > 0:
            # Получаем пользователей с пустыми записями пациентов
            null_patients_query = """
            SELECT p.id, p.user_id, u.email, u.full_name, u.created_at
            FROM patients p
            JOIN users u ON p.user_id = u.id
            WHERE p.gender IS NULL 
              AND p.address IS NULL 
              AND p.birth_date IS NULL 
              AND p.contraindications IS NULL 
              AND p.inn IS NULL
            ORDER BY u.created_at DESC
            LIMIT 5;
            """
            
            result = await db.execute(text(null_patients_query))
            null_patients = result.fetchall()
            
            logger.info(f"Пользователи с пустыми записями пациентов (последние 5):")
            for patient in null_patients:
                logger.info(f"  Patient ID: {patient[0]}, User ID: {patient[1]}, Email: {patient[2]}, Name: {patient[3]}, Created: {patient[4]}")

if __name__ == "__main__":
    asyncio.run(check_patients())
