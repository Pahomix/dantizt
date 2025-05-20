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
      sameSite: 'lax', // Используем 'lax' для лучшей совместимости с браузерами
      secure: !isLocalhost // Используем secure=true для HTTPS в продакшене
    };
    
    // Не устанавливаем домен, чтобы куки работали на всех устройствах
    console.log('Устанавливаем куки без явного указания домена');
    
    if (access_token) {
      // Устанавливаем куки с обоими именами для совместимости
      Cookies.set('access_token', access_token, cookieOptions);
      Cookies.set('access_token_native', access_token, cookieOptions);
      console.log('Access token cookies set');
    }
    if (refresh_token) {
      Cookies.set('refresh_token', refresh_token, cookieOptions);
      Cookies.set('refresh_token_native', refresh_token, cookieOptions);
      console.log('Refresh token cookies set');
    }
    if (role) {
      Cookies.set('userRole', role, cookieOptions);
      Cookies.set('userRole_native', role, cookieOptions);
      console.log('User role cookies set:', role);
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
    sameSite: 'lax',
    secure: !isLocalhost // Используем secure=true для HTTPS в продакшене
  };
  
  // Не устанавливаем домен, чтобы куки работали на всех устройствах
  console.log('Удаляем куки без явного указания домена');
  
  // Удаляем куки с обоими именами для совместимости
  Cookies.remove('access_token', cookieOptions);
  Cookies.remove('access_token_native', cookieOptions);
  
  Cookies.remove('refresh_token', cookieOptions);
  Cookies.remove('refresh_token_native', cookieOptions);
  
  Cookies.remove('userRole', cookieOptions);
  Cookies.remove('userRole_native', cookieOptions);
  
  // Не выполняем редирект здесь, так как это делается в компоненте Navbar
  
  return response;
};

export const checkAuth = () => api.get('/auth/me');
