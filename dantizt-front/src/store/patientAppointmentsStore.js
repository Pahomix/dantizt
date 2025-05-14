import { create } from 'zustand';
import api from '@/lib/axios';

export const usePatientAppointmentsStore = create((set) => ({
  appointments: [],
  selectedAppointment: null,
  loading: false,
  error: null,

  // Получить приемы пациента с их записями
  fetchPatientAppointments: async (patientId) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/medical-records/patient/${patientId}/appointments`);
      set({ appointments: response.data, loading: false });
      return response.data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  // Выбрать прием для просмотра
  setSelectedAppointment: (appointment) => {
    set({ selectedAppointment: appointment });
  },

  // Очистить выбранный прием
  clearSelectedAppointment: () => {
    set({ selectedAppointment: null });
  }
}));
