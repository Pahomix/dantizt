import api from '@/lib/axios';
import Cookies from 'js-cookie';

export const login = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  
  console.log('Raw login response:', response);
  
  // Если успешный логин, устанавливаем куки
  if (response.data) {
    // Получаем токены из ответа
    const { access_token, refresh_token, role } = response.data;
    
    console.log('Tokens from response:', { access_token, refresh_token });
    
    // Определяем, находимся ли мы в режиме разработки
    const isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    
    console.log('Setting cookies in environment:', isLocalhost ? 'development (localhost)' : 'production');
    
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
      console.log('Устанавливаем куки с доменом .dantizt.ru');
    }
    
    // Функция для установки куки с использованием document.cookie
    const setCookieNative = (name, value, options) => {
      let cookieString = `${name}=${encodeURIComponent(value)}`;
      
      if (options.expires) {
        const date = new Date();
        date.setTime(date.getTime() + (options.expires * 24 * 60 * 60 * 1000));
        cookieString += `; expires=${date.toUTCString()}`;
      }
      
      if (options.path) cookieString += `; path=${options.path}`;
      if (options.domain) cookieString += `; domain=${options.domain}`;
      if (options.sameSite) cookieString += `; samesite=${options.sameSite}`;
      if (options.secure) cookieString += `; secure`;
      
      document.cookie = cookieString;
      console.log(`Native cookie set: ${name}=${value} with options:`, options);
      return cookieString;
    };
    
    // Устанавливаем куки обоими способами
    if (access_token) {
      // Используем js-cookie
      Cookies.set('access_token', access_token, cookieOptions);
      console.log('Access token cookie set via js-cookie');
      
      // Используем нативный метод
      setCookieNative('access_token_native', access_token, cookieOptions);
    }
    
    if (refresh_token) {
      // Используем js-cookie
      Cookies.set('refresh_token', refresh_token, cookieOptions);
      console.log('Refresh token cookie set via js-cookie');
      
      // Используем нативный метод
      setCookieNative('refresh_token_native', refresh_token, cookieOptions);
    }
    
    if (role) {
      // Используем js-cookie
      Cookies.set('userRole', role, cookieOptions);
      console.log(`User role cookie set via js-cookie: ${role}`);
      
      // Используем нативный метод
      setCookieNative('userRole_native', role, cookieOptions);
    }
  }
  
  return response;
};

export const register = async (userData) => {
  try {
    console.log('Регистрация пользователя - входные данные:', userData);
    console.log('Тип данных patient:', typeof userData.patient);
    console.log('Содержимое patient:', userData.patient);
    console.log('JSON данных для отправки:', JSON.stringify(userData));
    
    const response = await api.post('/auth/register', userData);
    console.log('Ответ сервера при регистрации:', response);
    return response;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

export const verifyEmail = async (token) => {
  try {
    const response = await api.post('/auth/verify-email', { token });
    return response;
  } catch (error) {
    console.error('Email verification error:', error);
    throw error;
  }
};

export const logout = async () => {
  const response = await api.post('/auth/logout');
  
  // Определяем, находимся ли мы в режиме разработки
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  console.log('Removing cookies in environment:', isLocalhost ? 'development (localhost)' : 'production');
  
  // Удаляем куки при выходе, используя те же параметры, что и при установке
  // Настройки, соответствующие настройкам на сервере
  const cookieOptions = {
    path: '/',
    sameSite: 'strict',
    secure: false // Явно указываем, что не используем secure для HTTP
  };
  
  // Добавляем домен в продакшн режиме
  if (!isLocalhost) {
    cookieOptions.domain = '.dantizt.ru'; // Добавляем точку перед доменом для совместимости со старыми браузерами
    console.log('Удаляем куки с доменом .dantizt.ru');
  }
  
  Cookies.remove('access_token', cookieOptions);
  Cookies.remove('refresh_token', cookieOptions);
  Cookies.remove('userRole', cookieOptions);
  
  // Не выполняем редирект здесь, так как это делается в компоненте Navbar
  
  return response;
};

export const checkAuth = () => api.get('/auth/me');
