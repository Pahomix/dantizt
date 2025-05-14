import os
import subprocess
from datetime import datetime
import logging
from pathlib import Path

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
        Создание резервной копии базы данных
        
        :return: Путь к файлу резервной копии
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = self.backup_dir / f"backup_{self.db_name}_{timestamp}.sql"
        
        try:
            # Создание дампа базы данных
            command = [
                "pg_dump",
                "-d", self.db_name,
                "-f", str(backup_file),
                "--format=c"  # Использование пользовательского формата PostgreSQL
            ]
            
            subprocess.run(command, check=True)
            logger.info(f"Backup created successfully: {backup_file}")
            return backup_file
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to create backup: {e}")
            raise

    def restore_backup(self, backup_file: Path) -> None:
        """
        Восстановление базы данных из резервной копии
        
        :param backup_file: Путь к файлу резервной копии
        """
        try:
            # Восстановление базы данных из дампа
            command = [
                "pg_restore",
                "-d", self.db_name,
                "-c",  # Очистить (удалить) объекты базы данных перед восстановлением
                str(backup_file)
            ]
            
            subprocess.run(command, check=True)
            logger.info(f"Database restored successfully from {backup_file}")
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to restore backup: {e}")
            raise

    def list_backups(self) -> list[Path]:
        """
        Получение списка всех резервных копий
        
        :return: Список путей к файлам резервных копий
        """
        return sorted(
            [f for f in self.backup_dir.glob(f"backup_{self.db_name}_*.sql")],
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
$$ LANGUAGE plpgsql;
