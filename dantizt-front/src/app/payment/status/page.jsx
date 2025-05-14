'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePaymentsStore } from '@/store/paymentsStore';
import { toast } from 'react-toastify';

export default function PaymentStatusPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const { checkTinkoffPaymentStatus } = usePaymentsStore();

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Получаем параметры из URL
        const paymentId = searchParams.get('paymentId');
        const tinkoffPaymentId = searchParams.get('tinkoffPaymentId');
        
        if (!paymentId || !tinkoffPaymentId) {
          setStatus('error');
          toast.error('Недостаточно данных для проверки статуса платежа');
          return;
        }
        
        // Проверяем статус платежа
        const response = await checkTinkoffPaymentStatus(paymentId, tinkoffPaymentId);
        
        if (response.Success) {
          if (response.Status === 'CONFIRMED') {
            setStatus('success');
            toast.success('Платеж успешно выполнен!');
            
            // Перенаправляем на страницу успешной оплаты
            setTimeout(() => {
              router.push('/payment/success');
            }, 1000);
          } else if (response.Status === 'REJECTED' || response.Status === 'CANCELED') {
            setStatus('failed');
            toast.error('Платеж отклонен или отменен');
            
            // Перенаправляем на страницу неудачной оплаты
            setTimeout(() => {
              router.push('/payment/fail');
            }, 1000);
          } else {
            setStatus('pending');
            toast.info('Платеж в обработке. Пожалуйста, подождите...');
            
            // Повторно проверяем статус через 5 секунд
            setTimeout(() => {
              checkStatus();
            }, 5000);
          }
        } else {
          setStatus('error');
          toast.error(response.Message || 'Ошибка при проверке статуса платежа');
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
        setStatus('error');
        toast.error('Произошла ошибка при проверке статуса платежа');
        
        // Перенаправляем на страницу платежей
        setTimeout(() => {
          router.push('/patient/payments');
        }, 3000);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkStatus();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        {isLoading && (
          <>
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Проверка статуса платежа</h1>
            <p className="text-gray-600">
              Пожалуйста, подождите. Мы проверяем статус вашего платежа...
            </p>
          </>
        )}
        
        {!isLoading && status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Ошибка проверки платежа</h1>
            <p className="text-gray-600 mb-6">
              Произошла ошибка при проверке статуса платежа. Пожалуйста, свяжитесь с администратором.
            </p>
            <button
              onClick={() => router.push('/patient/payments')}
              className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Вернуться к платежам
            </button>
          </>
        )}
        
        {!isLoading && status === 'pending' && (
          <>
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Платеж в обработке</h1>
            <p className="text-gray-600 mb-6">
              Ваш платеж обрабатывается. Пожалуйста, подождите...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
