'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { verifyEmail } from '@/services/auth';
import { toast } from 'react-toastify';

export default function VerifyEmail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('Подтверждаем ваш email...');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const token = searchParams.get('token');
    console.log('Token from URL:', token);

    if (!token) {
      setStatus('error');
      setMessage('Токен подтверждения не найден');
      return;
    }

    const verify = async () => {
      try {
        // Имитируем прогресс загрузки
        const progressInterval = setInterval(() => {
          setProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 200);

        console.log('Sending verification request...');
        const response = await verifyEmail(token);
        console.log('Verification response:', response);
        
        // Завершаем прогресс
        clearInterval(progressInterval);
        setProgress(100);
        
        setStatus('success');
        setMessage('Email успешно подтвержден! Теперь вы можете войти в систему.');
        
        // Показываем уведомление об успехе
        toast.success('Email успешно подтвержден!');
        
        // Редирект через 3 секунды
        setTimeout(() => {
          router.push('/auth/login');
        }, 3000);
      } catch (err) {
        console.error('Verification error:', err);
        setStatus('error');
        setMessage(err.response?.data?.detail || 'Ошибка подтверждения email');
        setProgress(100);
        toast.error('Ошибка подтверждения email');
      }
    };

    verify();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          {/* Иконка статуса */}
          <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${
            status === 'verifying' ? 'bg-blue-100' :
            status === 'success' ? 'bg-green-100' :
            'bg-red-100'
          }`}>
            {status === 'verifying' ? (
              <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : status === 'success' ? (
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>

          {/* Заголовок */}
          <h2 className={`text-2xl font-bold mb-4 ${
            status === 'verifying' ? 'text-blue-900' :
            status === 'success' ? 'text-green-900' :
            'text-red-900'
          }`}>
            {status === 'verifying' ? 'Подтверждение email' :
             status === 'success' ? 'Email подтвержден!' :
             'Ошибка подтверждения'}
          </h2>

          {/* Сообщение */}
          <p className="text-gray-600 mb-6">{message}</p>

          {/* Прогресс-бар */}
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
            <div 
              className={`h-2.5 rounded-full transition-all duration-500 ${
                status === 'verifying' ? 'bg-blue-600' :
                status === 'success' ? 'bg-green-600' :
                'bg-red-600'
              }`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          {/* Кнопка возврата на страницу входа */}
          {(status === 'success' || status === 'error') && (
            <button
              onClick={() => router.push('/auth/login')}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Перейти на страницу входа
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
