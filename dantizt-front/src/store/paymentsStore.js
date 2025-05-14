import { create } from 'zustand';
import api from '@/lib/axios';

export const usePaymentsStore = create((set, get) => ({
  payments: null,
  loading: false,
  error: null,

  fetchPayments: async (params = {}) => {
    try {
      set({ loading: true, error: null });
      const { status, search, page = 1, limit = 10 } = params;
      const queryParams = new URLSearchParams();
      
      if (status) queryParams.append('status', status);
      if (search) queryParams.append('search', search);
      queryParams.append('page', page);
      queryParams.append('limit', limit);
      
      const url = `/payments?${queryParams.toString()}`;
      const response = await api.get(url);
      set({ payments: response.data.items || response.data, loading: false });
      return response.data;
    } catch (error) {
      console.error('Error fetching payments:', error);
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке платежей',
        loading: false 
      });
      throw error;
    }
  },

  fetchPatientPayments: async () => {
    try {
      set({ loading: true, error: null });
      const response = await api.get('/payments/patient');
      set({ payments: response.data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  createPayment: async (paymentData) => {
    try {
      set({ loading: true, error: null });
      const response = await api.post('/payments', paymentData);
      set((state) => ({
        payments: [...(state.payments || []), response.data],
        loading: false
      }));
      return response.data;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updatePayment: async (paymentId, paymentData, usePaymentIdParam = false) => {
    try {
      set({ loading: true, error: null });
      console.log(`Обновление платежа: ID=${paymentId}, статус=${paymentData.status}, usePaymentIdParam=${usePaymentIdParam}`);
      
      // Формируем данные для запроса в соответствии с обновленной схемой PaymentProcessSchema
      const requestData = usePaymentIdParam 
        ? {
            payment_id: paymentId, // Используем payment_id как альтернативный формат
            status: paymentData.status,
            payment_method: paymentData.payment_method
          }
        : {
            paymentId: paymentId, // Используем paymentId как основной формат
            status: paymentData.status,
            payment_method: paymentData.payment_method
          };
      
      console.log('Данные запроса на обновление платежа:', requestData);
      
      // Если метод оплаты - карта, добавляем данные карты
      if (paymentData.payment_method === 'card' && paymentData.cardData) {
        requestData.cardNumber = paymentData.cardData.cardNumber || '';
        requestData.expiryDate = paymentData.cardData.expiryDate || '';
        requestData.cvv = paymentData.cardData.cvv || '';
      }
      
      // Используем правильный эндпоинт для обработки платежа
      const response = await api.post(`/payments/process`, requestData);
      console.log('Ответ API обновления платежа:', response.data);
      
      // Обновляем локальное состояние
      set((state) => ({
        payments: state.payments?.map(payment =>
          payment.id === parseInt(paymentId) ? {
            ...payment,
            ...response.data,
            status: response.data.status || paymentData.status
          } : payment
        ),
        loading: false
      }));
      
      return response.data;
    } catch (error) {
      console.error('Ошибка при обновлении платежа:', error);
      set({ error: error.response?.data?.detail || 'Ошибка при обновлении платежа', loading: false });
      throw error;
    }
  },

  processPayment: async (paymentId, status) => {
    try {
      set({ loading: true, error: null });
      const response = await api.post(`/payments/process`, {
        payment_id: paymentId,
        status: status
      });
      set((state) => ({
        payments: state.payments?.map(payment =>
          payment.id === paymentId ? response.data : payment
        ),
        loading: false
      }));
      return response.data;
    } catch (error) {
      set({ 
        error: error.response?.data?.detail || 'Ошибка при обработке платежа',
        loading: false 
      });
      throw error;
    }
  },

  // Инициализация платежа через API Тинькофф
  initTinkoffPayment: async (paymentId) => {
    try {
      set({ loading: true, error: null });
      
      // Сначала получаем информацию о платеже, чтобы узнать сумму и описание
      let paymentInfo = null;
      const state = get();
      
      // Ищем платеж в текущем состоянии
      if (state.payments) {
        paymentInfo = state.payments.find(p => p.id === paymentId);
      }
      
      // Если платеж не найден, запрашиваем его с сервера
      if (!paymentInfo) {
        const paymentResponse = await api.get(`/payments/${paymentId}`);
        paymentInfo = paymentResponse.data;
      }
      
      // Формируем описание платежа
      let description = 'Оплата стоматологических услуг';
      if (paymentInfo.appointment?.services && paymentInfo.appointment.services.length > 0) {
        if (paymentInfo.appointment.services.length === 1) {
          description = `Оплата услуги: ${paymentInfo.appointment.services[0].name}`;
        } else {
          description = `Оплата комплекса услуг (${paymentInfo.appointment.services.length})`;
        }
      }
      
      // Формируем URL для возврата после успешной оплаты
      const origin = window.location.origin;
      // Возвращаемся к параметрам запроса, так как Tinkoff может не поддерживать хеш-фрагменты
      const timestamp = new Date().getTime();
      const successUrl = `${origin}/payment/success?paymentId=${paymentId}&timestamp=${timestamp}&source=tinkoff`;
      
      const response = await api.post(`/payments/tinkoff/init`, {
        payment_id: paymentId,
        amount: paymentInfo.amount, // Добавляем сумму платежа
        description: description, // Добавляем описание платежа
        customer_email: '', // Будет получено из данных пациента на бэкенде
        customer_phone: '', // Будет получено из данных пациента на бэкенде
        receipt_items: [], // Будет сформировано на бэкенде на основе услуг
        return_url: successUrl // URL для возврата после успешной оплаты
      });
      
      // Если успешно инициализирован платеж, возвращаем URL для оплаты
      if (response.data.Success && response.data.PaymentURL) {
        set({ loading: false });
        return response.data;
      } else {
        throw new Error(response.data.Message || 'Ошибка при инициализации платежа');
      }
    } catch (error) {
      console.error('Error initializing Tinkoff payment:', error);
      set({ 
        error: error.response?.data?.detail || error.message || 'Ошибка при инициализации платежа',
        loading: false 
      });
      throw error;
    }
  },

  // Проверка статуса платежа через API Тинькофф
  checkTinkoffPaymentStatus: async (paymentId, tinkoffPaymentId) => {
    try {
      console.log('%c === НАЧАЛО ПРОВЕРКИ СТАТУСА ПЛАТЕЖА TINKOFF ===', 'background: #4CAF50; color: white; padding: 4px; border-radius: 4px;');
      console.log('Исходные параметры:', { paymentId, tinkoffPaymentId, timestamp: new Date().toISOString() });
      
      set({ loading: true, error: null });
      
      // Проверяем, не является ли paymentId в формате order_{id}_xxx или другом формате
      let effectivePaymentId = paymentId;
      if (paymentId && typeof paymentId === 'string') {
        console.log('Анализ формата paymentId:', paymentId);
        
        // Проверяем формат order_{id}_xxx
        if (paymentId.startsWith('order_')) {
          console.log('Обнаружен формат order_XXX, пытаемся извлечь ID платежа');
          
          // Пробуем разные форматы извлечения ID
          const match1 = paymentId.match(/^order_([0-9]+)_/);
          const match2 = paymentId.match(/^order_([0-9]+)$/);
          
          console.log('Результаты регулярных выражений:', {
            'match1': match1 ? `Найдено: ${match1[0]}, Группа 1: ${match1[1]}` : 'Не найдено',
            'match2': match2 ? `Найдено: ${match2[0]}, Группа 1: ${match2[1]}` : 'Не найдено'
          });
          
          if (match1 && match1[1]) {
            effectivePaymentId = match1[1];
            console.log('%c Извлечен ID платежа из orderId (формат 1):', 'font-weight: bold; color: #2196F3;', effectivePaymentId);
          } else if (match2 && match2[1]) {
            effectivePaymentId = match2[1];
            console.log('%c Извлечен ID платежа из orderId (формат 2):', 'font-weight: bold; color: #2196F3;', effectivePaymentId);
          } else {
            console.warn('Не удалось извлечь ID платежа из orderId:', paymentId);
          }
        }
        // Проверяем, если это просто строка с числом
        else if (!isNaN(paymentId)) {
          effectivePaymentId = paymentId;
          console.log('%c PaymentId является строкой с числом:', 'font-weight: bold; color: #2196F3;', effectivePaymentId);
        } else {
          console.warn('PaymentId имеет неизвестный формат:', paymentId);
        }
      } else {
        console.log('PaymentId не является строкой или пустой:', paymentId);
      }
      
      console.log('%c Отправка запроса на проверку статуса платежа Tinkoff:', 'background: #FF9800; color: white; padding: 4px; border-radius: 4px;', {
        paymentId: effectivePaymentId,
        tinkoffPaymentId,
        url: '/payments/tinkoff/status'
      });
      
      console.time('Запрос статуса платежа');
      
      // Используем правильные имена параметров для бэкенда
      const response = await api.post(`/payments/tinkoff/status`, {
        payment_id: effectivePaymentId,
        tinkoff_payment_id: tinkoffPaymentId
      });
      
      console.timeEnd('Запрос статуса платежа');
      console.log('%c Ответ API статуса платежа Tinkoff:', 'background: #4CAF50; color: white; padding: 4px; border-radius: 4px;', response.data);
      
      // Маппинг статусов Tinkoff на статусы системы
      const statusMapping = {
        'NEW': 'pending',
        'AUTHORIZED': 'pending',
        'CONFIRMED': 'completed',
        'REJECTED': 'failed',
        'REFUNDED': 'refunded',
        'PARTIAL_REFUNDED': 'refunded',
        'REVERSED': 'failed',
        'CANCELED': 'failed'
      };
      
      // Обновляем статус платежа в сторе, если получили успешный ответ
      if (response.data.Success) {
        const tinkoffStatus = response.data.Status;
        const localStatus = statusMapping[tinkoffStatus] || 'pending';
        
        console.log(`Статус Tinkoff: ${tinkoffStatus}, локальный статус: ${localStatus}`);
        
        // Если статус в Tinkoff подтвержден, также обновляем его через API
        if (tinkoffStatus === 'CONFIRMED') {
          console.log('Платеж подтвержден Tinkoff, обновляем статус в нашей системе');
          let updateSuccess = false;
          
          // Проверяем, что effectivePaymentId не пустой и является числом или строкой с числом
          if (effectivePaymentId && (!isNaN(effectivePaymentId) || (typeof effectivePaymentId === 'string' && !isNaN(parseInt(effectivePaymentId))))) {
            // Первая попытка обновления с paymentId
            try {
              console.log(`Попытка обновления с параметром paymentId=${effectivePaymentId}`);
              const updateResponse = await api.post(`/payments/process`, {
                paymentId: effectivePaymentId,
                status: 'completed',
                payment_method: 'card'
              });
              console.log('Ответ обновления статуса платежа:', updateResponse.data);
              updateSuccess = true;
            } catch (updateError) {
              console.error('Ошибка при обновлении статуса платежа через paymentId:', updateError);
              
              // Вторая попытка обновления с payment_id
              try {
                console.log(`Попытка обновления с параметром payment_id=${effectivePaymentId}`);
                const altUpdateResponse = await api.post(`/payments/process`, {
                  payment_id: effectivePaymentId,
                  status: 'completed',
                  payment_method: 'card'
                });
                console.log('Ответ альтернативного обновления:', altUpdateResponse.data);
                updateSuccess = true;
              } catch (altError) {
                console.error('Альтернативный метод обновления тоже не сработал:', altError);
              }
            }
          } else {
            console.error(`Невозможно обновить статус платежа: некорректный ID платежа ${effectivePaymentId}`);
          }
          
          if (!updateSuccess) {
            console.log('Обе попытки обновления не удались, но продолжаем выполнение');
          }
        } else if (tinkoffStatus === 'AUTHORIZED' || tinkoffStatus === 'NEW') {
          console.log(`Платеж в процессе обработки (статус: ${tinkoffStatus}), ожидаем подтверждения`);
        }
        
        // Обновляем локальное состояние
        set((state) => ({
          payments: state.payments?.map(payment =>
            payment.id === parseInt(paymentId) ? {
              ...payment,
              status: localStatus
            } : payment
          ),
          loading: false
        }));
      } else {
        console.log('Получен неуспешный ответ от API статуса Tinkoff:', response.data);
        set({ loading: false });
      }
      
      return response.data;
    } catch (error) {
      console.error('Ошибка при проверке статуса платежа Tinkoff:', error);
      set({ 
        error: error.response?.data?.detail || error.message || 'Ошибка при проверке статуса платежа',
        loading: false 
      });
      throw error;
    }
  },

  generateTaxDeductionCertificate: async (patientId, year) => {
    try {
      set({ loading: true, error: null });
      
      // Сначала получаем платежи пациента за указанный год
      const paymentsResponse = await api.get('/payments', {
        params: {
          patient_id: patientId,
          status: 'completed',
          year: year
        }
      });
      
      const payments = paymentsResponse.data.items || [];
      
      if (payments.length === 0) {
        set({ loading: false });
        throw new Error('Нет завершенных платежей за указанный год');
      }
      
      // Создаем справку с использованием нового API
      const paymentIds = payments.map(payment => payment.id);
      const certificateResponse = await api.post('/certificates', {
        patient_id: patientId,
        year: year,
        payment_ids: paymentIds
      });
      
      const certificate = certificateResponse.data;
      
      set({ loading: false });
      return certificate;
    } catch (error) {
      console.error('Error generating tax deduction certificate:', error);
      
      // Если новый API не работает, пробуем использовать старый
      if (error.response?.status === 404) {
        try {
          set({ loading: true });
          
          // Используем URL из старого API только для создания справки, без скачивания
          const url = `/medical-records/patient/${patientId}/tax-deduction?year=${year}&download=false`;
          
          const response = await api.get(url);
          
          set({ loading: false });
          return { success: true, message: 'Справка успешно сгенерирована (legacy)' };
        } catch (legacyError) {
          console.error('Error generating certificate (legacy):', legacyError);
          set({ 
            error: legacyError.response?.data?.detail || 'Ошибка при генерации справки (legacy)',
            loading: false 
          });
          throw legacyError;
        }
      }
      
      set({ 
        error: error.response?.data?.detail || 'Ошибка при генерации справки для налогового вычета',
        loading: false 
      });
      throw error;
    }
  },

  clearPayments: () => {
    set({ payments: null, loading: false, error: null });
  }
}));
