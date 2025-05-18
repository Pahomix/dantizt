'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePaymentsStore } from '@/store/paymentsStore';
import { toast } from 'react-toastify';
import { Spinner } from '@/components/ui/spinner';
import PaymentStatusChecker from '@/components/payment/PaymentStatusChecker';

// Компонент с основным содержимым страницы
function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { checkTinkoffPaymentStatus } = usePaymentsStore();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('pending');
  
  // Получаем orderId из URL параметров
  const orderId = searchParams.get('orderId');
  const paymentId = searchParams.get('paymentId');
  
  // Извлекаем payment_id из orderId, если он в формате order_{payment_id}_xxxxx или order_{payment_id}
  let extractedPaymentId = null;
  if (orderId && orderId.startsWith('order_')) {
    const parts = orderId.substring(6).split('_');
    extractedPaymentId = parts[0];
  }
  
  // Используем доступный ID платежа
  const finalPaymentId = paymentId || extractedPaymentId;
  
  // Обработчик изменения статуса платежа
  const handleStatusChange = (response) => {
    console.log('Статус платежа изменился:', response);
    
    // Получаем данные из ответа API
    const paymentData = response.data || response;
    
    // Получаем статус платежа
    const paymentStatus = paymentData.Status || paymentData.status;
    const orderStatus = paymentData.order_status;
    
    // Проверяем статус платежа
    if (paymentStatus === 'CONFIRMED' || orderStatus === 'PAID' || paymentData.success === true) {
      setPaymentStatus('success');
    } else if (['REJECTED', 'CANCELED', 'DEADLINE_EXPIRED'].includes(paymentStatus)) {
      setPaymentStatus('error');
      setError('Платеж был отклонен или отменен');
    }
  };
  
  useEffect(() => {
    // Если нет orderId, но есть paymentId и tinkoffPaymentId, обновляем статус платежа через API
    const tinkoffPaymentId = searchParams.get('tinkoffPaymentId');
    if (!orderId && finalPaymentId && tinkoffPaymentId) {
      const updatePaymentStatus = async () => {
        try {
          setIsUpdating(true);
          await checkTinkoffPaymentStatus(finalPaymentId, tinkoffPaymentId);
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
    }
  }, [finalPaymentId, searchParams, checkTinkoffPaymentStatus]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          {/* Если есть orderId, используем PaymentStatusChecker для проверки статуса */}
          {orderId ? (
            <PaymentStatusChecker 
              orderId={orderId}
              successUrl="/patient/payments"
              failUrl="/payment/fail"
              interval={2000}
              maxRetries={15}
              onStatusChange={handleStatusChange}
            />
          ) : (
            <>
              {/* Иконка статуса */}
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 mb-4">
                {paymentStatus === 'success' ? (
                  <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                ) : paymentStatus === 'error' ? (
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                )}
              </div>
              
              {/* Заголовок */}
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {paymentStatus === 'success' ? 'Оплата успешно завершена!' : 
                 paymentStatus === 'error' ? 'Ошибка при обработке платежа' : 
                 'Проверка статуса платежа...'}
              </h2>
              
              {/* Сообщение */}
              <p className="text-gray-600 mb-6">
                {paymentStatus === 'success' ? 
                  'Ваш платеж был успешно обработан. Вы будете перенаправлены на страницу платежей через несколько секунд.' : 
                 paymentStatus === 'error' ? 
                  error || 'Произошла ошибка при обработке платежа. Пожалуйста, попробуйте еще раз.' : 
                  'Пожалуйста, подождите, пока мы проверяем статус вашего платежа...'}
              </p>
              
              {/* Индикатор загрузки при обновлении статуса */}
              {isUpdating && (
                <div className="flex justify-center mb-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                  <span className="ml-2 text-indigo-600">Обновляем статус платежа...</span>
                </div>
              )}
              
              {/* Кнопка возврата на страницу платежей */}
              <button
                onClick={() => router.push('/patient/payments')}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Перейти к платежам
              </button>
            </>
          )}
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
