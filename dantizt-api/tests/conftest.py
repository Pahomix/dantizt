import pytest
import asyncio
from typing import Generator, AsyncGenerator
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.session import Base, get_db
from app.core.config import settings

# Используем тестовую базу данных
TEST_DATABASE_URL = settings.DATABASE_URL.replace(
    "/dantizt", "/dantizt_test"
)

# Создаем тестовый движок базы данных
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=test_engine, class_=AsyncSession
)

@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Создает экземпляр цикла событий для каждой тестовой сессии."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def setup_database() -> AsyncGenerator:
    """Создает таблицы в тестовой базе данных перед тестами и удаляет их после."""
    # Создаем таблицы
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    yield
    
    # Удаляем таблицы
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def db(setup_database) -> AsyncGenerator:
    """Создает новую сессию базы данных для каждого теста."""
    async with TestingSessionLocal() as session:
        try:
            yield session
        finally:
            await session.rollback()

# Переопределяем зависимость для получения сессии базы данных
async def override_get_db():
    async with TestingSessionLocal() as session:
        try:
            yield session
        finally:
            await session.rollback()

# Заменяем зависимость в приложении
app.dependency_overrides[get_db] = override_get_db

@pytest.fixture
def client() -> Generator:
    """Создает тестовый клиент для синхронных запросов."""
    with TestClient(app) as c:
        yield c

@pytest.fixture
async def async_client() -> AsyncGenerator:
    """Создает асинхронный тестовый клиент."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
