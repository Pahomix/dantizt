import { create } from 'zustand';
import api from '@/lib/axios';

export const useTreatmentPlansStore = create((set) => ({
  treatmentPlans: [],
  loading: false,
  error: null,

  // Получение списка планов лечения пациента
  fetchPatientTreatmentPlans: async (patientId) => {
    try {
      set({ loading: true, error: null });
      const response = await api.get(`/treatment-plans/patient/${patientId}`);
      set({ treatmentPlans: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error('Error fetching patient treatment plans:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке планов лечения',
        loading: false 
      });
      throw error;
    }
  },

  // Получение плана лечения по ID
  fetchTreatmentPlan: async (planId) => {
    try {
      set({ loading: true, error: null });
      const response = await api.get(`/treatment-plans/${planId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching treatment plan:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке плана лечения',
        loading: false 
      });
      throw error;
    }
  },

  // Обновление статуса задачи
  updateTaskStatus: async (planId, taskId, status) => {
    try {
      set({ loading: true, error: null });
      const response = await api.put(`/treatment-plans/${planId}/tasks/${taskId}`, { status });
      set(state => ({
        treatmentPlans: state.treatmentPlans.map(plan => {
          if (plan.id === planId) {
            return {
              ...plan,
              tasks: plan.tasks.map(task =>
                task.id === taskId ? { ...task, status: response.data.status } : task
              )
            };
          }
          return plan;
        }),
        loading: false
      }));
      return response.data;
    } catch (error) {
      console.error('Error updating task status:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при обновлении статуса задачи',
        loading: false 
      });
      throw error;
    }
  },

  // Очистка ошибок
  clearError: () => set({ error: null })
}));
