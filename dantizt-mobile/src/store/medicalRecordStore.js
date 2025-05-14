import { create } from 'zustand';
import axios from '../utils/axios';
import useAuthStore from './authStore';

const useMedicalRecordStore = create((set) => ({
  records: [],
  isLoading: false,
  error: null,

  fetchMedicalRecords: async () => {
    set({ isLoading: true, error: null });
    try {
      const { patientProfile } = useAuthStore.getState();
      
      if (!patientProfile?.id) {
        throw new Error('Профиль пациента не найден');
      }

      // Получаем медицинские записи
      const { data } = await axios.get(`/medical-records/patient/${patientProfile.id}`);
      set({ records: data, isLoading: false });
    } catch (error) {
      console.error('Error fetching medical records:', error);
      const errorMessage = error.response?.data?.detail || 
                          error.message || 
                          'Ошибка при загрузке медицинской карты';
      set({
        error: errorMessage,
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));

export default useMedicalRecordStore;
