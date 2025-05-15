'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePaymentsStore } from '@/store/paymentsStore';
import { toast } from 'react-toastify';

// Компонент с основным содержимым страницы
function PaymentStatusContent() {
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
          setStatus('success');
          toast.success('Платеж успешно обработан');
          
          // Редирект на страницу успешного платежа через 2 секунды
          setTimeout(() => {
            router.push('/payment/success');
          }, 2000);
        } else {
          setStatus('error');
          toast.error(response.Message || 'Ошибка при обработке платежа');
          
          // Редирект на страницу ошибки платежа через 2 секунды
          setTimeout(() => {
            router.push('/payment/fail');
          }, 2000);
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
        setStatus('error');
        toast.error('Произошла ошибка при проверке статуса платежа');
        
        // Редирект на страницу ошибки платежа через 2 секунды
        setTimeout(() => {
          router.push('/payment/fail');
        }, 2000);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkStatus();
  }, [router, searchParams, checkTinkoffPaymentStatus]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          {/* Иконка статуса */}
          <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${
            isLoading ? 'bg-blue-100' :
            status === 'success' ? 'bg-green-100' :
            'bg-red-100'
          }`}>
            {isLoading ? (
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
            isLoading ? 'text-blue-900' :
            status === 'success' ? 'text-green-900' :
            'text-red-900'
          }`}>
            {isLoading ? 'Проверка статуса платежа' :
             status === 'success' ? 'Платеж успешно обработан' :
             'Ошибка обработки платежа'}
          </h2>

          {/* Сообщение */}
          <p className="text-gray-600 mb-6">
            {isLoading ? 'Пожалуйста, подождите. Мы проверяем статус вашего платежа...' :
             status === 'success' ? 'Ваш платеж был успешно обработан. Вы будете перенаправлены на страницу подтверждения.' :
             'Произошла ошибка при обработке платежа. Вы будете перенаправлены на страницу с деталями ошибки.'}
          </p>

          {/* Прогресс-бар */}
          <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
            <div 
              className={`h-2.5 rounded-full transition-all duration-500 ${
                isLoading ? 'bg-blue-600 animate-pulse' :
                status === 'success' ? 'bg-green-600' :
                'bg-red-600'
              }`}
              style={{ width: isLoading ? '60%' : '100%' }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Основной компонент страницы с обёрткой Suspense
export default function PaymentStatusPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <PaymentStatusContent />
    </Suspense>
  );
}
