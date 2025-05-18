'use client';

import { useState, useEffect } from 'react';
import { useScheduleStore } from '@/store/scheduleStore';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import api from '@/lib/axios';

export default function SlotPicker({ doctorId, selectedDate, onSlotSelect }) {
  const { fetchDoctorAvailability } = useScheduleStore();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [doctor, setDoctor] = useState(null);
  const [appointmentDuration, setAppointmentDuration] = useState(30);

  // Получаем информацию о враче и его специализации
  useEffect(() => {
    const fetchDoctorInfo = async () => {
      if (!doctorId) return;
      
      try {
        const response = await api.get(`/doctors/${doctorId}`);
        const doctorData = response.data;
        setDoctor(doctorData);
        
        if (doctorData.specialization && doctorData.specialization.appointment_duration) {
          setAppointmentDuration(doctorData.specialization.appointment_duration);
        }
      } catch (err) {
        console.error('Ошибка при получении информации о враче:', err);
      }
    };
    
    fetchDoctorInfo();
  }, [doctorId]);

  useEffect(() => {
    const loadSlots = async () => {
      if (!doctorId || !selectedDate) return;
      
      try {
        setLoading(true);
        setError(null);
        const response = await fetchDoctorAvailability(doctorId, selectedDate);
        setSlots(response.slots || []);
      } catch (err) {
        // Проверяем, является ли ошибка 404 (расписание не найдено)
        if (err.response && err.response.status === 404) {
          // Получаем день недели из выбранной даты (0 - воскресенье, 1 - понедельник, и т.д.)
          const dayOfWeek = selectedDate.getDay();
          const dayNames = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
          
          // Проверяем, содержит ли сообщение об ошибке информацию о дне недели
          if (err.response.data && err.response.data.detail && 
              err.response.data.detail.includes('No schedule found for doctor on day')) {
            setError(`В ${dayNames[dayOfWeek]} врач не ведет прием. Пожалуйста, выберите другой день.`);
          } else {
            setError('Расписание не найдено для выбранного дня');
          }
        } else {
          setError(err.message || 'Ошибка при загрузке доступного времени');
        }
        console.error('Ошибка при загрузке слотов:', err);
      } finally {
        setLoading(false);
      }
    };

    loadSlots();
  }, [doctorId, selectedDate]);

  const handleSlotClick = (slot) => {
    // Преобразуем время в формат ISO 8601 с датой
    const selectedDate_ISO = format(selectedDate, 'yyyy-MM-dd');
    const slotWithFullTime = {
      ...slot,
      start_time: slot.start_time,
      end_time: slot.end_time,
      // Добавляем полные даты для отображения в UI
      start_time_full: `${selectedDate_ISO}T${slot.start_time}`,
      end_time_full: `${selectedDate_ISO}T${slot.end_time}`
    };
    
    setSelectedSlot(slotWithFullTime);
    onSlotSelect?.(slotWithFullTime);
    console.log('Выбран слот:', slotWithFullTime);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-50 border border-red-100">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Доступное время не найдено
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            {error.includes('врач не ведет прием') && (
              <div className="mt-3">
                <div className="flex">
                  <button
                    type="button"
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    onClick={() => {
                      // Переходим на следующий день
                      const nextDay = new Date(selectedDate);
                      nextDay.setDate(nextDay.getDate() + 1);
                      // Вызываем функцию изменения даты в родительском компоненте
                      window.dispatchEvent(new CustomEvent('change-appointment-date', { detail: nextDay }));
                    }}
                  >
                    <svg className="-ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                    Посмотреть следующий день
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!slots.length) {
    return (
      <div className="p-4 text-gray-500">
        Нет доступных слотов на выбранную дату
      </div>
    );
  }

  // Форматируем длительность приема для отображения
  const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes} минут`;
    if (minutes === 60) return '1 час';
    if (minutes % 60 === 0) return `${minutes / 60} часа`;
    return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
  };

  const specializationName = doctor?.specialization?.name || 'Специалист';

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 p-3 rounded-lg text-sm text-indigo-700 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Длительность приема {specializationName}: {formatDuration(appointmentDuration)}
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {slots.map((slot, index) => {
          const startTime = format(new Date(`1970-01-01T${slot.start_time}`), 'HH:mm', { locale: ru });
          const endTime = format(new Date(`1970-01-01T${slot.end_time}`), 'HH:mm', { locale: ru });
          
          return (
            <button
              key={index}
              onClick={() => handleSlotClick(slot)}
              className={`
                p-3 rounded-lg text-sm font-medium transition-colors
                ${
                  selectedSlot?.start_time === slot.start_time && selectedSlot?.end_time === slot.end_time
                    ? 'bg-indigo-500 text-white shadow-md'
                    : 'bg-white border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-900'
                }
              `}
            >
              <div className="text-center">
                <span className="text-base font-semibold">{startTime} - {endTime}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
