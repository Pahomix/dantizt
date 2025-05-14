'use client';

import { useState, useEffect } from 'react';
import { TeethSelector } from './TeethSelector';

export function ExaminationForm({ appointment, initialData, onSave }) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tooth_positions: [],
    notes: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      record_type: 'examination',
      patient_id: appointment.patient_id,
      doctor_id: appointment.doctor_id,
      appointment_id: appointment.id
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTeethChange = (selectedTeeth) => {
    setFormData(prev => ({
      ...prev,
      tooth_positions: selectedTeeth
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Заголовок осмотра
        </label>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          required
        />
      </div>

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700">
          Описание осмотра
        </label>
        <textarea
          id="content"
          name="content"
          value={formData.content}
          onChange={handleChange}
          rows={4}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          required
        />
      </div>

      <TeethSelector
        selectedTeeth={formData.tooth_positions}
        onChange={handleTeethChange}
      />

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
          Дополнительные заметки
        </label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={2}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Сохранить осмотр
        </button>
      </div>
    </form>
  );
}
