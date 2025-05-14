import { create } from 'zustand';
import api from '@/lib/axios';

export const useScheduleStore = create((set, get) => ({
  doctors: [],
  schedules: [],
  specialDays: [],
  scheduleTemplates: [],
  services: [],
  selectedService: null,
  loading: false,
  error: null,

  fetchDoctors: async () => {
    try {
      set({ loading: true, error: null });
      const { data } = await api.get('/doctors/');
      set({ doctors: data });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },

  fetchDoctorSchedule: async (doctorId) => {
    try {
      set({ loading: true, error: null });
      const { data } = await api.get(`/schedules/doctors/${doctorId}/schedules`);
      set({ schedules: data });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },

  updateDoctorSchedule: async (doctorId, scheduleData) => {
    try {
      set({ loading: true, error: null });
      const { data } = await api.put(`/schedules/doctors/${doctorId}/schedules`, scheduleData);
      set({ schedules: data });
      return data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  fetchDoctorSpecialDays: async (doctorId) => {
    try {
      set({ loading: true, error: null });
      const { data } = await api.get(`/schedules/doctors/${doctorId}/special-days`);
      set({ specialDays: data });
    } catch (error) {
      set({ error: error.message });
    } finally {
      set({ loading: false });
    }
  },

  createSpecialDay: async (doctorId, specialDayData) => {
    try {
      set({ loading: true, error: null });
      const { data } = await api.post(`/schedules/doctors/${doctorId}/special-days`, specialDayData);
      set((state) => ({ specialDays: [...state.specialDays, data] }));
      return data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  updateSpecialDay: async (doctorId, specialDayId, specialDayData) => {
    try {
      set({ loading: true, error: null });
      const { data } = await api.put(`/schedules/doctors/${doctorId}/special-days/${specialDayId}`, specialDayData);
      set((state) => ({
        specialDays: state.specialDays.map(day => 
          day.id === specialDayId ? data : day
        )
      }));
      return data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  deleteSpecialDay: async (doctorId, specialDayId) => {
    try {
      set({ loading: true, error: null });
      await api.delete(`/schedules/doctors/${doctorId}/special-days/${specialDayId}`);
      set((state) => ({
        specialDays: state.specialDays.filter(day => day.id !== specialDayId)
      }));
    } catch (error) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  fetchDoctorAvailability: async (doctorId, date) => {
    try {
      set({ loading: true, error: null });
      const params = new URLSearchParams({
        date: date.toISOString().split('T')[0],
      });
      const { data } = await api.get(
        `/schedules/doctors/${doctorId}/availability?${params.toString()}`
      );
      return data;
    } catch (error) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  fetchServices: async () => {
    try {
      const response = await api.get('/services');
      set({ services: response.data });
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  },

  fetchScheduleTemplates: async (doctorId) => {
    try {
      const response = await api.get(`schedules/doctors/${doctorId}/schedule-templates`);
      set({ scheduleTemplates: response.data });
    } catch (error) {
      console.error('Error fetching schedule templates:', error);
    }
  },

  createScheduleTemplate: async (doctorId, template) => {
    try {
      const response = await api.post(`schedules/doctors/${doctorId}/schedule-templates`, template);
      const templates = get().scheduleTemplates;
      set({ scheduleTemplates: [...templates, response.data] });
      return response.data;
    } catch (error) {
      console.error('Error creating schedule template:', error);
      throw error;
    }
  },

  updateScheduleTemplate: async (doctorId, templateId, template) => {
    try {
      const response = await api.put(`schedules/doctors/${doctorId}/schedule-templates/${templateId}`, template);
      const templates = get().scheduleTemplates.map(t => 
        t.id === templateId ? response.data : t
      );
      set({ scheduleTemplates: templates });
      return response.data;
    } catch (error) {
      console.error('Error updating schedule template:', error);
      throw error;
    }
  },

  deleteScheduleTemplate: async (doctorId, templateId) => {
    try {
      await api.delete(`schedules/doctors/${doctorId}/schedule-templates/${templateId}`);
      const templates = get().scheduleTemplates.filter(t => t.id !== templateId);
      set({ scheduleTemplates: templates });
    } catch (error) {
      console.error('Error deleting schedule template:', error);
      throw error;
    }
  },
}));
