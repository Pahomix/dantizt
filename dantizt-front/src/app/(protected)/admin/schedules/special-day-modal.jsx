'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog } from '@headlessui/react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useScheduleStore } from '@/store/scheduleStore';

// Список допустимых типов особых дней
const VALID_TYPES = ['holiday', 'vacation', 'sick_leave', 'training'];

const SPECIAL_DAY_TYPES = [
  { id: 'holiday', name: 'Праздничный день' },
  { id: 'vacation', name: 'Отпуск' },
  { id: 'sick_leave', name: 'Больничный' },
  { id: 'training', name: 'Обучение/конференция' }
];

// Функция для создания начального состояния формы
const getInitialFormState = (date, specialDay) => {
  // Если есть особый день, используем его данные
  if (specialDay) {
    // Проверяем, что тип особого дня допустим, иначе используем 'holiday'
    const safeType = specialDay.type && VALID_TYPES.includes(specialDay.type) ? specialDay.type : 'holiday';
    
    return {
      dateFrom: format(new Date(specialDay.date), 'yyyy-MM-dd'),
      type: safeType,
      description: specialDay.description || '',
      isWorking: Boolean(specialDay.is_working),
      workStartTime: specialDay.start_time || '09:00',
      workEndTime: specialDay.end_time || '18:00'
    };
  }
  
  // Если есть только дата
  if (date) {
    return {
      dateFrom: format(date, 'yyyy-MM-dd'),
      type: 'holiday',
      description: '',
      isWorking: false,
      workStartTime: '09:00',
      workEndTime: '18:00'
    };
  }
  
  // Стандартные значения
  return {
    dateFrom: format(new Date(), 'yyyy-MM-dd'),
    type: 'holiday',
    description: '',
    isWorking: false,
    workStartTime: '09:00',
    workEndTime: '18:00'
  };
};

export default function SpecialDayModal({ isOpen, onClose, doctorId, date, specialDay }) {
  const { createSpecialDay, updateSpecialDay, deleteSpecialDay } = useScheduleStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Используем функцию для создания начального состояния
  const [formData, setFormData] = useState(() => getInitialFormState(date, specialDay));

  // Обновляем форму при изменении выбранной даты или особого дня
  useEffect(() => {
    // Создаем новое состояние формы на основе новых props
    const newFormState = getInitialFormState(date, specialDay);
    setFormData(newFormState);
  }, [specialDay, date]);

  // Функция для безопасного обновления состояния формы
  const updateFormData = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Обработчик отправки формы
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    
    try {
      // Проверяем, что тип особого дня допустим
      const safeType = formData.type && VALID_TYPES.includes(formData.type) ? formData.type : 'holiday';
      
      // Создаем базовый пайлоад для отправки на сервер
      const basePayload = {
        type: safeType,
        description: formData.description || null,
        is_working: Boolean(formData.isWorking),
        start_time: formData.isWorking ? (formData.workStartTime || '09:00') : null,
        end_time: formData.isWorking ? (formData.workEndTime || '18:00') : null
      };

      // Вызываем соответствующий метод стора
      if (specialDay) {
        // При обновлении не передаем поле date, как требует API
        await updateSpecialDay(doctorId, specialDay.id, basePayload);
      } else {
        // При создании нового особого дня добавляем дату
        const createPayload = {
          ...basePayload,
          date: formData.dateFrom || format(new Date(), 'yyyy-MM-dd')
        };
        await createSpecialDay(doctorId, createPayload);
      }
      onClose();
    } catch (error) {
      console.error('Error saving special day:', error);
      setError(error.response?.data?.detail || 'Ошибка при сохранении особого дня');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Обработчик удаления особого дня
  const handleDelete = async (specialDayId) => {
    if (!confirm('Вы уверены, что хотите удалить этот особый день?')) {
      return;
    }

    setIsSubmitting(true);
    setError('');
    
    try {
      await deleteSpecialDay(doctorId, specialDayId);
      onClose();
    } catch (error) {
      console.error('Error deleting special day:', error);
      setError(error.response?.data?.detail || 'Ошибка при удалении особого дня');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-lg rounded bg-white p-6">
          <Dialog.Title className="text-lg font-medium leading-6 text-gray-900 mb-4 flex justify-between items-center border-b pb-4">
            {specialDay ? 'Редактировать особый день' : 'Добавить особый день'}
            {specialDay && (
              <button
                type="button"
                onClick={() => handleDelete(specialDay.id)}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-red-600 hover:text-red-800 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                disabled={isSubmitting}
              >
                <TrashIcon className="h-4 w-4 mr-1" />
                Удалить
              </button>
            )}
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Тип особого дня
              </label>
              <select
                value={formData.type || 'holiday'}
                onChange={(e) => updateFormData('type', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
                required
              >
                <option value="holiday" className="text-gray-900">Праздничный день</option>
                <option value="vacation" className="text-gray-900">Отпуск</option>
                <option value="sick_leave" className="text-gray-900">Больничный</option>
                <option value="training" className="text-gray-900">Обучение/конференция</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Описание
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => updateFormData('description', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
                rows={2}
                placeholder="Добавьте описание особого дня (необязательно)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Дата
              </label>
              <input
                type="date"
                value={formData.dateFrom || format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => updateFormData('dateFrom', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
                required
              />
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={Boolean(formData.isWorking)}
                  onChange={(e) => updateFormData('isWorking', e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm font-medium text-gray-900">Рабочий день</span>
              </label>
            </div>

            {formData.isWorking && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Время начала работы
                  </label>
                  <input
                    type="time"
                    value={formData.workStartTime || '09:00'}
                    onChange={(e) => updateFormData('workStartTime', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Время окончания работы
                  </label>
                  <input
                    type="time"
                    value={formData.workEndTime || '18:00'}
                    onChange={(e) => updateFormData('workEndTime', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
                    required
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      {error}
                    </h3>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm"
              >
                {isSubmitting ? 'Сохранение...' : (specialDay ? 'Обновить' : 'Сохранить')}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
