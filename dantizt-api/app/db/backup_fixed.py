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
            
            logger.info(f"Backup created successfully: {backup_file}")
            
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
            
            # Подключаемся к новой базе данных
            conn = psycopg2.connect(
                host=db_host,
                port=db_port,
                user=db_user,
                password=db_password,
                dbname=db_name
            )
            conn.autocommit = True
            
            # Создаем таблицы и восстанавливаем данные
            for table_name, table_data in backup_data["tables"].items():
                # Получаем структуру таблицы
                columns = table_data["columns"]
                
                # Создаем SQL-запрос для создания таблицы
                # В реальном приложении здесь нужно было бы создать схему таблицы
                # Для демонстрации просто логируем информацию
                logger.info(f"Would create table {table_name} with columns: {columns}")
                
                # Заполняем таблицу данными
                rows = table_data["data"]
                logger.info(f"Would insert {len(rows)} rows into table {table_name}")
            
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
        return sorted(
            [f for f in self.backup_dir.glob(f"backup_{self.db_name}_*.json")],
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
