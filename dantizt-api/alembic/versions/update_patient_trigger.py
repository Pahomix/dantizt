"""update patient trigger

Revision ID: update_patient_trigger
Revises: 
Create Date: 2024-12-23 05:26:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'update_patient_trigger'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Удаляем старый триггер
    op.execute("""
        DROP TRIGGER IF EXISTS create_role_records_trigger ON users;
    """)
    
    # Создаем новую функцию триггера
    op.execute("""
        CREATE OR REPLACE FUNCTION create_role_records()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Логируем входные данные
            RAISE NOTICE 'create_role_records triggered: op=%, old_role=%, new_role=%', 
                TG_OP, 
                CASE WHEN TG_OP = 'UPDATE' THEN OLD.role::text ELSE NULL END,
                NEW.role::text;
                
            -- При создании нового пользователя
            IF TG_OP = 'INSERT' THEN
                -- Если роль пациент
                IF NEW.role = 'patient' THEN
                    INSERT INTO patients (
                        user_id,
                        birth_date,
                        gender,
                        address,
                        medical_history,
                        allergies,
                        created_at,
                        updated_at
                    ) VALUES (
                        NEW.id,
                        CURRENT_DATE,  -- Временное значение
                        NULL,         -- Будет обновлено позже
                        NULL,         -- Будет обновлено позже
                        NULL,         -- Будет обновлено позже
                        NULL,         -- Будет обновлено позже
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    );
                END IF;
            END IF;
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Создаем новый триггер
    op.execute("""
        CREATE TRIGGER create_role_records_trigger
        AFTER INSERT OR UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION create_role_records();
    """)

def downgrade() -> None:
    # Удаляем триггер и функцию
    op.execute("""
        DROP TRIGGER IF EXISTS create_role_records_trigger ON users;
        DROP FUNCTION IF EXISTS create_role_records();
    """)
