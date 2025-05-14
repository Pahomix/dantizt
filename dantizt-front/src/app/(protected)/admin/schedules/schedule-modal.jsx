'use client';

import { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

const DAYS_OF_WEEK = [
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
  'Воскресенье'
];

// Обновляем DEFAULT_SCHEDULE, чтобы дни недели начинались с понедельника
const DEFAULT_SCHEDULE = [
  { day_of_week: 0, is_active: true, start_time: '09:00', end_time: '17:00' },
  { day_of_week: 1, is_active: true, start_time: '09:00', end_time: '17:00' },
  { day_of_week: 2, is_active: true, start_time: '09:00', end_time: '17:00' },
  { day_of_week: 3, is_active: true, start_time: '09:00', end_time: '17:00' },
  { day_of_week: 4, is_active: true, start_time: '09:00', end_time: '17:00' },
  { day_of_week: 5, is_active: false, start_time: null, end_time: null },
  { day_of_week: 6, is_active: false, start_time: null, end_time: null }
];

export default function ScheduleModal({ isOpen, onClose, doctorId, updateDoctorSchedule }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [schedulesState, setSchedules] = useState(DEFAULT_SCHEDULE.map(schedule => ({
    ...schedule,
    is_active: schedule.is_active,
  })));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Подготавливаем данные для отправки
      const scheduleData = {
        schedules: schedulesState.map(schedule => ({
          day_of_week: schedule.day_of_week,
          is_active: schedule.is_active,
          start_time: schedule.is_active ? schedule.start_time : null,
          end_time: schedule.is_active ? schedule.end_time : null
        }))
      };

      // Обновляем расписание
      await updateDoctorSchedule(doctorId, scheduleData);
      onClose();
    } catch (error) {
      console.error('Error updating schedule:', error);
      alert('Ошибка при обновлении расписания');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      {/* Затемнение фона */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      {/* Центрирование модального окна */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-3xl w-full bg-white rounded-xl shadow-lg">
          {/* Шапка модального окна */}
          <div className="bg-white px-4 py-3 sm:px-6 rounded-t-xl flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold leading-6 text-gray-900">
              Редактировать расписание
            </Dialog.Title>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <span className="sr-only">Close</span>
              <XMarkIcon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>

          {/* Основное содержимое модального окна */}
          <div className="mt-3 sm:mt-0 sm:ml-4">
            <div className="mt-2">
              <form onSubmit={handleSubmit}>
                {/* Таблица с расписанием */}
                <div className="mt-4">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          День недели
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Рабочий день
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Начало работы
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Конец работы
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {schedulesState.map((schedule, index) => (
                        <tr key={schedule.day_of_week}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {DAYS_OF_WEEK[schedule.day_of_week]}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <input
                              type="checkbox"
                              checked={schedule.is_active}
                              onChange={(e) => {
                                const newSchedules = [...schedulesState];
                                const isActive = e.target.checked;
                                newSchedules[index] = {
                                  ...newSchedules[index],
                                  is_active: isActive,
                                  start_time: isActive ? '09:00' : null,
                                  end_time: isActive ? '17:00' : null
                                };
                                setSchedules(newSchedules);
                              }}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <input
                              type="time"
                              value={schedule.start_time || ''}
                              onChange={(e) => {
                                const newSchedules = [...schedulesState];
                                newSchedules[index] = {
                                  ...newSchedules[index],
                                  start_time: e.target.value
                                };
                                setSchedules(newSchedules);
                              }}
                              disabled={!schedule.is_active}
                              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <input
                              type="time"
                              value={schedule.end_time || ''}
                              onChange={(e) => {
                                const newSchedules = [...schedulesState];
                                newSchedules[index] = {
                                  ...newSchedules[index],
                                  end_time: e.target.value
                                };
                                setSchedules(newSchedules);
                              }}
                              disabled={!schedule.is_active}
                              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Кнопки действий */}
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:bg-gray-400"
                  >
                    {isSubmitting ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
