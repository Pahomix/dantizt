from sqlalchemy import DDL, event, text

# Процедура для записи на приём
create_appointment_procedure = """
DROP PROCEDURE IF EXISTS schedule_appointment(INTEGER, INTEGER, TIMESTAMP, INTERVAL, OUT TEXT, OUT INTEGER);

CREATE OR REPLACE PROCEDURE schedule_appointment(
    p_patient_id INTEGER,
    p_doctor_id INTEGER,
    p_start_time TIMESTAMP,
    p_duration INTERVAL,
    OUT status TEXT,
    OUT appointment_id INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE
    v_end_time TIMESTAMP;
    v_doctor_schedule RECORD;
    v_conflicting_appointment RECORD;
BEGIN
    -- Проверяем существование пациента и врача
    IF NOT EXISTS (SELECT 1 FROM patients WHERE id = p_patient_id) THEN
        status := 'ERROR: Пациент не найден';
        RETURN;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM doctors WHERE id = p_doctor_id) THEN
        status := 'ERROR: Врач не найден';
        RETURN;
    END IF;
    
    -- Вычисляем время окончания приёма
    v_end_time := p_start_time + p_duration;
    
    -- Проверяем рабочее время врача
    SELECT * FROM doctor_schedules 
    WHERE doctor_id = p_doctor_id 
    AND day_of_week = EXTRACT(DOW FROM p_start_time)::INTEGER
    AND is_active = true
    INTO v_doctor_schedule;
    
    IF NOT FOUND THEN
        status := 'ERROR: Врач не работает в этот день';
        RETURN;
    END IF;
    
    -- Проверяем, что время приёма входит в рабочее время врача
    IF p_start_time::time < v_doctor_schedule.start_time OR 
       v_end_time::time > v_doctor_schedule.end_time THEN
        status := 'ERROR: Время приёма вне рабочего времени врача';
        RETURN;
    END IF;
    
    -- Проверяем пересечение с другими приёмами
    SELECT * FROM appointments
    WHERE doctor_id = p_doctor_id
    AND status != 'cancelled'
    AND (
        (start_time, end_time) OVERLAPS (p_start_time, v_end_time)
    )
    INTO v_conflicting_appointment;
    
    IF FOUND THEN
        status := 'ERROR: Выбранное время уже занято';
        RETURN;
    END IF;
    
    -- Создаём запись о приёме
    INSERT INTO appointments (
        patient_id,
        doctor_id,
        start_time,
        end_time,
        status
    ) VALUES (
        p_patient_id,
        p_doctor_id,
        p_start_time,
        v_end_time,
        'scheduled'
    ) RETURNING id INTO appointment_id;
    
    -- Логируем действие
    INSERT INTO action_logs (
        table_name,
        action_type,
        record_id,
        new_data,
        created_at,
        updated_at
    ) VALUES (
        'appointments',
        'INSERT',
        appointment_id,
        jsonb_build_object(
            'patient_id', p_patient_id,
            'doctor_id', p_doctor_id,
            'start_time', p_start_time,
            'end_time', v_end_time
        )::text,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );
    
    status := 'SUCCESS';
END;
$$;
"""

# Процедура для расчёта стоимости лечения
calculate_treatment_cost_procedure = """
DROP PROCEDURE IF EXISTS calculate_treatment_cost(INTEGER, OUT DECIMAL, OUT DECIMAL, OUT DECIMAL);

CREATE OR REPLACE PROCEDURE calculate_treatment_cost(
    p_treatment_id INTEGER,
    OUT base_cost DECIMAL,
    OUT discount_amount DECIMAL,
    OUT final_cost DECIMAL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_patient_id INTEGER;
    v_visit_count INTEGER;
    v_discount_percent INTEGER;
    v_insurance_coverage DECIMAL;
BEGIN
    -- Получаем базовую стоимость услуг
    SELECT s.price
    INTO base_cost
    FROM treatments t
    JOIN services s ON s.id = t.service_id
    WHERE t.id = p_treatment_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Лечение с ID % не найдено', p_treatment_id;
    END IF;
    
    -- Получаем ID пациента
    SELECT p.id INTO v_patient_id
    FROM treatments t
    JOIN appointments a ON a.id = t.appointment_id
    JOIN patients p ON p.id = a.patient_id
    WHERE t.id = p_treatment_id;
    
    -- Считаем количество завершённых приёмов пациента
    SELECT COUNT(*) INTO v_visit_count
    FROM appointments a
    WHERE a.patient_id = v_patient_id
    AND a.status = 'COMPLETED'
    AND a.start_time <= CURRENT_TIMESTAMP;
    
    -- Определяем процент скидки на основе количества посещений
    v_discount_percent := CASE
        WHEN v_visit_count >= 10 THEN 15  -- 15% после 10 посещений
        WHEN v_visit_count >= 5 THEN 10   -- 10% после 5 посещений
        WHEN v_visit_count >= 3 THEN 5    -- 5% после 3 посещений
        ELSE 0
    END;
    
    -- Рассчитываем сумму скидки и финальную стоимость
    discount_amount := (base_cost * v_discount_percent / 100)::DECIMAL(10,2);
    final_cost := base_cost - discount_amount;
    
    -- Обновляем total_cost в таблице treatments
    UPDATE treatments
    SET total_cost = final_cost
    WHERE id = p_treatment_id;
    
    -- Логируем действие
    INSERT INTO action_logs (
        table_name,
        action_type,
        record_id,
        new_data,
        created_at,
        updated_at
    ) VALUES (
        'treatments',
        'UPDATE',
        p_treatment_id,
        jsonb_build_object(
            'base_cost', base_cost,
            'insurance_coverage', v_insurance_coverage,
            'discount_amount', discount_amount,
            'final_cost', final_cost,
            'visit_count', v_visit_count
        )::text,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );
END;
$$;
"""

# Процедура для формирования отчёта по работе врача
create_doctor_report_procedure = """
DROP PROCEDURE IF EXISTS generate_doctor_report(INTEGER, DATE, DATE, OUT JSONB);

CREATE OR REPLACE PROCEDURE generate_doctor_report(
    p_doctor_id INTEGER,
    p_start_date DATE,
    p_end_date DATE,
    OUT report JSONB
)
LANGUAGE plpgsql AS $$
DECLARE
    v_appointments_count INTEGER;
    v_completed_count INTEGER;
    v_cancelled_count INTEGER;
    v_total_duration INTERVAL;
    v_total_revenue DECIMAL;
    v_services_summary JSONB;
BEGIN
    -- Подсчёт количества приёмов
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'COMPLETED'),
        COUNT(*) FILTER (WHERE status = 'CANCELLED'),
        SUM(end_time - start_time),
        COALESCE(SUM(p.amount), 0)
    INTO 
        v_appointments_count,
        v_completed_count,
        v_cancelled_count,
        v_total_duration,
        v_total_revenue
    FROM appointments a
    LEFT JOIN treatments t ON t.appointment_id = a.id
    LEFT JOIN payments p ON p.treatment_id = t.id
    WHERE a.doctor_id = p_doctor_id
    AND DATE(a.start_time) BETWEEN p_start_date AND p_end_date;
    
    -- Формируем сводку по услугам
    SELECT jsonb_object_agg(
        s.name,
        jsonb_build_object(
            'count', COUNT(*),
            'total_revenue', SUM(s.price)
        )
    )
    INTO v_services_summary
    FROM appointments a
    JOIN treatments t ON t.appointment_id = a.id
    JOIN services s ON s.id = t.service_id
    WHERE a.doctor_id = p_doctor_id
    AND DATE(a.start_time) BETWEEN p_start_date AND p_end_date
    GROUP BY s.name;
    
    -- Формируем итоговый отчёт
    report := jsonb_build_object(
        'doctor_id', p_doctor_id,
        'period', jsonb_build_object(
            'start_date', p_start_date,
            'end_date', p_end_date
        ),
        'statistics', jsonb_build_object(
            'total_appointments', v_appointments_count,
            'completed_appointments', v_completed_count,
            'cancelled_appointments', v_cancelled_count,
            'total_duration', v_total_duration,
            'total_revenue', v_total_revenue
        ),
        'services_summary', v_services_summary
    );
    
    -- Логируем действие
    INSERT INTO action_logs (
        table_name,
        action_type,
        record_id,
        new_data,
        created_at,
        updated_at
    ) VALUES (
        'doctors',
        'UPDATE',
        p_doctor_id,
        report::text,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );
END;
$$;
"""

from sqlalchemy import text
import re

def split_sql_commands(sql):
    """Разделяет SQL-команды, сохраняя целостность долларных кавычек"""
    commands = []
    current_command = []
    in_dollar_quote = False
    dollar_quote_marker = None
    
    for line in sql.split('\n'):
        stripped_line = line.strip()
        
        # Обработка долларных кавычек
        if not in_dollar_quote and '$$' in stripped_line:
            in_dollar_quote = True
            dollar_quote_marker = '$$'
        elif in_dollar_quote and dollar_quote_marker in stripped_line:
            in_dollar_quote = False
            dollar_quote_marker = None
            
        current_command.append(line)
        
        # Если мы не внутри долларных кавычек и встретили точку с запятой,
        # значит это конец команды
        if not in_dollar_quote and stripped_line.endswith(';'):
            commands.append('\n'.join(current_command))
            current_command = []
    
    # Добавляем последнюю команду, если она есть
    if current_command:
        commands.append('\n'.join(current_command))
    
    return [cmd.strip() for cmd in commands if cmd.strip()]

async def create_procedures(conn):
    """Создает все хранимые процедуры в базе данных"""
    # Удаляем существующие процедуры
    await conn.execute(text("""
        DROP PROCEDURE IF EXISTS schedule_appointment(INTEGER, INTEGER, TIMESTAMP, INTERVAL, OUT TEXT, OUT INTEGER);
    """))
    
    await conn.execute(text("""
        DROP PROCEDURE IF EXISTS search_entities(TEXT, OUT JSONB);
    """))
    
    await conn.execute(text("""
        DROP PROCEDURE IF EXISTS get_available_slots(OUT JSONB, INTEGER, DATE, INTERVAL);
    """))
    
    # Создаем процедуру записи на прием
    await conn.execute(text("""
        CREATE OR REPLACE PROCEDURE schedule_appointment(
            p_patient_id INTEGER,
            p_doctor_id INTEGER,
            p_start_time TIMESTAMP,
            p_duration INTERVAL,
            OUT status TEXT,
            OUT appointment_id INTEGER
        )
        LANGUAGE plpgsql AS $$
        DECLARE
            v_end_time TIMESTAMP;
            v_doctor_schedule RECORD;
            v_conflicting_appointment RECORD;
        BEGIN
            -- Проверяем существование пациента и врача
            IF NOT EXISTS (SELECT 1 FROM patients WHERE id = p_patient_id) THEN
                status := 'ERROR: Пациент не найден';
                RETURN;
            END IF;

            IF NOT EXISTS (SELECT 1 FROM doctors WHERE id = p_doctor_id) THEN
                status := 'ERROR: Врач не найден';
                RETURN;
            END IF;

            -- Вычисляем время окончания приёма
            v_end_time := p_start_time + p_duration;

            -- Проверяем рабочее время врача
            SELECT * FROM doctor_schedules
            WHERE doctor_id = p_doctor_id
            AND day_of_week = EXTRACT(DOW FROM p_start_time)::INTEGER
            AND is_active = true
            INTO v_doctor_schedule;

            IF NOT FOUND THEN
                status := 'ERROR: Врач не работает в этот день';
                RETURN;
            END IF;

            -- Проверяем, что время приёма входит в рабочее время врача
            IF p_start_time::time < v_doctor_schedule.start_time OR
               v_end_time::time > v_doctor_schedule.end_time THEN
                status := 'ERROR: Время приёма вне рабочего времени врача';
                RETURN;
            END IF;

            -- Проверяем пересечение с другими приёмами
            SELECT * FROM appointments
            WHERE doctor_id = p_doctor_id
            AND status != 'cancelled'
            AND (
                (start_time, end_time) OVERLAPS (p_start_time, v_end_time)
            )
            INTO v_conflicting_appointment;

            IF FOUND THEN
                status := 'ERROR: Выбранное время уже занято';
                RETURN;
            END IF;

            -- Создаём запись о приёме
            INSERT INTO appointments (
                patient_id,
                doctor_id,
                start_time,
                end_time,
                status
            ) VALUES (
                p_patient_id,
                p_doctor_id,
                p_start_time,
                v_end_time,
                'scheduled'
            ) RETURNING id INTO appointment_id;

            -- Логируем действие
            INSERT INTO action_logs (
                table_name,
                action_type,
                record_id,
                new_data,
                created_at,
                updated_at
            ) VALUES (
                'appointments',
                'INSERT',
                appointment_id,
                jsonb_build_object(
                    'patient_id', p_patient_id,
                    'doctor_id', p_doctor_id,
                    'start_time', p_start_time,
                    'end_time', v_end_time
                )::text,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            );

            status := 'SUCCESS';
        END;
        $$;
    """))
    
    # Создаем процедуру поиска
    await conn.execute(text("""
        CREATE OR REPLACE PROCEDURE search_entities(
            p_query TEXT,
            OUT results JSONB
        )
        LANGUAGE plpgsql AS $$
        BEGIN
            SELECT json_agg(
                json_build_object(
                    'entity_type', entity_type,
                    'entity_id', entity_id,
                    'title', title,
                    'subtitle', subtitle,
                    'details', details,
                    'rank', ts_rank(search_vector, query)
                )
                ORDER BY ts_rank(search_vector, query) DESC
            )
            INTO results
            FROM 
                search_index_view,
                to_tsquery('russian', regexp_replace(p_query, '[[:space:]]+', ' & ', 'g')) query
            WHERE search_vector @@ query;
            
            IF results IS NULL THEN
                results := '[]'::jsonb;
            END IF;
        END;
        $$;
    """))
    
    # Создаем процедуру получения свободных слотов
    await conn.execute(text("""
        CREATE OR REPLACE PROCEDURE get_available_slots(
            OUT slots JSONB,
            p_doctor_id INTEGER,
            p_date DATE,
            p_duration INTERVAL DEFAULT INTERVAL '30 minutes'
        )
        LANGUAGE plpgsql AS $$
        DECLARE
            v_schedule RECORD;
            v_slot_start TIMESTAMP;
            v_slot_end TIMESTAMP;
            v_available_slots JSONB[];
        BEGIN
            -- Получаем расписание врача на этот день недели
            SELECT * FROM doctor_schedules
            WHERE doctor_id = p_doctor_id
            AND day_of_week = EXTRACT(DOW FROM p_date)
            INTO v_schedule;
            
            IF NOT FOUND OR NOT v_schedule.is_working THEN
                slots := '[]'::jsonb;
                RETURN;
            END IF;
            
            -- Формируем начальное и конечное время дня
            v_slot_start := p_date + v_schedule.start_time;
            v_slot_end := p_date + v_schedule.end_time;
            
            -- Собираем все свободные слоты
            WITH RECURSIVE time_slots AS (
                -- Начальное значение
                SELECT 
                    v_slot_start as start_time,
                    v_slot_start + p_duration as end_time
                WHERE v_slot_start + p_duration <= v_slot_end
                
                UNION ALL
                
                -- Рекурсивная часть
                SELECT 
                    end_time,
                    end_time + p_duration
                FROM time_slots
                WHERE end_time + p_duration <= v_slot_end
            )
            SELECT array_agg(
                jsonb_build_object(
                    'start_time', ts.start_time,
                    'end_time', ts.end_time
                )
            )
            INTO v_available_slots
            FROM time_slots ts
            WHERE NOT EXISTS (
                SELECT 1 FROM appointments a
                WHERE a.doctor_id = p_doctor_id
                AND a.status != 'cancelled'
                AND (a.start_time, a.end_time) OVERLAPS (ts.start_time, ts.end_time)
            );
            
            slots := COALESCE(jsonb_build_array(VARIADIC v_available_slots), '[]'::jsonb);
        END;
        $$;
    """))
    
    # Создаем процедуру записи на прием
    for command in split_sql_commands(create_appointment_procedure):
        await conn.execute(text(command))
        
    # Создаем процедуру поиска
    for command in split_sql_commands(calculate_treatment_cost_procedure):
        await conn.execute(text(command))
        
    # Создаем процедуру получения свободных слотов
    for command in split_sql_commands(create_doctor_report_procedure):
        await conn.execute(text(command))

def create_all_procedures():
    """Возвращает SQL для создания всех хранимых процедур"""
    return '\n'.join([
        create_appointment_procedure,
        calculate_treatment_cost_procedure,
        create_doctor_report_procedure
    ])
