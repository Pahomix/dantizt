import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '@/lib/axios';
import Cookies from 'js-cookie';

const initialState = {
  user: null,
  isAuthenticated: false
};

export const useAuthStore = create(
  persist(
    (set) => ({
      ...initialState,

      login: (userData) => {
        console.log('Setting auth state:', userData);
        set({
          user: userData,
          isAuthenticated: true
        });
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          console.log('Clearing auth state');
          // Очищаем куки при выходе с правильными параметрами
          const cookieOptions = {
            path: '/',
            domain: 'www.dantizt.ru'
          };
          
          Cookies.remove('access_token', cookieOptions);
          Cookies.remove('refresh_token', cookieOptions);
          Cookies.remove('userRole', cookieOptions);
          set(initialState);
        }
      },

      updateUser: (userData) => {
        console.log('Updating user data:', userData);
        set((state) => ({
          ...state,
          user: {
            ...state.user,
            ...userData
          }
        }));
      },

      checkAuth: async () => {
        try {
          console.log('Checking auth with /auth/me');
          const { data } = await api.get('/auth/me');
          console.log('Auth check response:', data);
          
          if (data?.email) {
            // Обновляем токены из ответа
            if (data.access_token) {
              Cookies.set('access_token', data.access_token, {
                secure: false,
                sameSite: 'lax'
              });
            }
            if (data.refresh_token) {
              Cookies.set('refresh_token', data.refresh_token, {
                secure: false,
                sameSite: 'lax'
              });
            }
            
            // Обновляем состояние
            set({
              user: {
                email: data.email,
                full_name: data.full_name,
                role: data.role
              },
              isAuthenticated: true
            });
            return true;
          }
          
          return false;
        } catch (error) {
          console.error('Auth check error:', error);
          set(initialState);
          return false;
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
