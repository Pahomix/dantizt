FROM node:20-alpine AS builder

WORKDIR /app

# Принимаем переменные окружения во время сборки
ARG NEXT_PUBLIC_API_URL=http://api:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Установка зависимостей и глобальная установка next
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --production=false --legacy-peer-deps && \
    npm install -g next && \
    npm cache clean --force

# Копирование исходного кода
COPY . .

# Установка правильных прав доступа
RUN chmod -R 755 node_modules/.bin

# Сборка приложения
RUN npm run build

# Финальный этап
FROM node:20-alpine

WORKDIR /app

# Устанавливаем только production зависимости
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --only=production --no-audit --no-fund --legacy-peer-deps && \
    npm cache clean --force

# Переносим только необходимые файлы
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next

# Запуск приложения
CMD ["npm", "start"]
