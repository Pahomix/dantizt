import { create } from 'zustand';
import axios from '@/lib/axios';
import { showError } from '@/utils/notifications';

export const useServiceStore = create((set, get) => ({
  services: [],
  loading: false,
  error: null,

  // Получение списка всех услуг
  fetchServices: async () => {
    set({ loading: true, error: null });
    try {
      const response = await axios.get('/services');
      set({ services: response.data });
    } catch (error) {
      set({ error: error.message });
      showError('Ошибка при загрузке услуг');
    } finally {
      set({ loading: false });
    }
  },

  // Создание новой услуги
  createService: async (serviceData) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post('/services', serviceData);
      set(state => ({
        services: [...state.services, response.data]
      }));
      return response.data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  // Обновление услуги
  updateService: async (serviceId, serviceData) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.put(`/services/${serviceId}`, serviceData);
      set(state => ({
        services: state.services.map(service =>
          service.id === serviceId ? response.data : service
        )
      }));
      return response.data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  // Удаление услуги
  deleteService: async (serviceId) => {
    set({ loading: true, error: null });
    try {
      await axios.delete(`/services/${serviceId}`);
      set(state => ({
        services: state.services.filter(service => service.id !== serviceId)
      }));
      return true;
    } catch (error) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  }
}));
