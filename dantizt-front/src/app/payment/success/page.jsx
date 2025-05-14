'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePaymentsStore } from '@/store/paymentsStore';
import { toast } from 'react-toastify';
import { Spinner } from '@/components/ui/spinner';

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { checkTinkoffPaymentStatus } = usePaymentsStore();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('pending');

  useEffect(() => {
    // Устанавливаем таймер для перенаправления на страницу платежей через 5 секунд
    const redirectTimer = setTimeout(() => {
      router.push('/patient/payments');
    }, 5000);
    
    const updatePaymentStatus = async () => {
      try {
        setIsUpdating(true);
        
        // Получаем ID платежа из URL параметров (различные варианты)
        const paymentId = searchParams.get('paymentId');
        const orderId = searchParams.get('orderId');
        
        // Извлекаем payment_id из orderId, если он в формате order_{payment_id}_xxxxx или order_{payment_id}
        let extractedPaymentId = null;
        if (orderId && orderId.startsWith('order_')) {
          const match1 = orderId.match(/^order_([0-9]+)_/);
          const match2 = orderId.match(/^order_([0-9]+)$/);
          
          if (match1 && match1[1]) {
            extractedPaymentId = match1[1];
          } else if (match2 && match2[1]) {
            extractedPaymentId = match2[1];
          }
        }
        
        // Тинькофф может передавать PaymentId в разных форматах
        const tinkoffPaymentId = 
          searchParams.get('PaymentId') || 
          searchParams.get('payment') || 
          searchParams.get('paymentId') || 
          searchParams.get('payment_id');
        
        // Проверяем все возможные варианты ID платежа в порядке приоритета
        const effectivePaymentId = 
          paymentId || 
          extractedPaymentId || // Используем извлеченный ID из orderId
          searchParams.get('payment_id');
        
        // Проверяем наличие необходимых параметров
        if (!effectivePaymentId && !tinkoffPaymentId) {
          setError('Не найдены необходимые параметры для проверки статуса платежа');
          return;
        }
        
        // Проверяем статус платежа через Tinkoff API
        if (tinkoffPaymentId) {
          try {
            const result = await checkTinkoffPaymentStatus(effectivePaymentId, tinkoffPaymentId);
            
            if (result && result.status) {
              setPaymentStatus(result.status);
              
              // Показываем уведомление в зависимости от статуса
              if (result.status === 'CONFIRMED' || result.status === 'AUTHORIZED') {
                toast.success('Платеж успешно подтвержден!');
              } else if (result.status === 'REJECTED') {
                toast.error('Платеж отклонен');
              } else if (result.status === 'REFUNDED') {
                toast.info('Платеж возвращен');
              }
            }
          } catch (checkError) {
            setError(`Ошибка при проверке статуса платежа: ${checkError.message || 'Неизвестная ошибка'}`);
          }
        } else {
          // Если ID платежа не найден, показываем общее сообщение об успехе
          toast.success('Платеж успешно выполнен!');
        }
      } catch (error) {
        setError(error.toString());
        toast.error('Произошла ошибка при обновлении статуса платежа');
      } finally {
        setIsUpdating(false);
      }
    };
    
    // Запускаем проверку статуса платежа
    updatePaymentStatus();
    
    // Очистка таймера при размонтировании компонента
    return () => {
      clearTimeout(redirectTimer);
    };
  }, [router, searchParams, checkTinkoffPaymentStatus]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          {isUpdating ? (
            <Spinner className="w-10 h-10 text-green-500" />
          ) : (
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          )}
        </div>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {isUpdating ? 'Обработка платежа...' : 'Оплата успешно выполнена!'}
        </h1>
        <p className="text-gray-600 mb-6">
          {isUpdating 
            ? 'Пожалуйста, подождите, мы обрабатываем ваш платеж...'
            : 'Спасибо за оплату. Ваш платеж был успешно обработан.'}
        </p>
        
        <p className="text-sm text-gray-500 mb-4">
          Вы будете автоматически перенаправлены на страницу платежей через 5 секунд.
        </p>
        
        <button
          onClick={() => router.push('/patient/payments')}
          className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Вернуться к платежам
        </button>
        
        {/* Показываем ошибку только в режиме разработки */}
        {process.env.NODE_ENV === 'development' && error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 text-left text-xs rounded">
            <pre className="overflow-auto">{error}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
