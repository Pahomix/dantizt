-- Обновленный триггер для создания платежа при завершении приема
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

-- Пересоздание триггера
DROP TRIGGER IF EXISTS payment_on_completion_trigger ON appointments;
CREATE TRIGGER payment_on_completion_trigger
AFTER UPDATE ON appointments
FOR EACH ROW
WHEN (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed'))
EXECUTE FUNCTION create_payment_on_completion();
