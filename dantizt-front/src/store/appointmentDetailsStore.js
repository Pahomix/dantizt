import { create } from 'zustand';
import api from '@/lib/axios';

export const useAppointmentDetailsStore = create((set) => ({
  appointment: null,
  loading: false,
  error: null,

  fetchAppointment: async (id) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/appointments/${id}`);
      // Преобразуем даты в объекты Date
      const appointment = {
        ...response.data,
        start_time: new Date(response.data.start_time),
        end_time: new Date(response.data.end_time),
        created_at: new Date(response.data.created_at),
        updated_at: new Date(response.data.updated_at)
      };
      set({ appointment, loading: false });
    } catch (error) {
      set({ 
        error: error.response?.data?.detail || 'Failed to fetch appointment', 
        loading: false 
      });
    }
  },

  updateAppointmentStatus: async (id, status) => {
    try {
      const response = await api.put(`/appointments/${id}`, { status });
      // Преобразуем даты в объекты Date
      const appointment = {
        ...response.data,
        start_time: new Date(response.data.start_time),
        end_time: new Date(response.data.end_time),
        created_at: new Date(response.data.created_at),
        updated_at: new Date(response.data.updated_at)
      };
      set({ appointment });
      return appointment;
    } catch (error) {
      throw error.response?.data?.detail || 'Failed to update appointment status';
    }
  },

  addAppointmentNote: async (id, note) => {
    try {
      const response = await api.post(`/appointments/${id}/notes`, { notes: note });
      // Преобразуем даты в объекты Date
      const appointment = {
        ...response.data,
        start_time: new Date(response.data.start_time),
        end_time: new Date(response.data.end_time),
        created_at: new Date(response.data.created_at),
        updated_at: new Date(response.data.updated_at)
      };
      set({ appointment });
      return appointment;
    } catch (error) {
      throw error.response?.data?.detail || 'Failed to add appointment note';
    }
  },

  clearAppointment: () => set({ appointment: null, error: null }),
}));
