-- Изменение ограничения внешнего ключа для specialization_id в таблице doctors
-- Сначала удаляем существующее ограничение
ALTER TABLE doctors DROP CONSTRAINT IF EXISTS doctors_specialization_id_fkey;

-- Затем изменяем столбец, чтобы разрешить NULL значения
ALTER TABLE doctors ALTER COLUMN specialization_id DROP NOT NULL;

-- Добавляем новое ограничение с ON DELETE SET NULL
ALTER TABLE doctors 
ADD CONSTRAINT doctors_specialization_id_fkey 
FOREIGN KEY (specialization_id) 
REFERENCES specializations(id) 
ON DELETE SET NULL;
