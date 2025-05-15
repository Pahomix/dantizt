'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { toast } from 'react-toastify';
import { useAuthStore } from '@/store/auth.store';
import { HOME_ROUTES } from '@/constants/routes';
import { login as loginApi } from '@/services/auth';
import Cookies from 'js-cookie';

export default function Login() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login: setAuth } = useAuthStore();

  const onSubmit = async (data) => {
    try {
      setLoading(true);
      setError('');
      console.log('Отправка запроса на авторизацию:', data);
      
      const response = await loginApi({
        email: data.email,
        password: data.password,
      });

      console.log('Ответ от сервера после авторизации:', response);

      // Проверяем наличие данных в ответе
      if (!response.data) {
        throw new Error('Нет данных в ответе');
      }

      // Сохраняем данные пользователя в store
      const userData = {
        id: response.data.id,
        email: response.data.email,
        role: response.data.role,
        fullName: response.data.full_name,
      };
      setAuth(userData);
      console.log('Данные пользователя сохранены в store:', userData);

      // Редирект на соответствующую страницу
      const redirectPath = HOME_ROUTES[response.data.role] || '/dashboard';
      console.log('Попытка редиректа на:', redirectPath);
      
      // Пробуем сначала через router
      try {
        router.push(redirectPath);
      } catch (routerError) {
        console.error('Ошибка при редиректе через router:', routerError);
        // Альтернативный способ редиректа
        window.location.href = redirectPath;
      }
      
      // Устанавливаем таймаут для проверки редиректа
      setTimeout(() => {
        if (window.location.pathname.includes('/auth/login')) {
          console.log('Редирект не произошел, пробуем альтернативный метод');
          window.location.href = redirectPath;
        }
      }, 1000);
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.detail || 'Ошибка при входе';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Вход в систему
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{error}</h3>
                  </div>
                </div>
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  {...register('email', { 
                    required: 'Это поле обязательно',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Некорректный email адрес'
                    }
                  })}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Пароль
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  {...register('password', { 
                    required: 'Это поле обязательно',
                    minLength: {
                      value: 8,
                      message: 'Пароль должен содержать минимум 8 символов'
                    }
                  })}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : null}
                {loading ? 'Вход...' : 'Войти'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="relative flex justify-center text-sm">
                <span className="px-2 text-gray-500">
                  Нет аккаунта?{' '}
                  <Link href="/auth/register" className="font-medium text-indigo-600 hover:text-indigo-500">
                    Зарегистрироваться
                  </Link>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
