'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import api from '@/lib/axios';
import { ClockIcon } from '@heroicons/react/24/outline';

export default function SlotPicker({ doctorId, selectedDate, serviceId, onSlotSelect }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);

  useEffect(() => {
    const fetchSlots = async () => {
      if (!doctorId || !selectedDate || !serviceId) return;

      setLoading(true);
      setError(null);
      try {
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        const response = await api.get(`/appointments/available-slots`, {
          params: {
            doctor_id: doctorId,
            date: formattedDate,
            service_id: serviceId
          }
        });
        setSlots(response.data);
      } catch (err) {
        setError('Ошибка при загрузке доступного времени');
        console.error('Error fetching slots:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSlots();
  }, [doctorId, selectedDate, serviceId]);

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
    onSlotSelect(slot);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center py-4">
        {error}
      </div>
    );
  }

  if (!slots.length) {
    return (
      <div className="text-gray-500 text-center py-4">
        Нет доступных слотов на выбранную дату
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {slots.map((slot) => (
        <button
          key={`${slot.start_time}-${slot.end_time}`}
          onClick={() => handleSlotSelect(slot)}
          className={`
            flex items-center justify-center px-3 py-2 rounded-lg transition-all
            ${selectedSlot === slot
              ? 'bg-indigo-500 text-white'
              : 'border border-gray-300 hover:border-indigo-500 text-gray-700 hover:text-indigo-500 active:bg-indigo-500 active:text-white'
            }
            focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
          `}
        >
          <ClockIcon className={`w-4 h-4 mr-2 ${selectedSlot === slot ? 'text-white' : 'text-gray-400'}`} />
          <span>
            {format(new Date(`2000-01-01T${slot.start_time}`), 'HH:mm', { locale: ru })}
          </span>
        </button>
      ))}
    </div>
  );
}
