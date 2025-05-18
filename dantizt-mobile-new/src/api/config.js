import { API_URL_PRODUCTION, API_URL_DEVELOPMENT, NODE_ENV } from '@env';

// Определяем, используется ли продакшен-режим
const USE_PRODUCTION = NODE_ENV === 'production' || __DEV__ === false;

// Выбираем URL в зависимости от окружения
// Если переменные окружения не определены, используем значения по умолчанию
const PRODUCTION_URL = API_URL_PRODUCTION || 'https://dantizt.ru/api/v1';
const DEVELOPMENT_URL = API_URL_DEVELOPMENT || 'http://127.0.0.1:8000/api/v1';

// Экспортируем итоговый URL
export const API_URL = USE_PRODUCTION ? PRODUCTION_URL : DEVELOPMENT_URL;

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
