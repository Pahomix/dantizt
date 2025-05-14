import { create } from 'zustand';
import api from '@/lib/axios';

export const useDiagnosesStore = create((set) => ({
  diagnoses: [],
  selectedDiagnosis: null,
  loading: false,
  error: null,

  // Получение списка диагнозов пациента
  fetchPatientDiagnoses: async (patientId) => {
    try {
      set({ loading: true, error: null });
      const response = await api.get(`/medical-records/patient/${patientId}`, {
        params: {
          record_type: 'diagnosis'
        }
      });
      set({ diagnoses: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error('Error fetching patient diagnoses:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке диагнозов',
        loading: false 
      });
      throw error;
    }
  },

  // Получение диагноза по ID
  fetchDiagnosis: async (diagnosisId) => {
    try {
      set({ loading: true, error: null });
      const response = await api.get(`/medical-records/${diagnosisId}`);
      set({ selectedDiagnosis: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error('Error fetching diagnosis:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке диагноза',
        loading: false 
      });
      throw error;
    }
  },

  // Создание нового диагноза
  createDiagnosis: async (diagnosisData) => {
    try {
      set({ loading: true, error: null });
      const response = await api.post('/medical-records', {
        ...diagnosisData,
        record_type: 'diagnosis'
      });
      set(state => ({
        diagnoses: [...state.diagnoses, response.data],
        selectedDiagnosis: response.data,
        loading: false
      }));
      return response.data;
    } catch (error) {
      console.error('Error creating diagnosis:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при создании диагноза',
        loading: false 
      });
      throw error;
    }
  },

  // Обновление диагноза
  updateDiagnosis: async (diagnosisId, diagnosisData) => {
    try {
      set({ loading: true, error: null });
      const response = await api.put(`/medical-records/${diagnosisId}`, diagnosisData);
      set(state => ({
        diagnoses: state.diagnoses.map(diagnosis =>
          diagnosis.id === diagnosisId ? { ...diagnosis, ...response.data } : diagnosis
        ),
        selectedDiagnosis: response.data,
        loading: false
      }));
      return response.data;
    } catch (error) {
      console.error('Error updating diagnosis:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при обновлении диагноза',
        loading: false 
      });
      throw error;
    }
  },

  // Очистка ошибок
  clearError: () => set({ error: null }),

  // Очистка выбранного диагноза
  clearSelectedDiagnosis: () => set({ selectedDiagnosis: null }),

  // Очистка всех диагнозов
  clearDiagnoses: () => set({ diagnoses: [] })
}));
