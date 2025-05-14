import asyncio
import json
from app.db.session import AsyncSessionLocal
from sqlalchemy import text

async def get_table_info():
    async with AsyncSessionLocal() as db:
        # Check table structure
        result = await db.execute(text(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'patients'"
        ))
        columns = [{'name': row[0], 'type': row[1]} for row in result.fetchall()]
        print("Table structure for patients:")
        print(json.dumps(columns, indent=2))
        
        # Check for data
        result = await db.execute(text("SELECT COUNT(*) FROM patients"))
        count = result.scalar_one()
        print(f"\nNumber of records in patients table: {count}")
        
        if count > 0:
            # View data
            result = await db.execute(text(
                "SELECT id, user_id, gender, address, birth_date, contraindications, inn FROM patients"
            ))
            rows = result.fetchall()
            print("\nData in patients table:")
            for row in rows:
                print(f"ID: {row[0]}, User ID: {row[1]}, Gender: {row[2]}, Address: {row[3]}, Birth Date: {row[4]}, Contraindications: {row[5]}, INN: {row[6]}")

if __name__ == "__main__":
    asyncio.run(get_table_info())
