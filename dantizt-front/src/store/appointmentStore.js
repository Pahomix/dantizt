import { create } from 'zustand';
import api from '@/lib/axios';

export const useAppointmentStore = create((set, get) => ({
  appointments: [],
  loading: false,
  error: null,
  totalCount: 0,

  // Получение списка записей на прием
  fetchAppointments: async (params = {}) => {
    try {
      set({ loading: true, error: null });
      const response = await api.get('/appointments/list', { params });
      
      // Обрабатываем данные, убеждаясь, что все необходимые поля присутствуют
      const appointments = (response.data.items || []).map(appointment => ({
        ...appointment,
        // Обеспечиваем наличие полей patient_name и doctor_name для отображения в таблице
        patient_name: appointment.patient_name || 
                     (appointment.patient && appointment.patient.full_name) || 
                     (appointment.patient && appointment.patient.user && appointment.patient.user.full_name) || 
                     'Нет данных',
        doctor_name: appointment.doctor_name || 
                    (appointment.doctor && appointment.doctor.user && appointment.doctor.user.full_name) || 
                    'Нет данных',
        doctor_specialty: appointment.doctor_specialty || 
                         (appointment.doctor && appointment.doctor.specialization && appointment.doctor.specialization.name) || 
                         'Нет данных'
      }));
      
      set({ 
        appointments,
        totalCount: response.data.total || 0,
        loading: false 
      });
      
      console.log('Fetched appointments:', appointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      set({ 
        error: error.response?.data?.detail || 'Failed to fetch appointments',
        loading: false,
        appointments: [],
        totalCount: 0
      });
    }
  },

  // Создание новой записи
  createAppointment: async (appointmentData) => {
    try {
      set({ loading: true, error: null });
      const response = await api.post('/appointments/', appointmentData);
      
      // После создания записи, обновляем весь список для получения актуальных данных
      await get().fetchAppointments();
      
      return response.data;
    } catch (error) {
      console.error('Error creating appointment:', error);
      set({ 
        error: error.response?.data?.detail || 'Failed to create appointment',
        loading: false 
      });
      throw error;
    }
  },

  // Обновление записи
  updateAppointment: async (id, appointmentData) => {
    try {
      set({ loading: true, error: null });
      const response = await api.put(`/appointments/${id}`, appointmentData);
      
      // После обновления записи, обновляем весь список для получения актуальных данных
      await get().fetchAppointments();
      
      return response.data;
    } catch (error) {
      console.error('Error updating appointment:', error);
      set({ 
        error: error.response?.data?.detail || 'Failed to update appointment',
        loading: false 
      });
      throw error;
    }
  },

  // Удаление записи
  deleteAppointment: async (id) => {
    try {
      set({ loading: true, error: null });
      await api.delete(`/appointments/${id}`);
      
      // После удаления записи, обновляем весь список для получения актуальных данных
      await get().fetchAppointments();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      set({ 
        error: error.response?.data?.detail || 'Failed to delete appointment',
        loading: false 
      });
      throw error;
    }
  },

  // Изменение статуса записи
  updateAppointmentStatus: async (id, status) => {
    try {
      set({ loading: true, error: null });
      const response = await api.patch(`/appointments/${id}/status`, { status });
      
      // После обновления статуса, обновляем весь список для получения актуальных данных
      await get().fetchAppointments();
      
      return response.data;
    } catch (error) {
      console.error('Error updating appointment status:', error);
      set({ 
        error: error.response?.data?.detail || 'Failed to update appointment status',
        loading: false 
      });
      throw error;
    }
  },

  // Сброс состояния
  resetState: () => {
    set({
      appointments: [],
      loading: false,
      error: null,
      totalCount: 0
    });
  }
}));
