"""
Скрипт для преобразования метрик из Prometheus в формат InfluxDB.
Собирает метрики из Prometheus API и отправляет их в InfluxDB.
"""
import requests
import time
import logging
from datetime import datetime
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Конфигурация Prometheus
PROMETHEUS_URL = "http://localhost:9090"

# Конфигурация InfluxDB
INFLUXDB_URL = "http://localhost:8086"
INFLUXDB_TOKEN = "my-super-secret-auth-token"
INFLUXDB_ORG = "dantizt"
INFLUXDB_BUCKET = "metrics"

# Список метрик для сбора (соответствует метрикам из app/core/metrics.py)
METRICS = [
    # Базовые метрики HTTP
    "dantizt_http_requests_total",
    "dantizt_request_duration_seconds",
    "dantizt_http_requests_active",
    
    # Кастомные метрики приложения
    "dantizt_appointments_total",
    "dantizt_doctor_workload",
    "dantizt_payment_amount_total"
]

def query_prometheus(metric):
    """
    Запрашивает метрику из Prometheus API.
    """
    try:
        response = requests.get(
            f"{PROMETHEUS_URL}/api/v1/query",
            params={"query": metric}
        )
        if response.status_code == 200:
            data = response.json()
            if data["status"] == "success":
                return data["data"]["result"]
            else:
                logger.error(f"Prometheus query error: {data['error']}")
                return []
        else:
            logger.error(f"Prometheus API error: {response.status_code}")
            return []
    except Exception as e:
        logger.error(f"Error querying Prometheus: {str(e)}")
        return []

def write_to_influxdb(metrics_data):
    """
    Записывает метрики в InfluxDB.
    """
    try:
        client = InfluxDBClient(
            url=INFLUXDB_URL,
            token=INFLUXDB_TOKEN,
            org=INFLUXDB_ORG
        )
        write_api = client.write_api(write_options=SYNCHRONOUS)
        
        points = []
        for metric_name, data in metrics_data.items():
            for item in data:
                # Получаем значение метрики
                value = float(item["value"][1])
                # Получаем временную метку
                timestamp = int(item["value"][0]) * 1_000_000_000  # Конвертируем в наносекунды для InfluxDB
                
                # Создаем точку данных
                point = Point(metric_name)
                
                # Добавляем теги из метрики
                for tag_key, tag_value in item["metric"].items():
                    if tag_key != "__name__":  # Пропускаем имя метрики
                        point = point.tag(tag_key, tag_value)
                
                # Добавляем значение
                point = point.field("value", value)
                
                # Добавляем временную метку
                point = point.time(timestamp)
                
                points.append(point)
        
        # Записываем все точки в InfluxDB
        write_api.write(bucket=INFLUXDB_BUCKET, record=points)
        logger.info(f"Successfully wrote {len(points)} points to InfluxDB")
        
        # Закрываем клиент
        client.close()
        return True
    except Exception as e:
        logger.error(f"Error writing to InfluxDB: {str(e)}")
        return False

def collect_and_write_metrics():
    """
    Собирает метрики из Prometheus и записывает их в InfluxDB.
    """
    logger.info("Starting metrics collection...")
    
    # Собираем метрики из Prometheus
    metrics_data = {}
    for metric in METRICS:
        logger.info(f"Querying metric: {metric}")
        result = query_prometheus(metric)
        if result:
            metrics_data[metric] = result
            logger.info(f"Collected {len(result)} data points for {metric}")
        else:
            logger.warning(f"No data for metric: {metric}")
    
    # Записываем метрики в InfluxDB
    if metrics_data:
        success = write_to_influxdb(metrics_data)
        if success:
            logger.info("Successfully wrote metrics to InfluxDB")
        else:
            logger.error("Failed to write metrics to InfluxDB")
    else:
        logger.warning("No metrics collected from Prometheus")

def main():
    """
    Основная функция для запуска сбора метрик.
    """
    logger.info("Starting Prometheus to InfluxDB converter...")
    
    # Проверяем доступность Prometheus
    try:
        response = requests.get(f"{PROMETHEUS_URL}/-/healthy")
        if response.status_code != 200:
            logger.error(f"Prometheus is not healthy: {response.status_code}")
            return
    except Exception as e:
        logger.error(f"Cannot connect to Prometheus: {str(e)}")
        return
    
    # Проверяем доступность InfluxDB
    try:
        client = InfluxDBClient(
            url=INFLUXDB_URL,
            token=INFLUXDB_TOKEN,
            org=INFLUXDB_ORG
        )
        health = client.health()
        if health.status != "pass":
            logger.error(f"InfluxDB is not healthy: {health.message}")
            return
        client.close()
    except Exception as e:
        logger.error(f"Cannot connect to InfluxDB: {str(e)}")
        return
    
    # Запускаем цикл сбора метрик
    try:
        while True:
            collect_and_write_metrics()
            # Ждем 30 секунд перед следующим сбором
            logger.info("Waiting 30 seconds for next collection...")
            time.sleep(30)
    except KeyboardInterrupt:
        logger.info("Stopping metrics collection...")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")

if __name__ == "__main__":
    main()
