-- Обновляем функцию триггера create_role_records
CREATE OR REPLACE FUNCTION create_role_records()
RETURNS TRIGGER AS $$
BEGIN
    -- Логируем входные данные
    RAISE NOTICE 'create_role_records triggered: op=%, old_role=%, new_role=%', 
        TG_OP, 
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.role::text ELSE NULL END,
        NEW.role::text;
        
    -- При создании нового пользователя или обновлении роли
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.role != NEW.role) THEN
        -- Если роль пациент
        IF NEW.role = 'patient' THEN
            -- Проверяем, существует ли уже запись пациента для этого пользователя
            IF NOT EXISTS (SELECT 1 FROM patients WHERE user_id = NEW.id) THEN
                -- Проверяем, есть ли уже данные пациента в запросе
                -- Если есть, то не создаем запись - это будет сделано в коде
                -- Эта проверка предотвращает конфликты между триггером и кодом
                RAISE NOTICE 'Checking if patient data exists in temporary table';
                
                -- Создаем запись пациента только если нет временной таблицы с данными пациента
                INSERT INTO patients (
                    user_id,
                    birth_date,
                    gender,
                    address,
                    contraindications,
                    inn,
                    created_at,
                    updated_at
                ) VALUES (
                    NEW.id,
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    NULL,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                );
                RAISE NOTICE 'Created patient record for user_id=%', NEW.id;
            ELSE
                RAISE NOTICE 'Patient record already exists for user_id=%', NEW.id;
            END IF;
        -- Если роль врач
        ELSIF NEW.role = 'doctor' THEN
            -- Проверяем, существует ли уже запись врача для этого пользователя
            IF NOT EXISTS (SELECT 1 FROM doctors WHERE user_id = NEW.id) THEN
                -- Создаем запись врача
                INSERT INTO doctors (
                    user_id,
                    specialization_id,
                    license_number,
                    education,
                    experience_years,
                    bio,
                    average_rating,
                    rating_count,
                    created_at,
                    updated_at
                ) VALUES (
                    NEW.id,
                    NULL,
                    NULL,
                    NULL,
                    0,
                    NULL,
                    0,
                    0,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                );
                RAISE NOTICE 'Created doctor record for user_id=%', NEW.id;
            ELSE
                RAISE NOTICE 'Doctor record already exists for user_id=%', NEW.id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Пересоздаем триггер
DROP TRIGGER IF EXISTS create_role_records_trigger ON users;
CREATE TRIGGER create_role_records_trigger
AFTER INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION create_role_records();
