import { create } from 'zustand';
import api from '@/lib/axios';

export const useDoctorAppointmentsStore = create((set) => ({
  appointments: [],
  appointment: null,
  loading: false,
  error: null,

  // Получение приемов врача
  fetchAppointments: async (filters = {}) => {
    set({ loading: true, error: null });
    try {
      const { status, from_date, to_date } = filters;
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (from_date) params.append('from_date', from_date.toISOString());
      if (to_date) {
        // Устанавливаем время окончания дня
        const endDate = new Date(to_date);
        endDate.setHours(23, 59, 59, 999);
        params.append('to_date', endDate.toISOString());
      }

      const response = await api.get(`/appointments/doctor/me?${params}`);
      
      // Преобразуем даты в объекты Date
      const appointments = response.data.map(appointment => ({
        ...appointment,
        start_time: new Date(appointment.start_time),
        end_time: new Date(appointment.end_time),
        created_at: new Date(appointment.created_at),
        updated_at: new Date(appointment.updated_at)
      }));
      
      set({ appointments, loading: false });
    } catch (error) {
      console.error('Error fetching appointments:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке приемов',
        loading: false,
        appointments: []
      });
    }
  },

  // Получение данных одного приема
  fetchAppointment: async (appointmentId) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/appointments/${appointmentId}`);
      
      // Преобразуем даты в объекты Date
      const appointment = {
        ...response.data,
        start_time: new Date(response.data.start_time),
        end_time: new Date(response.data.end_time),
        created_at: new Date(response.data.created_at),
        updated_at: new Date(response.data.updated_at)
      };
      
      set({ appointment, loading: false });
      return appointment;
    } catch (error) {
      console.error('Error fetching appointment:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке приема',
        loading: false,
        appointment: null
      });
      throw error;
    }
  },

  // Обновление статуса приема
  updateAppointmentStatus: async (appointmentId, status) => {
    set({ loading: true, error: null });
    try {
      const response = await api.put(`/appointments/${appointmentId}`, { status });
      
      // Преобразуем даты в объекты Date
      const appointment = {
        ...response.data,
        start_time: new Date(response.data.start_time),
        end_time: new Date(response.data.end_time),
        created_at: new Date(response.data.created_at),
        updated_at: new Date(response.data.updated_at)
      };
      
      set({ appointment, loading: false });
      return appointment;
    } catch (error) {
      console.error('Error updating appointment status:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при обновлении статуса приема',
        loading: false 
      });
      throw error;
    }
  },

  // Добавление заметки к приему
  addAppointmentNote: async (appointmentId, notes) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post(`/appointments/${appointmentId}/notes`, { notes });
      
      // Преобразуем даты в объекты Date
      const appointment = {
        ...response.data,
        start_time: new Date(response.data.start_time),
        end_time: new Date(response.data.end_time),
        created_at: new Date(response.data.created_at),
        updated_at: new Date(response.data.updated_at)
      };
      
      set({ appointment, loading: false });
      return appointment;
    } catch (error) {
      console.error('Error adding appointment note:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при добавлении заметки',
        loading: false 
      });
      throw error;
    }
  },

  // Добавление услуг к приему
  addAppointmentServices: async (appointmentId, serviceIds) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post(`/appointments/${appointmentId}/services`, serviceIds);
      
      // Преобразуем даты в объекты Date
      const appointment = {
        ...response.data,
        start_time: new Date(response.data.start_time),
        end_time: new Date(response.data.end_time),
        created_at: new Date(response.data.created_at),
        updated_at: new Date(response.data.updated_at)
      };
      
      set({ appointment, loading: false });
      return appointment;
    } catch (error) {
      console.error('Error adding appointment services:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при добавлении услуг',
        loading: false 
      });
      throw error;
    }
  },

  // Завершение приема с указанием услуг
  completeAppointment: async (appointmentId, serviceIds) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post(`/appointments/${appointmentId}/complete`, { service_ids: serviceIds });
      
      // Преобразуем даты в объекты Date
      const appointment = {
        ...response.data,
        start_time: new Date(response.data.start_time),
        end_time: new Date(response.data.end_time),
        created_at: new Date(response.data.created_at),
        updated_at: new Date(response.data.updated_at)
      };
      
      set({ appointment, loading: false });
      return appointment;
    } catch (error) {
      console.error('Error completing appointment:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при завершении приема',
        loading: false 
      });
      throw error;
    }
  },
}));
