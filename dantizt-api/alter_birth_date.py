import asyncio
from app.db.session import AsyncSessionLocal
from sqlalchemy import text

async def alter_birth_date_type():
    async with AsyncSessionLocal() as db:
        try:
            # Изменяем тип поля birth_date с date на varchar
            await db.execute(text("""
                ALTER TABLE patients 
                ALTER COLUMN birth_date TYPE VARCHAR
                USING birth_date::VARCHAR
            """))
            
            await db.commit()
            print("Successfully altered birth_date column type to VARCHAR")
        except Exception as e:
            print(f"Error altering birth_date column: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(alter_birth_date_type())
