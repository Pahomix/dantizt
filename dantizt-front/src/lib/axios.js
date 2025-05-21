import axios from 'axios';
import Cookies from 'js-cookie';

// Определяем URL API в зависимости от окружения
const IS_DEV = process.env.NODE_ENV === 'development';

// Используем настройки из переменных окружения или значения по умолчанию
const API_URL = process.env.NEXT_PUBLIC_API_URL || (IS_DEV ? 'http://localhost:8000/api/v1' : 'https://dantizt.ru/api/v1');

console.log('[API] Using API URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true // Важно для работы с куки
});

// Добавляем куки к каждому запросу
api.interceptors.request.use(
  (config) => {
    console.log(`[API Request] ${config.method.toUpperCase()} ${config.url}`, config.data);
    // Проверяем, что мы на клиенте
    if (typeof window !== 'undefined') {
      // Получаем токен с помощью js-cookie (проверяем все возможные варианты)
      const token = Cookies.get('access_token') || Cookies.get('access_token_native') || Cookies.get('authToken');
      
      console.log('[API] Using token from cookies:', !!token);
      console.log('[API] Available cookies:', Object.keys(Cookies.get()));
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Обработка ответов
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Если ошибка 401 и это не повторный запрос, и это не запрос на логин
    if (error.response?.status === 401 && 
        !originalRequest._retry && 
        !originalRequest.url.includes('/auth/login')) {
      originalRequest._retry = true;
      
      try {
        // Пытаемся обновить токен
        const response = await api.post('/auth/refresh');
        const { access_token } = response.data;
        
        // Сохраняем новый токен
        Cookies.set('access_token', access_token);
        
        // Повторяем оригинальный запрос с новым токеном
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Если не удалось обновить токен, выходим из системы
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
        Cookies.remove('userRole');
        window.location.href = '/auth/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
