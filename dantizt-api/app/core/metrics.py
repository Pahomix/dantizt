from prometheus_client import Counter, Gauge, Histogram, Summary
from starlette_exporter import PrometheusMiddleware, handle_metrics
from fastapi import FastAPI
import time
from typing import Callable, Dict, List, Optional
import logging
import random
logger = logging.getLogger(__name__)

REQUEST_COUNT = Counter(
    'dantizt_http_requests_total', 
    'Общее количество HTTP запросов',
    ['method', 'endpoint', 'status_code']
)

REQUEST_LATENCY = Histogram(
    'dantizt_http_request_duration_seconds', 
    'Время выполнения HTTP запросов в секундах',
    ['method', 'endpoint'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0, 10.0]
)

ACTIVE_REQUESTS = Gauge(
    'dantizt_http_requests_active',
    'Количество активных HTTP запросов',
    ['method', 'endpoint']
)

APPOINTMENT_COUNT = Counter(
    'dantizt_appointments_total',
    'Общее количество записей на прием',
    ['status']
)

DOCTOR_WORKLOAD = Gauge(
    'dantizt_doctor_workload',
    'Загруженность врачей (количество назначенных приемов)',
    ['doctor_id', 'doctor_name']
)

PAYMENT_AMOUNT = Counter(
    'dantizt_payment_amount_total',
    'Общая сумма платежей',
    ['payment_status', 'payment_method']
)

API_ERRORS = Counter(
    'dantizt_api_errors_total',
    'Количество ошибок API',
    ['error_type', 'endpoint']
)
ACTIVE_USERS = Gauge(
    'dantizt_active_users',
    'Количество активных пользователей',
    ['role']
)

DB_QUERY_LATENCY = Histogram(
    'dantizt_db_query_duration_seconds',
    'Время выполнения запросов к базе данных в секундах',
    ['operation', 'table'],
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0]
)

def setup_metrics(app: FastAPI):
    app.add_middleware(
        PrometheusMiddleware,
        app_name="dantizt_api",
        prefix="dantizt",
        group_paths=True,
        filter_unhandled_paths=True
    )
    
    app.add_route("/metrics", handle_metrics)
    
    logger.info("Prometheus метрики настроены")
    
    return app

def track_appointment(status: str):
    APPOINTMENT_COUNT.labels(status=status).inc()

def update_doctor_workload(doctor_id: int, doctor_name: str, appointment_count: int):
    DOCTOR_WORKLOAD.labels(doctor_id=str(doctor_id), doctor_name=doctor_name).set(appointment_count)

def track_payment(amount: float, status: str, method: str):
    PAYMENT_AMOUNT.labels(payment_status=status, payment_method=method).inc(amount)

def track_db_query(operation: str, table: str, duration: float):
    DB_QUERY_LATENCY.labels(operation=operation, table=table).observe(duration)

def update_active_users(role: str, count: int):
    ACTIVE_USERS.labels(role=role).set(count)

def track_api_error(error_type: str, endpoint: str):
    """
    Отслеживание ошибки API.
    """
    API_ERRORS.labels(error_type=error_type, endpoint=endpoint).inc()
