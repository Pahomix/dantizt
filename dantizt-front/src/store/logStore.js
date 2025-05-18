import { create } from 'zustand';
import api from '@/lib/axios';

export const useLogStore = create((set, get) => ({
  logs: [],
  totalLogs: 0,
  currentPage: 1,
  pageSize: 10,
  loading: false,
  error: null,
  tables: [],
  actions: [],
  filters: {
    table_name: null,
    action_type: null,
    start_date: null,
    end_date: null,
  },

  setFilters: (filters) => {
    set({ filters: { ...get().filters, ...filters } });
  },

  resetFilters: () => {
    set({
      filters: {
        table_name: null,
        action_type: null,
        start_date: null,
        end_date: null,
      }
    });
  },

  setPage: (page) => {
    set({ currentPage: page });
    get().fetchLogs();
  },

  setPageSize: (size) => {
    set({ pageSize: size, currentPage: 1 });
    get().fetchLogs();
  },

  fetchLogs: async () => {
    try {
      const { currentPage, pageSize, filters } = get();
      set({ loading: true, error: null });
      
      const skip = (currentPage - 1) * pageSize;
      
      // Строим параметры запроса
      const params = {
        skip,
        limit: pageSize,
        ...filters
      };
      
      // Удаляем null значения
      Object.keys(params).forEach(key => 
        params[key] === null && delete params[key]
      );
      
      const response = await api.get('/logs', { params });
      
      set({
        logs: response.data.items || [],
        totalLogs: response.data.total || 0,
        loading: false
      });
    } catch (error) {
      console.error('Ошибка при загрузке логов:', error);
      set({
        error: error.response?.data?.detail || 'Не удалось загрузить логи',
        loading: false
      });
    }
  },

  fetchLogDetails: async (logId) => {
    try {
      set({ loading: true, error: null });
      const response = await api.get(`/logs/${logId}`);
      set({ loading: false });
      return response.data;
    } catch (error) {
      console.error('Ошибка при загрузке деталей лога:', error);
      set({
        error: error.response?.data?.detail || 'Не удалось загрузить детали лога',
        loading: false
      });
      return null;
    }
  },

  fetchTables: async () => {
    try {
      set({ loading: true, error: null });
      const response = await api.get('/logs/tables');
      set({ tables: response.data || [], loading: false });
    } catch (error) {
      console.error('Ошибка при загрузке списка таблиц:', error);
      set({
        error: error.response?.data?.detail || 'Не удалось загрузить список таблиц',
        loading: false
      });
    }
  },

  fetchActions: async () => {
    try {
      set({ loading: true, error: null });
      const response = await api.get('/logs/actions');
      set({ actions: response.data || [], loading: false });
    } catch (error) {
      console.error('Ошибка при загрузке списка действий:', error);
      set({
        error: error.response?.data?.detail || 'Не удалось загрузить список действий',
        loading: false
      });
    }
  }
}));
