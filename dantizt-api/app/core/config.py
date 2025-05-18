from pydantic_settings import BaseSettings
from typing import Optional, List, Union
from functools import lru_cache
import logging

class Settings(BaseSettings):
    # API
    API_V1_STR: str = "/api/v1"
    
    # Project info
    PROJECT_NAME: str = "Dantizt"
    PROJECT_VERSION: str = "1.0.0"
    PROJECT_DESCRIPTION: str = "API for dental clinic management system"
    
    # Server
    SERVER_HOST: str = "http://localhost:8000"
    SERVER_PORT: int = 8000
    DEBUG_MODE: bool = True
    WORKERS_COUNT: int = 1
    
    # Frontend
    FRONTEND_URL: str = "http://dantizt.ru" 
    FRONTEND_DEV_URL: str = "http://localhost:3000" 
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001"
    ]
    
    # Database
    SQLALCHEMY_DATABASE_URI: str
    DATABASE_URL: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    POSTGRES_HOST: str
    POSTGRES_PORT: str
    
    # JWT Settings
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Cookie settings
    COOKIE_SECURE: bool = False  # В продакшене установить True
    COOKIE_SAMESITE: str = "none"  # В продакшене установить "lax"
    COOKIE_DOMAIN: str | None = None
    
    # Admin
    ADMIN_EMAIL: str = "admin@example.com"
    ADMIN_PASSWORD: str = "admin123"
    ADMIN_FULL_NAME: str = "System Administrator"

    # Настройки почтового сервера
    MAIL_USERNAME: str = "pahomixmc@gmail.com"
    MAIL_PASSWORD: str = "kzyb ohqh vimh hxtz"
    MAIL_FROM: str = "pahomixmc@gmail.com"
    MAIL_FROM_NAME: str = "Dental Clinic"
    MAIL_PORT: int = 465
    MAIL_SERVER: str = "smtp.gmail.com"

    AUTO_CREATE_TABLES: bool = True

    # Tinkoff API settings
    TINKOFF_TERMINAL_KEY: str = ""
    TINKOFF_PASSWORD: str = "" 
    TINKOFF_IS_TEST: bool = True 
    TINKOFF_SUCCESS_URL: str = ""
    TINKOFF_FAIL_URL: str = ""
    TINKOFF_NOTIFICATION_URL: str = ""

    model_config = {
        "env_file": ".env",
        "extra": "ignore",
        "env_file_encoding": "utf-8"
    }

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
