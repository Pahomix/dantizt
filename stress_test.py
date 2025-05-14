"""
Скрипт для имитации нагрузки на API и вызова алертов.
"""
import requests
import time
import random
import threading
import logging

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Базовый URL API
BASE_URL = "http://localhost:8000"

# Список эндпоинтов для тестирования
ENDPOINTS = [
    # Основные эндпоинты
    "/api/v1/auth/me",
    "/api/v1/users/",
    "/api/v1/patients",
    "/api/v1/doctors",
    "/api/v1/services",
    "/api/v1/appointments/",
    "/api/v1/specializations/",
    "/api/v1/payments/",
    "/api/v1/statistics/clinic",
    "/api/v1/medical-records/patient/1",
    "/api/v1/notifications/unread-count/1",
    "/api/v1/schedules/doctors/1/availability",
    "/non-existent-endpoint"  # Этот эндпоинт вызовет 404 ошибку
]

# Данные для аутентификации
AUTH_DATA = {
    "email": "test@example.com",
    "password": "password123"
}

# Данные для регистрации
REGISTER_DATA = {
    "email": "test@example.com",
    "password": "password123",
    "full_name": "Test User",
    "phone_number": "+1234567890"
}

# Глобальный токен доступа
ACCESS_TOKEN = None

def register():
    """
    Регистрирует нового пользователя.
    """
    url = f"{BASE_URL}/api/v1/auth/register"
    try:
        response = requests.post(url, json=REGISTER_DATA, timeout=5)
        if response.status_code == 201 or response.status_code == 200:
            logger.info(f"Successfully registered a new user.")
            return True
        elif response.status_code == 400 and "already exists" in response.text.lower():
            logger.info(f"User already exists, proceeding to login.")
            return True
        else:
            logger.warning(f"Registration failed. Status code: {response.status_code}")
            logger.warning(f"Response: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        logger.error(f"Registration request error: {str(e)}")
        return False

def login():
    """
    Выполняет вход в систему и получает токен доступа.
    """
    global ACCESS_TOKEN
    url = f"{BASE_URL}/api/v1/auth/login"
    try:
        # Сначала пробуем JSON
        logger.info(f"Attempting to login with JSON: {AUTH_DATA}")
        response = requests.post(url, json=AUTH_DATA, timeout=5)
        
        # Если не удалось, пробуем form-data
        if response.status_code != 200:
            logger.info("Trying form-data login...")
            form_data = {
                "username": AUTH_DATA["email"],  # OAuth2 использует username вместо email
                "password": AUTH_DATA["password"]
            }
            response = requests.post(f"{BASE_URL}/api/v1/auth/login/form", data=form_data, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"Login response: {data}")
            ACCESS_TOKEN = data.get("access_token")
            if not ACCESS_TOKEN:
                # Проверяем альтернативные названия полей
                ACCESS_TOKEN = data.get("token") or data.get("accessToken")
            logger.info(f"Successfully logged in. Token received.")
            return True
        else:
            logger.error(f"Login failed. Status code: {response.status_code}")
            logger.error(f"Response: {response.text}")
            # Если не можем войти, используем фиктивный токен для тестирования
            ACCESS_TOKEN = "test_token_for_metrics"
            return False
    except requests.exceptions.RequestException as e:
        logger.error(f"Login request error: {str(e)}")
        # Используем фиктивный токен для тестирования
        ACCESS_TOKEN = "test_token_for_metrics"
        return False

def send_request(endpoint, method="GET", data=None):
    """
    Отправляет запрос к API и обрабатывает ответ.
    """
    url = f"{BASE_URL}{endpoint}"
    headers = {}
    
    # Добавляем токен аутентификации, если он есть
    if ACCESS_TOKEN:
        headers["Authorization"] = f"Bearer {ACCESS_TOKEN}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, timeout=2)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=2)
        elif method.upper() == "PUT":
            response = requests.put(url, json=data, headers=headers, timeout=2)
        else:
            logger.error(f"Unsupported method: {method}")
            return False
        
        # Обработка ответа в соответствии с особенностями API
        if response.status_code == 401 or response.status_code == 404:
            # 401 и 404 ошибки считаются нормальными для тестирования
            logger.info(f"Successful request (expected {response.status_code}): {url}")
            return True
        elif response.status_code >= 200 and response.status_code < 300:
            logger.info(f"Successful request: {url}")
            return True
        else:
            logger.warning(f"Failed request: {url}, Status code: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error: {url}, Error: {str(e)}")
        return False

def normal_load():
    """
    Имитирует нормальную нагрузку на API.
    """
    logger.info("Starting normal load test...")
    for _ in range(50):
        endpoint = random.choice(ENDPOINTS)
        send_request(endpoint)
        time.sleep(random.uniform(0.1, 0.5))
    logger.info("Normal load test completed.")

def high_load():
    """
    Имитирует высокую нагрузку на API для вызова алерта HighRequestRate.
    """
    logger.info("Starting high load test...")
    threads = []
    for _ in range(20):
        thread = threading.Thread(target=lambda: [
            send_request(random.choice(ENDPOINTS)) 
            for _ in range(10)
        ])
        threads.append(thread)
        thread.start()
    
    for thread in threads:
        thread.join()
    
    logger.info("High load test completed.")

def error_load():
    """
    Имитирует запросы с ошибками для вызова алерта HighErrorRate.
    """
    logger.info("Starting error load test...")
    # Создаем несуществующие эндпоинты, которые вызовут ошибки
    error_endpoints = [f"/invalid/endpoint/{i}" for i in range(20)]
    
    for _ in range(50):
        endpoint = random.choice(error_endpoints)
        send_request(endpoint)
        time.sleep(random.uniform(0.05, 0.2))
    
    logger.info("Error load test completed.")

def latency_load():
    """
    Имитирует запросы, которые могут вызвать высокую задержку.
    """
    logger.info("Starting latency load test...")
    # Предполагаем, что эти эндпоинты могут быть медленными
    heavy_endpoints = [
        "/api/v1/statistics/clinic", 
        "/api/v1/medical-records/patient/1",
        "/api/v1/appointments/"
    ]
    
    for _ in range(30):
        endpoint = random.choice(heavy_endpoints)
        send_request(endpoint)
        time.sleep(random.uniform(0.1, 0.3))
    
    logger.info("Latency load test completed.")

def main():
    """
    Основная функция для запуска тестов нагрузки.
    """
    logger.info("Starting stress test...")
    
    # Сначала пробуем зарегистрироваться
    register_success = register()
    logger.info(f"Registration {'successful' if register_success else 'failed'}.")
    
    # Затем выполняем вход в систему
    login_success = login()
    logger.info(f"Login {'successful' if login_success else 'failed, using test token'}.")     
    # Сначала нормальная нагрузка
    normal_load()
    time.sleep(5)
    
    # Затем высокая нагрузка для вызова алерта
    high_load()
    logger.info("Waiting for alert to fire...")
    time.sleep(60)  # Ждем, чтобы алерт сработал
    
    # Возвращаемся к нормальной нагрузке для разрешения алерта
    logger.info("Returning to normal load...")
    normal_load()
    time.sleep(5)
    
    # Тест с ошибками
    error_load()
    logger.info("Waiting for error alert to fire...")
    time.sleep(60)  # Ждем, чтобы алерт сработал
    
    # Возвращаемся к нормальной нагрузке
    logger.info("Returning to normal load...")
    normal_load()
    
    logger.info("Stress test completed.")

if __name__ == "__main__":
    main()
