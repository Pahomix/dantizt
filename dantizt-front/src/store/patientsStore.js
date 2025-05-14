import { create } from 'zustand';
import api from '@/lib/axios';

export const usePatientsStore = create((set, get) => ({
  patients: [],
  loading: false,
  error: null,
  
  // Загрузка списка пациентов
  fetchPatients: async () => {
    set({ loading: true, error: null });
    
    try {
      const response = await api.get('/patients', {
        params: {
          limit: 100 // Получаем больше пациентов для удобства выбора
        }
      });
      
      // Проверяем формат ответа API
      const patients = response.data.items || response.data;
      
      set({ 
        patients,
        loading: false 
      });
      
      return patients;
    } catch (error) {
      console.error('Error fetching patients:', error);
      set({ 
        error: error.message || 'Ошибка при загрузке списка пациентов',
        loading: false 
      });
      return [];
    }
  },
  
  // Получение пациента по ID
  getPatientById: (patientId) => {
    const { patients } = get();
    return patients.find(patient => patient.id === patientId);
  },
  
  // Очистка хранилища
  clearPatients: () => {
    set({ patients: [], loading: false, error: null });
  }
}));
