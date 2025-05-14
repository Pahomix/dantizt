import { create } from 'zustand';
import api from '@/lib/axios';
import { toast } from 'react-toastify';

/**
 * Patient store for managing patient data.
 */
export const usePatientStore = create((set, get) => ({
  /**
   * List of patients.
   */
  patients: [],

  /**
   * Current patient profile.
   */
  patientProfile: null,

  /**
   * Selected patient.
   */
  selectedPatient: null,

  /**
   * Loading state.
   */
  loading: false,

  /**
   * Error message.
   */
  error: null,

  /**
   * Clears the error message.
   */
  clearError: () => set({ error: null }),

  /**
   * Fetches the current patient's profile.
   */
  fetchPatientProfile: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/patients/me');
      const profile = response.data;
      set({ patientProfile: profile, loading: false });
      return profile;
    } catch (error) {
      set({ error: error.response?.data?.detail || error.message, loading: false });
      toast('Ошибка при загрузке профиля пациента', { type: 'error' });
      throw error;
    }
  },

  /**
   * Updates the current patient's profile.
   * @param {object} profileData - New profile data.
   */
  updatePatientProfile: async (profileData) => {
    set({ loading: true, error: null });
    try {
      const response = await api.put('/patients/me', profileData);
      
      // Сразу после успешного обновления запрашиваем актуальные данные
      const updatedProfile = await api.get('/patients/me');
      
      set({ patientProfile: updatedProfile.data, loading: false });
      toast('Профиль успешно обновлен', { type: 'success' });
      return updatedProfile.data;
    } catch (error) {
      set({ error: error.response?.data?.detail || error.message, loading: false });
      toast('Ошибка при обновлении профиля', { type: 'error' });
      throw error;
    }
  },

  /**
   * Fetches the list of patients.
   */
  fetchPatients: async () => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/patients');
      set({ patients: response.data.items || response.data, loading: false });
      return response.data.items || response.data;
    } catch (error) {
      set({ error: error.response?.data?.detail || error.message, loading: false });
      toast('Ошибка при загрузке списка пациентов', { type: 'error' });
      throw error;
    }
  },

  /**
   * Fetches a single patient by ID
   * @param {number} patientId - ID of the patient to fetch
   */
  fetchPatient: async (patientId) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get(`/patients/${patientId}`);
      set({ selectedPatient: response.data, loading: false });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.detail || error.message, loading: false });
      toast('Ошибка при загрузке данных пациента', { type: 'error' });
      throw error;
    }
  },

  /**
   * Creates a new patient.
   * @param {object} patientData - Patient data.
   */
  createPatient: async (patientData) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post('/patients', patientData);
      set(state => ({
        patients: [...state.patients, response.data],
        loading: false
      }));
      toast('Пациент успешно добавлен', { type: 'success' });
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.detail || error.message, loading: false });
      toast('Ошибка при создании пациента', { type: 'error' });
      throw error;
    }
  },

  /**
   * Updates a patient.
   * @param {number} patientId - ID of the patient to update.
   * @param {object} patientData - New patient data.
   */
  updatePatient: async (patientId, patientData) => {
    set({ loading: true, error: null });
    try {
      // Отправляем запрос на обновление данных
      await api.put(`/patients/${patientId}`, patientData);
      
      // Получаем обновленные данные пациента
      const updatedResponse = await api.get(`/patients/${patientId}`);
      const updatedPatient = updatedResponse.data;
      
      // Обновляем список пациентов с актуальными данными
      set(state => ({
        patients: state.patients.map(patient =>
          patient.id === patientId ? updatedPatient : patient
        ),
        loading: false
      }));
      
      toast('Данные пациента успешно обновлены', { type: 'success' });
      return updatedPatient;
    } catch (error) {
      set({ error: error.response?.data?.detail || error.message, loading: false });
      toast('Ошибка при обновлении данных пациента', { type: 'error' });
      throw error;
    }
  },

  /**
   * Deletes a patient.
   * @param {number} patientId - ID of the patient to delete.
   */
  deletePatient: async (patientId) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/patients/${patientId}`);
      set(state => ({
        patients: state.patients.filter(patient => patient.id !== patientId),
        loading: false
      }));
      toast('Пациент успешно удален', { type: 'success' });
      return true;
    } catch (error) {
      set({ error: error.response?.data?.detail || error.message, loading: false });
      toast('Ошибка при удалении пациента', { type: 'error' });
      throw error;
    }
  }
}));
