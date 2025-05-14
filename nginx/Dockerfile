FROM nginx:1.22-alpine

# Удаляем стандартную конфигурацию
RUN rm /etc/nginx/conf.d/default.conf
RUN rm /etc/nginx/nginx.conf

# Копируем нашу конфигурацию
COPY nginx.conf /etc/nginx/nginx.conf

# Создаем директорию для загрузок
RUN mkdir -p /var/www/uploads && \
    chmod 755 /var/www/uploads

# Создаем директорию для SSL-сертификатов
RUN mkdir -p /etc/nginx/ssl

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]
