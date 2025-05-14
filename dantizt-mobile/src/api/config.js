export const API_URL = 'http://127.0.0.1:8000/api/v1';

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
