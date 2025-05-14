import { create } from 'zustand';
import axios from '@/lib/axios';
import { showError } from '@/utils/notifications';

export const useSpecializationStore = create((set, get) => ({
  specializations: [],
  loading: false,
  error: null,

  // Получение списка всех специализаций
  fetchSpecializations: async () => {
    set({ loading: true, error: null });
    try {
      const response = await axios.get('/specializations');
      set({ specializations: response.data });
    } catch (error) {
      set({ error: error.message });
      showError('Ошибка при загрузке специализаций');
    } finally {
      set({ loading: false });
    }
  },

  // Создание новой специализации
  createSpecialization: async (specializationData) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post('/specializations', specializationData);
      set(state => ({
        specializations: [...state.specializations, response.data]
      }));
      return response.data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  // Обновление специализации
  updateSpecialization: async (specializationId, specializationData) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.put(`/specializations/${specializationId}`, specializationData);
      set(state => ({
        specializations: state.specializations.map(specialization =>
          specialization.id === specializationId ? response.data : specialization
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

  // Удаление специализации
  deleteSpecialization: async (specializationId) => {
    set({ loading: true, error: null });
    try {
      await axios.delete(`/specializations/${specializationId}`);
      set(state => ({
        specializations: state.specializations.filter(specialization => specialization.id !== specializationId)
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
