import { create } from 'zustand';
import axios from '../utils/axios';

const useAppointmentStore = create((set) => ({
  appointments: [],
  selectedAppointment: null,
  loading: false,
  error: null,

  // Получение списка записей пациента
  fetchPatientAppointments: async (patientId) => {
    try {
      set({ loading: true, error: null });
      const response = await axios.get(`/appointments/patient/${patientId}`);
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

  // Создание новой записи
  createAppointment: async (appointmentData) => {
    try {
      set({ loading: true, error: null });
      const response = await axios.post('/appointments', appointmentData);
      // Загружаем актуальные данные после создания записи
      const updatedAppointments = await axios.get(`/appointments/patient/${appointmentData.patient_id}`);
      set({ 
        appointments: updatedAppointments.data,
        loading: false 
      });
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

  // Отмена записи
  cancelAppointment: async (appointmentId) => {
    try {
      set({ loading: true, error: null });
      const response = await axios.put(`/appointments/${appointmentId}`, {
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

  // Получение доступных слотов для записи
  fetchAvailableSlots: async (doctorId, date) => {
    try {
      set({ loading: true, error: null });
      const response = await axios.get(`/schedules/doctors/${doctorId}/availability`, {
        params: { date }
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

export default useAppointmentStore;
