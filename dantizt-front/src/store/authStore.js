import { create } from 'zustand';
import api from '@/lib/axios';

export const useAuthStore = create((set) => ({
  user: null,
  loading: false,
  error: null,

  setUser: (user) => set({ user }),

  login: async (credentials) => {
    try {
      set({ loading: true, error: null });
      const response = await api.post('/auth/login', credentials);
      set({ user: response.data, loading: false });
      return response.data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      set({ loading: true, error: null });
      await api.post('/auth/logout');
      set({ user: null, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  checkAuth: async () => {
    try {
      set({ loading: true, error: null });
      const response = await api.get('/auth/me');
      set({ user: response.data, loading: false });
      return response.data;
    } catch (error) {
      set({ user: null, error: error.message, loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null })
}));
