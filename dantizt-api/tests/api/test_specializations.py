import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import status

from app.db.models import User, Specialization
from app.core.security import create_access_token

pytestmark = pytest.mark.asyncio

@pytest.fixture
async def admin_token(db: AsyncSession):
    """Фикстура для создания токена администратора"""
    # Проверяем, существует ли уже администратор
    result = await db.execute(
        select(User).where(User.email == "admin@example.com")
    )
    admin_user = result.scalar_one_or_none()
    
    if not admin_user:
        # Создаем администратора, если его нет
        admin_user = User(
            email="admin@example.com",
            hashed_password="$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",  # "password"
            is_active=True,
            is_superuser=True,
            full_name="Admin User"
        )
        db.add(admin_user)
        await db.commit()
        await db.refresh(admin_user)
    
    # Создаем токен доступа для администратора
    access_token = create_access_token(
        data={"sub": admin_user.email, "is_superuser": admin_user.is_superuser}
    )
    return access_token

@pytest.fixture
async def regular_user_token(db: AsyncSession):
    """Фикстура для создания токена обычного пользователя"""
    # Проверяем, существует ли уже обычный пользователь
    result = await db.execute(
        select(User).where(User.email == "user@example.com")
    )
    user = result.scalar_one_or_none()
    
    if not user:
        # Создаем обычного пользователя, если его нет
        user = User(
            email="user@example.com",
            hashed_password="$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",  # "password"
            is_active=True,
            is_superuser=False,
            full_name="Regular User"
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    
    # Создаем токен доступа для обычного пользователя
    access_token = create_access_token(
        data={"sub": user.email, "is_superuser": user.is_superuser}
    )
    return access_token

async def test_create_specialization_admin(client: AsyncClient, admin_token: str, db: AsyncSession):
    """Тест создания специализации администратором"""
    # Данные для создания специализации
    specialization_data = {
        "name": "Тестовая специализация",
        "description": "Описание тестовой специализации",
        "appointment_duration": 45
    }
    
    # Отправляем запрос на создание специализации
    response = await client.post(
        "/api/v1/specializations/",
        json=specialization_data,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    # Проверяем статус ответа
    assert response.status_code == status.HTTP_200_OK
    
    # Проверяем данные в ответе
    data = response.json()
    assert data["name"] == specialization_data["name"]
    assert data["description"] == specialization_data["description"]
    assert data["appointment_duration"] == specialization_data["appointment_duration"]
    assert "id" in data
    
    # Проверяем, что специализация создана в базе данных
    result = await db.execute(
        select(Specialization).where(Specialization.id == data["id"])
    )
    db_specialization = result.scalar_one_or_none()
    assert db_specialization is not None
    assert db_specialization.name == specialization_data["name"]
    assert db_specialization.description == specialization_data["description"]
    assert db_specialization.appointment_duration == specialization_data["appointment_duration"]

async def test_create_specialization_regular_user(client: AsyncClient, regular_user_token: str):
    """Тест создания специализации обычным пользователем (должно быть запрещено)"""
    # Данные для создания специализации
    specialization_data = {
        "name": "Тестовая специализация от обычного пользователя",
        "description": "Описание тестовой специализации",
        "appointment_duration": 30
    }
    
    # Отправляем запрос на создание специализации
    response = await client.post(
        "/api/v1/specializations/",
        json=specialization_data,
        headers={"Authorization": f"Bearer {regular_user_token}"}
    )
    
    # Проверяем, что запрос запрещен
    assert response.status_code == status.HTTP_403_FORBIDDEN
    
    # Проверяем сообщение об ошибке
    data = response.json()
    assert "detail" in data
    assert "Only administrators can create specializations" in data["detail"]

async def test_create_specialization_no_auth(client: AsyncClient):
    """Тест создания специализации без аутентификации"""
    # Данные для создания специализации
    specialization_data = {
        "name": "Тестовая специализация без аутентификации",
        "description": "Описание тестовой специализации",
        "appointment_duration": 30
    }
    
    # Отправляем запрос на создание специализации без токена
    response = await client.post(
        "/api/v1/specializations/",
        json=specialization_data
    )
    
    # Проверяем, что запрос не авторизован
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

async def test_create_specialization_invalid_data(client: AsyncClient, admin_token: str):
    """Тест создания специализации с некорректными данными"""
    # Данные с отсутствующим обязательным полем name
    specialization_data = {
        "description": "Описание без имени",
        "appointment_duration": 30
    }
    
    # Отправляем запрос на создание специализации
    response = await client.post(
        "/api/v1/specializations/",
        json=specialization_data,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    # Проверяем, что запрос не прошел валидацию
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    # Проверяем сообщение об ошибке
    data = response.json()
    assert "detail" in data
    assert len(data["detail"]) > 0
    assert data["detail"][0]["loc"][1] == "name"  # Ошибка в поле name
