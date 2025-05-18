from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

# Триггер для логирования изменений в таблицах
create_audit_trigger = """
CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER 
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO action_logs (
        table_name,
        action_type,
        record_id,
        old_data,
        new_data,
        created_at,
        updated_at
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        CASE
            WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)::text
            WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD)::text
            ELSE NULL
        END,
        CASE
            WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::text
            ELSE NULL
        END,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );
    RETURN NEW;
END;
$$;
"""

# Триггер для управления правами пользователей
create_user_permissions_trigger = """
CREATE OR REPLACE FUNCTION set_user_permissions()
RETURNS TRIGGER AS $$
BEGIN
    -- Логируем входные данные
    RAISE NOTICE 'set_user_permissions triggered: op=%, role=%, is_active=%, email_verified=%, token=%', 
        TG_OP, NEW.role, NEW.is_active, NEW.email_verified, NEW.email_verification_token;

    -- При создании нового пользователя
    IF TG_OP = 'INSERT' THEN
        -- Для админа сразу активируем
        IF NEW.role = 'admin' AND NEW.is_active IS NULL THEN
            NEW.is_active = true;
            NEW.email_verified = true;
            NEW.email_verification_token = NULL;
            RAISE NOTICE 'Admin user: setting is_active=true, email_verified=true';
        -- Для остальных пользователей проверяем, не установлены ли значения
        ELSIF NEW.is_active IS NULL THEN
            NEW.is_active = false;
            NEW.email_verified = false;
            -- Генерируем токен для верификации email
            NEW.email_verification_token = encode(gen_random_bytes(32), 'hex');
            RAISE NOTICE 'Regular user: setting is_active=false, email_verified=false';
        ELSE
            RAISE NOTICE 'Values already set: is_active=%, email_verified=%', NEW.is_active, NEW.email_verified;
        END IF;
    -- При обновлении пользователя
    ELSIF TG_OP = 'UPDATE' THEN
        -- Если email подтвержден, активируем пользователя и очищаем токен
        IF NEW.email_verified = true AND OLD.email_verified = false AND NEW.role != 'admin' THEN
            NEW.is_active = true;
            NEW.email_verification_token = NULL;
            RAISE NOTICE 'Email verified: setting is_active=true';
        END IF;
    END IF;
    
    -- Обновляем updated_at при любом изменении
    NEW.updated_at := CURRENT_TIMESTAMP;
    
    -- Логируем результат
    RAISE NOTICE 'Final state: is_active=%, email_verified=%, token=%', NEW.is_active, NEW.email_verified, NEW.email_verification_token;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для обновления рейтинга врача
create_doctor_rating_trigger = """
CREATE OR REPLACE FUNCTION update_doctor_rating()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE doctors
        SET average_rating = (
            SELECT AVG(rating)::numeric(3,2)
            FROM doctor_reviews
            WHERE doctor_id = NEW.doctor_id
        ),
        rating_count = rating_count + 1
        WHERE id = NEW.doctor_id;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE doctors
        SET average_rating = (
            SELECT AVG(rating)::numeric(3,2)
            FROM doctor_reviews
            WHERE doctor_id = NEW.doctor_id
        )
        WHERE id = NEW.doctor_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE doctors
        SET average_rating = COALESCE((
            SELECT AVG(rating)::numeric(3,2)
            FROM doctor_reviews
            WHERE doctor_id = OLD.doctor_id
        ), 0),
        rating_count = rating_count - 1
        WHERE id = OLD.doctor_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для обновления стоимости лечения
create_treatment_cost_trigger = """
CREATE OR REPLACE FUNCTION update_treatment_cost()
RETURNS TRIGGER AS $$
BEGIN
    -- Получаем стоимость услуги
    SELECT cost INTO NEW.total_cost
    FROM services
    WHERE id = NEW.service_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для обновления статуса оплаты
create_payment_status_trigger = """
CREATE OR REPLACE FUNCTION update_payment_status()
RETURNS TRIGGER AS $$
DECLARE
    v_total_paid NUMERIC;
    v_total_cost NUMERIC;
BEGIN
    -- Получаем общую сумму оплат
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM payments
    WHERE treatment_id = NEW.treatment_id AND status = 'completed';
    
    -- Получаем общую стоимость лечения
    SELECT total_cost
    INTO v_total_cost
    FROM treatments
    WHERE id = NEW.treatment_id;

    -- Обновляем статус оплаты
    IF v_total_paid >= v_total_cost THEN
        UPDATE treatments
        SET payment_status = 'paid'
        WHERE id = NEW.treatment_id;
    ELSE
        UPDATE treatments
        SET payment_status = 'partially_paid'
        WHERE id = NEW.treatment_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для обновления статуса плана лечения
create_treatment_plan_status_trigger = """
CREATE OR REPLACE FUNCTION update_treatment_plan_status()
RETURNS TRIGGER AS $$
DECLARE
    v_total_steps INTEGER;
    v_completed_steps INTEGER;
BEGIN
    -- Получаем общее количество шагов и количество завершенных шагов
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed')
    INTO v_total_steps, v_completed_steps
    FROM treatment_steps
    WHERE treatment_plan_id = NEW.treatment_plan_id;
    
    -- Обновляем статус плана лечения
    IF v_completed_steps = v_total_steps THEN
        UPDATE treatment_plans
        SET 
            status = 'completed',
            completed_at = CURRENT_TIMESTAMP
        WHERE id = NEW.treatment_plan_id;
    ELSIF v_completed_steps > 0 THEN
        UPDATE treatment_plans
        SET status = 'in_progress'
        WHERE id = NEW.treatment_plan_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для обновления статуса приема
create_appointment_status_trigger = """
CREATE OR REPLACE FUNCTION update_appointment_status()
RETURNS TRIGGER AS $$
DECLARE
    v_total_treatments INTEGER;
    v_completed_treatments INTEGER;
BEGIN
    -- Если создается медицинская запись, меняем статус на in_progress
    IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'medical_records' THEN
        UPDATE appointments
        SET status = 'in_progress'::appointmentstatus
        WHERE id = NEW.appointment_id;
        RETURN NEW;
    
    -- Если это изменение в treatments, проверяем завершение всех процедур
    ELSIF TG_TABLE_NAME = 'treatments' AND TG_OP IN ('INSERT', 'UPDATE') THEN
        -- Получаем общее количество процедур и количество завершенных
        SELECT 
            COUNT(*),
            COUNT(*) FILTER (WHERE status = 'completed')
        INTO v_total_treatments, v_completed_treatments
        FROM treatments
        WHERE appointment_id = NEW.appointment_id;
        
        -- Если все процедуры завершены, меняем статус на completed
        IF v_total_treatments > 0 AND v_total_treatments = v_completed_treatments THEN
            UPDATE appointments
            SET status = 'completed'::appointmentstatus
            WHERE id = NEW.appointment_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для автоматического создания уведомлений
create_notification_trigger = """
CREATE OR REPLACE FUNCTION create_notifications()
RETURNS TRIGGER AS $$
BEGIN
    -- При создании приема создаем уведомление о напоминании
    IF TG_TABLE_NAME = 'appointments' AND TG_OP = 'INSERT' THEN
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            is_read,
            created_at
        )
        SELECT 
            p.user_id,
            'reminder',
            'Напоминание о приеме',
            'Напоминаем о предстоящем приеме ' || NEW.start_time::text,
            false,
            CURRENT_TIMESTAMP
        FROM patients p
        WHERE p.id = NEW.patient_id;
    
    -- При создании платежа создаем уведомление
    ELSIF TG_TABLE_NAME = 'payments' AND TG_OP = 'INSERT' THEN
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            is_read,
            created_at
        )
        SELECT 
            p.user_id,
            'payment_due',
            'Платеж получен',
            'Получен платеж на сумму ' || NEW.amount::text || ' руб.',
            false,
            CURRENT_TIMESTAMP
        FROM treatments t
        JOIN patients p ON t.patient_id = p.id
        WHERE t.id = NEW.treatment_id;
    
    -- При завершении лечения создаем уведомление о follow-up
    ELSIF TG_TABLE_NAME = 'treatments' AND TG_OP = 'UPDATE' AND NEW.status = 'completed' THEN
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            is_read,
            created_at
        )
        SELECT 
            p.user_id,
            'treatment_followup',
            'Контрольный осмотр',
            'Ваше лечение завершено. Пожалуйста, запишитесь на контрольный осмотр.',
            false,
            CURRENT_TIMESTAMP
        FROM patients p
        WHERE p.id = NEW.patient_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для создания записи в медицинской истории при изменении диагноза
create_diagnosis_history_trigger = """
CREATE OR REPLACE FUNCTION update_diagnosis_history()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        INSERT INTO medical_histories (
            patient_id,
            diagnosis,
            treatment_plan,
            notes,
            date
        ) VALUES (
            NEW.patient_id,
            NEW.name || ' (' || NEW.code || ')',
            'Статус изменен с ' || OLD.status || ' на ' || NEW.status,
            NEW.notes,
            CURRENT_DATE
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для проверки пересечений в расписании врача
create_schedule_overlap_trigger = """
CREATE OR REPLACE FUNCTION check_schedule_overlap()
RETURNS TRIGGER AS $$
DECLARE
    doctor_schedule record;
BEGIN
    -- Проверяем пересечения с другими расписаниями
    SELECT * FROM doctor_schedules
    WHERE doctor_id = NEW.doctor_id
    AND day_of_week = EXTRACT(DOW FROM NEW.start_time)
    AND is_active = true
    INTO doctor_schedule;
    
    -- Проверяем, что время записи входит в рабочее время врача
    IF doctor_schedule IS NULL OR 
       EXTRACT(HOUR FROM NEW.start_time) < EXTRACT(HOUR FROM doctor_schedule.start_time) OR 
       EXTRACT(HOUR FROM NEW.end_time) > EXTRACT(HOUR FROM doctor_schedule.end_time) OR
       (EXTRACT(HOUR FROM NEW.start_time) = EXTRACT(HOUR FROM doctor_schedule.start_time) AND 
        EXTRACT(MINUTE FROM NEW.start_time) < EXTRACT(MINUTE FROM doctor_schedule.start_time)) OR
       (EXTRACT(HOUR FROM NEW.end_time) = EXTRACT(HOUR FROM doctor_schedule.end_time) AND 
        EXTRACT(MINUTE FROM NEW.end_time) > EXTRACT(MINUTE FROM doctor_schedule.end_time)) THEN
        RAISE EXCEPTION 'Обнаружено пересечение в расписании врача';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для создания записей врача и пациента при создании пользователя
create_role_records_trigger = """
CREATE OR REPLACE FUNCTION create_role_records()
RETURNS TRIGGER AS $$
BEGIN
    -- Логируем входные данные
    RAISE NOTICE 'create_role_records triggered: op=%, old_role=%, new_role=%, user_id=%, is_active=%', 
        TG_OP, 
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.role::text ELSE NULL END,
        NEW.role::text,
        NEW.id,
        NEW.is_active;
        
    -- При создании нового пользователя или обновлении роли
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.role != NEW.role) THEN
        -- Если роль пациент
        IF NEW.role = 'patient' THEN
            -- Проверяем, существует ли уже запись пациента для этого пользователя
            IF NOT EXISTS (SELECT 1 FROM patients WHERE user_id = NEW.id) THEN
                -- Проверяем, есть ли уже данные пациента в запросе
                -- Если есть, то не создаем запись - это будет сделано в коде
                -- Эта проверка предотвращает конфликты между триггером и кодом
                RAISE NOTICE 'Checking if patient data exists in temporary table for user_id=%', NEW.id;
                
                -- Создаем пустую запись пациента
                -- Данные будут заполнены в коде API
                RAISE NOTICE 'Creating empty patient record for user_id=%', NEW.id;
                
                -- Используем INSERT ... ON CONFLICT для предотвращения конфликтов
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
                )
                ON CONFLICT (user_id) DO NOTHING;
                RAISE NOTICE 'Created patient record for user_id=%', NEW.id;
            ELSE
                RAISE NOTICE 'Patient record already exists for user_id=%', NEW.id;
            END IF;
        -- Если роль доктор
        ELSIF NEW.role = 'doctor' THEN
            -- Проверяем, существует ли уже запись доктора для этого пользователя
            IF NOT EXISTS (SELECT 1 FROM doctors WHERE user_id = NEW.id) THEN
                INSERT INTO doctors (
                    user_id,
                    specialization_id,
                    experience_years,
                    education,
                    bio,
                    average_rating,
                    rating_count,
                    is_available,
                    created_at,
                    updated_at
                ) VALUES (
                    NEW.id,
                    1, -- Используем ID первой специализации (Терапевт)
                    0,
                    NULL,
                    NULL,
                    0.0,
                    0,
                    TRUE,
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
"""

# Триггер для автоматического создания уведомлений при создании/изменении записи на прием
create_appointment_notification_trigger = """
CREATE OR REPLACE FUNCTION handle_appointment_notifications()
RETURNS TRIGGER AS $$
BEGIN
    -- При создании новой записи
    IF TG_OP = 'INSERT' THEN
        -- Уведомление для врача
        INSERT INTO notifications (
            user_id, 
            type,
            title, 
            message, 
            is_read,
            created_at
        )
        SELECT 
            d.user_id,
            'reminder',
            'Новая запись на прием',
            'К вам записался пациент ' || u.full_name || ' на ' || NEW.start_time::text,
            false,
            CURRENT_TIMESTAMP
        FROM doctors d
        JOIN users u ON u.id = (SELECT user_id FROM patients WHERE id = NEW.patient_id)
        WHERE d.id = NEW.doctor_id;

        -- Уведомление для пациента
        INSERT INTO notifications (
            user_id, 
            type,
            title, 
            message, 
            is_read,
            created_at
        )
        SELECT 
            p.user_id,
            'reminder',
            'Запись подтверждена',
            'Вы записаны к врачу ' || u.full_name || ' на ' || NEW.start_time::text,
            false,
            CURRENT_TIMESTAMP
        FROM patients p
        JOIN doctors d ON d.id = NEW.doctor_id
        JOIN users u ON u.id = d.user_id
        WHERE p.id = NEW.patient_id;
    
    -- При изменении статуса записи
    ELSIF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
        -- Уведомление для пациента о изменении статуса
        INSERT INTO notifications (
            user_id, 
            type,
            title, 
            message, 
            is_read,
            created_at
        )
        SELECT 
            p.user_id,
            'system',
            'Статус записи изменен',
            'Статус вашей записи к врачу ' || u.full_name || ' изменен на ' || NEW.status,
            false,
            CURRENT_TIMESTAMP
        FROM patients p
        JOIN doctors d ON d.id = NEW.doctor_id
        JOIN users u ON u.id = d.user_id
        WHERE p.id = NEW.patient_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для автоматического создания медицинской карты при первом приеме
create_medical_record_trigger = """
CREATE OR REPLACE FUNCTION create_initial_medical_record()
RETURNS TRIGGER AS $$
BEGIN
    -- При создании новой записи на прием
    IF TG_OP = 'INSERT' THEN
        -- Проверка на наличие медицинских записей больше не нужна
        -- Первичный осмотр больше не создается автоматически
        NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для обновления статуса приема при создании медицинской записи
create_appointment_completion_trigger = """
CREATE OR REPLACE FUNCTION update_appointment_status_on_record()
RETURNS TRIGGER AS $$
BEGIN
    -- При создании медицинской записи обновляем статус приема на "completed"
    IF TG_OP = 'INSERT' AND NEW.appointment_id IS NOT NULL AND NEW.record_type = 'examination'::recordtype THEN
        UPDATE appointments
        SET status = 'completed'::appointmentstatus,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.appointment_id
        AND status != 'completed'::appointmentstatus;

        -- Создаем уведомление о завершении приема
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            is_read,
            created_at
        )
        SELECT 
            p.user_id,
            'system',
            'Прием завершен',
            'Ваш прием у врача ' || u.full_name || ' завершен',
            false,
            CURRENT_TIMESTAMP
        FROM appointments a
        JOIN patients p ON p.id = a.patient_id
        JOIN doctors d ON d.id = a.doctor_id
        JOIN users u ON u.id = d.user_id
        WHERE a.id = NEW.appointment_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для автоматического обновления времени изменения
create_update_timestamp_trigger = """
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для проверки времени работы врача
create_working_hours_check_trigger = """
CREATE OR REPLACE FUNCTION check_working_hours()
RETURNS TRIGGER AS $$
DECLARE
    doctor_schedule record;
BEGIN
    -- Получаем расписание врача на день недели записи
    SELECT * FROM doctor_schedules
    WHERE doctor_id = NEW.doctor_id
    AND day_of_week = EXTRACT(DOW FROM NEW.start_time)
    INTO doctor_schedule;
    
    -- Проверяем, что время записи входит в рабочее время врача
    IF doctor_schedule IS NULL OR 
       EXTRACT(HOUR FROM NEW.start_time) < EXTRACT(HOUR FROM doctor_schedule.start_time) OR 
       EXTRACT(HOUR FROM NEW.end_time) > EXTRACT(HOUR FROM doctor_schedule.end_time) OR
       (EXTRACT(HOUR FROM NEW.start_time) = EXTRACT(HOUR FROM doctor_schedule.start_time) AND 
        EXTRACT(MINUTE FROM NEW.start_time) < EXTRACT(MINUTE FROM doctor_schedule.start_time)) OR
       (EXTRACT(HOUR FROM NEW.end_time) = EXTRACT(HOUR FROM doctor_schedule.end_time) AND 
        EXTRACT(MINUTE FROM NEW.end_time) > EXTRACT(MINUTE FROM doctor_schedule.end_time)) THEN
        RAISE EXCEPTION 'Время записи находится вне рабочих часов врача';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер обновления статуса лечения
create_treatment_status_update_trigger = """
CREATE OR REPLACE FUNCTION update_treatment_status()
RETURNS TRIGGER AS $$
DECLARE
    total_steps INTEGER;
    completed_steps INTEGER;
BEGIN
    -- Подсчитываем общее количество шагов и выполненных шагов
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed')
    INTO total_steps, completed_steps
    FROM treatment_steps
    WHERE treatment_plan_id = NEW.treatment_plan_id;
    
    -- Обновляем статус плана лечения
    IF completed_steps = total_steps THEN
        UPDATE treatment_plans
        SET status = 'completed',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.treatment_plan_id;
        
        -- Создаем уведомление о завершении лечения
        INSERT INTO notifications (
            user_id, 
            type,
            title, 
            message, 
            is_read,
            created_at
        )
        SELECT 
            p.user_id,
            'treatment_followup',
            'Лечение завершено',
            'План лечения полностью выполнен',
            false,
            CURRENT_TIMESTAMP
        FROM treatment_plans tp
        JOIN medical_records mr ON mr.id = tp.medical_record_id
        JOIN patients p ON p.id = mr.patient_id
        WHERE tp.id = NEW.treatment_plan_id;
    ELSIF completed_steps > 0 THEN
        UPDATE treatment_plans
        SET status = 'in_progress',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.treatment_plan_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для создания платежа при завершении приема
create_payment_on_completion_trigger = """
CREATE OR REPLACE FUNCTION create_payment_on_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_record record;
    v_total_cost numeric(10,2) := 0;
    v_service_names text := 'Консультация';
    v_services_found boolean := false;
    v_service_id integer;
    v_service_cost numeric(10,2);
    v_service_name text;
BEGIN
    -- Если статус изменился на "completed"
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Добавляем логирование для отладки
        RAISE NOTICE 'Триггер create_payment_on_completion запущен для appointment_id=%', NEW.id;
        
        -- Проверяем, есть ли услуги в appointment_services
        -- Используем FOR цикл для обхода всех услуг
        FOR v_record IN 
            SELECT s.id, s.name, s.cost
            FROM appointment_services aps
            JOIN services s ON s.id = aps.service_id
            WHERE aps.appointment_id = NEW.id
        LOOP
            v_services_found := true;
            v_total_cost := v_total_cost + v_record.cost;
            
            -- Добавляем имя услуги в список
            IF v_service_names = 'Консультация' THEN
                v_service_names := v_record.name;
            ELSE
                v_service_names := v_service_names || ', ' || v_record.name;
            END IF;
            
            RAISE NOTICE 'Найдена услуга: %, стоимость: %', v_record.name, v_record.cost;
        END LOOP;
        
        -- Если услуги не найдены в appointment_services, проверяем старое поле service_id
        IF NOT v_services_found AND NEW.service_id IS NOT NULL THEN
            SELECT id, name, cost INTO v_service_id, v_service_name, v_service_cost
            FROM services
            WHERE id = NEW.service_id;
            
            IF v_service_id IS NOT NULL THEN
                v_services_found := true;
                v_service_names := v_service_name;
                v_total_cost := v_service_cost;
                RAISE NOTICE 'Найдена услуга по service_id: %, стоимость: %', v_service_names, v_total_cost;
            END IF;
        END IF;
        
        -- Если услуги все равно не найдены, выводим сообщение
        IF NOT v_services_found THEN
            RAISE NOTICE 'Услуги не найдены, создаем платеж с нулевой суммой';
        END IF;
        
        -- Создаем новый платеж со статусом "pending"
        INSERT INTO payments (
            patient_id,
            doctor_id,
            appointment_id,
            amount,
            status,
            payment_method
        )
        VALUES (
            NEW.patient_id,
            NEW.doctor_id,
            NEW.id,
            v_total_cost,
            'pending'::paymentstatus,
            'card'::paymentmethod
        );
        
        RAISE NOTICE 'Платеж создан для appointment_id=%, amount=%', NEW.id, v_total_cost;

        -- Создаем уведомление о необходимости оплаты
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            is_read,
            created_at
        )
        SELECT 
            p.user_id,
            'payment',
            'Требуется оплата',
            'Необходимо оплатить услуги: ' || v_service_names || ' у врача ' || u.full_name || ' на сумму ' || v_total_cost || ' руб.',
            false,
            CURRENT_TIMESTAMP
        FROM patients p
        JOIN doctors d ON d.id = NEW.doctor_id
        JOIN users u ON u.id = d.user_id
        WHERE p.id = NEW.patient_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для проверки рабочих часов
create_schedule_overlap_trigger = """
CREATE OR REPLACE FUNCTION check_schedule_overlap()
RETURNS TRIGGER AS $$
DECLARE
    doctor_schedule record;
BEGIN
    -- Проверяем пересечения с другими расписаниями
    SELECT * FROM doctor_schedules
    WHERE doctor_id = NEW.doctor_id
    AND day_of_week = EXTRACT(DOW FROM NEW.start_time)
    AND is_active = true
    INTO doctor_schedule;
    
    -- Проверяем, что время записи входит в рабочее время врача
    IF doctor_schedule IS NULL OR 
       EXTRACT(HOUR FROM NEW.start_time) < EXTRACT(HOUR FROM doctor_schedule.start_time) OR 
       EXTRACT(HOUR FROM NEW.end_time) > EXTRACT(HOUR FROM doctor_schedule.end_time) OR
       (EXTRACT(HOUR FROM NEW.start_time) = EXTRACT(HOUR FROM doctor_schedule.start_time) AND 
        EXTRACT(MINUTE FROM NEW.start_time) < EXTRACT(MINUTE FROM doctor_schedule.start_time)) OR
       (EXTRACT(HOUR FROM NEW.end_time) = EXTRACT(HOUR FROM doctor_schedule.end_time) AND 
        EXTRACT(MINUTE FROM NEW.end_time) > EXTRACT(MINUTE FROM doctor_schedule.end_time)) THEN
        RAISE EXCEPTION 'Обнаружено пересечение в расписании врача';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для создания записей врача и пациента при создании пользователя
create_role_records_trigger = """
CREATE OR REPLACE FUNCTION create_role_records()
RETURNS TRIGGER AS $$
BEGIN
    -- Логируем входные данные
    RAISE NOTICE 'create_role_records triggered: op=%, old_role=%, new_role=%, user_id=%, is_active=%', 
        TG_OP, 
        CASE WHEN TG_OP = 'UPDATE' THEN OLD.role::text ELSE NULL END,
        NEW.role::text,
        NEW.id,
        NEW.is_active;
        
    -- При создании нового пользователя или обновлении роли
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.role != NEW.role) THEN
        -- Если роль пациент
        IF NEW.role = 'patient' THEN
            -- Проверяем, существует ли уже запись пациента для этого пользователя
            IF NOT EXISTS (SELECT 1 FROM patients WHERE user_id = NEW.id) THEN
                -- Проверяем, есть ли уже данные пациента в запросе
                -- Если есть, то не создаем запись - это будет сделано в коде
                -- Эта проверка предотвращает конфликты между триггером и кодом
                RAISE NOTICE 'Checking if patient data exists in temporary table for user_id=%', NEW.id;
                
                -- Создаем пустую запись пациента
                -- Данные будут заполнены в коде API
                RAISE NOTICE 'Creating empty patient record for user_id=%', NEW.id;
                
                -- Используем INSERT ... ON CONFLICT для предотвращения конфликтов
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
                )
                ON CONFLICT (user_id) DO NOTHING;
                RAISE NOTICE 'Created patient record for user_id=%', NEW.id;
            ELSE
                RAISE NOTICE 'Patient record already exists for user_id=%', NEW.id;
            END IF;
        -- Если роль доктор
        ELSIF NEW.role = 'doctor' THEN
            -- Проверяем, существует ли уже запись доктора для этого пользователя
            IF NOT EXISTS (SELECT 1 FROM doctors WHERE user_id = NEW.id) THEN
                INSERT INTO doctors (
                    user_id,
                    specialization_id,
                    experience_years,
                    education,
                    bio,
                    average_rating,
                    rating_count,
                    is_available,
                    created_at,
                    updated_at
                ) VALUES (
                    NEW.id,
                    1, -- Используем ID первой специализации (Терапевт)
                    0,
                    NULL,
                    NULL,
                    0.0,
                    0,
                    TRUE,
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
"""

# Триггер для автоматического создания уведомлений при создании/изменении записи на прием
create_appointment_notification_trigger = """
CREATE OR REPLACE FUNCTION handle_appointment_notifications()
RETURNS TRIGGER AS $$
BEGIN
    -- При создании новой записи
    IF TG_OP = 'INSERT' THEN
        -- Уведомление для врача
        INSERT INTO notifications (
            user_id, 
            type,
            title, 
            message, 
            is_read,
            created_at
        )
        SELECT 
            d.user_id,
            'reminder',
            'Новая запись на прием',
            'К вам записался пациент ' || u.full_name || ' на ' || NEW.start_time::text,
            false,
            CURRENT_TIMESTAMP
        FROM doctors d
        JOIN users u ON u.id = (SELECT user_id FROM patients WHERE id = NEW.patient_id)
        WHERE d.id = NEW.doctor_id;

        -- Уведомление для пациента
        INSERT INTO notifications (
            user_id, 
            type,
            title, 
            message, 
            is_read,
            created_at
        )
        SELECT 
            p.user_id,
            'reminder',
            'Запись подтверждена',
            'Вы записаны к врачу ' || u.full_name || ' на ' || NEW.start_time::text,
            false,
            CURRENT_TIMESTAMP
        FROM patients p
        JOIN doctors d ON d.id = NEW.doctor_id
        JOIN users u ON u.id = d.user_id
        WHERE p.id = NEW.patient_id;
    
    -- При изменении статуса записи
    ELSIF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
        -- Уведомление для пациента о изменении статуса
        INSERT INTO notifications (
            user_id, 
            type,
            title, 
            message, 
            is_read,
            created_at
        )
        SELECT 
            p.user_id,
            'system',
            'Статус записи изменен',
            'Статус вашей записи к врачу ' || u.full_name || ' изменен на ' || NEW.status,
            false,
            CURRENT_TIMESTAMP
        FROM patients p
        JOIN doctors d ON d.id = NEW.doctor_id
        JOIN users u ON u.id = d.user_id
        WHERE p.id = NEW.patient_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для автоматического создания медицинской карты при первом приеме
create_medical_record_trigger = """
CREATE OR REPLACE FUNCTION create_initial_medical_record()
RETURNS TRIGGER AS $$
BEGIN
    -- При создании новой записи на прием
    IF TG_OP = 'INSERT' THEN
        -- Проверка на наличие медицинских записей больше не нужна
        -- Первичный осмотр больше не создается автоматически
        NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для обновления статуса приема при создании медицинской записи
create_appointment_completion_trigger = """
CREATE OR REPLACE FUNCTION update_appointment_status_on_record()
RETURNS TRIGGER AS $$
BEGIN
    -- При создании медицинской записи обновляем статус приема на "completed"
    IF TG_OP = 'INSERT' AND NEW.appointment_id IS NOT NULL AND NEW.record_type = 'examination'::recordtype THEN
        UPDATE appointments
        SET status = 'completed'::appointmentstatus,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.appointment_id
        AND status != 'completed'::appointmentstatus;

        -- Создаем уведомление о завершении приема
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            is_read,
            created_at
        )
        SELECT 
            p.user_id,
            'system',
            'Прием завершен',
            'Ваш прием у врача ' || u.full_name || ' завершен',
            false,
            CURRENT_TIMESTAMP
        FROM appointments a
        JOIN patients p ON p.id = a.patient_id
        JOIN doctors d ON d.id = a.doctor_id
        JOIN users u ON u.id = d.user_id
        WHERE a.id = NEW.appointment_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для автоматического обновления времени изменения
create_update_timestamp_trigger = """
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для проверки времени работы врача
create_working_hours_check_trigger = """
CREATE OR REPLACE FUNCTION check_working_hours()
RETURNS TRIGGER AS $$
DECLARE
    doctor_schedule record;
BEGIN
    -- Получаем расписание врача на день недели записи
    SELECT * FROM doctor_schedules
    WHERE doctor_id = NEW.doctor_id
    AND day_of_week = EXTRACT(DOW FROM NEW.start_time)
    INTO doctor_schedule;
    
    -- Проверяем, что время записи входит в рабочее время врача
    IF doctor_schedule IS NULL OR 
       EXTRACT(HOUR FROM NEW.start_time) < EXTRACT(HOUR FROM doctor_schedule.start_time) OR 
       EXTRACT(HOUR FROM NEW.end_time) > EXTRACT(HOUR FROM doctor_schedule.end_time) OR
       (EXTRACT(HOUR FROM NEW.start_time) = EXTRACT(HOUR FROM doctor_schedule.start_time) AND 
        EXTRACT(MINUTE FROM NEW.start_time) < EXTRACT(MINUTE FROM doctor_schedule.start_time)) OR
       (EXTRACT(HOUR FROM NEW.end_time) = EXTRACT(HOUR FROM doctor_schedule.end_time) AND 
        EXTRACT(MINUTE FROM NEW.end_time) > EXTRACT(MINUTE FROM doctor_schedule.end_time)) THEN
        RAISE EXCEPTION 'Время записи находится вне рабочих часов врача';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер обновления статуса лечения
create_treatment_status_update_trigger = """
CREATE OR REPLACE FUNCTION update_treatment_status()
RETURNS TRIGGER AS $$
DECLARE
    total_steps INTEGER;
    completed_steps INTEGER;
BEGIN
    -- Подсчитываем общее количество шагов и выполненных шагов
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'completed')
    INTO total_steps, completed_steps
    FROM treatment_steps
    WHERE treatment_plan_id = NEW.treatment_plan_id;
    
    -- Обновляем статус плана лечения
    IF completed_steps = total_steps THEN
        UPDATE treatment_plans
        SET status = 'completed',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.treatment_plan_id;
        
        -- Создаем уведомление о завершении лечения
        INSERT INTO notifications (
            user_id, 
            type,
            title, 
            message, 
            is_read,
            created_at
        )
        SELECT 
            p.user_id,
            'treatment_followup',
            'Лечение завершено',
            'План лечения полностью выполнен',
            false,
            CURRENT_TIMESTAMP
        FROM treatment_plans tp
        JOIN medical_records mr ON mr.id = tp.medical_record_id
        JOIN patients p ON p.id = mr.patient_id
        WHERE tp.id = NEW.treatment_plan_id;
    ELSIF completed_steps > 0 THEN
        UPDATE treatment_plans
        SET status = 'in_progress',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.treatment_plan_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

# Триггер для создания платежа при завершении приема
create_payment_on_completion_trigger = """
CREATE OR REPLACE FUNCTION create_payment_on_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_record record;
    v_total_cost numeric(10,2) := 0;
    v_service_names text := 'Консультация';
    v_services_found boolean := false;
    v_service_id integer;
    v_service_cost numeric(10,2);
    v_service_name text;
    v_payment_exists boolean := false;
BEGIN
    -- Если статус изменился на "completed"
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Добавляем логирование для отладки
        RAISE NOTICE 'Триггер create_payment_on_completion запущен для appointment_id=%', NEW.id;
        
        -- Проверяем, существует ли уже платеж для этого приема
        PERFORM 1 FROM payments WHERE appointment_id = NEW.id;
        IF FOUND THEN
            RAISE NOTICE 'Платеж для appointment_id=% уже существует, новый платеж не создается', NEW.id;
            v_payment_exists := true;
        END IF;
        
        -- Если платеж не существует, создаем новый
        IF NOT v_payment_exists THEN
            -- Проверяем, есть ли услуги в appointment_services
            -- Используем FOR цикл для обхода всех услуг
            FOR v_record IN 
                SELECT s.id, s.name, s.cost
                FROM appointment_services aps
                JOIN services s ON s.id = aps.service_id
                WHERE aps.appointment_id = NEW.id
            LOOP
                v_services_found := true;
                v_total_cost := v_total_cost + v_record.cost;
                
                -- Добавляем имя услуги в список
                IF v_service_names = 'Консультация' THEN
                    v_service_names := v_record.name;
                ELSE
                    v_service_names := v_service_names || ', ' || v_record.name;
                END IF;
                
                RAISE NOTICE 'Найдена услуга: %, стоимость: %', v_record.name, v_record.cost;
            END LOOP;
            
            -- Если услуги не найдены в appointment_services, проверяем старое поле service_id
            IF NOT v_services_found AND NEW.service_id IS NOT NULL THEN
                SELECT id, name, cost INTO v_service_id, v_service_name, v_service_cost
                FROM services
                WHERE id = NEW.service_id;
                
                IF v_service_id IS NOT NULL THEN
                    v_services_found := true;
                    v_service_names := v_service_name;
                    v_total_cost := v_service_cost;
                    RAISE NOTICE 'Найдена услуга по service_id: %, стоимость: %', v_service_names, v_total_cost;
                END IF;
            END IF;
            
            -- Если услуги все равно не найдены, выводим сообщение
            IF NOT v_services_found THEN
                RAISE NOTICE 'Услуги не найдены, создаем платеж с нулевой суммой';
            END IF;
            
            -- Создаем новый платеж со статусом "pending"
            INSERT INTO payments (
                patient_id,
                doctor_id,
                appointment_id,
                amount,
                status,
                payment_method
            )
            VALUES (
                NEW.patient_id,
                NEW.doctor_id,
                NEW.id,
                v_total_cost,
                'pending'::paymentstatus,
                'card'::paymentmethod
            );
            
            RAISE NOTICE 'Платеж создан для appointment_id=%, amount=%', NEW.id, v_total_cost;

            -- Создаем уведомление о необходимости оплаты
            INSERT INTO notifications (
                user_id,
                type,
                title,
                message,
                is_read,
                created_at
            )
            SELECT 
                p.user_id,
                'payment',
                'Требуется оплата',
                'Необходимо оплатить услуги: ' || v_service_names || ' у врача ' || u.full_name || ' на сумму ' || v_total_cost || ' руб.',
                false,
                CURRENT_TIMESTAMP
            FROM patients p
            JOIN doctors d ON d.id = NEW.doctor_id
            JOIN users u ON u.id = d.user_id
            WHERE p.id = NEW.patient_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

async def create_triggers(conn: AsyncConnection):
    """Создает все необходимые триггеры в базе данных"""
    
    # Создаем функции триггеров
    trigger_functions = [
        create_audit_trigger,
        create_user_permissions_trigger,
        create_doctor_rating_trigger,
        create_treatment_cost_trigger,
        create_payment_status_trigger,
        create_treatment_plan_status_trigger,
        create_appointment_status_trigger,
        create_notification_trigger,
        create_diagnosis_history_trigger,
        create_schedule_overlap_trigger,
        create_role_records_trigger,
        create_appointment_notification_trigger,
        create_medical_record_trigger,
        create_appointment_completion_trigger,
        create_update_timestamp_trigger,
        create_working_hours_check_trigger,
        create_treatment_status_update_trigger,
        create_payment_on_completion_trigger
    ]

    # Создаем функции триггеров
    for func in trigger_functions:
        await conn.execute(text(func))

    # Создаем триггеры для аудита
    await conn.execute(text("DROP TRIGGER IF EXISTS audit_trigger ON users"))
    await conn.execute(text("""
        CREATE TRIGGER audit_trigger
        AFTER INSERT OR UPDATE OR DELETE ON users
        FOR EACH ROW EXECUTE FUNCTION log_changes()
    """))

    # Триггер для прав пользователей
    await conn.execute(text("DROP TRIGGER IF EXISTS user_permissions_trigger ON users"))
    await conn.execute(text("""
        CREATE TRIGGER user_permissions_trigger
        BEFORE INSERT OR UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION set_user_permissions()
    """))

    # Триггер для рейтинга врачей
    await conn.execute(text("DROP TRIGGER IF EXISTS doctor_rating_trigger ON doctor_reviews"))
    await conn.execute(text("""
        CREATE TRIGGER doctor_rating_trigger
        AFTER INSERT OR UPDATE OR DELETE ON doctor_reviews
        FOR EACH ROW EXECUTE FUNCTION update_doctor_rating()
    """))

    # Триггер для создания записей врача и пациента
    await conn.execute(text("DROP TRIGGER IF EXISTS create_role_records_trigger ON users"))
    await conn.execute(text("""
        CREATE TRIGGER create_role_records_trigger
        AFTER INSERT OR UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION create_role_records()
    """))

    # Триггер для уведомлений о записях
    await conn.execute(text("DROP TRIGGER IF EXISTS appointment_notification_trigger ON appointments"))
    await conn.execute(text("""
        CREATE TRIGGER appointment_notification_trigger
        AFTER INSERT OR UPDATE ON appointments
        FOR EACH ROW EXECUTE FUNCTION handle_appointment_notifications()
    """))

    # Триггер для создания медицинской карты
    await conn.execute(text("DROP TRIGGER IF EXISTS create_medical_record_trigger ON appointments"))
    await conn.execute(text("""
        CREATE TRIGGER create_medical_record_trigger
        AFTER INSERT ON appointments
        FOR EACH ROW EXECUTE FUNCTION create_initial_medical_record()
    """))

    # Триггер для обновления статуса приема при создании медицинской записи
    await conn.execute(text("DROP TRIGGER IF EXISTS appointment_completion_trigger ON medical_records"))
    await conn.execute(text("""
        CREATE TRIGGER appointment_completion_trigger
        AFTER INSERT ON medical_records
        FOR EACH ROW EXECUTE FUNCTION update_appointment_status_on_record()
    """))

    # Триггеры обновления времени
    for table in ['users', 'doctors', 'patients', 'appointments', 'medical_records']:
        await conn.execute(text(f"DROP TRIGGER IF EXISTS update_timestamp_trigger ON {table}"))
        await conn.execute(text(f"""
            CREATE TRIGGER update_timestamp_trigger
            BEFORE UPDATE ON {table}
            FOR EACH ROW EXECUTE FUNCTION update_timestamp()
        """))

    # Триггер проверки рабочих часов
    await conn.execute(text("DROP TRIGGER IF EXISTS working_hours_check_trigger ON appointments"))
    await conn.execute(text("""
        CREATE TRIGGER working_hours_check_trigger
        BEFORE INSERT OR UPDATE ON appointments
        FOR EACH ROW EXECUTE FUNCTION check_working_hours()
    """))

    # Триггер для создания платежа при завершении приема
    await conn.execute(text("DROP TRIGGER IF EXISTS payment_on_completion_trigger ON appointments"))
    await conn.execute(text("""
        CREATE TRIGGER payment_on_completion_trigger
        AFTER UPDATE ON appointments
        FOR EACH ROW
        WHEN (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed'))
        EXECUTE FUNCTION create_payment_on_completion()
    """))

    # Триггер для обновления статуса лечения
    # Этот триггер создаем только если таблица treatment_steps существует
    await conn.execute(text("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'treatment_steps'
            ) THEN
                DROP TRIGGER IF EXISTS treatment_status_update_trigger ON treatment_steps;
                CREATE TRIGGER treatment_status_update_trigger
                AFTER UPDATE ON treatment_steps
                FOR EACH ROW EXECUTE FUNCTION update_treatment_status();
            END IF;
        END
        $$;
    """))
    
    # Триггеры для логирования действий во всех основных таблицах
    tables = [
        'users', 'doctors', 'patients', 'appointments', 'medical_records',
        'services', 'specializations', 'payments', 'doctor_schedules',
        'doctor_reviews', 'doctor_specializations', 'notifications',
        'treatments', 'treatment_steps', 'treatment_plans'
    ]
    
    for table in tables:
        # Проверяем существование таблицы перед созданием триггера
        await conn.execute(text(f"""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = '{table}'
                ) THEN
                    DROP TRIGGER IF EXISTS audit_trigger ON {table};
                    CREATE TRIGGER audit_trigger
                    AFTER INSERT OR UPDATE OR DELETE ON {table}
                    FOR EACH ROW EXECUTE FUNCTION log_changes();
                END IF;
            END
            $$;
        """))