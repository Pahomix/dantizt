'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/axios';

export default function DoctorModal({ doctor, onClose, onSave }) {
  const [formData, setFormData] = useState({
    email: doctor?.user?.email || '',
    full_name: doctor?.user?.full_name || '',
    phone_number: doctor?.user?.phone_number || '',
    specialization_id: doctor?.specialization?.id || '',
    experience_years: doctor?.experience_years || '',
    education: doctor?.education || '',
    password: '',
    is_active: doctor?.user?._is_active ?? true
  });

  const [specializations, setSpecializations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchSpecializations = async () => {
      try {
        const response = await api.get('/specializations');
        setSpecializations(response.data);
      } catch (error) {
        console.error('Error fetching specializations:', error);
        setError('Ошибка при загрузке специализаций');
      }
    };

    fetchSpecializations();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setLoading(true);
    setError('');

    const submitButton = e.target.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      // Преобразуем данные формы
      const processedData = {
        ...formData,
        specialization_id: parseInt(formData.specialization_id) || null,
        experience_years: formData.experience_years === '' ? null : parseInt(formData.experience_years),
        // Не отправляем пустой пароль при обновлении
        password: formData.password || undefined
      };
      
      const result = await onSave(processedData);
      
      if (result) {
        onClose();
      }
    } catch (error) {
      console.error('Error saving doctor:', error);
      setError(error.response?.data?.detail || 'Ошибка при сохранении');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {doctor ? 'Редактировать врача' : 'Добавить врача'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            disabled={isSubmitting}
            type="button"
          >
            <span className="sr-only">Закрыть</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-900">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
            />
          </div>

          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-900">
              ФИО
            </label>
            <input
              type="text"
              id="full_name"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
            />
          </div>

          <div>
            <label htmlFor="phone_number" className="block text-sm font-medium text-gray-900">
              Телефон
            </label>
            <input
              type="tel"
              id="phone_number"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
            />
          </div>

          <div>
            <label htmlFor="specialization_id" className="block text-sm font-medium text-gray-900">
              Специализация
            </label>
            <select
              id="specialization_id"
              name="specialization_id"
              value={formData.specialization_id}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
            >
              <option value="">Выберите специализацию</option>
              {specializations.map(spec => (
                <option key={spec.id} value={spec.id}>
                  {spec.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="experience_years" className="block text-sm font-medium text-gray-900">
              Опыт работы (лет)
            </label>
            <input
              type="number"
              id="experience_years"
              name="experience_years"
              value={formData.experience_years}
              onChange={handleChange}
              min="0"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
            />
          </div>

          <div>
            <label htmlFor="education" className="block text-sm font-medium text-gray-900">
              Образование
            </label>
            <textarea
              id="education"
              name="education"
              value={formData.education}
              onChange={handleChange}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-900">
              Пароль {doctor && '(оставьте пустым, чтобы не менять)'}
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required={!doctor}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
              Активен
            </label>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              disabled={isSubmitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting || loading}
              className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
