from sqlalchemy import DDL, event

# Создание партиционированной таблицы логов
create_partitioned_logs = """
-- Удаляем старую таблицу action_logs если она существует
DROP TABLE IF EXISTS action_logs CASCADE;

-- Создаем основную таблицу с партициями
CREATE TABLE action_logs (
    id SERIAL,
    table_name VARCHAR(50) NOT NULL,
    action_type VARCHAR(10) NOT NULL,
    record_id INTEGER,
    old_data TEXT,
    new_data TEXT,
    description TEXT,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Создаем партиции по месяцам
CREATE TABLE action_logs_2024_01 PARTITION OF action_logs
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE action_logs_2024_02 PARTITION OF action_logs
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE TABLE action_logs_2024_03 PARTITION OF action_logs
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');

-- И так далее для остальных месяцев...
"""

# Создание партиционированной таблицы приёмов
create_partitioned_appointments = """
-- Удаляем старую таблицу appointments если она существует
DROP TABLE IF EXISTS appointments CASCADE;

-- Создаём новую партиционированную таблицу
CREATE TABLE appointments (
    id SERIAL,
    patient_id INTEGER NOT NULL,
    doctor_id INTEGER NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_patient FOREIGN KEY (patient_id) REFERENCES patients(id),
    CONSTRAINT fk_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id)
) PARTITION BY RANGE (start_time);

-- Создаём партиции по кварталам
CREATE TABLE appointments_2024_q1 PARTITION OF appointments
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

CREATE TABLE appointments_2024_q2 PARTITION OF appointments
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');

CREATE TABLE appointments_2024_q3 PARTITION OF appointments
    FOR VALUES FROM ('2024-07-01') TO ('2024-10-01');

CREATE TABLE appointments_2024_q4 PARTITION OF appointments
    FOR VALUES FROM ('2024-10-01') TO ('2025-01-01');
"""

# Функция для автоматического создания новых партиций
create_partition_function = """
CREATE OR REPLACE FUNCTION create_partition_if_not_exists()
RETURNS TRIGGER AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    -- Для таблицы логов создаём месячные партиции
    IF TG_TABLE_NAME = 'action_logs' THEN
        partition_date := DATE_TRUNC('month', NEW.created_at);
        partition_name := 'action_logs_' || TO_CHAR(partition_date, 'YYYY_MM');
        start_date := partition_date;
        end_date := partition_date + INTERVAL '1 month';
    
    -- Для таблицы приёмов создаём квартальные партиции
    ELSIF TG_TABLE_NAME = 'appointments' THEN
        partition_date := DATE_TRUNC('quarter', NEW.start_time);
        partition_name := 'appointments_' || TO_CHAR(partition_date, 'YYYY') || '_q' || 
                         TO_CHAR(EXTRACT(QUARTER FROM partition_date), '9');
        start_date := partition_date;
        end_date := partition_date + INTERVAL '3 months';
    END IF;

    -- Проверяем существование партиции
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF %I
             FOR VALUES FROM (%L) TO (%L)',
            partition_name, TG_TABLE_NAME, start_date, end_date
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Создание триггеров для автоматического создания партиций
create_partition_triggers = """
-- Триггер для таблицы логов
DROP TRIGGER IF EXISTS action_logs_insert_trigger ON action_logs;
CREATE TRIGGER action_logs_insert_trigger
    BEFORE INSERT ON action_logs
    FOR EACH ROW
    EXECUTE FUNCTION create_partition_if_not_exists();

-- Триггер для таблицы приёмов
DROP TRIGGER IF EXISTS appointments_insert_trigger ON appointments;
CREATE TRIGGER appointments_insert_trigger
    BEFORE INSERT ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION create_partition_if_not_exists();
"""

def setup_partitions(engine):
    """
    Настройка партиционирования для таблиц
    """
    # Создание партиционированных таблиц
    engine.execute(create_partitioned_logs)
    engine.execute(create_partitioned_appointments)
    
    # Создание функции для автоматического создания партиций
    engine.execute(create_partition_function)
    
    # Создание триггеров
    engine.execute(create_partition_triggers)
