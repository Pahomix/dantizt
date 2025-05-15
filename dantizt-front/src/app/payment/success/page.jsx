'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePaymentsStore } from '@/store/paymentsStore';
import { toast } from 'react-toastify';
import { Spinner } from '@/components/ui/spinner';

// Компонент с основным содержимым страницы
function PaymentSuccessContent() {
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
          const parts = orderId.substring(6).split('_');
          extractedPaymentId = parts[0];
        }
        
        // Используем доступный ID платежа
        const finalPaymentId = paymentId || extractedPaymentId;
        
        if (!finalPaymentId) {
          setError('Не удалось определить ID платежа');
          setPaymentStatus('error');
          return;
        }
        
        // Получаем Tinkoff payment ID
        const tinkoffPaymentId = searchParams.get('tinkoffPaymentId');
        
        if (tinkoffPaymentId) {
          // Если есть tinkoffPaymentId, обновляем статус платежа через API
          await checkTinkoffPaymentStatus(finalPaymentId, tinkoffPaymentId);
        }
        
        setPaymentStatus('success');
      } catch (err) {
        console.error('Error updating payment status:', err);
        setError('Произошла ошибка при обновлении статуса платежа');
        setPaymentStatus('error');
      } finally {
        setIsUpdating(false);
      }
    };
    
    updatePaymentStatus();
    
    // Очищаем таймер при размонтировании компонента
    return () => clearTimeout(redirectTimer);
  }, [router, searchParams, checkTinkoffPaymentStatus]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          {/* Иконка статуса */}
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          {/* Заголовок */}
          <h2 className="text-2xl font-bold text-green-900 mb-4">
            Оплата успешно завершена!
          </h2>
          
          {/* Сообщение */}
          <p className="text-gray-600 mb-6">
            Ваш платеж был успешно обработан. Вы будете перенаправлены на страницу платежей через несколько секунд.
          </p>
          
          {/* Индикатор загрузки при обновлении статуса */}
          {isUpdating && (
            <div className="flex justify-center mb-4">
              <Spinner className="h-6 w-6 text-blue-600" />
              <span className="ml-2 text-blue-600">Обновляем статус платежа...</span>
            </div>
          )}
          
          {/* Сообщение об ошибке */}
          {error && (
            <div className="text-red-600 mb-4">
              {error}
            </div>
          )}
          
          {/* Кнопка возврата на страницу платежей */}
          <button
            onClick={() => router.push('/patient/payments')}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Перейти к платежам
          </button>
        </div>
      </div>
    </div>
  );
}

// Основной компонент страницы с обёрткой Suspense
export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
