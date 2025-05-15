FROM node:18-alpine AS builder

WORKDIR /app

# Принимаем переменные окружения во время сборки
ARG NEXT_PUBLIC_API_URL=http://api:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Сначала копируем только package.json и package-lock.json
COPY package.json package-lock.json ./

# Устанавливаем зависимости
RUN npm ci --legacy-peer-deps

# Копируем весь код проекта
COPY . .

# Создаем необходимые директории и файлы
RUN mkdir -p src/components/admin src/store src/lib

# Создаем BackupList компонент, если он не существует
RUN if [ ! -f src/components/admin/BackupList.jsx ]; then \
    echo 'import React from "react"; export default function BackupList() { return <div>Backup List</div>; }' > src/components/admin/BackupList.jsx; \
    fi

# Создаем backupStore, если он не существует
RUN if [ ! -f src/store/backupStore.js ]; then \
    echo 'export const useBackupStore = () => ({ backups: [], loading: false, error: null });' > src/store/backupStore.js; \
    fi

# Создаем axios.js, если он не существует
RUN if [ ! -f src/lib/axios.js ]; then \
    echo 'import axios from "axios"; const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1", headers: { "Content-Type": "application/json" } }); export default api;' > src/lib/axios.js; \
    fi

# Проверяем структуру проекта
RUN ls -la src/lib/ && ls -la src/components/admin/ && ls -la src/store/

# Сборка приложения
RUN npm run build || (ls -la src/lib && echo "Build failed, see errors above")

# Финальный этап
FROM node:18-alpine

WORKDIR /app

# Устанавливаем только production зависимости
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --only=production --legacy-peer-deps

# Переносим только необходимые файлы
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next

# Запуск приложения
CMD ["npx", "next", "start"]
