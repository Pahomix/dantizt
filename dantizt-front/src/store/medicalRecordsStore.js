import { create } from 'zustand';
import api from '@/lib/axios';

export const useMedicalRecordsStore = create((set) => ({
  records: [],
  selectedRecord: null,
  treatmentPlans: [],
  currentPlan: null,
  loading: false,
  error: null,

  // Получение медицинских записей пациента
  fetchPatientRecords: async (patientId, recordType = null) => {
    try {
      set({ loading: true, error: null });
      const params = recordType ? { record_type: recordType } : {};
      const response = await api.get(`/medical-records/patient/${patientId}`, { params });
      set({ records: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error('Error fetching medical records:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке медицинских записей',
        loading: false 
      });
    }
  },

  // Получение конкретной медицинской записи
  fetchRecord: async (recordId) => {
    try {
      set({ loading: true, error: null });
      const response = await api.get(`/medical-records/${recordId}`);
      set({ selectedRecord: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error('Error fetching medical record:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке медицинской записи',
        loading: false 
      });
    }
  },

  // Создание новой медицинской записи (для врачей)
  createRecord: async (recordData) => {
    try {
      set({ loading: true, error: null });
      const response = await api.post('/medical-records', recordData);
      set((state) => ({
        records: [...state.records, response.data],
        loading: false
      }));
      return response.data;
    } catch (error) {
      console.error('Error creating medical record:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при создании медицинской записи',
        loading: false 
      });
      throw error;
    }
  },

  // Обновление медицинской записи (для врачей)
  updateRecord: async (recordId, recordData) => {
    try {
      set({ loading: true, error: null });
      const response = await api.put(`/medical-records/${recordId}`, recordData);
      set((state) => ({
        records: state.records.map(record =>
          record.id === recordId ? { ...record, ...response.data } : record
        ),
        selectedRecord: response.data,
        loading: false
      }));
      return response.data;
    } catch (error) {
      console.error('Error updating medical record:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при обновлении медицинской записи',
        loading: false 
      });
      throw error;
    }
  },

  // Удаление медицинской записи (для врачей)
  deleteRecord: async (recordId) => {
    try {
      set({ loading: true, error: null });
      await api.delete(`/medical-records/${recordId}`);
      set((state) => ({
        records: state.records.filter(record => record.id !== recordId),
        loading: false
      }));
    } catch (error) {
      console.error('Error deleting medical record:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при удалении медицинской записи',
        loading: false 
      });
      throw error;
    }
  },

  // Добавление прикрепленного файла к записи (для врачей)
  addAttachment: async (recordId, file) => {
    try {
      set({ loading: true, error: null });
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post(`/medical-records/${recordId}/attachment`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      set((state) => ({
        records: state.records.map(record =>
          record.id === recordId ? { ...record, attachments: [...record.attachments, response.data] } : record
        ),
        selectedRecord: state.selectedRecord?.id === recordId ? 
          { ...state.selectedRecord, attachments: [...state.selectedRecord.attachments, response.data] } : 
          state.selectedRecord,
        loading: false
      }));
      return response.data;
    } catch (error) {
      console.error('Error adding attachment:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при добавлении прикрепленного файла',
        loading: false 
      });
      throw error;
    }
  },

  // Планы лечения
  fetchPatientTreatmentPlans: async (patientId, filters = {}) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/treatment-plans/patient/${patientId}`, { params: filters });
      set({ treatmentPlans: response.data, loading: false });
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Ошибка при загрузке планов лечения', loading: false });
    }
  },

  fetchTreatmentPlan: async (planId) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/treatment-plans/${planId}`);
      set({ currentPlan: response.data, loading: false });
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Ошибка при загрузке плана лечения', loading: false });
    }
  },

  createTreatmentPlan: async (planData) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post('/treatment-plans', planData);
      set(state => ({
        treatmentPlans: [...state.treatmentPlans, response.data],
        loading: false
      }));
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Ошибка при создании плана лечения', loading: false });
      throw error;
    }
  },

  updateTreatmentPlan: async (planId, planData) => {
    set({ loading: true, error: null });
    try {
      const response = await api.put(`/treatment-plans/${planId}`, planData);
      set(state => ({
        treatmentPlans: state.treatmentPlans.map(plan => 
          plan.id === planId ? response.data : plan
        ),
        currentPlan: response.data,
        loading: false
      }));
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Ошибка при обновлении плана лечения', loading: false });
      throw error;
    }
  },

  deleteTreatmentPlan: async (planId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/treatment-plans/${planId}`);
      set(state => ({
        treatmentPlans: state.treatmentPlans.filter(plan => plan.id !== planId),
        loading: false
      }));
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Ошибка при удалении плана лечения', loading: false });
      throw error;
    }
  },

  // Шаги плана лечения
  addTreatmentStep: async (planId, stepData) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post(`/treatment-plans/${planId}/steps`, stepData);
      set(state => {
        const updatedPlan = {
          ...state.currentPlan,
          steps: [...state.currentPlan.steps, response.data]
        };
        return {
          currentPlan: updatedPlan,
          treatmentPlans: state.treatmentPlans.map(plan =>
            plan.id === planId ? updatedPlan : plan
          ),
          loading: false
        };
      });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Ошибка при добавлении шага плана', loading: false });
      throw error;
    }
  },

  updateTreatmentStep: async (planId, stepId, stepData) => {
    set({ loading: true, error: null });
    try {
      const response = await api.put(`/treatment-plans/${planId}/steps/${stepId}`, stepData);
      set(state => {
        const updatedPlan = {
          ...state.currentPlan,
          steps: state.currentPlan.steps.map(step =>
            step.id === stepId ? response.data : step
          )
        };
        return {
          currentPlan: updatedPlan,
          treatmentPlans: state.treatmentPlans.map(plan =>
            plan.id === planId ? updatedPlan : plan
          ),
          loading: false
        };
      });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Ошибка при обновлении шага плана', loading: false });
      throw error;
    }
  },

  deleteTreatmentStep: async (planId, stepId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/treatment-plans/${planId}/steps/${stepId}`);
      set(state => {
        const updatedPlan = {
          ...state.currentPlan,
          steps: state.currentPlan.steps.filter(step => step.id !== stepId)
        };
        return {
          currentPlan: updatedPlan,
          treatmentPlans: state.treatmentPlans.map(plan =>
            plan.id === planId ? updatedPlan : plan
          ),
          loading: false
        };
      });
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Ошибка при удалении шага плана', loading: false });
      throw error;
    }
  },

  // Очистка ошибок
  clearError: () => set({ error: null }),

  // Очистка выбранной записи
  clearSelectedRecord: () => set({ selectedRecord: null }),

  // Очистка всех записей
  clearRecords: () => set({ records: [] })
}));
