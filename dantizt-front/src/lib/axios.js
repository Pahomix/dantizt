import axios from 'axios';
import Cookies from 'js-cookie';

// Определяем URL API в зависимости от окружения
const IS_DEV = process.env.NODE_ENV === 'development';
const API_URL_PROD = process.env.NEXT_PUBLIC_API_URL_PROD || 'http://www.dantizt.ru/api/v1';
const API_URL_DEV = process.env.NEXT_PUBLIC_API_URL_DEV || 'http://localhost:8000/api/v1';

// Используем продакшн URL или URL для разработки
const API_URL = IS_DEV ? API_URL_DEV : API_URL_PROD;

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
      // Получаем токен с помощью js-cookie или из document.cookie
      const token = Cookies.get('access_token');
      
      // Функция для получения значения куки из document.cookie
      const getCookieValue = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return undefined;
      };
      
      // Пробуем получить токен из обычных или нативных куки
      const accessToken = token || getCookieValue('access_token_native');
      
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
        console.log('[API] Using token for authorization');
      } else {
        console.log('[API] No token found for authorization');
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
        
        // Сохраняем новый токен с правильными настройками
        // Определяем, находимся ли мы в режиме разработки
        const isLocalhost = typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        
        // Настройки, соответствующие настройкам на сервере
        const cookieOptions = {
          path: '/',
          expires: 7,
          sameSite: 'lax', // Используем 'lax' для лучшей совместимости с браузерами
          secure: false // Явно указываем, что не используем secure для HTTP
        };
        
        // Добавляем домен в продакшн режиме
        if (!isLocalhost) {
          cookieOptions.domain = '.dantizt.ru'; // Добавляем точку перед доменом для совместимости со старыми браузерами
          console.log('Устанавливаем куки с доменом .dantizt.ru при обновлении токена');
        }
        
        Cookies.set('access_token', access_token, cookieOptions);
        
        // Повторяем оригинальный запрос с новым токеном
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Если не удалось обновить токен, выходим из системы
        // Определяем, находимся ли мы в режиме разработки
        const isLocalhost = typeof window !== 'undefined' && 
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        
        // Настройки, соответствующие настройкам на сервере
        const cookieOptions = {
          path: '/',
          sameSite: 'lax', // Используем 'lax' для лучшей совместимости с браузерами
          secure: false // Явно указываем, что не используем secure для HTTP
        };
        
        // Добавляем домен в продакшн режиме
        if (!isLocalhost) {
          cookieOptions.domain = '.dantizt.ru'; // Добавляем точку перед доменом для совместимости со старыми браузерами
          console.log('Удаляем куки с доменом .dantizt.ru при ошибке обновления токена');
        }
        
        Cookies.remove('access_token', cookieOptions);
        Cookies.remove('refresh_token', cookieOptions);
        Cookies.remove('userRole', cookieOptions);
        window.location.href = '/auth/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
