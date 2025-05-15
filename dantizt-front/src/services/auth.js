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
    
    if (access_token) {
      Cookies.set('access_token', access_token, {
        secure: true, // для продакшена с HTTPS
        sameSite: 'lax'
      });
    }
    if (refresh_token) {
      Cookies.set('refresh_token', refresh_token, {
        secure: true, // для продакшена с HTTPS
        sameSite: 'lax'
      });
    }
    if (role) {
      Cookies.set('userRole', role, {
        secure: true, // для продакшена с HTTPS
        sameSite: 'lax'
      });
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
  
  // Удаляем куки при выходе
  Cookies.remove('access_token');
  Cookies.remove('refresh_token');
  Cookies.remove('userRole');
  
  return response;
};

export const checkAuth = () => api.get('/auth/me');
