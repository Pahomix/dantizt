import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';


const LOCAL_IP = '192.168.0.240';
const TUNNEL_URL = 'https://838e0e40-2891-413a-847c-2a3d5236e193.tunnel4.com/api/v1';
const PROD_URL = 'http://www.dantizt.ru/api/v1';

// Используйте TUNNEL_URL для локальной разработки или PROD_URL для продакшна
const API_URL = PROD_URL; // Измените на TUNNEL_URL для локальной разработки

const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000, 
  headers: {
    'Content-Type': 'application/json',
  },
  maxRedirects: 5, 
});

axiosInstance.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('Request with token:', config.url);
    } else {
      console.log('Request without token:', config.url);
    }
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => {
    console.log('Response success:', response.config.url);
    return response;
  },
  async (error) => {
    console.error('Response error:', {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data
    });

    if (error.response?.status === 401) {
      console.log('Unauthorized, removing token');
      await AsyncStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
