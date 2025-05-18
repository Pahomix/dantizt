'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { paymentsApi } from '@/services/api/payments';

/**
 * Компонент для периодической проверки статуса платежа
 * 
 * @param {Object} props - Свойства компонента
 * @param {string} props.orderId - ID заказа для проверки
 * @param {string} props.successUrl - URL для перенаправления при успешном платеже
 * @param {string} props.failUrl - URL для перенаправления при неудачном платеже
 * @param {number} props.interval - Интервал проверки в миллисекундах (по умолчанию 2000)
 * @param {number} props.maxRetries - Максимальное количество попыток (по умолчанию 10)
 * @param {Function} props.onStatusChange - Callback при изменении статуса
 */
const PaymentStatusChecker = ({ 
  orderId, 
  successUrl = '/payment/success', 
  failUrl = '/payment/fail',
  interval = 2000,
  maxRetries = 10,
  onStatusChange = null
}) => {
  const router = useRouter();
  const [status, setStatus] = useState('PENDING');
  const [retries, setRetries] = useState(0);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const intervalIdRef = useRef(null);
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!orderId) {
      setError('ID заказа не указан');
      setIsProcessing(false);
      return;
    }

    const checkPaymentStatus = async () => {
      // Если уже перенаправлены или превышено количество попыток, не делаем запрос
      if (redirectedRef.current || retries >= maxRetries) {
        clearInterval(intervalIdRef.current);
        setIsProcessing(false);
        return;
      }

      try {
        const response = await paymentsApi.checkStatusByOrderId(orderId);
        console.log('Статус платежа:', response);
        
        // Получаем данные из ответа API
        const paymentData = response.data || response;
        
        // Обновляем состояние
        if (paymentData) {
          // Проверяем статус HTTP запроса
          if (response.status === 200) {
            // Успешный HTTP запрос
            console.log('Успешный ответ от API, данные:', paymentData);
            
            // Проверяем статус платежа в данных
            const paymentStatus = paymentData.Status || paymentData.status;
            const orderStatus = paymentData.order_status;
            
            // Устанавливаем статус в компоненте
            if (paymentStatus) {
              setStatus(paymentStatus);
            }
            
            // Вызываем callback, если он предоставлен
            if (onStatusChange) {
              onStatusChange(paymentData);
            }
            
            // Проверяем статус платежа и перенаправляем пользователя
            if (paymentStatus === 'CONFIRMED' || orderStatus === 'PAID' || paymentData.success === true) {
              // Платеж успешно завершен
              console.log('Платеж успешно завершен, перенаправляем на:', successUrl);
              redirectedRef.current = true;
              clearInterval(intervalIdRef.current);
              setIsProcessing(false);
              router.push(successUrl);
              return; // Прерываем выполнение функции
            } else if (['REJECTED', 'CANCELED', 'DEADLINE_EXPIRED'].includes(paymentStatus)) {
              // Платеж отклонен или отменен
              console.log('Платеж отклонен или отменен, перенаправляем на:', failUrl);
              redirectedRef.current = true;
              clearInterval(intervalIdRef.current);
              setIsProcessing(false);
              router.push(failUrl);
              return; // Прерываем выполнение функции
            }
          } else if (response.status >= 400) {
            // Ошибка HTTP
            throw new Error(`HTTP error: ${response.status}`);
          }
          
          // Платеж все еще в процессе, увеличиваем счетчик попыток
          setRetries(prev => prev + 1);
          
          // Если достигнуто максимальное количество попыток, останавливаем проверку
          if (retries >= maxRetries - 1) {
            console.log('Превышено максимальное количество попыток');
            clearInterval(intervalIdRef.current);
            setIsProcessing(false);
            setError('Превышено максимальное количество попыток проверки');
          }
        }
      } catch (error) {
        console.error('Ошибка при проверке статуса платежа:', error);
        setError(error.message || 'Ошибка при проверке статуса платежа');
        setRetries(prev => prev + 1);
        
        if (retries >= maxRetries - 1) {
          clearInterval(intervalIdRef.current);
          setIsProcessing(false);
        }
      }
    };

    // Запускаем первую проверку сразу
    checkPaymentStatus();
    
    // Настраиваем интервал для периодической проверки
    intervalIdRef.current = setInterval(checkPaymentStatus, interval);

    // Очистка интервала при размонтировании компонента
    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [orderId]); // Зависимость только от orderId, чтобы эффект запускался один раз

  return (
    <div className="text-center px-4 py-6 bg-white rounded-lg shadow-md">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Проверка статуса платежа
        </h1>
        <div className="h-1 w-20 bg-indigo-500 mx-auto rounded"></div>
      </div>
      
      {isProcessing ? (
        <div className="py-4">
          <div className="mb-8">
            <div className="animate-spin mx-auto rounded-full h-16 w-16 border-4 border-indigo-100 border-t-4 border-t-indigo-600"></div>
          </div>
          
          <div className="bg-indigo-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-indigo-700">
              Проверяем статус платежа...
            </p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min(100, (retries / maxRetries) * 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1 text-right">
              Попытка {retries + 1} из {maxRetries}
            </p>
          </div>
          
          <p className="text-sm text-gray-500">
            Пожалуйста, не закрывайте эту страницу
          </p>
        </div>
      ) : error ? (
        <div className="py-4">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
            <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
          
          <div className="bg-red-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-700">
              Произошла ошибка: {error}
            </p>
          </div>
          
          <button
            onClick={() => router.push(failUrl)}
            className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
          >
            <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
            </svg>
            Вернуться на главную
          </button>
        </div>
      ) : (
        <div className="py-4">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4 mb-6">
            <p className="text-sm font-medium text-green-700">
              Статус платежа: {status}
            </p>
          </div>
          
          <button
            onClick={() => router.push(successUrl)}
            className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
          >
            Продолжить
          </button>
        </div>
      )}
    </div>
  );
};

export default PaymentStatusChecker;
