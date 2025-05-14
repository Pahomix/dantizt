-- Create Database
CREATE DATABASE dentist_db;

-- Connect to database
\c dentist_db

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'doctor', 'patient');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'completed', 'cancelled');
CREATE TYPE gender AS ENUM ('male', 'female', 'other');

-- Create tables
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE specializations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE doctors (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    specialization_id INTEGER REFERENCES specializations(id),
    experience_years INTEGER DEFAULT 0,
    education TEXT,
    about TEXT,
    UNIQUE(user_id)
);

CREATE TABLE doctor_schedules (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER REFERENCES doctors(id),
    work_start_time TIME NOT NULL,
    work_end_time TIME NOT NULL,
    lunch_start_time TIME,
    lunch_end_time TIME,
    working_days INTEGER[] NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    date_of_birth DATE,
    gender gender,
    phone VARCHAR(20),
    address TEXT,
    medical_history TEXT,
    UNIQUE(user_id)
);

CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    doctor_id INTEGER REFERENCES doctors(id),
    patient_id INTEGER REFERENCES patients(id),
    appointment_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration INTEGER NOT NULL, -- в минутах
    status appointment_status DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE services (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    cost DECIMAL(10,2) NOT NULL,
    duration INTEGER NOT NULL -- в минутах
);

CREATE TABLE medical_histories (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id),
    doctor_id INTEGER REFERENCES doctors(id),
    diagnosis TEXT NOT NULL,
    treatment TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE treatments (
    id SERIAL PRIMARY KEY,
    medical_history_id INTEGER REFERENCES medical_histories(id),
    service_id INTEGER REFERENCES services(id),
    start_date DATE,
    end_date DATE,
    status TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Создание индексов
CREATE INDEX idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_medical_histories_patient_id ON medical_histories(patient_id);
CREATE INDEX idx_treatments_medical_history_id ON treatments(medical_history_id);
CREATE INDEX idx_doctor_schedules_doctor_id ON doctor_schedules(doctor_id);

-- Добавление базовых специализаций
INSERT INTO specializations (name, description) VALUES
('Терапевт', 'Лечение зубов'),
('Ортодонт', 'Исправление прикуса'),
('Хирург', 'Удаление зубов'),
('Пародонтолог', 'Лечение дёсен');

-- Добавление администратора
INSERT INTO users (email, hashed_password, full_name, role) VALUES
('admin@example.com', 'hashed_password_here', 'Admin User', 'admin');

-- Функция для проверки доступности врача
CREATE OR REPLACE FUNCTION check_doctor_availability(
    doctor_id INTEGER,
    check_date TIMESTAMP
) RETURNS BOOLEAN AS $$
DECLARE
    schedule_exists INTEGER;
    is_working_day BOOLEAN;
BEGIN
    -- Проверяем, есть ли активное расписание
    SELECT COUNT(*) INTO schedule_exists
    FROM doctor_schedules
    WHERE doctor_id = $1 
    AND is_active = true
    AND EXTRACT(DOW FROM $2) = ANY(working_days);

    RETURN schedule_exists > 0;
END;
$$ LANGUAGE plpgsql;

-- Процедура создания записи на прием с проверками
CREATE OR REPLACE PROCEDURE create_appointment(
    p_doctor_id INTEGER,
    p_patient_id INTEGER,
    p_appointment_date TIMESTAMP,
    p_duration INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Проверяем доступность врача
    IF NOT check_doctor_availability(p_doctor_id, p_appointment_date) THEN
        RAISE EXCEPTION 'Doctor is not available at this time';
    END IF;

    -- Проверяем, нет ли пересечений с другими записями
    IF EXISTS (
        SELECT 1 FROM appointments
        WHERE doctor_id = p_doctor_id
        AND appointment_date BETWEEN p_appointment_date 
        AND p_appointment_date + (p_duration || ' minutes')::interval
    ) THEN
        RAISE EXCEPTION 'Time slot is already taken';
    END IF;

    -- Создаем запись
    INSERT INTO appointments (
        doctor_id,
        patient_id,
        appointment_date,
        duration,
        status
    ) VALUES (
        p_doctor_id,
        p_patient_id,
        p_appointment_date,
        p_duration,
        'scheduled'
    );
END;
$$;

-- Функция для расчета стоимости лечения
CREATE OR REPLACE FUNCTION calculate_treatment_cost(
    treatment_id INTEGER
) RETURNS DECIMAL AS $$
DECLARE
    total_cost DECIMAL(10,2) := 0;
BEGIN
    SELECT SUM(s.cost)
    INTO total_cost
    FROM treatments t
    JOIN services s ON s.id = ANY(t.service_ids)
    WHERE t.id = treatment_id;
    
    RETURN COALESCE(total_cost, 0);
END;
$$ LANGUAGE plpgsql;

-- Триггерная функция для логирования изменений в расписании
CREATE OR REPLACE FUNCTION log_schedule_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO action_logs (
        user_id,
        action_type,
        table_name,
        record_id,
        description
    ) VALUES (
        current_user_id()
        CASE
            WHEN TG_OP = 'INSERT' THEN 'SCHEDULE_CREATED'
            WHEN TG_OP = 'UPDATE' THEN 'SCHEDULE_UPDATED'
            WHEN TG_OP = 'DELETE' THEN 'SCHEDULE_DELETED'
        END,
        'doctor_schedules',
        COALESCE(NEW.id, OLD.id),
        'Schedule changed for doctor ' || COALESCE(NEW.doctor_id::text, OLD.doctor_id::text)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Создание триггера
CREATE TRIGGER schedule_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON doctor_schedules
FOR EACH ROW EXECUTE FUNCTION log_schedule_changes();

-- Транзакционная процедура создания врача с расписанием
CREATE OR REPLACE PROCEDURE create_doctor_with_schedule(
    p_user_id INTEGER,
    p_specialization_id INTEGER,
    p_experience_years INTEGER,
    p_education TEXT,
    p_about TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_doctor_id INTEGER;
BEGIN
    -- Начало транзакции
    BEGIN
        -- Создание врача
        INSERT INTO doctors (
            user_id,
            specialization_id,
            experience_years,
            education,
            about
        ) VALUES (
            p_user_id,
            p_specialization_id,
            p_experience_years,
            p_education,
            p_about
        ) RETURNING id INTO v_doctor_id;

        -- Создание стандартного расписания
        INSERT INTO doctor_schedules (
            doctor_id,
            work_start_time,
            work_end_time,
            lunch_start_time,
            lunch_end_time,
            working_days,
            is_active
        ) VALUES (
            v_doctor_id,
            '09:00'::time,
            '18:00'::time,
            '13:00'::time,
            '14:00'::time,
            ARRAY[1,2,3,4,5],
            true
        );

        -- Если все успешно - коммит
        COMMIT;
    EXCEPTION WHEN OTHERS THEN
        -- В случае ошибки - откат
        ROLLBACK;
        RAISE;
    END;
END;
$$;