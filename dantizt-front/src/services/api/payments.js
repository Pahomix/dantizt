import api from '@/lib/axios';

// Сервис для работы с платежами
export const paymentsApi = {
  // Получить все платежи
  getAll: (params) => api.get('/payments', { params }),
  
  // Получить платеж по ID
  getById: (id) => api.get(`/payments/${id}`),
  
  // Получить платежи пациента
  getPatientPayments: () => api.get('/payments/patient'),
  
  // Создать новый платеж
  create: (data) => api.post('/payments', data),
  
  // Обновить платеж
  update: (id, data) => api.put(`/payments/${id}`, data),
  
  // Удалить платеж
  delete: (id) => api.delete(`/payments/${id}`),
  
  // Инициализировать платеж через Тинькофф
  initTinkoffPayment: (data) => api.post('/payments/tinkoff/init', data),
  
  // Проверить статус платежа через Тинькофф
  checkTinkoffStatus: (data) => api.post('/payments/tinkoff/check-status', data),
  
  // Подтвердить платеж через Тинькофф
  confirmTinkoffPayment: (data) => api.post('/payments/tinkoff/confirm', data),
  
  // Отменить платеж через Тинькофф
  cancelTinkoffPayment: (data) => api.post('/payments/tinkoff/cancel', data),
  
  // Вернуть платеж через Тинькофф
  refundTinkoffPayment: (data) => api.post('/payments/tinkoff/refund', data),
  
  // Ручная проверка статуса платежа (без авторизации)
  manualCheckStatus: (paymentId) => api.get(`/payments/check-status/${paymentId}`),
  
  // Проверка статуса платежа по ID заказа (без авторизации)
  checkStatusByOrderId: (orderId) => api.get(`/payment-status/order/${orderId}`),
};

export default paymentsApi;
