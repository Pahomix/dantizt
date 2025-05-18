'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePaymentsStore } from '@/store/paymentsStore';
import { toast } from 'react-toastify';
import PaymentStatusChecker from '@/components/payment/PaymentStatusChecker';

function PaymentFailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fetchPatientPayments } = usePaymentsStore();
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  
  // Получаем orderId из URL параметров
  const orderId = searchParams.get('orderId');
  const paymentId = searchParams.get('paymentId');
  
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
      // Если платеж оказался успешным, перенаправляем на страницу успеха
      console.log('Платеж успешный, перенаправляем на страницу успеха');
      router.push('/payment/success?orderId=' + orderId);
    }
  };

  useEffect(() => {
    // Обновляем список платежей
    fetchPatientPayments();
    
    // Если нет orderId, показываем уведомление о неудачной оплате
    if (!orderId && !paymentId) {
      toast.error('Платеж не был выполнен');
      
      // Перенаправляем на страницу платежей через 3 секунды
      const redirectTimer = setTimeout(() => {
        router.push('/patient/payments');
      }, 3000);
      
      return () => clearTimeout(redirectTimer);
    } else {
      // Если есть orderId, проверяем статус платежа
      setIsCheckingStatus(true);
    }
  }, [orderId, paymentId, router, fetchPatientPayments]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        {/* Если есть orderId и мы проверяем статус, используем PaymentStatusChecker */}
        {isCheckingStatus && orderId ? (
          <PaymentStatusChecker 
            orderId={orderId}
            successUrl="/payment/success"
            failUrl="/payment/fail"
            interval={2000}
            maxRetries={15}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Оплата не выполнена</h1>
            <p className="text-gray-600 mb-6">
              К сожалению, ваш платеж не был выполнен. Пожалуйста, попробуйте еще раз или выберите другой способ оплаты.
            </p>
            
            <p className="text-sm text-gray-500 mb-4">
              Вы будете автоматически перенаправлены на страницу платежей через несколько секунд.
            </p>
            
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => router.push('/patient/payments')}
                className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Вернуться к платежам
              </button>
              
              <button
                onClick={() => router.push('/patient/appointments/new')}
                className="w-full py-2 px-4 border border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Записаться на прием снова
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">Загрузка...</div>}>
      <PaymentFailContent />
    </Suspense>
  );
}
