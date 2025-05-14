'use client';

import { useState } from 'react';

const recordTypeLabels = {
  note: 'Заметка',
  procedure: 'Процедура',
  prescription: 'Назначение',
  examination: 'Осмотр',
  treatment: 'Лечение'
};

export function MedicalRecordForm({ initialData, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(initialData || {
    record_type: 'note',
    title: '',
    description: '',
    tooth_positions: [],
    attachments: [],
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleToothPositionChange = (position) => {
    setFormData(prev => {
      const positions = prev.tooth_positions || [];
      if (positions.includes(position)) {
        return {
          ...prev,
          tooth_positions: positions.filter(p => p !== position)
        };
      } else {
        return {
          ...prev,
          tooth_positions: [...positions, position]
        };
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Тип записи
        </label>
        <select
          name="record_type"
          value={formData.record_type}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        >
          {Object.entries(recordTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Заголовок
        </label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Описание
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={4}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Позиции зубов
        </label>
        <div className="mt-2 grid grid-cols-8 gap-2">
          {Array.from({ length: 32 }, (_, i) => i + 1).map((position) => (
            <button
              key={position}
              type="button"
              onClick={() => handleToothPositionChange(position)}
              className={`p-2 text-sm font-medium rounded-md ${
                formData.tooth_positions?.includes(position)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              }`}
            >
              {position}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Дополнительные заметки
        </label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Отмена
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {initialData ? 'Сохранить' : 'Создать'}
        </button>
      </div>
    </form>
  );
}
