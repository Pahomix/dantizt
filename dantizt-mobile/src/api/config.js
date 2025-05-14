// Используем переменные окружения или дефолтные значения
const USE_PRODUCTION = process.env.NODE_ENV === 'production' || __DEV__ === false;

// Продакшен URL использует домен dantizt.ru
const PRODUCTION_API_URL = 'https://dantizt.ru/api/v1';

// Локальный URL для разработки
const DEVELOPMENT_API_URL = 'http://127.0.0.1:8000/api/v1';

// Выбираем URL в зависимости от окружения
export const API_URL = USE_PRODUCTION ? PRODUCTION_API_URL : DEVELOPMENT_API_URL;

export const ENDPOINTS = {
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  VERIFY_EMAIL: '/auth/verify-email',
  APPOINTMENTS: '/appointments',
  MEDICAL_RECORDS: '/medical-records',
  PROFILE: '/profile',
};

export const createHeaders = (token = null) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};
