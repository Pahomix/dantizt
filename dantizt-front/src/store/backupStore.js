import { create } from 'zustand';
import { api } from '@/services/api';

export const useBackupStore = create((set, get) => ({
  backups: [],
  loading: false,
  error: null,

  fetchBackups: async () => {
    try {
      set({ loading: true, error: null });
      const response = await api.get('/admin/backups');
      set({ backups: response.data, loading: false });
    } catch (error) {
      console.error('Ошибка при загрузке резервных копий:', error);
      set({ 
        error: error.response?.data?.detail || 'Не удалось загрузить резервные копии', 
        loading: false 
      });
    }
  },

  createBackup: async () => {
    try {
      set({ loading: true, error: null });
      await api.post('/admin/backups');
      // После создания обновляем список
      await get().fetchBackups();
    } catch (error) {
      console.error('Ошибка при создании резервной копии:', error);
      set({ 
        error: error.response?.data?.detail || 'Не удалось создать резервную копию', 
        loading: false 
      });
    }
  },

  restoreBackup: async (backupId) => {
    try {
      set({ loading: true, error: null });
      await api.post(`/admin/backups/${backupId}/restore`);
      set({ loading: false });
      return true;
    } catch (error) {
      console.error('Ошибка при восстановлении из резервной копии:', error);
      set({ 
        error: error.response?.data?.detail || 'Не удалось восстановить из резервной копии', 
        loading: false 
      });
      return false;
    }
  },

  deleteBackup: async (backupId) => {
    try {
      set({ loading: true, error: null });
      await api.delete(`/admin/backups/${backupId}`);
      // После удаления обновляем список
      await get().fetchBackups();
    } catch (error) {
      console.error('Ошибка при удалении резервной копии:', error);
      set({ 
        error: error.response?.data?.detail || 'Не удалось удалить резервную копию', 
        loading: false 
      });
    }
  }
}));
