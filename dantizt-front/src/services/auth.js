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
    
    // Используем HTTP в любом случае, так как работаем без SSL
    const isProduction = false;
    
    console.log('Setting cookies in environment:', isProduction ? 'production' : 'development');
    
    const cookieOptions = {
      secure: false, // Всегда false, так как используем HTTP
      sameSite: 'lax',
      path: '/', // Важно указать path для доступности кук на всех страницах
      domain: 'www.dantizt.ru' // Явно указываем домен
    };
    
    if (access_token) {
      Cookies.set('access_token', access_token, cookieOptions);
      console.log('Access token cookie set');
    }
    if (refresh_token) {
      Cookies.set('refresh_token', refresh_token, cookieOptions);
      console.log('Refresh token cookie set');
    }
    if (role) {
      Cookies.set('userRole', role, cookieOptions);
      console.log('User role cookie set:', role);
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
  
  // Удаляем куки при выходе, используя те же параметры, что и при установке
  const cookieOptions = {
    path: '/',
    domain: 'www.dantizt.ru'
  };
  
  Cookies.remove('access_token', cookieOptions);
  Cookies.remove('refresh_token', cookieOptions);
  Cookies.remove('userRole', cookieOptions);
  
  // Не выполняем редирект здесь, так как это делается в компоненте Navbar
  
  return response;
};

export const checkAuth = () => api.get('/auth/me');
