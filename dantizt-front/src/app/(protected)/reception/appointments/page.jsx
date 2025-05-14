'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MagnifyingGlassIcon, 
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  XMarkIcon,
  CheckIcon,
  ClockIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { useAppointmentsStore } from '@/store/appointmentsStore';
import { usePatientStore } from '@/store/patientStore';
import { useDoctorStore } from '@/store/doctorStore';
import { toast } from 'react-toastify';
import api from '@/lib/axios'; // Исправленный импорт API
import SlotPicker from '@/components/slot-picker';

// Вспомогательные функции
const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Функция для форматирования даты в читаемом формате
const formatDateReadable = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatTime = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-800';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getStatusText = (status) => {
  switch (status) {
    case 'scheduled':
      return 'Запланирован';
    case 'completed':
      return 'Завершен';
    case 'cancelled':
      return 'Отменен';
    case 'in_progress':
      return 'В процессе';
    default:
      return 'Неизвестно';
  }
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState('all');
  const [doctorsList, setDoctorsList] = useState([]);
  const [patientsList, setPatientsList] = useState([]);
  const [formData, setFormData] = useState({
    patient_id: '',
    doctor_id: '',
    date: '',
    start_time: '',
    end_time: '',
    start_time_full: '',
    end_time_full: ''
  });
  const router = useRouter();

  // Получаем функции из сторов приемов, пациентов и врачей
  const { 
    loading, 
    error, 
    fetchAllAppointments, 
    cancelAppointment, 
    completeAppointment,
    createAppointment,
    updateAppointment
  } = useAppointmentsStore();
  const { fetchPatients, patients } = usePatientStore();
  const { fetchDoctors, doctors } = useDoctorStore();

  useEffect(() => {
    // Загружаем данные при изменении фильтров или страницы
    fetchAppointments();
  }, [currentPage, filterStatus, debouncedSearchTerm, selectedDate]);

  useEffect(() => {
    // Загружаем списки пациентов и врачей при монтировании компонента
    const loadData = async () => {
      try {
        // Получаем данные из API напрямую для отладки
        const patientsResponse = await api.get('/patients');
        const doctorsResponse = await api.get('/doctors');
        
        console.log('Raw patients response:', patientsResponse);
        console.log('Raw doctors response:', doctorsResponse);
        
        // Устанавливаем данные напрямую из ответа API
        const patientsData = patientsResponse.data;
        const doctorsData = doctorsResponse.data;
        
        console.log('Patients data:', patientsData);
        console.log('Doctors data:', doctorsData);
        
        // Сохраняем данные в состояние компонента
        if (Array.isArray(patientsData)) {
          setPatientsList(patientsData);
        } else if (patientsData && Array.isArray(patientsData.items)) {
          setPatientsList(patientsData.items);
        } else {
          console.error('Unexpected patients data format:', patientsData);
          setPatientsList([]);
        }
        
        if (Array.isArray(doctorsData)) {
          setDoctorsList(doctorsData);
        } else if (doctorsData && Array.isArray(doctorsData.items)) {
          setDoctorsList(doctorsData.items);
        } else {
          console.error('Unexpected doctors data format:', doctorsData);
          setDoctorsList([]);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Ошибка при загрузке данных');
      }
    };
    
    loadData();
  }, []);

  // Загрузка данных с сервера
  const fetchAppointments = async () => {
    try {
      setIsLoading(true);
      
      // Создаем объект параметров
      const params = {
        page: currentPage,
        status: filterStatus,
        search: debouncedSearchTerm
      };
      
      // Добавляем дату только если она выбрана
      if (selectedDate) {
        params.date = formatDate(selectedDate);
      }
      
      // Получаем данные из API через стор
      const response = await fetchAllAppointments(params);
      
      // Обновляем состояние компонента
      setAppointments(response.items || response);
      setTotalPages(response.total_pages || Math.ceil(response.total / 10) || 1);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast.error('Ошибка при загрузке записей на прием');
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    // Сбрасываем страницу при новом поиске
    setCurrentPage(1);
    // Поиск будет запущен через useEffect
  };

  const handleAddAppointment = () => {
    // Сбрасываем данные формы
    setFormData({
      patient_id: '',
      doctor_id: '',
      date: '',
      start_time: '',
      end_time: '',
      start_time_full: '',
      end_time_full: ''
    });
    setShowAppointmentModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSaveAppointment = async () => {
    try {
      if (!formData.patient_id || !formData.doctor_id || !formData.date || !formData.start_time || !formData.end_time) {
        toast.error('Пожалуйста, заполните все поля формы');
        return;
      }

      // Формируем данные в соответствии с требованиями API
      // Используем полные даты в формате ISO 8601 из SlotPicker, если они доступны
      const appointmentData = {
        patient_id: parseInt(formData.patient_id),
        doctor_id: parseInt(formData.doctor_id),
        start_time: formData.start_time_full || `${formData.date}T${formData.start_time}`,
        end_time: formData.end_time_full || `${formData.date}T${formData.end_time}`,
        reason: "Консультация" // Добавляем дефолтное значение, так как поле удалено из формы
      };

      console.log('Создание записи с данными:', appointmentData);
      
      // Проверка на будущее время
      const now = new Date();
      const appointmentTime = new Date(appointmentData.start_time);
      
      if (appointmentTime <= now) {
        toast.error('Время записи должно быть в будущем');
        return;
      }
      
      await createAppointment(appointmentData);
      toast.success('Запись успешно создана');
      setShowAppointmentModal(false);
      setFormData({
        patient_id: '',
        doctor_id: '',
        date: '',
        start_time: '',
        end_time: '',
        start_time_full: '',
        end_time_full: ''
      });
      fetchAppointments(); // Обновляем список записей
    } catch (error) {
      console.error('Ошибка при создании записи:', error);
      // Проверяем, есть ли конкретное сообщение об ошибке от API
      if (error.response && error.response.data && error.response.data.detail) {
        // Выводим сообщение об ошибке от API
        toast.error(error.response.data.detail);
      } else {
        // Выводим общее сообщение об ошибке
        toast.error('Ошибка при создании записи');
      }
    }
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setCurrentPage(1);
    setFormData({
      ...formData,
      date: formatDate(date)
    });
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

  const handleCancelAppointment = async (appointmentId) => {
    if (window.confirm('Вы уверены, что хотите отменить эту запись?')) {
      try {
        await cancelAppointment(appointmentId);
        toast.success('Запись успешно отменена');
        // Обновляем список приемов
        fetchAppointments();
      } catch (error) {
        console.error('Error cancelling appointment:', error);
        toast.error('Ошибка при отмене записи');
      }
    }
  };

  const handleCompleteAppointment = async (appointmentId) => {
    if (window.confirm('Отметить прием как завершенный?')) {
      try {
        await completeAppointment(appointmentId);
        toast.success('Прием отмечен как завершенный');
        // Обновляем список приемов
        fetchAppointments();
      } catch (error) {
        console.error('Error completing appointment:', error);
        toast.error('Ошибка при завершении приема');
      }
    }
  };

  const clearDate = () => {
    setSelectedDate(null);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => {
      clearTimeout(timeoutId);
    };
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
          <h1 className="text-2xl font-semibold text-gray-900">Записи на прием</h1>
          <p className="mt-1 text-sm text-gray-500">
            Управление записями пациентов
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            type="button"
            onClick={handleAddAppointment}
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <PlusIcon className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
            Новая запись
          </button>
        </div>
      </div>

      {/* Фильтры */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterStatus('all')}
          className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold shadow-sm ${
            filterStatus === 'all' 
              ? 'bg-indigo-600 text-white' 
              : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
          }`}
        >
          Все
        </button>
        <button
          type="button"
          onClick={() => handleFilterChange('scheduled')}
          className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold shadow-sm ${
            filterStatus === 'scheduled' 
              ? 'bg-indigo-600 text-white' 
              : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
          }`}
        >
          Запланированные
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
          Завершенные
        </button>
        <button
          type="button"
          onClick={() => handleFilterChange('cancelled')}
          className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold shadow-sm ${
            filterStatus === 'cancelled' 
              ? 'bg-indigo-600 text-white' 
              : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
          }`}
        >
          Отмененные
        </button>
        
        {/* Выбор даты */}
        <div className="ml-auto flex items-center">
          <input
            type="date"
            value={selectedDate ? formatDate(selectedDate) : ''}
            onChange={(e) => handleDateChange(new Date(e.target.value))}
            className="rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          />
          {selectedDate && (
            <button
              type="button"
              onClick={clearDate}
              className="ml-2 inline-flex items-center rounded-md bg-white px-2 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              <XMarkIcon className="h-4 w-4 text-gray-500" aria-hidden="true" />
            </button>
          )}
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
              placeholder="Поиск по имени пациента, врача или услуге"
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

      {/* Таблица записей */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата
                </th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Время
                </th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Пациент
                </th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Врач
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
              {appointments.map((appointment) => (
                <tr key={appointment.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateReadable(appointment.start_time)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatTime(appointment.start_time)} - {formatTime(appointment.end_time)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {appointment.patient_name || (appointment.patient && appointment.patient.full_name) || 'Нет данных'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {appointment.doctor_name ? 
                      `${appointment.doctor_name} ${appointment.doctor_specialty ? `(${appointment.doctor_specialty})` : ''}` : 
                      (appointment.doctor && appointment.doctor.full_name ? 
                        `${appointment.doctor.full_name} ${appointment.doctor.specialization ? `(${appointment.doctor.specialization})` : ''}` : 
                        'Нет данных')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(appointment.status)}`}>
                      {getStatusText(appointment.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex justify-center">
                      {appointment.status === 'scheduled' && (
                        <button
                          onClick={() => handleCancelAppointment(appointment.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Отменить"
                        >
                          <XMarkIcon className="h-5 w-5" />
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
                Показано <span className="font-medium">{appointments.length}</span> из{' '}
                <span className="font-medium">10</span> записей
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
      {/* Модальное окно для создания новой записи */}
      {showAppointmentModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-lg sm:w-full" role="dialog" aria-modal="true" aria-labelledby="modal-headline">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-headline">
                      Создание новой записи
                    </h3>
                    <div className="mt-2">
                      <form>
                        <div className="mb-4">
                          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="patient_id">
                            Пациент
                          </label>
                          <select
                            name="patient_id"
                            id="patient_id"
                            value={formData.patient_id}
                            onChange={handleInputChange}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            required
                          >
                            <option value="">Выберите пациента</option>
                            {patientsList && patientsList.length > 0 ? (
                              patientsList.map(patient => (
                                <option key={patient.id} value={patient.id}>
                                  {patient.user?.full_name || `Пациент ID: ${patient.id}`}
                                </option>
                              ))
                            ) : (
                              <option value="" disabled>Нет доступных пациентов</option>
                            )}
                          </select>
                        </div>
                        <div className="mb-4">
                          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="doctor_id">
                            Врач
                          </label>
                          <select
                            name="doctor_id"
                            id="doctor_id"
                            value={formData.doctor_id}
                            onChange={handleInputChange}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            required
                          >
                            <option value="">Выберите врача</option>
                            {doctorsList && doctorsList.length > 0 ? (
                              doctorsList.map(doctor => (
                                <option key={doctor.id} value={doctor.id}>
                                  {doctor.user?.full_name || `Врач ID: ${doctor.id}`} {doctor.specialization ? `(${doctor.specialization.name})` : ''}
                                </option>
                              ))
                            ) : (
                              <option value="" disabled>Нет доступных врачей</option>
                            )}
                          </select>
                        </div>
                        <div className="mb-4">
                          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="date">
                            Дата
                          </label>
                          <input
                            type="date"
                            name="date"
                            id="date"
                            value={formData.date}
                            onChange={handleInputChange}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                          />
                        </div>
                        
                        {formData.doctor_id && formData.date && (
                          <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2">
                              Выберите время
                            </label>
                            <SlotPicker
                              doctorId={parseInt(formData.doctor_id)}
                              selectedDate={new Date(formData.date)}
                              onSlotSelect={(slot) => {
                                console.log('Selected slot from SlotPicker:', slot);
                                // Преобразуем формат времени из SlotPicker в формат, необходимый для API
                                // SlotPicker возвращает время в формате HH:MM:SS
                                setFormData({
                                  ...formData,
                                  start_time: slot.start_time,
                                  end_time: slot.end_time,
                                  start_time_full: slot.start_time_full,
                                  end_time_full: slot.end_time_full
                                });
                              }}
                            />
                          </div>
                        )}
                        
                        <div className="mb-4 hidden">
                          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="start_time">
                            Время начала
                          </label>
                          <input
                            type="time"
                            name="start_time"
                            id="start_time"
                            value={formData.start_time}
                            onChange={handleInputChange}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                          />
                        </div>
                        <div className="mb-4 hidden">
                          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="end_time">
                            Время окончания
                          </label>
                          <input
                            type="time"
                            name="end_time"
                            id="end_time"
                            value={formData.end_time}
                            onChange={handleInputChange}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                          />
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleSaveAppointment}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAppointmentModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
