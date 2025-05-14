# Представление для просмотра расписания врачей
create_doctor_schedule_view = """
CREATE OR REPLACE VIEW doctor_schedule_view AS
SELECT
    d.id as doctor_id,
    u.full_name as doctor_name,
    s.name as specialization,
    ds.day_of_week,
    ds.start_time,
    ds.end_time,
    ds.is_working,
    dsd.date as special_day_date,
    dsd.type AS special_day_type,
    dsd.description AS special_day_description,
    dsd.is_working AS special_day_is_working,
    dsd.start_time AS special_day_start_time,
    dsd.end_time AS special_day_end_time
FROM doctors d
JOIN users u ON d.user_id = u.id
JOIN specializations s ON d.specialization_id = s.id
LEFT JOIN doctor_schedules ds ON d.id = ds.doctor_id
LEFT JOIN doctor_special_days dsd ON d.id = dsd.doctor_id
    AND CURRENT_DATE = dsd.date;
"""

# Представление для просмотра истории пациентов
create_patient_history_view = """
CREATE OR REPLACE VIEW patient_history_view AS
SELECT 
    p.id as patient_id,
    u.full_name,
    a.start_time as appointment_date,
    mr.title as diagnosis,
    mr.description as treatment_notes,
    s.cost as total_cost,
    s.name as service_name,
    s.cost as service_base_price,
    du.full_name as doctor_name,
    a.status::text as appointment_status
FROM 
    patients p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN appointments a ON p.id = a.patient_id
    LEFT JOIN medical_records mr ON a.id = mr.appointment_id AND mr.record_type = 'treatment'
    LEFT JOIN services s ON mr.service_id = s.id
    LEFT JOIN doctors d ON a.doctor_id = d.id
    LEFT JOIN users du ON d.user_id = du.id
ORDER BY 
    p.id, a.start_time;
"""

# Представление для анализа загруженности врачей
create_doctor_workload_view = """
CREATE OR REPLACE VIEW doctor_workload_view AS
SELECT 
    d.id as doctor_id,
    u.full_name,
    d.experience_years,
    s.name as specialization,
    COUNT(a.id) as total_appointments,
    COUNT(CASE WHEN a.status::text = 'completed' THEN 1 END) as completed_appointments,
    COUNT(CASE WHEN a.status::text = 'cancelled' THEN 1 END) as cancelled_appointments,
    COUNT(CASE WHEN a.status::text = 'scheduled' THEN 1 END) as scheduled_appointments,
    COUNT(CASE WHEN a.status::text = 'in_progress' THEN 1 END) as in_progress_appointments,
    COALESCE(d.average_rating, 0) as average_rating,
    d.rating_count
FROM 
    doctors d
    JOIN users u ON d.user_id = u.id
    JOIN specializations s ON d.specialization_id = s.id
    LEFT JOIN appointments a ON d.id = a.doctor_id
GROUP BY 
    d.id, u.full_name, d.experience_years, s.name, d.average_rating, d.rating_count;
"""

# Представление для получения текущего расписания врачей
DOCTOR_SCHEDULES_VIEW = """
CREATE OR REPLACE VIEW v_doctor_schedules AS
WITH days_of_week AS (
    SELECT generate_series(0, 6) AS day_of_week
)
SELECT 
    d.id AS doctor_id,
    u.full_name AS doctor_name,
    s.name AS specialization,
    dow.day_of_week,
    COALESCE(ds.start_time, NULL) as start_time,
    COALESCE(ds.end_time, NULL) as end_time,
    COALESCE(ds.is_working, false) as is_working,
    COALESCE(ds.month, NULL) as month,
    COALESCE(ds.year, NULL) as year,
    dsd.date AS special_day_date,
    dsd.description AS special_day_description,
    dsd.is_working AS special_day_is_working,
    dsd.start_time AS special_day_start_time,
    dsd.end_time AS special_day_end_time
FROM doctors d
JOIN users u ON d.user_id = u.id
JOIN specializations s ON d.specialization_id = s.id
CROSS JOIN days_of_week dow
LEFT JOIN doctor_schedules ds ON d.id = ds.doctor_id 
    AND dow.day_of_week = ds.day_of_week
    AND (ds.month IS NULL OR ds.month = EXTRACT(MONTH FROM CURRENT_DATE))
    AND (ds.year IS NULL OR ds.year = EXTRACT(YEAR FROM CURRENT_DATE))
LEFT JOIN doctor_special_days dsd ON d.id = dsd.doctor_id
    AND CURRENT_DATE = dsd.date;
"""

# Представление для статистики на панели управления
dashboard_stats_view = """
    CREATE OR REPLACE VIEW dashboard_stats_view AS
    WITH appointment_stats AS (
        SELECT
            COUNT(*) as total_appointments,
            COUNT(*) FILTER (WHERE status = 'completed') as completed_appointments,
            COUNT(*) FILTER (WHERE status = 'scheduled') as upcoming_appointments,
            COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_appointments,
            COUNT(DISTINCT patient_id) as unique_patients,
            COUNT(DISTINCT doctor_id) as active_doctors
        FROM appointments
        WHERE start_time >= CURRENT_DATE - INTERVAL '30 days'
    ),
    revenue_stats AS (
        SELECT
            COALESCE(SUM(amount), 0) as total_revenue,
            COALESCE(AVG(amount), 0) as average_payment
        FROM payments
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    ),
    top_services AS (
        SELECT
            s.name as service_name,
            COUNT(*) as usage_count,
            COALESCE(SUM(p.amount), 0) as revenue
        FROM appointments a
        JOIN doctor_services ds ON ds.doctor_id = a.doctor_id
        JOIN services s ON s.id = ds.service_id
        LEFT JOIN payments p ON p.service_id = s.id AND p.appointment_id = a.id
        WHERE a.created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY s.name
        ORDER BY usage_count DESC
        LIMIT 5
    ),
    top_doctors AS (
        SELECT
            u.full_name as doctor_name,
            COUNT(*) as appointment_count,
            COALESCE(AVG(dr.rating), 0) as average_rating
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        JOIN users u ON d.user_id = u.id
        LEFT JOIN doctor_reviews dr ON d.id = dr.doctor_id
        WHERE a.start_time >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY u.full_name
        ORDER BY appointment_count DESC
        LIMIT 5
    )
    SELECT
        json_build_object(
            'appointments', json_build_object(
                'total', a.total_appointments,
                'completed', a.completed_appointments,
                'upcoming', a.upcoming_appointments,
                'cancelled', a.cancelled_appointments,
                'unique_patients', a.unique_patients,
                'active_doctors', a.active_doctors
            ),
            'revenue', json_build_object(
                'total', r.total_revenue,
                'average', r.average_payment
            ),
            'top_services', (
                SELECT json_agg(row_to_json(s))
                FROM top_services s
            ),
            'top_doctors', (
                SELECT json_agg(row_to_json(d))
                FROM top_doctors d
            )
        ) as dashboard_data
    FROM appointment_stats a, revenue_stats r;
"""

# Представление для просмотра платежей с информацией о пользователях
create_payments_view = """
CREATE OR REPLACE VIEW payments_view AS
SELECT 
    p.id as payment_id,
    p.amount,
    p.status::text,
    p.description,
    p.created_at,
    u.full_name as patient_name,
    u.email as patient_email,
    pat.id as patient_id
FROM 
    payments p
    JOIN patients pat ON p.patient_id = pat.id
    JOIN users u ON pat.user_id = u.id
ORDER BY 
    p.created_at DESC;
"""

# Представление для детальной информации о врачах
create_doctor_details_view = """
CREATE OR REPLACE VIEW doctor_details_view AS
WITH recent_doctor_reviews AS (
    SELECT
        r.doctor_id,
        jsonb_agg(
            jsonb_build_object(
                'id', r.id,
                'rating', r.rating,
                'comment', r.comment,
                'patient_name', u.full_name
            ) ORDER BY r.id DESC
        ) FILTER (WHERE r.id IN (
            SELECT id FROM doctor_reviews r2
            WHERE r2.doctor_id = r.doctor_id
            ORDER BY id DESC
            LIMIT 5
        )) as reviews
    FROM doctor_reviews r
    JOIN patients p ON p.id = r.patient_id
    JOIN users u ON p.user_id = u.id
    GROUP BY r.doctor_id
)
SELECT
    d.id,
    u.full_name,
    d.experience_years,
    d.average_rating,
    d.rating_count,
    d.bio,
    d.education,
    d.achievements,
    d.certificates,
    d.is_available,
    s.name as specialization,
    s.description as specialization_description,
    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'day_of_week', ds.day_of_week,
                'start_time', ds.start_time,
                'end_time', ds.end_time,
                'is_working', ds.is_working
            ) ORDER BY ds.day_of_week
        )
        FROM doctor_schedules ds
        WHERE ds.doctor_id = d.id
    ) as schedule,
    COALESCE(r.reviews, '[]'::jsonb) as recent_reviews
FROM doctors d
JOIN users u ON d.user_id = u.id
JOIN specializations s ON s.id = d.specialization_id
LEFT JOIN recent_doctor_reviews r ON r.doctor_id = d.id;
"""

# Представление для поиска
create_search_view = """
CREATE OR REPLACE VIEW search_view AS
SELECT
    'doctor' as entity_type,
    d.id as entity_id,
    u.full_name as title,
    s.name as subtitle,
    json_build_object(
        'experience_years', d.experience_years,
        'rating', d.average_rating,
        'specialization', s.name
    ) as details,
    to_tsvector('russian', 
        u.full_name || ' ' || 
        s.name || ' ' || 
        COALESCE(d.bio, '')
    ) as search_vector
FROM doctors d
JOIN users u ON d.user_id = u.id
JOIN specializations s ON d.specialization_id = s.id
UNION ALL
SELECT
    'service' as entity_type,
    s.id as entity_id,
    s.name as title,
    s.category::text as subtitle,
    json_build_object(
        'price', s.cost,
        'duration', s.duration,
        'category', s.category::text,
        'description', s.description
    ) as details,
    to_tsvector('russian', 
        s.name || ' ' || 
        s.category::text || ' ' ||
        COALESCE(s.description, '')
    ) as search_vector
FROM services s;
"""

# Представление для группировки услуг по категориям
create_services_by_category_view = """
CREATE OR REPLACE VIEW services_by_category_view AS
SELECT 
    category,
    jsonb_agg(
        jsonb_build_object(
            'id', id,
            'name', name,
            'description', description,
            'cost', cost,
            'duration', duration,
            'total_time', (duration + preparation_time + cleanup_time),
            'preparation_time', preparation_time,
            'cleanup_time', cleanup_time
        ) ORDER BY name
    ) as services
FROM services
GROUP BY category;
"""

# Представление для сводной информации о пациенте
create_patient_summary_view = """
CREATE OR REPLACE VIEW patient_summary_view AS
SELECT 
    p.id,
    u.full_name,
    u.phone_number,
    u.email,
    p.medical_history,
    p.allergies,
    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', mr.id,
                'code', mr.diagnosis_code,
                'name', mr.title,
                'status', mr.status,
                'doctor_name', du.full_name
            ) ORDER BY mr.id DESC
        )
        FROM medical_records mr
        JOIN doctors doc ON doc.id = mr.doctor_id
        JOIN users du ON doc.user_id = du.id
        WHERE mr.patient_id = p.id AND mr.record_type = 'diagnosis'
    ) as diagnoses,
    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', a.id,
                'start_time', a.start_time,
                'status', a.status,
                'doctor_name', du.full_name,
                'service_name', s.name
            ) ORDER BY a.start_time DESC
        )
        FROM (
            SELECT a.*
            FROM appointments a
            WHERE a.patient_id = p.id
            ORDER BY a.start_time DESC
            LIMIT 5
        ) a
        JOIN doctors d ON d.id = a.doctor_id
        JOIN users du ON d.user_id = du.id
        LEFT JOIN medical_records mr ON mr.appointment_id = a.id AND mr.record_type = 'treatment'
        LEFT JOIN services s ON mr.service_id = s.id
    ) as recent_appointments
FROM patients p
JOIN users u ON p.user_id = u.id;
"""

# SQL-запросы для создания представлений
VIEWS_SQL = [
    # Представление с детальной информацией о врачах
    create_doctor_details_view,
    # Представление для поиска
    create_search_view,
    # Представление для группировки услуг по категориям
    create_services_by_category_view,
    # Представление для сводной информации о пациенте
    create_patient_summary_view,
    dashboard_stats_view,
    DOCTOR_SCHEDULES_VIEW,
    create_payments_view
]

from sqlalchemy import text

async def create_views(conn):
    """Создает все представления в базе данных"""
    # Сначала удаляем существующие представления
    await conn.execute(text("DROP VIEW IF EXISTS doctor_schedule_view CASCADE;"))
    await conn.execute(text("DROP VIEW IF EXISTS patient_history_view CASCADE;"))
    await conn.execute(text("DROP VIEW IF EXISTS doctor_workload_view CASCADE;"))
    await conn.execute(text("DROP VIEW IF EXISTS doctor_details_view CASCADE;"))
    await conn.execute(text("DROP VIEW IF EXISTS search_view CASCADE;"))
    await conn.execute(text("DROP VIEW IF EXISTS services_by_category_view CASCADE;"))
    await conn.execute(text("DROP VIEW IF EXISTS patient_summary_view CASCADE;"))
    await conn.execute(text("DROP VIEW IF EXISTS dashboard_stats_view CASCADE;"))
    await conn.execute(text("DROP VIEW IF EXISTS v_doctor_schedules CASCADE;"))
    await conn.execute(text("DROP VIEW IF EXISTS payments_view CASCADE;"))

    # Теперь создаем представления
    await conn.execute(text(create_doctor_schedule_view))
    await conn.execute(text(create_patient_history_view))
    await conn.execute(text(create_doctor_workload_view))
    for view_sql in VIEWS_SQL:
        await conn.execute(text(view_sql))
