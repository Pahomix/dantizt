import { create } from 'zustand';
import api from '@/lib/axios';

export const useServicesStore = create((set) => ({
  services: [],
  loading: false,
  error: null,

  // Получение списка всех услуг
  fetchServices: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/services');
      set({ services: response.data, loading: false });
    } catch (error) {
      console.error('Error fetching services:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке услуг',
        loading: false,
        services: []
      });
    }
  },

  // Получение услуг по специализации врача
  fetchServicesBySpecialty: async (specialtyId) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/services/specialty/${specialtyId}`);
      set({ services: response.data, loading: false });
    } catch (error) {
      console.error('Error fetching services by specialty:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке услуг по специализации',
        loading: false,
        services: []
      });
    }
  },

  // Получение услуг для конкретного врача
  fetchServicesByDoctor: async (doctorId) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/services/doctor/${doctorId}`);
      set({ services: response.data, loading: false });
    } catch (error) {
      console.error('Error fetching services by doctor:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке услуг врача',
        loading: false,
        services: []
      });
    }
  },

  // Получение услуги по ID
  fetchService: async (serviceId) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/services/${serviceId}`);
      set({ loading: false });
      return response.data;
    } catch (error) {
      console.error('Error fetching service:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке услуги',
        loading: false 
      });
      throw error;
    }
  },
}));
