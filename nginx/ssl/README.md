# SSL-сертификаты для Dantizt

В этой директории должны находиться следующие файлы SSL-сертификатов:

1. `certificate.crt` - основной сертификат сайта
2. `certificate.key` - приватный ключ
3. `certificate_ca.crt` - сертификат удостоверяющего центра (CA)

## Инструкция по установке сертификатов

1. Создайте файл `certificate.crt` с содержимым основного сертификата:
```
-----BEGIN CERTIFICATE-----
MIIHiTCCBnGgAwIBAgIMY/klqZsZCUm9kGh5MA0GCSqGSIb3DQEBCwUAMFMxCzAJ
...
(содержимое сертификата)
...
2SJ+bLoBQ0DxLNmjSQ==
-----END CERTIFICATE-----
```

2. Создайте файл `certificate.key` с содержимым приватного ключа:
```
-----BEGIN RSA PRIVATE KEY-----
MIIJKgIBAAKCAgEA3z0VsWHNNU2gcc9EEhwGE3y48qLCM+aHHtdK6sbr/9E8XuNc
...
(содержимое приватного ключа)
...
M+e73nfXhuee7sqxoBz8jHCdIj0y3FirSLllrgPRSRlJzWHvVoYU2i00/DUcMA==
-----END RSA PRIVATE KEY-----
```

3. Создайте файл `certificate_ca.crt` с содержимым сертификата CA.

## Обновление конфигурации Nginx

После добавления сертификатов, обновите пути в файле `nginx.conf`:

```nginx
ssl_certificate /etc/nginx/ssl/certificate.crt;
ssl_certificate_key /etc/nginx/ssl/certificate.key;
ssl_trusted_certificate /etc/nginx/ssl/certificate_ca.crt;
```

## Безопасность

Убедитесь, что файлы сертификатов имеют правильные разрешения:
- `certificate.crt` и `certificate_ca.crt`: 644 (-rw-r--r--)
- `certificate.key`: 600 (-rw-------)

## Обновление сертификатов

Сертификаты действительны до 13 декабря 2025 года. После этого их необходимо обновить.
