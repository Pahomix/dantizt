'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import Cookies from 'js-cookie';

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    // Проверяем наличие токенов
    const accessToken = Cookies.get('access_token');
    const refreshToken = Cookies.get('refresh_token');
    
    if (accessToken || refreshToken) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);
  
  return null;
}
