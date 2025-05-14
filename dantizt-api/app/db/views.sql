-- Представление для получения текущего расписания врачей
CREATE OR REPLACE VIEW v_doctor_schedules AS
SELECT 
    d.id AS doctor_id,
    d.full_name AS doctor_name,
    s.name AS specialization,
    ds.day_of_week,
    ds.start_time,
    ds.end_time,
    ds.is_working,
    dsd.date_from,
    dsd.date_to,
    dsd.type AS special_day_type,
    dsd.description AS special_day_description,
    dsd.is_working AS special_day_is_working,
    dsd.work_start_time AS special_day_start_time,
    dsd.work_end_time AS special_day_end_time
FROM doctors d
JOIN specializations s ON d.specialization_id = s.id
LEFT JOIN doctor_schedules ds ON d.id = ds.doctor_id
LEFT JOIN doctor_special_days dsd ON d.id = dsd.doctor_id
    AND CURRENT_DATE BETWEEN dsd.date_from AND dsd.date_to;

-- Представление для получения текущего расписания врачей
CREATE OR REPLACE VIEW v_doctor_schedules AS
SELECT 
    d.id AS doctor_id,
    d.full_name AS doctor_name,
    s.name AS specialization,
    ds.day_of_week,
    ds.start_time,
    ds.end_time,
    ds.is_working,
    dsd.date_from,
    dsd.date_to,
    dsd.type AS special_day_type,
    dsd.description AS special_day_description,
    dsd.is_working AS special_day_is_working,
    dsd.work_start_time AS special_day_start_time,
    dsd.work_end_time AS special_day_end_time
FROM doctors d
JOIN specializations s ON d.specialization_id = s.id
LEFT JOIN doctor_schedules ds ON d.id = ds.doctor_id
LEFT JOIN doctor_special_days dsd ON d.id = dsd.doctor_id
    AND CURRENT_DATE BETWEEN dsd.date_from AND dsd.date_to;

-- Функция для проверки доступности врача в указанное время
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

-- Триггер для проверки пересечения записей
CREATE OR REPLACE FUNCTION check_appointment_overlap() RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM appointments
        WHERE doctor_id = NEW.doctor_id
            AND id != NEW.id  -- Исключаем текущую запись при обновлении
            AND (start_time, end_time) OVERLAPS (NEW.start_time, NEW.end_time)
    ) THEN
        RAISE EXCEPTION 'Appointment overlaps with existing appointment';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointment_overlap_check
    BEFORE INSERT OR UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION check_appointment_overlap();

-- Функция для получения свободных слотов врача на дату
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
