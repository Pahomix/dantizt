'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePaymentsStore } from '@/store/paymentsStore';
import { toast } from 'react-toastify';

export default function PaymentFailPage() {
  const router = useRouter();
  const { fetchPatientPayments } = usePaymentsStore();

  useEffect(() => {
    // Обновляем список платежей
    fetchPatientPayments();
    
    // Показываем уведомление о неудачной оплате
    toast.error('Платеж не был выполнен');
    
    // Перенаправляем на страницу платежей через 3 секунды
    const redirectTimer = setTimeout(() => {
      router.push('/patient/payments');
    }, 3000);
    
    return () => clearTimeout(redirectTimer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Оплата не выполнена</h1>
        <p className="text-gray-600 mb-6">
          К сожалению, ваш платеж не был выполнен. Пожалуйста, попробуйте еще раз или выберите другой способ оплаты.
        </p>
        
        <p className="text-sm text-gray-500 mb-4">
          Вы будете автоматически перенаправлены на страницу платежей через несколько секунд.
        </p>
        
        <button
          onClick={() => router.push('/patient/payments')}
          className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Вернуться к платежам
        </button>
      </div>
    </div>
  );
}
