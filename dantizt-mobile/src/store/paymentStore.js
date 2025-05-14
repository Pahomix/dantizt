import { create } from 'zustand';
import axios from '../utils/axios';
import { Linking, Alert, Platform } from 'react-native';

const usePaymentStore = create((set, get) => ({
  payments: [],
  statistics: {
    pendingCount: 0,
  },
  isLoading: false,
  error: null,

  fetchPayments: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.get('/payments/patient');
      const payments = response.data;
      const pendingCount = payments.filter(p => p.status === 'pending').length;
      
      set({ 
        payments,
        statistics: {
          ...get().statistics,
          pendingCount
        },
        isLoading: false 
      });
    } catch (error) {
      set({ 
        error: error.response?.data?.detail || 'Ошибка при загрузке платежей',
        isLoading: false 
      });
    }
  },

  processPayment: async (paymentData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await axios.post('/payments/process', paymentData);
      // Используем get().fetchPayments() вместо set.getState().fetchPayments()
      await get().fetchPayments();
      return response.data;
    } catch (error) {
      set({ error: error.response?.data?.detail || 'Ошибка при обработке платежа' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Инициализация платежа через API Тинькофф
  initTinkoffPayment: async (paymentId) => {
    try {
      set({ isLoading: true, error: null });
      
      // Сначала получаем информацию о платеже, чтобы узнать сумму и описание
      let paymentInfo = null;
      const state = get();
      
      // Ищем платеж в текущем состоянии
      if (state.payments) {
        paymentInfo = state.payments.find(p => p.id === paymentId);
      }
      
      // Если платеж не найден, запрашиваем его с сервера
      if (!paymentInfo) {
        const paymentResponse = await axios.get(`/payments/${paymentId}`);
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
      
      // Получаем базовый URL для мобильного приложения
      // В реальном приложении это будет URL схема или deep link
      const baseUrl = Platform.OS === 'ios' 
        ? 'dantizt://' 
        : 'dantizt://';
      
      // Формируем URL для возврата после успешной оплаты
      const timestamp = new Date().getTime();
      const successUrl = `${baseUrl}payment/success?paymentId=${paymentId}&timestamp=${timestamp}&source=tinkoff`;
      const failUrl = `${baseUrl}payment/fail?paymentId=${paymentId}&timestamp=${timestamp}&source=tinkoff`;
      
      const response = await axios.post(`/payments/tinkoff/init`, {
        payment_id: paymentId,
        amount: paymentInfo.amount, // Добавляем сумму платежа
        description: description, // Добавляем описание платежа
        customer_email: '', // Будет получено из данных пациента на бэкенде
        customer_phone: '', // Будет получено из данных пациента на бэкенде
        receipt_items: [], // Будет сформировано на бэкенде на основе услуг
        return_url: successUrl, // URL для возврата после успешной оплаты
        fail_url: failUrl // URL для возврата после неудачной оплаты
      });
      
      // Если успешно инициализирован платеж, открываем URL для оплаты
      if (response.data.Success && response.data.PaymentURL) {
        set({ isLoading: false });
        
        // Открываем браузер для оплаты
        try {
          // Проверяем, можно ли открыть URL
          const canOpen = await Linking.canOpenURL(response.data.PaymentURL);
          if (canOpen) {
            await Linking.openURL(response.data.PaymentURL);
          } else {
            Alert.alert(
              'Ошибка',
              'Не удалось открыть страницу оплаты. Пожалуйста, попробуйте позже.',
              [{ text: 'OK' }]
            );
            throw new Error('Не удалось открыть URL для оплаты');
          }
        } catch (error) {
          console.error('Ошибка при открытии URL для оплаты:', error);
          Alert.alert(
            'Ошибка',
            'Не удалось открыть страницу оплаты. Пожалуйста, попробуйте позже.',
            [{ text: 'OK' }]
          );
          throw error;
        }
        
        return response.data;
      } else {
        throw new Error(response.data.Message || 'Ошибка при инициализации платежа');
      }
    } catch (error) {
      console.error('Error initializing Tinkoff payment:', error);
      set({ 
        error: error.response?.data?.detail || error.message || 'Ошибка при инициализации платежа',
        isLoading: false 
      });
      throw error;
    }
  },

  // Проверка статуса платежа через API Тинькофф
  checkTinkoffPaymentStatus: async (paymentId, tinkoffPaymentId) => {
    try {
      console.log('=== НАЧАЛО ПРОВЕРКИ СТАТУСА ПЛАТЕЖА TINKOFF ===');
      console.log('Исходные параметры:', { paymentId, tinkoffPaymentId, timestamp: new Date().toISOString() });
      
      set({ isLoading: true, error: null });
      
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
          
          if (match1 && match1[1]) {
            effectivePaymentId = match1[1];
            console.log('Извлечен ID платежа из orderId (формат 1):', effectivePaymentId);
          } else if (match2 && match2[1]) {
            effectivePaymentId = match2[1];
            console.log('Извлечен ID платежа из orderId (формат 2):', effectivePaymentId);
          } else {
            console.warn('Не удалось извлечь ID платежа из orderId:', paymentId);
          }
        }
        // Проверяем, если это просто строка с числом
        else if (!isNaN(paymentId)) {
          effectivePaymentId = paymentId;
          console.log('PaymentId является строкой с числом:', effectivePaymentId);
        } else {
          console.warn('PaymentId имеет неизвестный формат:', paymentId);
        }
      } else {
        console.log('PaymentId не является строкой или пустой:', paymentId);
      }
      
      console.log('Отправка запроса на проверку статуса платежа Tinkoff:', {
        paymentId: effectivePaymentId,
        tinkoffPaymentId,
        url: '/payments/tinkoff/status'
      });
      
      // Используем правильные имена параметров для бэкенда
      const response = await axios.post(`/payments/tinkoff/status`, {
        payment_id: effectivePaymentId,
        tinkoff_payment_id: tinkoffPaymentId
      });
      
      console.log('Ответ API статуса платежа Tinkoff:', response.data);
      
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
              const updateResponse = await axios.post(`/payments/process`, {
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
                const altUpdateResponse = await axios.post(`/payments/process`, {
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
            payment.id === parseInt(effectivePaymentId) ? {
              ...payment,
              status: localStatus
            } : payment
          ),
          isLoading: false
        }));
      } else {
        console.log('Получен неуспешный ответ от API статуса Tinkoff:', response.data);
        set({ isLoading: false });
      }
      
      return response.data;
    } catch (error) {
      console.error('Ошибка при проверке статуса платежа Tinkoff:', error);
      set({ 
        error: error.response?.data?.detail || error.message || 'Ошибка при проверке статуса платежа',
        isLoading: false 
      });
      throw error;
    }
  }
}));

export default usePaymentStore;
