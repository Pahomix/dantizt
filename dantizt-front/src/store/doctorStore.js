import { create } from 'zustand';
import api from '@/lib/axios';

export const useDoctorStore = create((set, get) => ({
  doctors: [],
  selectedDoctor: null,
  doctorProfile: null,
  loading: false,
  error: null,

  // Получение списка врачей
  fetchDoctors: async () => {
    try {
      set({ loading: true, error: null });
      const response = await api.get('/doctors');
      set({ doctors: response.data, loading: false });
    } catch (error) {
      console.error('Error fetching doctors:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке списка врачей',
        loading: false 
      });
    }
  },

  // Получение конкретного врача
  fetchDoctor: async (doctorId) => {
    try {
      set({ loading: true, error: null });
      const response = await api.get(`/doctors/${doctorId}`);
      set({ selectedDoctor: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error('Error fetching doctor:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке информации о враче',
        loading: false 
      });
    }
  },

  // Получение профиля текущего врача
  fetchDoctorProfile: async () => {
    try {
      set({ loading: true, error: null });
      const response = await api.get('/doctors/me');
      set({ doctorProfile: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error('Error fetching doctor profile:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке профиля врача',
        loading: false,
        doctorProfile: null 
      });
      return null;
    }
  },

  // Обновление профиля текущего врача
  updateDoctorProfile: async (profileData) => {
    try {
      set({ loading: true, error: null });
      const response = await api.put('/doctors/me', profileData);
      set({ doctorProfile: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error('Error updating doctor profile:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при обновлении профиля врача',
        loading: false 
      });
      throw error;
    }
  },

  // Создание врача (только для администраторов)
  createDoctor: async (doctorData) => {
    try {
      set({ loading: true, error: null });
      
      const response = await api.post('/doctors', doctorData);
      
      if (!response.data) {
        set({ 
          error: 'Ошибка при создании врача',
          loading: false 
        });
        return null;
      }

      // Обновляем список врачей после создания
      try {
        const doctorsResponse = await api.get('/doctors');
        set({ 
          doctors: doctorsResponse.data,
          loading: false 
        });
      } catch (fetchError) {
        console.error('Error fetching doctors after create:', fetchError);
        // Если не удалось обновить список, просто добавляем нового врача
        set((state) => ({
          doctors: [...state.doctors, response.data],
          loading: false
        }));
      }
      
      return response.data;
    } catch (error) {
      console.error('Error creating doctor:', error);
      if (error.message === 'Duplicate request cancelled') {
        set({ 
          error: 'Запрос уже выполняется',
          loading: false 
        });
        return null;
      }
      const errorMessage = error.response?.data?.detail || 'Ошибка при создании врача';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  // Обновление врача (только для администраторов)
  updateDoctor: async (doctorId, doctorData) => {
    try {
      set({ loading: true, error: null });
      const response = await api.put(`/doctors/${doctorId}`, doctorData);
      
      // Обновляем список врачей после обновления
      try {
        const doctorsResponse = await api.get('/doctors');
        set({ 
          doctors: doctorsResponse.data,
          loading: false,
          selectedDoctor: doctorId === get().selectedDoctor?.id ? response.data : get().selectedDoctor
        });
      } catch (fetchError) {
        console.error('Error fetching doctors after update:', fetchError);
        // Если не удалось обновить список, обновляем только конкретного врача
        set((state) => {
          // Находим индекс обновляемого врача
          const index = state.doctors.findIndex(d => d.id === doctorId);
          if (index === -1) return state;

          // Создаем новый массив врачей
          const newDoctors = [...state.doctors];
          
          // Обновляем данные врача, сохраняя структуру объекта
          newDoctors[index] = {
            ...newDoctors[index],
            ...response.data,
            user: response.data.user,
            specialization: response.data.specialization
          };

          return {
            doctors: newDoctors,
            loading: false,
            selectedDoctor: doctorId === state.selectedDoctor?.id ? newDoctors[index] : state.selectedDoctor
          };
        });
      }

      return response.data;
    } catch (error) {
      console.error('Error updating doctor:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при обновлении информации о враче',
        loading: false 
      });
      throw error;
    }
  },

  // Удаление врача (только для администраторов)
  deleteDoctor: async (doctorId) => {
    try {
      set({ loading: true, error: null });
      await api.delete(`/doctors/${doctorId}`);
      
      // Обновляем список врачей после удаления
      try {
        const doctorsResponse = await api.get('/doctors');
        set({ 
          doctors: doctorsResponse.data,
          selectedDoctor: get().selectedDoctor?.id === doctorId ? null : get().selectedDoctor,
          loading: false 
        });
      } catch (fetchError) {
        console.error('Error fetching doctors after delete:', fetchError);
        // Если не удалось обновить список, просто удаляем врача из текущего списка
        set((state) => ({
          doctors: state.doctors.filter(d => d.id !== doctorId),
          selectedDoctor: state.selectedDoctor?.id === doctorId ? null : state.selectedDoctor,
          loading: false
        }));
      }
    } catch (error) {
      console.error('Error deleting doctor:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при удалении врача',
        loading: false 
      });
      throw error;
    }
  },

  // Очистка ошибок
  clearError: () => set({ error: null }),

  // Очистка выбранного врача
  clearSelectedDoctor: () => set({ selectedDoctor: null }),

  // Очистка профиля врача
  clearDoctorProfile: () => set({ doctorProfile: null })
}));
