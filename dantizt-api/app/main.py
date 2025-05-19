from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.session import init_db
from app.core.logging_config import setup_logging
from app.middleware import RequestLoggingMiddleware
from app.api.v1.api import api_router
from app.core.metrics import setup_metrics

# Setup logging
logger = setup_logging()

app = FastAPI(
    title="DantiZT API",
    description="Dental Clinic Management System API",
    version="1.0.0",
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Настройка CORS - используем настройки из settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Content-Type",
        "Set-Cookie",
        "Access-Control-Allow-Headers",
        "Access-Control-Allow-Origin",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin"
    ],
    expose_headers=[
        "Set-Cookie",
        "Access-Control-Allow-Credentials"
    ],
)

# Add request logging middleware
app.add_middleware(RequestLoggingMiddleware)

# Setup Prometheus metrics
setup_metrics(app)

# Регистрация API роутера
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {
        "message": "Welcome to DantiZT API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }

@app.on_event("startup")
async def startup_event():
    await init_db()
    
    # Инициализация начальных значений метрик
    from app.core.metrics import update_active_users
    from app.db.session import get_db
    from sqlalchemy import func, select
    from app.db.models import User, UserRole
    
    # Асинхронная функция для обновления метрик пользователей
    async def init_user_metrics():
        async for db in get_db():
            # Получаем количество пользователей по ролям
            for role in UserRole:
                count = await db.execute(
                    select(func.count()).where(User.role == role.value)
                )
                count = count.scalar() or 0
                update_active_users(role.value, count)
    
    # Запускаем инициализацию метрик
    await init_user_metrics()