import { create } from 'zustand';
import axios from '@/lib/axios';
import { showError } from '@/utils/notifications';

export const useStatisticsStore = create((set) => ({
  clinicStats: null,
  doctorStats: null,
  patientStats: null,
  loading: false,
  error: null,

  // Получение общей статистики клиники
  fetchClinicStatistics: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await axios.get('/statistics/clinic');
      set({ clinicStats: data });
    } catch (error) {
      set({ error: error.message });
      showError('Ошибка при загрузке статистики клиники');
    } finally {
      set({ loading: false });
    }
  },

  // Получение статистики врача
  fetchDoctorStatistics: async (doctorId, startDate, endDate) => {
    set({ loading: true, error: null });
    try {
      const params = {};
      if (startDate) params.start_date = startDate.toISOString();
      if (endDate) params.end_date = endDate.toISOString();

      const { data } = await axios.get(`/statistics/doctor/${doctorId}`, { params });
      set({ doctorStats: data });
    } catch (error) {
      set({ error: error.message });
      showError('Ошибка при загрузке статистики врача');
    } finally {
      set({ loading: false });
    }
  },

  // Получение статистики пациента
  fetchPatientStatistics: async (patientId, startDate, endDate) => {
    set({ loading: true, error: null });
    try {
      const params = {};
      if (startDate) params.start_date = startDate.toISOString();
      if (endDate) params.end_date = endDate.toISOString();

      const { data } = await axios.get(`/statistics/patient/${patientId}`, { params });
      set({ patientStats: data });
    } catch (error) {
      set({ error: error.message });
      showError('Ошибка при загрузке статистики пациента');
    } finally {
      set({ loading: false });
    }
  },

  // Сброс статистики
  resetStatistics: () => {
    set({
      clinicStats: null,
      doctorStats: null,
      patientStats: null,
      error: null
    });
  }
}));
