from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection
from .models import User, Patient, Doctor, Appointment, Treatment, Service, Payment

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

# Триггер для автоматического создания уведомлений
create_notification_trigger = """
CREATE OR REPLACE FUNCTION create_notifications()
RETURNS TRIGGER AS $$
BEGIN
    -- При создании приема создаем уведомление о напоминании
    IF TG_TABLE_NAME = 'appointments' AND TG_OP = 'INSERT' THEN
        INSERT INTO notifications (
            user_id,
            patient_id,
            type,
            title,
            message,
            scheduled_for,
            is_read,
            created_at,
            updated_at
        )
        SELECT 
            p.user_id,
            NEW.patient_id,
            'appointment_reminder',
            'Напоминание о приеме',
            'Напоминаем о предстоящем приеме ' || NEW.start_time::text,
            NEW.start_time - INTERVAL '1 day',
            false,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM patients p
        WHERE p.id = NEW.patient_id;
    
    -- При создании платежа создаем уведомление
    ELSIF TG_TABLE_NAME = 'payments' AND TG_OP = 'INSERT' THEN
        INSERT INTO notifications (
            user_id,
            patient_id,
            type,
            title,
            message,
            scheduled_for,
            is_read,
            created_at,
            updated_at
        )
        SELECT 
            p.user_id,
            t.patient_id,
            'payment_due',
            'Платеж получен',
            'Получен платеж на сумму ' || NEW.amount::text || ' руб.',
            CURRENT_TIMESTAMP,
            false,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM treatments t
        JOIN patients p ON t.patient_id = p.id
        WHERE t.id = NEW.treatment_id;
    
    -- При завершении лечения создаем уведомление о follow-up
    ELSIF TG_TABLE_NAME = 'treatments' AND TG_OP = 'UPDATE' AND NEW.status = 'completed' THEN
        INSERT INTO notifications (
            user_id,
            patient_id,
            type,
            title,
            message,
            scheduled_for,
            is_read,
            created_at,
            updated_at
        )
        SELECT 
            p.user_id,
            NEW.patient_id,
            'treatment_followup',
            'Контрольный осмотр',
            'Ваше лечение завершено. Пожалуйста, запишитесь на контрольный осмотр.',
            CURRENT_TIMESTAMP + INTERVAL '1 month',
            false,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM patients p
        WHERE p.id = NEW.patient_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

async def create_triggers(conn: AsyncConnection):
    """Создает все необходимые триггеры в базе данных"""
    
    # Создаем триггер для аудита
    await conn.execute(text(create_audit_trigger))
    await conn.execute(text("DROP TRIGGER IF EXISTS audit_trigger ON users"))
    await conn.execute(text("""
        CREATE TRIGGER audit_trigger
        AFTER INSERT OR UPDATE OR DELETE ON users
        FOR EACH ROW EXECUTE FUNCTION log_changes()
    """))
    
    # Создаем триггер для статуса оплаты
    await conn.execute(text(create_payment_status_trigger))
    await conn.execute(text("DROP TRIGGER IF EXISTS payment_status_trigger ON payments"))
    await conn.execute(text("""
        CREATE TRIGGER payment_status_trigger
        AFTER INSERT OR UPDATE ON payments
        FOR EACH ROW EXECUTE FUNCTION update_payment_status()
    """))
    
    # Создаем триггер для уведомлений
    await conn.execute(text(create_notification_trigger))
    
    # Триггер для приемов
    await conn.execute(text("DROP TRIGGER IF EXISTS notification_trigger ON appointments"))
    await conn.execute(text("""
        CREATE TRIGGER notification_trigger
        AFTER INSERT ON appointments
        FOR EACH ROW EXECUTE FUNCTION create_notifications()
    """))
    
    # Триггер для платежей
    await conn.execute(text("DROP TRIGGER IF EXISTS payment_notification_trigger ON payments"))
    await conn.execute(text("""
        CREATE TRIGGER payment_notification_trigger
        AFTER INSERT ON payments
        FOR EACH ROW EXECUTE FUNCTION create_notifications()
    """))
    
    # Триггер для лечения
    await conn.execute(text("DROP TRIGGER IF EXISTS treatment_notification_trigger ON treatments"))
    await conn.execute(text("""
        CREATE TRIGGER treatment_notification_trigger
        AFTER UPDATE ON treatments
        FOR EACH ROW EXECUTE FUNCTION create_notifications()
    """))
