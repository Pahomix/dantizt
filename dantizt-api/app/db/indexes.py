from sqlalchemy import DDL, event

# Индексы для оптимизации поиска
create_indexes = [
    # Индекс для поиска пациентов по имени и фамилии
    """
    CREATE INDEX IF NOT EXISTS idx_patients_name 
    ON patients USING btree (first_name, last_name);
    """,
    
    """
    CREATE INDEX IF NOT EXISTS idx_doctors_specialization 
    ON doctors USING btree (specialization_id);
    """,
    
    # Индекс для поиска приёмов по дате
    """
    CREATE INDEX IF NOT EXISTS idx_appointments_date 
    ON appointments USING btree (start_time);
    """,
    
    # Составной индекс для поиска приёмов по врачу и дате
    """
    CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date 
    ON appointments USING btree (doctor_id, start_time);
    """,
    
    # Индекс для поиска платежей по статусу
    """
    CREATE INDEX IF NOT EXISTS idx_payments_status 
    ON payments USING btree (status);
    """,
    
    # Индекс для поиска в логах по дате
    """
    CREATE INDEX IF NOT EXISTS idx_action_logs_date 
    ON action_logs USING btree (created_at);
    """,
    
    # Индекс для полнотекстового поиска в логах
    """
    CREATE INDEX IF NOT EXISTS idx_action_logs_full_text 
    ON action_logs USING gin (to_tsvector('russian', 
        coalesce(old_data::text, '') || ' ' || 
        coalesce(new_data::text, '')
    ));
    """,
    
    # Индекс для оптимизации поиска в расписании врачей
    """
    CREATE INDEX IF NOT EXISTS idx_doctor_schedules_composite 
    ON doctor_schedules USING btree (doctor_id, day_of_week, start_time, end_time);
    """,
    
    # Индекс для поиска по статусу лечения
    """
    CREATE INDEX IF NOT EXISTS idx_treatments_status 
    ON treatments USING btree (status);
    """,
    
    # Составной индекс для поиска лечения по пациенту и статусу
    """
    CREATE INDEX IF NOT EXISTS idx_treatments_patient_status 
    ON treatments USING btree (patient_id, status);
    """,
    
    # Индекс для поиска по категории услуг
    """
    CREATE INDEX IF NOT EXISTS idx_services_category 
    ON services USING btree (category);
    """,
    
    # Индекс для поиска шагов лечения по порядку
    """
    CREATE INDEX IF NOT EXISTS idx_treatment_steps_order 
    ON treatment_steps USING btree (treatment_plan_id, "order");
    """,
    
    # Индекс для поиска уведомлений по дате отправки
    """
    CREATE INDEX IF NOT EXISTS idx_notifications_scheduled 
    ON notifications USING btree (scheduled_for) 
    WHERE NOT is_sent;
    """,
    
    # Индекс для поиска диагнозов по статусу
    """
    CREATE INDEX IF NOT EXISTS idx_diagnoses_status 
    ON diagnoses USING btree (status);
    """,
    
    # Составной индекс для медицинских записей
    """
    CREATE INDEX IF NOT EXISTS idx_medical_records_composite 
    ON medical_records USING btree (patient_id, record_type, created_at);
    """,
    
    # Индекс для поиска по рейтингу врачей
    """
    CREATE INDEX IF NOT EXISTS idx_doctors_rating 
    ON doctors USING btree (average_rating DESC);
    """
]

def create_all_indexes(engine):
    """Создает все индексы в базе данных"""
    for index in create_indexes:
        engine.execute(index)
