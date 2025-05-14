import { create } from 'zustand';
import api from '@/lib/axios';

export const useAppointmentsStore = create((set) => ({
  appointments: [],
  selectedAppointment: null,
  loading: false,
  error: null,

  // Получение списка записей пациента
  fetchPatientAppointments: async (patientId) => {
    try {
      set({ loading: true, error: null });
      const response = await api.get(`/appointments/patient/${patientId}`);
      set({ appointments: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error('Error fetching patient appointments:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке записей',
        loading: false 
      });
      throw error;
    }
  },

  // Получение списка записей врача
  fetchDoctorAppointments: async (doctorId) => {
    try {
      set({ loading: true, error: null });
      const response = await api.get(`/appointments/doctor/${doctorId}`);
      set({ appointments: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error('Error fetching doctor appointments:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке записей',
        loading: false 
      });
      throw error;
    }
  },

  // Получение списка записей текущего врача
  fetchMyDoctorAppointments: async (params = {}) => {
    try {
      set({ loading: true, error: null });
      const { status, from_date, to_date } = params;
      const queryParams = new URLSearchParams();
      
      if (status) queryParams.append('status', status);
      if (from_date) queryParams.append('from_date', from_date.toISOString());
      if (to_date) queryParams.append('to_date', to_date.toISOString());
      
      const url = `/appointments/doctor/me?${queryParams.toString()}`;
      const response = await api.get(url);
      set({ appointments: response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error('Error fetching my doctor appointments:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке записей',
        loading: false 
      });
      throw error;
    }
  },

  // Получение всех записей с фильтрацией
  fetchAllAppointments: async (params = {}) => {
    try {
      set({ loading: true, error: null });
      const { status, date, search, page = 1, limit = 10 } = params;
      const queryParams = new URLSearchParams();
      
      if (status && status !== 'all') queryParams.append('status', status);
      if (date) queryParams.append('date', date);
      if (search) queryParams.append('search', search);
      queryParams.append('page', page);
      queryParams.append('limit', limit);
      
      const url = `/appointments/list?${queryParams.toString()}`;
      const response = await api.get(url);
      set({ appointments: response.data.items || response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error('Error fetching all appointments:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке записей',
        loading: false 
      });
      throw error;
    }
  },

  // Создание новой записи
  createAppointment: async (appointmentData) => {
    try {
      set({ loading: true, error: null });
      const response = await api.post('/appointments', appointmentData);
      set((state) => ({
        appointments: [...state.appointments, response.data],
        loading: false
      }));
      return response.data;
    } catch (error) {
      console.error('Error creating appointment:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при создании записи',
        loading: false 
      });
      throw error;
    }
  },

  // Обновление записи
  updateAppointment: async (appointmentId, appointmentData) => {
    try {
      set({ loading: true, error: null });
      const response = await api.put(`/appointments/${appointmentId}`, appointmentData);
      set((state) => ({
        appointments: state.appointments.map(appointment =>
          appointment.id === appointmentId ? response.data : appointment
        ),
        loading: false
      }));
      return response.data;
    } catch (error) {
      console.error('Error updating appointment:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при обновлении записи',
        loading: false 
      });
      throw error;
    }
  },

  // Отмена записи
  cancelAppointment: async (appointmentId) => {
    try {
      set({ loading: true, error: null });
      const response = await api.put(`/appointments/${appointmentId}`, {
        status: 'cancelled'
      });
      set((state) => ({
        appointments: state.appointments.map(appointment =>
          appointment.id === appointmentId ? response.data : appointment
        ),
        loading: false
      }));
      return response.data;
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при отмене записи',
        loading: false 
      });
      throw error;
    }
  },

  // Завершение записи (для врача)
  completeAppointment: async (appointmentId) => {
    try {
      set({ loading: true, error: null });
      const response = await api.put(`/appointments/${appointmentId}`, {
        status: 'completed'
      });
      set((state) => ({
        appointments: state.appointments.map(appointment =>
          appointment.id === appointmentId ? response.data : appointment
        ),
        loading: false
      }));
      return response.data;
    } catch (error) {
      console.error('Error completing appointment:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при завершении записи',
        loading: false 
      });
      throw error;
    }
  },

  // Получение доступных слотов для записи
  fetchAvailableSlots: async (doctorId, date) => {
    try {
      set({ loading: true, error: null });
      const response = await api.get(`/appointments/available-slots`, {
        params: { doctor_id: doctorId, date }
      });
      set({ loading: false });
      return response.data;
    } catch (error) {
      console.error('Error fetching available slots:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке доступных слотов',
        loading: false 
      });
      throw error;
    }
  },

  // Очистка ошибок
  clearError: () => set({ error: null }),

  // Очистка выбранной записи
  clearSelectedAppointment: () => set({ selectedAppointment: null })
}));
