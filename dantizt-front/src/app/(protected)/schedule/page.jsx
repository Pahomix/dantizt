'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { showError, showSuccess } from '@/utils/notifications';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const DAYS_OF_WEEK = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье'
];

export default function SchedulePage() {
  const [schedules, setSchedules] = useState([]);
  const [specialDays, setSpecialDays] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [schedulesRes, specialDaysRes] = await Promise.all([
        api.get('/schedules/me'),
        api.get('/schedules/me/special-days')
      ]);
      
      setSchedules(schedulesRes.data || []);
      setSpecialDays(specialDaysRes.data || []);
    } catch (error) {
      setError('Ошибка при загрузке расписания');
      showError('Не удалось загрузить расписание');
      console.error('Error fetching schedule data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScheduleUpdate = async (scheduleData) => {
    try {
      await api.put(`/schedules/me`, scheduleData);
      showSuccess('Расписание успешно обновлено');
      fetchData();
    } catch (error) {
      showError('Не удалось обновить расписание');
      console.error('Error updating schedule:', error);
    }
  };

  const handleSpecialDayCreate = async (specialDayData) => {
    try {
      await api.post('/schedules/me/special-days', specialDayData);
      showSuccess('Особый день успешно добавлен');
      fetchData();
    } catch (error) {
      showError('Не удалось добавить особый день');
      console.error('Error creating special day:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen text-red-600">
        {error}
      </div>
    );
  }

  const getScheduleForDay = (dayOfWeek) => {
    return schedules.find(schedule => schedule.day_of_week === dayOfWeek);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Моё расписание</h1>
        <div className="space-x-4">
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            onClick={() => setEditingSchedule({})}
          >
            Редактировать расписание
          </button>
          <button
            type="button"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            onClick={() => setEditingSpecialDay({})}
          >
            Добавить особый день
          </button>
        </div>
      </div>

      <div className="bg-white shadow ring-1 ring-black ring-opacity-5 rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {/* Заголовки дней недели */}
          {DAYS_OF_WEEK.map((day, index) => (
            <div
              key={day}
              className="bg-gray-50 p-4"
            >
              <h3 className="text-sm font-semibold text-gray-900">{day}</h3>
              {renderDaySchedule(getScheduleForDay(index))}
            </div>
          ))}
        </div>
      </div>

      {/* Список особых дней */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Особые дни</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {specialDays.map((specialDay) => (
            <div
              key={specialDay.id}
              className="bg-white shadow rounded-lg p-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {format(new Date(specialDay.date), 'd MMMM yyyy', { locale: ru })}
                  </p>
                  <p className="text-sm text-gray-500">
                    {specialDay.type === 'holiday' ? 'Выходной' : 'Особый график'}
                  </p>
                  {specialDay.type !== 'holiday' && (
                    <p className="text-sm text-gray-500">
                      {format(new Date(`1970-01-01T${specialDay.start_time}`), 'HH:mm')} - 
                      {format(new Date(`1970-01-01T${specialDay.end_time}`), 'HH:mm')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-500"
                  onClick={() => handleSpecialDayDelete(specialDay.id)}
                >
                  <span className="sr-only">Удалить</span>
                  {/* Иконка удаления */}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderDaySchedule(schedule) {
  if (!schedule || !schedule.is_active) {
    return (
      <p className="text-sm text-gray-500 mt-2">Выходной</p>
    );
  }

  return (
    <div className="mt-2">
      <p className="text-sm text-gray-900">
        {format(new Date(`1970-01-01T${schedule.start_time}`), 'HH:mm')} - 
        {format(new Date(`1970-01-01T${schedule.end_time}`), 'HH:mm')}
      </p>
      <p className="text-xs text-gray-500">
        Длительность приема: {schedule.slot_duration} мин
      </p>
      {schedule.break_between_slots > 0 && (
        <p className="text-xs text-gray-500">
          Перерыв между приемами: {schedule.break_between_slots} мин
        </p>
      )}
    </div>
  );
}
