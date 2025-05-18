import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from '../utils/axios';

const useAuthStore = create((set) => ({
  token: null,
  user: null,
  patientProfile: null,
  isAuthenticated: false,
  isLoading: false,

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axios.post('/auth/login', { email, password });
      
      await AsyncStorage.setItem('token', data.access_token);
      
      // Получаем профиль пациента, который включает в себя данные пользователя
      const { data: patientData } = await axios.get('/patients/me', {
        headers: { Authorization: `Bearer ${data.access_token}` }
      });
      
      set({
        token: data.access_token,
        user: patientData.user,
        patientProfile: patientData,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.detail || 
                          error.message || 
                          'Ошибка при входе';
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  register: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      // Регистрируем пользователя
      const { data: registerData } = await axios.post('/auth/register', userData);
      
      // Автоматически входим
      const { data: loginData } = await axios.post('/auth/login', {
        email: userData.email,
        password: userData.password,
      });
      
      await AsyncStorage.setItem('token', loginData.access_token);
      
      // Получаем профиль пациента
      const { data: patientData } = await axios.get('/patients/me', {
        headers: { Authorization: `Bearer ${loginData.access_token}` }
      });
      
      set({
        token: loginData.access_token,
        user: patientData.user,
        patientProfile: patientData,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Register error:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.detail || 
                          error.message || 
                          'Ошибка регистрации';
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  verifyEmail: async (token) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await axios.post('/auth/verify-email', { token });
      set({ isLoading: false });
      return data;
    } catch (error) {
      console.error('Email verification error:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.detail || 
                          error.message || 
                          'Ошибка при подтверждении email';
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  logout: async () => {
    try {
      await axios.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error.response?.data || error.message);
    } finally {
      await AsyncStorage.removeItem('token');
      set({
        token: null,
        user: null,
        patientProfile: null,
        isAuthenticated: false,
      });
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        throw new Error('No token found');
      }

      // Получаем профиль пациента, который включает в себя данные пользователя
      const { data: patientData } = await axios.get('/patients/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      set({
        user: patientData.user,
        token,
        patientProfile: patientData,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Auth check error:', error.response?.data || error.message);
      await AsyncStorage.removeItem('token');
      set({
        user: null,
        token: null,
        patientProfile: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  fetchPatientProfile: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data: patientData } = await axios.get('/patients/me');
      set({
        patientProfile: patientData,
        isLoading: false,
      });
      return patientData;
    } catch (error) {
      console.error('Error fetching patient profile:', error.response?.data || error.message);
      const errorMessage = error.response?.data?.detail || 
                          error.message || 
                          'Ошибка при получении профиля';
      set({
        error: errorMessage,
        isLoading: false,
      });
      throw error;
    }
  },

  updateProfile: async ({ user: updatedUser, patientProfile: updatedProfile }) => {
    set((state) => ({
      ...state,
      user: { ...state.user, ...updatedUser },
      patientProfile: { ...state.patientProfile, ...updatedProfile }
    }));
  },
}));

export default useAuthStore;
