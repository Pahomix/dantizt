import logging
import sys
from pathlib import Path
from logging.handlers import RotatingFileHandler
from app.core.config import settings

# Create logs directory if it doesn't exist
logs_dir = Path("logs")
logs_dir.mkdir(exist_ok=True)

# Configure logging
def setup_logging():
    # Create formatters
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    # Create handlers
    # Используем stderr вместо stdout для гарантированного вывода в консоль
    console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setFormatter(console_formatter)
    
    file_handler = RotatingFileHandler(
        logs_dir / "app.log",
        maxBytes=10485760,  # 10MB
        backupCount=5,
        encoding="utf-8"
    )
    file_handler.setFormatter(file_formatter)

    # Set log levels based on environment
    # Всегда устанавливаем уровень DEBUG для консоли
    console_handler.setLevel(logging.DEBUG)
    file_handler.setLevel(logging.DEBUG)  # Также снижаем уровень для файла

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)  # Всегда устанавливаем DEBUG для корневого логгера
    
    # Удаляем существующие обработчики, чтобы избежать дублирования
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
        
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)

    # Configure uvicorn access logger
    uvicorn_logger = logging.getLogger("uvicorn.access")
    uvicorn_logger.handlers = []
    uvicorn_logger.addHandler(file_handler)
    uvicorn_logger.addHandler(console_handler)  # Добавляем консольный обработчик

    # Configure SQL Alchemy logger
    sqlalchemy_logger = logging.getLogger("sqlalchemy.engine")
    sqlalchemy_logger.setLevel(logging.WARNING)
    sqlalchemy_logger.addHandler(file_handler)
    
    # Configure API endpoints logger
    api_logger = logging.getLogger("app.api.v1.endpoints")
    api_logger.setLevel(logging.DEBUG)
    # Отключаем propagate, чтобы избежать дублирования сообщений
    api_logger.propagate = False
    
    # Удаляем существующие обработчики, чтобы избежать дублирования
    for handler in api_logger.handlers[:]:
        api_logger.removeHandler(handler)
        
    api_logger.addHandler(console_handler)
    api_logger.addHandler(file_handler)
    
    # Добавляем специальный логгер для auth.py
    auth_logger = logging.getLogger("app.api.v1.endpoints.auth")
    auth_logger.setLevel(logging.DEBUG)
    auth_logger.propagate = False
    
    # Удаляем существующие обработчики, чтобы избежать дублирования
    for handler in auth_logger.handlers[:]:
        auth_logger.removeHandler(handler)
        
    auth_logger.addHandler(console_handler)
    auth_logger.addHandler(file_handler)

    return root_logger
