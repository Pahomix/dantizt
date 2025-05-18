import os
import logging
import json
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple

logger = logging.getLogger(__name__)

class DatabaseBackup:
    def __init__(self, db_name: str, backup_dir: str = "backups"):
        """
        Инициализация менеджера резервных копий
        
        :param db_name: Имя базы данных
        :param backup_dir: Директория для хранения резервных копий
        """
        self.db_name = db_name
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(parents=True, exist_ok=True)

    def create_backup(self) -> Path:
        """
        Создание резервной копии базы данных с использованием psycopg2
        
        :return: Путь к файлу резервной копии
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = self.backup_dir / f"backup_{self.db_name}_{timestamp}.json"
        
        try:
            # Получаем параметры подключения к базе данных из переменных окружения
            from app.core.config import settings
            
            db_host = settings.POSTGRES_HOST
            db_port = settings.POSTGRES_PORT
            db_user = settings.POSTGRES_USER
            db_password = settings.POSTGRES_PASSWORD
            db_name = self.db_name
            
            # Подключаемся к базе данных
            conn = psycopg2.connect(
                host=db_host,
                port=db_port,
                user=db_user,
                password=db_password,
                dbname=db_name
            )
            
            # Получаем список всех таблиц в базе данных
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                """)
                tables = [row[0] for row in cursor.fetchall()]
            
            # Создаем структуру для хранения данных
            backup_data = {
                "metadata": {
                    "database": self.db_name,
                    "created_at": datetime.now().isoformat(),
                    "version": "1.0",
                    "tables": tables
                },
                "tables": {}
            }
            
            # Для каждой таблицы получаем структуру и данные
            for table in tables:
                with conn.cursor() as cursor:
                    # Получаем структуру таблицы
                    cursor.execute(f"""
                        SELECT column_name, data_type 
                        FROM information_schema.columns 
                        WHERE table_name = '{table}'
                    """)
                    columns = [(row[0], row[1]) for row in cursor.fetchall()]
                    
                    # Получаем данные таблицы
                    cursor.execute(f"SELECT * FROM {table}")
                    rows = cursor.fetchall()
                    
                    # Преобразуем данные в список словарей
                    table_data = []
                    for row in rows:
                        row_dict = {}
                        for i, col in enumerate(columns):
                            # Преобразуем типы данных, которые не сериализуются в JSON
                            value = row[i]
                            if isinstance(value, datetime):
                                value = value.isoformat()
                            elif hasattr(value, '__str__'):
                                value = str(value)
                            row_dict[col[0]] = value
                        table_data.append(row_dict)
                    
                    # Добавляем данные таблицы в общую структуру
                    backup_data["tables"][table] = {
                        "columns": columns,
                        "data": table_data
                    }
            
            conn.close()
            
            # Сохраняем данные в JSON-файл
            with open(backup_file, 'w', encoding='utf-8') as f:
                json.dump(backup_data, f, indent=4, ensure_ascii=False)
                f.flush()
                os.fsync(f.fileno())
            
            logger.info(f"Backup created successfully: {backup_file}")
            
            # Проверяем, что файл существует
            if backup_file.exists():
                logger.info(f"Backup file confirmed on disk: {backup_file}")
            else:
                logger.warning(f"Backup file not found after creation: {backup_file}")
            
            return backup_file
            
        except Exception as e:
            logger.error(f"Failed to create backup: {e}")
            raise

    def restore_backup(self, backup_file: Path) -> None:
        """
        Восстановление базы данных из резервной копии с использованием psycopg2
        
        :param backup_file: Путь к файлу резервной копии
        """
        try:
            # Проверяем, что файл резервной копии существует
            if not backup_file.exists():
                raise FileNotFoundError(f"Backup file not found: {backup_file}")
            
            # Загружаем данные из файла резервной копии
            with open(backup_file, 'r', encoding='utf-8') as f:
                backup_data = json.load(f)
            
            # Получаем параметры подключения к базе данных из переменных окружения
            from app.core.config import settings
            
            db_host = settings.POSTGRES_HOST
            db_port = settings.POSTGRES_PORT
            db_user = settings.POSTGRES_USER
            db_password = settings.POSTGRES_PASSWORD
            db_name = self.db_name
            
            # Подключаемся к базе данных с правами администратора
            conn = psycopg2.connect(
                host=db_host,
                port=db_port,
                user=db_user,
                password=db_password,
                dbname="postgres"  # Подключаемся к системной базе данных для административных операций
            )
            conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)  # Необходимо для создания/удаления баз данных
            
            # Отключаем все соединения с базой данных
            with conn.cursor() as cursor:
                cursor.execute(f"""
                    SELECT pg_terminate_backend(pid) 
                    FROM pg_stat_activity 
                    WHERE datname = '{db_name}' AND pid <> pg_backend_pid()
                """)
            
            # Удаляем существующую базу данных
            with conn.cursor() as cursor:
                cursor.execute(f"DROP DATABASE IF EXISTS {db_name}")
            
            # Создаем новую пустую базу данных
            with conn.cursor() as cursor:
                cursor.execute(f"CREATE DATABASE {db_name}")
            
            conn.close()
            
            # Подключаемся к базе данных
            conn = psycopg2.connect(
                host=db_host,
                port=db_port,
                user=db_user,
                password=db_password,
                dbname=db_name
            )
            conn.autocommit = True
            
            # Создаем необходимые ENUM типы в соответствии с моделями SQLAlchemy
            with conn.cursor() as cursor:
                # Создаем тип UserRole и функцию приведения типов
                try:
                    cursor.execute("""
                        DO $$
                        BEGIN
                            -- Создаем тип, если не существует
                            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN
                                CREATE TYPE "userrole" AS ENUM ('admin', 'doctor', 'patient', 'reception');
                            END IF;
                            
                            -- Создаем функцию приведения типа
                            CREATE OR REPLACE FUNCTION text_to_userrole(text) RETURNS "userrole" AS $$
                            BEGIN
                                RETURN $1::"userrole";
                            EXCEPTION
                                WHEN invalid_text_representation THEN
                                    RETURN 'patient'::"userrole";
                            END;
                            $$ LANGUAGE plpgsql IMMUTABLE;
                            
                            -- Создаем оператор приведения
                            DROP CAST IF EXISTS (text AS "userrole");
                            CREATE CAST (text AS "userrole") WITH FUNCTION text_to_userrole(text) AS IMPLICIT;
                        END
                        $$;
                    """)
                    logger.info("Created ENUM type UserRole and cast function")
                except Exception as e:
                    logger.error(f"Error creating ENUM type UserRole: {e}")
                
                # Создаем тип AppointmentStatus и функцию приведения типов
                try:
                    cursor.execute("""
                        DO $$
                        BEGIN
                            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointmentstatus') THEN
                                CREATE TYPE "appointmentstatus" AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');
                            END IF;
                            
                            -- Создаем функцию приведения типа
                            CREATE OR REPLACE FUNCTION text_to_appointmentstatus(text) RETURNS "appointmentstatus" AS $$
                            BEGIN
                                RETURN $1::"appointmentstatus";
                            EXCEPTION
                                WHEN invalid_text_representation THEN
                                    RETURN 'scheduled'::"appointmentstatus";
                            END;
                            $$ LANGUAGE plpgsql IMMUTABLE;
                            
                            -- Создаем оператор приведения
                            DROP CAST IF EXISTS (text AS "appointmentstatus");
                            CREATE CAST (text AS "appointmentstatus") WITH FUNCTION text_to_appointmentstatus(text) AS IMPLICIT;
                        END
                        $$;
                    """)
                    logger.info("Created ENUM type AppointmentStatus and cast function")
                except Exception as e:
                    logger.error(f"Error creating ENUM type AppointmentStatus: {e}")
                
                # Создаем тип ServiceCategory и функцию приведения типов
                try:
                    cursor.execute("""
                        DO $$
                        BEGIN
                            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'servicecategory') THEN
                                CREATE TYPE "servicecategory" AS ENUM ('therapy', 'surgery', 'diagnostics', 'consultation', 'prevention');
                            END IF;
                            
                            -- Создаем функцию приведения типа
                            CREATE OR REPLACE FUNCTION text_to_servicecategory(text) RETURNS "servicecategory" AS $$
                            BEGIN
                                RETURN $1::"servicecategory";
                            EXCEPTION
                                WHEN invalid_text_representation THEN
                                    RETURN 'consultation'::"servicecategory";
                            END;
                            $$ LANGUAGE plpgsql IMMUTABLE;
                            
                            -- Создаем оператор приведения
                            DROP CAST IF EXISTS (text AS "servicecategory");
                            CREATE CAST (text AS "servicecategory") WITH FUNCTION text_to_servicecategory(text) AS IMPLICIT;
                        END
                        $$;
                    """)
                    logger.info("Created ENUM type ServiceCategory and cast function")
                except Exception as e:
                    logger.error(f"Error creating ENUM type ServiceCategory: {e}")
                
                # Создаем тип PaymentStatus и функцию приведения типов
                try:
                    cursor.execute("""
                        DO $$
                        BEGIN
                            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'paymentstatus') THEN
                                CREATE TYPE "paymentstatus" AS ENUM ('pending', 'completed', 'failed', 'refunded');
                            END IF;
                            
                            -- Создаем функцию приведения типа
                            CREATE OR REPLACE FUNCTION text_to_paymentstatus(text) RETURNS "paymentstatus" AS $$
                            BEGIN
                                RETURN $1::"paymentstatus";
                            EXCEPTION
                                WHEN invalid_text_representation THEN
                                    RETURN 'pending'::"paymentstatus";
                            END;
                            $$ LANGUAGE plpgsql IMMUTABLE;
                            
                            -- Создаем оператор приведения
                            DROP CAST IF EXISTS (text AS "paymentstatus");
                            CREATE CAST (text AS "paymentstatus") WITH FUNCTION text_to_paymentstatus(text) AS IMPLICIT;
                        END
                        $$;
                    """)
                    logger.info("Created ENUM type PaymentStatus and cast function")
                except Exception as e:
                    logger.error(f"Error creating ENUM type PaymentStatus: {e}")
                
                # Создаем тип PaymentMethod и функцию приведения типов
                try:
                    cursor.execute("""
                        DO $$
                        BEGIN
                            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'paymentmethod') THEN
                                CREATE TYPE "paymentmethod" AS ENUM ('cash', 'card', 'insurance');
                            END IF;
                            
                            -- Создаем функцию приведения типа
                            CREATE OR REPLACE FUNCTION text_to_paymentmethod(text) RETURNS "paymentmethod" AS $$
                            BEGIN
                                RETURN $1::"paymentmethod";
                            EXCEPTION
                                WHEN invalid_text_representation THEN
                                    RETURN 'card'::"paymentmethod";
                            END;
                            $$ LANGUAGE plpgsql IMMUTABLE;
                            
                            -- Создаем оператор приведения
                            DROP CAST IF EXISTS (text AS "paymentmethod");
                            CREATE CAST (text AS "paymentmethod") WITH FUNCTION text_to_paymentmethod(text) AS IMPLICIT;
                        END
                        $$;
                    """)
                    logger.info("Created ENUM type PaymentMethod and cast function")
                except Exception as e:
                    logger.error(f"Error creating ENUM type PaymentMethod: {e}")
                
                # Создаем тип NotificationType и функцию приведения типов
                try:
                    cursor.execute("""
                        DO $$
                        BEGIN
                            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notificationtype') THEN
                                CREATE TYPE "notificationtype" AS ENUM ('appointment', 'reminder', 'system', 'payment');
                            END IF;
                            
                            -- Создаем функцию приведения типа
                            CREATE OR REPLACE FUNCTION text_to_notificationtype(text) RETURNS "notificationtype" AS $$
                            BEGIN
                                RETURN $1::"notificationtype";
                            EXCEPTION
                                WHEN invalid_text_representation THEN
                                    RETURN 'system'::"notificationtype";
                            END;
                            $$ LANGUAGE plpgsql IMMUTABLE;
                            
                            -- Создаем оператор приведения
                            DROP CAST IF EXISTS (text AS "notificationtype");
                            CREATE CAST (text AS "notificationtype") WITH FUNCTION text_to_notificationtype(text) AS IMPLICIT;
                        END
                        $$;
                    """)
                    logger.info("Created ENUM type NotificationType and cast function")
                except Exception as e:
                    logger.error(f"Error creating ENUM type NotificationType: {e}")
                
                # Создаем тип SpecialDayType и функцию приведения типов
                try:
                    cursor.execute("""
                        DO $$
                        BEGIN
                            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'specialdaytype') THEN
                                CREATE TYPE "specialdaytype" AS ENUM ('holiday', 'vacation', 'sick_leave', 'training');
                            END IF;
                            
                            -- Создаем функцию приведения типа
                            CREATE OR REPLACE FUNCTION text_to_specialdaytype(text) RETURNS "specialdaytype" AS $$
                            BEGIN
                                RETURN $1::"specialdaytype";
                            EXCEPTION
                                WHEN invalid_text_representation THEN
                                    RETURN 'holiday'::"specialdaytype";
                            END;
                            $$ LANGUAGE plpgsql IMMUTABLE;
                            
                            -- Создаем оператор приведения
                            DROP CAST IF EXISTS (text AS "specialdaytype");
                            CREATE CAST (text AS "specialdaytype") WITH FUNCTION text_to_specialdaytype(text) AS IMPLICIT;
                        END
                        $$;
                    """)
                    logger.info("Created ENUM type SpecialDayType and cast function")
                except Exception as e:
                    logger.error(f"Error creating ENUM type SpecialDayType: {e}")
                
                # Создаем тип TreatmentStatus и функцию приведения типов
                try:
                    cursor.execute("""
                        DO $$
                        BEGIN
                            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'treatmentstatus') THEN
                                CREATE TYPE "treatmentstatus" AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
                            END IF;
                            
                            -- Создаем функцию приведения типа
                            CREATE OR REPLACE FUNCTION text_to_treatmentstatus(text) RETURNS "treatmentstatus" AS $$
                            BEGIN
                                RETURN $1::"treatmentstatus";
                            EXCEPTION
                                WHEN invalid_text_representation THEN
                                    RETURN 'planned'::"treatmentstatus";
                            END;
                            $$ LANGUAGE plpgsql IMMUTABLE;
                            
                            -- Создаем оператор приведения
                            DROP CAST IF EXISTS (text AS "treatmentstatus");
                            CREATE CAST (text AS "treatmentstatus") WITH FUNCTION text_to_treatmentstatus(text) AS IMPLICIT;
                        END
                        $$;
                    """)
                    logger.info("Created ENUM type TreatmentStatus and cast function")
                except Exception as e:
                    logger.error(f"Error creating ENUM type TreatmentStatus: {e}")
                
                # Создаем тип RecordType и функцию приведения типов
                try:
                    cursor.execute("""
                        DO $$
                        BEGIN
                            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recordtype') THEN
                                CREATE TYPE "recordtype" AS ENUM ('note', 'prescription', 'diagnosis', 'test_result', 'examination');
                            END IF;
                            
                            -- Создаем функцию приведения типа
                            CREATE OR REPLACE FUNCTION text_to_recordtype(text) RETURNS "recordtype" AS $$
                            BEGIN
                                RETURN $1::"recordtype";
                            EXCEPTION
                                WHEN invalid_text_representation THEN
                                    RETURN 'note'::"recordtype";
                            END;
                            $$ LANGUAGE plpgsql IMMUTABLE;
                            
                            -- Создаем оператор приведения
                            DROP CAST IF EXISTS (text AS "recordtype");
                            CREATE CAST (text AS "recordtype") WITH FUNCTION text_to_recordtype(text) AS IMPLICIT;
                        END
                        $$;
                    """)
                    logger.info("Created ENUM type RecordType and cast function")
                except Exception as e:
                    logger.error(f"Error creating ENUM type RecordType: {e}")
                
                # Создаем тип RecordStatus и функцию приведения типов
                try:
                    cursor.execute("""
                        DO $$
                        BEGIN
                            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recordstatus') THEN
                                CREATE TYPE "recordstatus" AS ENUM ('active', 'archived', 'deleted');
                            END IF;
                            
                            -- Создаем функцию приведения типа
                            CREATE OR REPLACE FUNCTION text_to_recordstatus(text) RETURNS "recordstatus" AS $$
                            BEGIN
                                RETURN $1::"recordstatus";
                            EXCEPTION
                                WHEN invalid_text_representation THEN
                                    RETURN 'active'::"recordstatus";
                            END;
                            $$ LANGUAGE plpgsql IMMUTABLE;
                            
                            -- Создаем оператор приведения
                            DROP CAST IF EXISTS (text AS "recordstatus");
                            CREATE CAST (text AS "recordstatus") WITH FUNCTION text_to_recordstatus(text) AS IMPLICIT;
                        END
                        $$;
                    """)
                    logger.info("Created ENUM type RecordStatus and cast function")
                except Exception as e:
                    logger.error(f"Error creating ENUM type RecordStatus: {e}")
                    
                # Создаем тип CertificateStatus и функцию приведения типов
                try:
                    cursor.execute("""
                        DO $$
                        BEGIN
                            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'certificatestatus') THEN
                                CREATE TYPE "certificatestatus" AS ENUM ('issued', 'cancelled');
                            END IF;
                            
                            -- Создаем функцию приведения типа
                            CREATE OR REPLACE FUNCTION text_to_certificatestatus(text) RETURNS "certificatestatus" AS $$
                            BEGIN
                                RETURN $1::"certificatestatus";
                            EXCEPTION
                                WHEN invalid_text_representation THEN
                                    RETURN 'issued'::"certificatestatus";
                            END;
                            $$ LANGUAGE plpgsql IMMUTABLE;
                            
                            -- Создаем оператор приведения
                            DROP CAST IF EXISTS (text AS "certificatestatus");
                            CREATE CAST (text AS "certificatestatus") WITH FUNCTION text_to_certificatestatus(text) AS IMPLICIT;
                        END
                        $$;
                    """)
                    logger.info("Created ENUM type CertificateStatus and cast function")
                except Exception as e:
                    logger.error(f"Error creating ENUM type CertificateStatus: {e}")
            
            # Для каждой таблицы восстанавливаем структуру и данные
            for table_name, table_data in backup_data["tables"].items():
                try:
                    # Проверяем, является ли это представлением (view)
                    if table_name.endswith('_view'):
                        logger.info(f"Skipping view {table_name} during restore - views will be recreated by the application")
                        continue
                    
                    # Получаем структуру таблицы
                    columns = table_data["columns"]
                    
                    # Создаем SQL-запрос для создания таблицы
                    create_table_sql = f"CREATE TABLE IF NOT EXISTS {table_name} (\n"
                    
                    # Добавляем определения столбцов
                    columns_definitions = []
                    for column_name, column_type in columns:
                        # Обрабатываем специальные типы данных
                        if column_type == 'USER-DEFINED':
                            # Заменяем USER-DEFINED на text для совместимости
                            column_type = 'text'
                        elif column_type == 'ARRAY':
                            # Заменяем ARRAY на text[] для совместимости
                            column_type = 'text[]'
                        elif column_type == 'json':
                            # Оставляем json как есть, но будем обрабатывать NULL значения при вставке
                            pass
                        # Обрабатываем типы данных с указанием размера или точности
                        elif column_type.startswith('character varying'):
                            # Оставляем как есть
                            pass
                        # Добавляем определение колонки в SQL запрос
                        columns_definitions.append(f"    {column_name} {column_type}")
                    
                    # Добавляем первичный ключ, если это таблица users
                    if table_name == 'users':
                        columns_definitions.append("    PRIMARY KEY (id)")
                    
                    create_table_sql += ",\n".join(columns_definitions)
                    create_table_sql += "\n);"
                    
                    # Выполняем SQL-запрос для создания таблицы
                    with conn.cursor() as cursor:
                        cursor.execute(create_table_sql)
                    
                    logger.info(f"Created table {table_name} with columns: {columns}")
                    
                    # Заполняем таблицу данными
                    rows = table_data["data"]
                    
                    # Если есть данные для вставки
                    if rows:
                        for row in rows:
                            try:
                                # Создаем SQL-запрос для вставки данных
                                columns_str = ", ".join(row.keys())
                                
                                # Используем формат %s вместо $1, $2, ...
                                placeholders = ", ".join(["%s" for _ in range(len(row))])
                                insert_sql = f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders})"
                                
                                # Преобразуем значения для совместимости
                                values = []
                                column_types = {col[0]: col[1] for col in columns}  # Создаем словарь типов колонок
                                
                                for col_name, value in row.items():
                                    # Получаем тип колонки, если доступен
                                    col_type = column_types.get(col_name, '')
                                    
                                    if value is None or value == 'None' or value == 'null':
                                        # Обрабатываем NULL значения и их строковые представления
                                        values.append(None)
                                    elif isinstance(value, list) or col_type == 'ARRAY' or col_type == 'text[]':
                                        # Преобразуем списки в формат PostgreSQL массивов
                                        if not value or value == '[]':
                                            # Пустой список
                                            values.append('{}')
                                        elif isinstance(value, str) and (value.startswith('[') and value.endswith(']')):
                                            # Строковое представление списка
                                            try:
                                                # Пробуем преобразовать строку в список
                                                list_value = json.loads(value)
                                                array_str = '{' + ','.join([str(item).replace("'", "\"") for item in list_value]) + '}'
                                                values.append(array_str)
                                            except json.JSONDecodeError:
                                                # Если не удалось преобразовать, используем пустой массив
                                                values.append('{}')
                                        else:
                                            # Формируем правильный литерал массива PostgreSQL
                                            array_str = '{' + ','.join([str(item).replace("'", "\"") for item in value]) + '}'
                                            values.append(array_str)
                                    elif col_type == 'json' or col_type == 'jsonb':
                                        # Обрабатываем JSON данные
                                        if isinstance(value, str):
                                            if value.lower() == 'none' or value.lower() == 'null':
                                                values.append(None)
                                            else:
                                                try:
                                                    # Проверяем, что строка является допустимым JSON
                                                    json.loads(value)
                                                    values.append(value)
                                                except json.JSONDecodeError:
                                                    # Если не является допустимым JSON, создаем пустой объект
                                                    values.append('{}')
                                        else:
                                            # Преобразуем в JSON строку
                                            try:
                                                values.append(json.dumps(value))
                                            except:
                                                values.append('{}')
                                    elif col_type.startswith('time') and (value == 'None' or value == 'null'):
                                        # Обрабатываем специально временные типы
                                        values.append(None)
                                    else:
                                        values.append(value)
                                
                                # Выполняем SQL-запрос для вставки данных
                                with conn.cursor() as cursor:
                                    cursor.execute(insert_sql, values)
                            except Exception as e:
                                logger.error(f"Error inserting row into {table_name}: {e}")
                                # Продолжаем со следующей строкой
                        
                        logger.info(f"Inserted {len(rows)} rows into table {table_name}")
                except Exception as e:
                    logger.error(f"Error restoring table {table_name}: {e}")
                    # Продолжаем с другими таблицами
            
            conn.close()
            
            logger.info(f"Database restored successfully from backup: {backup_file}")
        except Exception as e:
            logger.error(f"Failed to restore database: {e}")
            raise

    def list_backups(self) -> list[Path]:
        """
        Получение списка файлов резервных копий
        
        :return: Список путей к файлам резервных копий
        """
        # Убедимся, что директория существует
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        # Обновляем список файлов в директории (иногда требуется для Windows)
        import os
        os.sync() if hasattr(os, 'sync') else None
        
        # Используем более гибкий шаблон для поиска файлов
        pattern = f"backup_{self.db_name}_*.json"
        backup_files = list(self.backup_dir.glob(pattern))
        
        # Если файлы не найдены, попробуем поискать по менее строгому шаблону
        if not backup_files:
            pattern = f"backup_*.json"
            backup_files = list(self.backup_dir.glob(pattern))
        
        logger.info(f"Found {len(backup_files)} backup files in {self.backup_dir}")
        
        return sorted(
            backup_files,
            key=lambda x: x.stat().st_mtime,
            reverse=True
        )

    def cleanup_old_backups(self, keep_last: int = 5) -> None:
        """
        Удаление старых резервных копий, оставляя только указанное количество последних
        
        :param keep_last: Количество последних резервных копий, которые нужно сохранить
        """
        backups = self.list_backups()
        for backup in backups[keep_last:]:
            try:
                backup.unlink()
                logger.info(f"Deleted old backup: {backup}")
            except Exception as e:
                logger.error(f"Failed to delete backup {backup}: {e}")

# Функции для создания SQL-функций для работы с бэкапами
create_backup_functions = """
-- Функция для создания резервной копии
CREATE OR REPLACE FUNCTION create_database_backup()
RETURNS TEXT AS $$
DECLARE
    backup_path TEXT;
BEGIN
    SELECT INTO backup_path 'backups/backup_' || current_database() || '_' || 
           to_char(current_timestamp, 'YYYYMMDD_HH24MISS') || '.sql';
    
    PERFORM pg_catalog.pg_dump(current_database(), backup_path);
    
    INSERT INTO action_logs (table_name, action_type, description)
    VALUES ('system', 'backup', 'Created database backup: ' || backup_path);
    
    RETURN backup_path;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения списка резервных копий
CREATE OR REPLACE FUNCTION list_database_backups()
RETURNS TABLE (
    backup_file TEXT,
    created_at TIMESTAMP,
    size_bytes BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pg_ls_dir('backups')::TEXT as backup_file,
        pg_stat_file('backups/' || pg_ls_dir('backups')).modification::TIMESTAMP as created_at,
        pg_stat_file('backups/' || pg_ls_dir('backups')).size as size_bytes
    WHERE pg_ls_dir('backups') LIKE 'backup_%'
    ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql;"""
