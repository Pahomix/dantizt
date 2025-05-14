from sqlalchemy import DDL, event
from sqlalchemy.sql import text

# Функция для получения статистики по врачам
create_doctor_stats_function = """
CREATE OR REPLACE FUNCTION get_doctor_statistics(doctor_id INTEGER)
RETURNS TABLE (
    total_appointments INTEGER,
    completed_appointments INTEGER,
    total_revenue DECIMAL,
    average_appointment_duration INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(a.id) as total_appointments,
        COUNT(a.id) FILTER (WHERE a.status = 'completed') as completed_appointments,
        COALESCE(SUM(p.amount), 0) as total_revenue,
        AVG(a.end_time - a.start_time) as average_appointment_duration
    FROM appointments a
    LEFT JOIN treatments t ON a.id = t.appointment_id
    LEFT JOIN payments p ON t.id = p.treatment_id
    WHERE a.doctor_id = doctor_id;
END;
$$ LANGUAGE plpgsql;
"""

# Функция для поиска свободных слотов врача
create_free_slots_function = """
CREATE OR REPLACE FUNCTION find_doctor_free_slots(
    doctor_id INTEGER,
    search_date DATE
)
RETURNS TABLE (
    start_time TIMESTAMP,
    end_time TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    WITH doctor_schedule AS (
        SELECT ds.start_time::time as shift_start,
               ds.end_time::time as shift_end
        FROM doctor_schedule ds
        WHERE ds.doctor_id = doctor_id
        AND ds.day_of_week = EXTRACT(DOW FROM search_date)
    ),
    time_slots AS (
        SELECT generate_series(
            search_date + shift_start,
            search_date + shift_end - interval '30 minutes',
            interval '30 minutes'
        ) as slot_start
        FROM doctor_schedule
    )
    SELECT 
        ts.slot_start,
        ts.slot_start + interval '30 minutes' as slot_end
    FROM time_slots ts
    LEFT JOIN appointments a ON 
        a.doctor_id = doctor_id AND
        a.start_time < ts.slot_start + interval '30 minutes' AND
        a.end_time > ts.slot_start AND
        DATE(a.start_time) = search_date
    WHERE a.id IS NULL
    ORDER BY ts.slot_start;
END;
$$ LANGUAGE plpgsql;
"""

# Функция для расчета стоимости лечения
create_treatment_cost_function = """
CREATE OR REPLACE FUNCTION calculate_treatment_cost(treatment_id INTEGER)
RETURNS DECIMAL AS $$
DECLARE
    total_cost DECIMAL;
BEGIN
    SELECT COALESCE(SUM(s.price), 0)
    INTO total_cost
    FROM treatments t
    JOIN services s ON s.id = t.service_id
    WHERE t.id = treatment_id;
    
    RETURN total_cost;
END;
$$ LANGUAGE plpgsql;
"""

# Функция для проверки доступности врача в указанное время
CHECK_DOCTOR_AVAILABILITY = """
CREATE OR REPLACE FUNCTION check_doctor_availability(
    p_doctor_id INTEGER,
    p_date DATE,
    p_start_time TIME,
    p_end_time TIME
) RETURNS BOOLEAN AS $$
DECLARE
    v_day_of_week INTEGER;
    v_is_working BOOLEAN;
    v_schedule_start TIME;
    v_schedule_end TIME;
    v_special_day RECORD;
    v_has_appointments BOOLEAN;
BEGIN
    -- Получаем день недели для указанной даты (0-6, где 0 = воскресенье)
    v_day_of_week := EXTRACT(DOW FROM p_date);
    
    -- Проверяем специальные дни
    SELECT * INTO v_special_day
    FROM doctor_special_days
    WHERE doctor_id = p_doctor_id
        AND p_date BETWEEN date_from AND date_to;
    
    IF FOUND THEN
        -- Если это специальный день
        IF NOT v_special_day.is_working THEN
            RETURN FALSE;
        END IF;
        
        IF v_special_day.work_start_time IS NOT NULL THEN
            v_schedule_start := v_special_day.work_start_time;
            v_schedule_end := v_special_day.work_end_time;
        END IF;
    ELSE
        -- Проверяем обычное расписание
        SELECT is_working, start_time, end_time INTO v_is_working, v_schedule_start, v_schedule_end
        FROM doctor_schedules
        WHERE doctor_id = p_doctor_id AND day_of_week = v_day_of_week;
        
        IF NOT FOUND OR NOT v_is_working THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Проверяем, что запрошенное время входит в рабочее время
    IF p_start_time < v_schedule_start OR p_end_time > v_schedule_end THEN
        RETURN FALSE;
    END IF;
    
    -- Проверяем, нет ли других записей в это время
    SELECT EXISTS(
        SELECT 1
        FROM appointments
        WHERE doctor_id = p_doctor_id
            AND DATE(start_time) = p_date
            AND (
                (start_time, end_time) OVERLAPS (p_date + p_start_time, p_date + p_end_time)
            )
    ) INTO v_has_appointments;
    
    RETURN NOT v_has_appointments;
END;
$$ LANGUAGE plpgsql;
"""

# Функция для получения свободных слотов врача на дату
GET_AVAILABLE_SLOTS = """
CREATE OR REPLACE FUNCTION get_available_slots(
    p_doctor_id INTEGER,
    p_date DATE,
    p_slot_duration INTEGER DEFAULT 30  -- Длительность слота в минутах
) RETURNS TABLE (
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    is_available BOOLEAN
) AS $$
DECLARE
    v_schedule RECORD;
    v_current_time TIMESTAMP;
    v_schedule_end TIMESTAMP;
    v_special_day RECORD;
BEGIN
    -- Проверяем специальные дни
    SELECT * INTO v_special_day
    FROM doctor_special_days
    WHERE doctor_id = p_doctor_id
        AND p_date BETWEEN date_from AND date_to;
    
    IF FOUND THEN
        IF NOT v_special_day.is_working THEN
            RETURN;
        END IF;
        v_current_time := p_date + v_special_day.work_start_time;
        v_schedule_end := p_date + v_special_day.work_end_time;
    ELSE
        -- Получаем обычное расписание
        SELECT * INTO v_schedule
        FROM doctor_schedules
        WHERE doctor_id = p_doctor_id
            AND day_of_week = EXTRACT(DOW FROM p_date);
            
        IF NOT FOUND OR NOT v_schedule.is_working THEN
            RETURN;
        END IF;
        
        v_current_time := p_date + v_schedule.start_time;
        v_schedule_end := p_date + v_schedule.end_time;
    END IF;
    
    -- Генерируем слоты
    WHILE v_current_time + (p_slot_duration || ' minutes')::interval <= v_schedule_end LOOP
        RETURN QUERY
        SELECT 
            v_current_time,
            v_current_time + (p_slot_duration || ' minutes')::interval,
            NOT EXISTS(
                SELECT 1
                FROM appointments
                WHERE doctor_id = p_doctor_id
                    AND (start_time, end_time) OVERLAPS 
                        (v_current_time, v_current_time + (p_slot_duration || ' minutes')::interval)
            );
            
        v_current_time := v_current_time + (p_slot_duration || ' minutes')::interval;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
"""

# Создание всех функций
def create_functions(engine):
    functions = [
        create_doctor_stats_function,
        create_free_slots_function,
        create_treatment_cost_function,
        CHECK_DOCTOR_AVAILABILITY,
        GET_AVAILABLE_SLOTS
    ]
    
    for func in functions:
        engine.execute(text(func))
