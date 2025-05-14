-- Представление для просмотра информации о пациентах с их аллергиями
CREATE OR REPLACE VIEW patient_allergy_view AS
SELECT 
    p.id AS patient_id,
    p.first_name,
    p.last_name,
    p.birth_date,
    STRING_AGG(a.name, ', ') AS allergies
FROM patients p
LEFT JOIN patient_allergies pa ON p.id = pa.patient_id
LEFT JOIN allergies a ON pa.allergy_id = a.id
GROUP BY p.id, p.first_name, p.last_name, p.birth_date;

-- Представление для просмотра загруженности врачей
CREATE OR REPLACE VIEW doctor_workload_view AS
SELECT 
    d.id AS doctor_id,
    d.first_name,
    d.last_name,
    s.name AS specialization,
    COUNT(a.id) AS appointments_count,
    DATE(a.appointment_date) AS appointment_date
FROM doctors d
LEFT JOIN appointments a ON d.id = a.doctor_id
LEFT JOIN specializations s ON d.specialization_id = s.id
GROUP BY d.id, d.first_name, d.last_name, s.name, DATE(a.appointment_date);

-- Представление для финансовой статистики
CREATE OR REPLACE VIEW financial_statistics_view AS
SELECT 
    DATE_TRUNC('month', p.payment_date) AS month,
    s.name AS service_name,
    COUNT(p.id) AS services_count,
    SUM(p.amount) AS total_amount
FROM payments p
JOIN services s ON p.service_id = s.id
GROUP BY DATE_TRUNC('month', p.payment_date), s.name;

-- Представление для истории лечения пациентов
CREATE OR REPLACE VIEW patient_treatment_history_view AS
SELECT 
    p.id AS patient_id,
    p.first_name || ' ' || p.last_name AS patient_name,
    d.first_name || ' ' || d.last_name AS doctor_name,
    s.name AS specialization,
    t.diagnosis,
    t.treatment_plan,
    t.created_at AS treatment_date
FROM patients p
JOIN treatments t ON p.id = t.patient_id
JOIN doctors d ON t.doctor_id = d.id
JOIN specializations s ON d.specialization_id = s.id
ORDER BY t.created_at DESC;

-- Представление для активности пользователей системы
CREATE OR REPLACE VIEW user_activity_view AS
SELECT 
    u.full_name,
    u.role,
    al.action_type,
    COUNT(*) as action_count,
    MAX(al.created_at) as last_action_date
FROM users u
JOIN action_logs al ON u.id = al.user_id
GROUP BY u.username, u.role, al.action_type;