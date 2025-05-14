'use client';

import { useState, useEffect } from 'react';
import { 
  MagnifyingGlassIcon, 
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import { usePaymentsStore } from '@/store/paymentsStore';
import { toast } from 'react-toastify';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const { fetchPayments, updatePayment, loading, error, generateTaxDeductionCertificate } = usePaymentsStore();

  useEffect(() => {
    // Загрузка данных с сервера
    fetchPaymentsData();
  }, [currentPage, filterStatus, debouncedSearchTerm]);

  const fetchPaymentsData = async () => {
    try {
      setIsLoading(true);
      // Получаем данные из API через стор
      const response = await fetchPayments({
        page: currentPage,
        status: filterStatus !== 'all' ? filterStatus : undefined,
        search: debouncedSearchTerm || undefined
      });
      
      // Обновляем состояние компонента
      setPayments(response.items || response);
      setTotalPages(response.total_pages || Math.ceil(response.total / 10) || 1);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Ошибка при загрузке платежей');
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    // Сбрасываем страницу при новом поиске
    setCurrentPage(1);
    // Поиск будет запущен через useEffect
  };

  const handleProcessPayment = (payment) => {
    setSelectedPayment(payment);
    setPaymentMethod(payment.payment_method || 'card');
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = async () => {
    try {
      if (!selectedPayment) return;
      
      const paymentData = {
        status: 'completed',
        payment_method: paymentMethod
      };
      
      // Если метод оплаты - карта, добавляем данные карты
      if (paymentMethod === 'card') {
        // В реальном приложении здесь будут данные из формы ввода карты
        paymentData.cardData = {
          cardNumber: '4111111111111111', // Тестовый номер карты
          expiryDate: '12/25',
          cvv: '123'
        };
      }
      
      await updatePayment(selectedPayment.id, paymentData);
      toast.success('Платеж успешно обработан');
      setShowPaymentModal(false);
      fetchPaymentsData(); // Обновляем список платежей
    } catch (error) {
      console.error('Ошибка при обработке платежа:', error);
      toast.error(error.response?.data?.detail || 'Ошибка при обработке платежа');
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleFilterChange = (status) => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  const handleIssueTaxDocument = async (payment) => {
    try {
      if (!payment || !payment.patient || !payment.patient.id) {
        toast.error('Не удалось получить данные пациента');
        return;
      }
      
      // Получаем текущий год (или можно использовать год платежа)
      const currentYear = new Date().getFullYear();
      
      // Вызываем функцию из стора для генерации справки
      await generateTaxDeductionCertificate(payment.patient.id, currentYear, false);
      
      toast.success('Справка для налогового вычета успешно сформирована');
    } catch (error) {
      console.error('Ошибка при формировании справки:', error);
      toast.error(error.response?.data?.detail || 'Ошибка при формировании справки для налогового вычета');
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return 'Оплачен';
      case 'pending':
        return 'Ожидает оплаты';
      case 'cancelled':
        return 'Отменен';
      default:
        return status;
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Платежи</h1>
          <p className="mt-1 text-sm text-gray-500">
            Управление платежами пациентов
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`mr-2 inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold shadow-sm ${
              filterStatus === 'all' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
            }`}
          >
            Все
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('pending')}
            className={`mr-2 inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold shadow-sm ${
              filterStatus === 'pending' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
            }`}
          >
            Ожидают оплаты
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('completed')}
            className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold shadow-sm ${
              filterStatus === 'completed' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
            }`}
          >
            Оплаченные
          </button>
        </div>
      </div>

      {/* Поиск */}
      <div className="mb-6">
        <form onSubmit={handleSearch} className="relative">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              name="search"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-md border-0 py-2 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              placeholder="Поиск по имени пациента, услуге или врачу"
            />
          </div>
          <button
            type="submit"
            className="absolute right-0 top-0 h-full px-3 py-2 rounded-r-md bg-indigo-600 text-white"
          >
            Поиск
          </button>
        </form>
      </div>

      {/* Таблица платежей */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Пациент
                </th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Услуга
                </th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата приема
                </th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Сумма
                </th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {payment.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {payment.patient && payment.patient.user ? payment.patient.user.full_name : 'Нет данных'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {payment.appointment && payment.appointment.services && payment.appointment.services.length > 0 
                      ? payment.appointment.services.map(service => service.name).join(', ')
                      : 'Нет данных'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {payment.appointment && payment.appointment.start_time 
                      ? new Date(payment.appointment.start_time).toLocaleDateString('ru-RU')
                      : 'Invalid Date'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {payment.amount} ₽
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(payment.status)}`}>
                      {getStatusText(payment.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      {payment.status === 'pending' && (
                        <button
                          onClick={() => handleProcessPayment(payment)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Обработать платеж"
                        >
                          <CurrencyDollarIcon className="h-5 w-5" />
                        </button>
                      )}
                      {payment.status === 'completed' && (
                        <button
                          onClick={() => handleIssueTaxDocument(payment)}
                          className="text-green-600 hover:text-green-900"
                          title="Выдать справку для налогового вычета"
                        >
                          <DocumentTextIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Пагинация */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Показано <span className="font-medium">{payments.length}</span> из{' '}
                <span className="font-medium">10</span> платежей
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${
                    currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <span className="sr-only">Предыдущая</span>
                  <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
                </button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => handlePageChange(i + 1)}
                    className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                      currentPage === i + 1
                        ? 'z-10 bg-indigo-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                        : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 ${
                    currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <span className="sr-only">Следующая</span>
                  <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Модальное окно для обработки платежа */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Обработка платежа
                </h3>
                <div className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Пациент</p>
                      <p className="font-medium">{selectedPayment.patient && selectedPayment.patient.user ? selectedPayment.patient.user.full_name : 'Нет данных'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Услуги</p>
                      <p className="font-medium">
                        {selectedPayment.appointment && selectedPayment.appointment.services && selectedPayment.appointment.services.length > 0 
                          ? selectedPayment.appointment.services.map(service => `${service.name} (${service.cost} ₽)`).join(', ')
                          : 'Нет данных'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Сумма к оплате</p>
                      <p className="font-medium text-lg">{selectedPayment.amount} ₽</p>
                    </div>
                    <div>
                      <label htmlFor="payment_method" className="block text-sm font-medium text-gray-700">
                        Способ оплаты
                      </label>
                      <select
                        id="payment_method"
                        name="payment_method"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                      >
                        <option value="card">Банковская карта</option>
                        <option value="cash">Наличные</option>
                        <option value="insurance">Страховка</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Подтвердить оплату
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
