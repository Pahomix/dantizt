# Запуск проекта Dantizt через Docker

Этот документ содержит инструкции по запуску проекта Dantizt с использованием Docker и Docker Compose.

## Предварительные требования

- Docker
- Docker Compose
- Доступ к серверу с открытыми портами 80 и 443

## Структура проекта

- `dantizt-api` - Backend API на FastAPI
- `dantizt-front` - Frontend на Next.js
- `nginx` - Nginx конфигурация для обратного прокси
- `docker-compose.app.yml` - Конфигурация Docker Compose для запуска приложения

## Настройка SSL-сертификатов

Для работы с HTTPS вам необходимо добавить SSL-сертификаты в директорию `nginx/ssl/`:

```
nginx/ssl/
├── fullchain.pem  # Полная цепочка сертификатов
└── privkey.pem    # Приватный ключ
```

Вы можете получить сертификаты с помощью Let's Encrypt или использовать самоподписанные сертификаты для разработки.

### Использование Let's Encrypt

1. Установите certbot на вашем сервере
2. Получите сертификаты:
   ```bash
   certbot certonly --standalone -d dantizt.ru -d www.dantizt.ru
   ```
3. Скопируйте сертификаты в директорию `nginx/ssl/`:
   ```bash
   cp /etc/letsencrypt/live/dantizt.ru/fullchain.pem nginx/ssl/
   cp /etc/letsencrypt/live/dantizt.ru/privkey.pem nginx/ssl/
   ```

## Настройка переменных окружения

### Backend (dantizt-api)

Создайте файл `.env` в директории `dantizt-api/`:

```
DATABASE_URL=postgresql://postgres:postgres@db:5432/dantizt_db
SECRET_KEY=your_secret_key_here
DEBUG=False
```

### Frontend (dantizt-front)

Создайте файл `.env` в директории `dantizt-front/`:

```
NEXT_PUBLIC_API_URL=http://api:8000
```

## Запуск проекта

1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/your-username/dantizt.git
   cd dantizt
   ```

2. Запустите проект с помощью Docker Compose:
   ```bash
   docker-compose -f docker-compose.app.yml up -d
   ```

3. Проверьте, что все контейнеры запущены:
   ```bash
   docker-compose -f docker-compose.app.yml ps
   ```

## Доступ к приложению

- Frontend: https://www.dantizt.ru
- API: https://www.dantizt.ru/api

## Остановка проекта

```bash
docker-compose -f docker-compose.app.yml down
```

## Обновление проекта

1. Остановите проект:
   ```bash
   docker-compose -f docker-compose.app.yml down
   ```

2. Обновите код из репозитория:
   ```bash
   git pull
   ```

3. Пересоберите и запустите контейнеры:
   ```bash
   docker-compose -f docker-compose.app.yml up -d --build
   ```

## Просмотр логов

```bash
# Все логи
docker-compose -f docker-compose.app.yml logs

# Логи конкретного сервиса
docker-compose -f docker-compose.app.yml logs api
docker-compose -f docker-compose.app.yml logs front
docker-compose -f docker-compose.app.yml logs nginx
```

## Резервное копирование базы данных

```bash
docker exec dantizt_db pg_dump -U postgres dantizt_db > backup_$(date +%Y%m%d).sql
```

## Восстановление базы данных из резервной копии

```bash
cat backup_YYYYMMDD.sql | docker exec -i dantizt_db psql -U postgres -d dantizt_db
```
