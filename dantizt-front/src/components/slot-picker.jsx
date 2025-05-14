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
        setError(err.message);
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
      <div className="p-4 text-red-500">
        Ошибка при загрузке слотов: {error}
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
