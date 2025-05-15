'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import Cookies from 'js-cookie';

export default function ProtectedLayout({ children }) {
  const router = useRouter();
  const { checkAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      console.log('Protected layout - checking auth');
      console.log('Cookies:', document.cookie);

      // Проверяем наличие токенов в куках
      const accessToken = Cookies.get('access_token');
      const refreshToken = Cookies.get('refresh_token');

      if (!accessToken && !refreshToken) {
        console.log('No tokens found, redirecting to login');
        router.replace('/auth/login');
        setIsLoading(false);
        return;
      }

      try {
        console.log('Checking auth with backend...');
        const isValid = await checkAuth();
        console.log('Auth check result:', isValid);

        if (!isValid) {
          console.log('Auth check failed, redirecting to login');
          // Очищаем куки при неудачной проверке
          Cookies.remove('access_token');
          Cookies.remove('refresh_token');
          Cookies.remove('userRole');
          router.replace('/auth/login');
        }
      } catch (error) {
        console.error('Auth verification error:', error);
        // Очищаем куки при ошибке
        Cookies.remove('access_token');
        Cookies.remove('refresh_token');
        Cookies.remove('userRole');
        router.replace('/auth/login');
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, [router, checkAuth]);

  // Показываем загрузку пока проверяем авторизацию
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Если проверка завершена и пользователь авторизован, показываем контент
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}
