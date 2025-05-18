import { create } from 'zustand';
import api from '@/lib/axios';

export const useBackupStore = create((set, get) => ({
  backups: [],
  loading: false,
  error: null,

  fetchBackups: async () => {
    try {
      set({ loading: true, error: null });
      const response = await api.get('/backups');
      set({ backups: response.data.items || [], loading: false });
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
      await api.post('/backups/create');
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

  restoreBackup: async (filename) => {
    try {
      set({ loading: true, error: null });
      await api.post(`/backups/restore/${filename}`);
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
  
  downloadBackup: async (filename) => {
    try {
      set({ loading: true, error: null });
      // Создаем ссылку для скачивания файла
      const response = await api.get(`/backups/download/${filename}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      set({ loading: false });
    } catch (error) {
      console.error('Ошибка при скачивании резервной копии:', error);
      set({ 
        error: error.response?.data?.detail || 'Не удалось скачать резервную копию', 
        loading: false 
      });
    }
  },

  deleteBackup: async (filename) => {
    try {
      set({ loading: true, error: null });
      await api.delete(`/backups/${filename}`);
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
