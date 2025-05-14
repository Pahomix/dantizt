'use client';

import { useState, useEffect } from 'react';
import { usePaymentsStore } from '@/store/paymentsStore';
import { useAuthStore } from '@/store/auth.store';
import { usePatientStore } from '@/store/patientStore';
import { formatDate, formatMoney } from '@/utils/formatters';
import { usePathname } from 'next/navigation';
import axios from 'axios';
import { toast } from 'react-toastify';

const api = axios.create({
  baseURL: '/api/v1',
});

// Компонент информации о платеже для оплаты через Тинькофф
const PaymentInfo = ({ payment, onClose, onProceedToPayment }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  // Формируем заголовок на основе услуг
  const getPaymentTitle = () => {
    if (payment.appointment?.services && payment.appointment.services.length > 0) {
      if (payment.appointment.services.length === 1) {
        // Если одна услуга, показываем её название
        return `Оплата: ${payment.appointment.services[0].name}`;
      } else {
        // Если несколько услуг, показываем "Комплекс услуг" или первую услугу со счетчиком
        return `Оплата: Комплекс услуг (${payment.appointment.services.length})`;
      }
    }
    // Если нет услуг, проверяем наличие service
    return `Оплата: ${payment.appointment?.service?.name || 'Стоматологические услуги'}`;
  };

  const handleProceedToPayment = async () => {
    setError('');
    setIsProcessing(true);

    try {
      await onProceedToPayment();
    } catch (error) {
      setError(error.message || 'Произошла ошибка при инициализации платежа');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
      <div className="relative bg-white rounded-lg shadow-xl p-8 max-w-md w-full m-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-500"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-xl font-semibold mb-6">{getPaymentTitle()}</h2>
        <div className="mb-6">
          <p className="text-sm text-gray-600">Сумма к оплате:</p>
          <p className="text-lg font-semibold">{formatMoney(payment.amount)} ₽</p>
          
          {/* Детализация услуг */}
          {payment.appointment?.services && payment.appointment.services.length > 0 && (
            <div className="mt-3 border-t pt-2">
              <p className="text-sm font-medium text-gray-700 mb-1">Состав услуг:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                {payment.appointment.services.map(service => (
                  <li key={service.id} className="flex justify-between">
                    <span>{service.name}</span>
                    <span className="font-medium">{formatMoney(service.cost)} ₽</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 pt-2 border-t flex justify-between text-sm font-medium">
                <span>Итого:</span>
                <span>{formatMoney(payment.amount)} ₽</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="mr-3 inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleProceedToPayment}
            disabled={isProcessing}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isProcessing ? 'Подготовка...' : 'Перейти к оплате'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default function PaymentsPage() {
  const [pendingPayments, setPendingPayments] = useState([]);
  const [completedPayments, setCompletedPayments] = useState([]);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [redirectUrl, setRedirectUrl] = useState(null);
  const { user } = useAuthStore();
  const { patientProfile, fetchPatientProfile } = usePatientStore();
  const { 
    payments, 
    fetchPatientPayments, 
    generateTaxDeductionCertificate,
    initTinkoffPayment,
    checkTinkoffPaymentStatus
  } = usePaymentsStore();
  const pathname = usePathname();

  useEffect(() => {
    fetchPatientProfile();
  }, [pathname]);

  useEffect(() => {
    if (patientProfile?.id) {
      fetchPatientPayments();
    }
  }, [patientProfile?.id]);

  useEffect(() => {
    if (payments) {
      setPendingPayments(payments.filter(p => p.status === 'pending'));
      setCompletedPayments(payments.filter(p => p.status === 'completed'));
      
      // Проверяем статус платежей, которые были инициализированы через Тинькофф
      const tinkoffPayments = payments.filter(p => 
        p.status === 'pending' && p.external_payment_id && p.payment_url
      );
      
      // Проверяем статус каждого платежа
      tinkoffPayments.forEach(payment => {
        handleCheckPaymentStatus(payment);
      });
    }
  }, [payments]);

  // Обработчик для инициализации платежа через API Тинькофф
  const handleInitTinkoffPayment = async () => {
    try {
      // Инициализируем платеж через API Тинькофф
      const response = await initTinkoffPayment(selectedPayment.id);
      
      if (response.Success && response.PaymentURL) {
        // Сохраняем URL для оплаты
        setRedirectUrl(response.PaymentURL);
        
        // Закрываем модальное окно
        setSelectedPayment(null);
        
        // Показываем уведомление
        toast.info('Перенаправление на страницу оплаты...');
        
        // Перенаправляем пользователя на страницу оплаты в том же окне
        console.log('Перенаправление на URL оплаты:', response.PaymentURL);
        window.location.href = response.PaymentURL;
      } else {
        throw new Error(response.Message || 'Ошибка при инициализации платежа');
      }
    } catch (error) {
      console.error('Error initializing Tinkoff payment:', error);
      toast.error(error.message || 'Произошла ошибка при инициализации платежа');
    }
  };
  
  // Обработчик для проверки статуса платежа
  const handleCheckPaymentStatus = async (payment) => {
    try {
      if (payment.external_payment_id) {
        const response = await checkTinkoffPaymentStatus(payment.id, payment.external_payment_id);
        
        if (response.Success) {
          // Обновляем список платежей
          fetchPatientPayments();
          
          // Показываем уведомление о статусе платежа
          if (response.Status === 'CONFIRMED') {
            toast.success('Платеж успешно выполнен!');
          } else if (response.Status === 'REJECTED' || response.Status === 'CANCELED') {
            toast.error('Платеж отклонен или отменен');
          }
        }
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      toast.error('Не удалось проверить статус платежа');
    }
  };
  
  // Обработчик успешной оплаты
  const handlePaymentSuccess = async () => {
    setSelectedPayment(null);
    await fetchPatientPayments();
  };



  const PaymentCard = ({ payment, showPayButton = false }) => {
    // Формируем заголовок на основе услуг
    const getPaymentTitle = () => {
      if (payment.appointment?.services && payment.appointment.services.length > 0) {
        if (payment.appointment.services.length === 1) {
          // Если одна услуга, показываем её название
          return payment.appointment.services[0].name;
        } else {
          // Если несколько услуг, показываем "Комплекс услуг" или первую услугу со счетчиком
          return `Комплекс услуг (${payment.appointment.services.length})`;
        }
      }
      // Если нет услуг, проверяем наличие service
      return payment.appointment?.service?.name || 'Стоматологические услуги';
    };

    return (
      <div className="bg-white rounded-lg shadow p-6 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {getPaymentTitle()}
            </h3>
            <p className="text-sm text-gray-500">
              {formatDate(payment.created_at)}
            </p>
            <div className="mt-2">
              <p className="text-sm text-gray-600">
                Прием: {payment.appointment?.start_time ? formatDate(payment.appointment.start_time) : 'Не указано'}
              </p>
              <p className="text-sm text-gray-600">
                Врач: {payment.appointment?.doctor?.user?.full_name || 'Не указано'}
              </p>
            </div>
            
            {/* Детализация услуг */}
            {payment.appointment?.services && payment.appointment.services.length > 0 && (
              <div className="mt-3 border-t pt-2">
                <p className="text-sm font-medium text-gray-700 mb-1">Состав услуг:</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  {payment.appointment.services.map(service => (
                    <li key={service.id} className="flex justify-between">
                      <span>{service.name}</span>
                      <span className="font-medium">{formatMoney(service.cost)} ₽</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 pt-2 border-t flex justify-between text-sm font-medium">
                  <span>Итого:</span>
                  <span>{formatMoney(payment.amount)} ₽</span>
                </div>
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-gray-900">
              {formatMoney(payment.amount)} ₽
            </p>
            <p className={`text-sm ${payment.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>
              {payment.status === 'completed' ? 'Оплачено' : 'Ожидает оплаты'}
            </p>
            {showPayButton && payment.status === 'pending' && (
              <button
                onClick={() => setSelectedPayment(payment)}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Оплатить
              </button>
            )}

          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">
        Платежи
      </h1>

      {pendingPayments.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Ожидают оплаты
          </h2>
          <div className="space-y-4">
            {pendingPayments.map(payment => (
              <PaymentCard
                key={payment.id}
                payment={payment}
                showPayButton={true}
              />
            ))}
          </div>
        </div>
      )}

      {completedPayments.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            История платежей
          </h2>
          <div className="space-y-4">
            {completedPayments.map(payment => (
              <PaymentCard
                key={payment.id}
                payment={payment}
              />
            ))}
          </div>
        </div>
      )}

      {selectedPayment && (
        <PaymentInfo
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
          onProceedToPayment={handleInitTinkoffPayment}
        />
      )}
    </div>
  );
}
