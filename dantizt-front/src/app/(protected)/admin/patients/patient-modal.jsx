'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/axios';

export default function PatientModal({ patient, onClose, onSave }) {
  const [formData, setFormData] = useState({
    email: patient?.user?.email || '',
    full_name: patient?.user?.full_name || '',
    phone_number: patient?.user?.phone_number || '',
    birth_date: patient?.birth_date || '',
    gender: patient?.gender || '',
    address: patient?.address || '',
    contraindications: patient?.contraindications || '',
    inn: patient?.inn || '',
    password: '',
    is_active: patient?.user?.is_active ?? true
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        email: formData.email.trim() || null,
        full_name: formData.full_name.trim() || null,
        phone_number: formData.phone_number.trim() || null,
        birth_date: formData.birth_date ? formData.birth_date.trim() || null : null,
        gender: formData.gender ? formData.gender.trim() || null : null,
        address: formData.address ? formData.address.trim() || null : null,
        contraindications: formData.contraindications ? formData.contraindications.trim() || null : null,
        inn: formData.inn ? formData.inn.trim() || null : null,
        is_active: formData.is_active,
        ...(formData.password && formData.password.trim() ? { password: formData.password.trim() } : {})
      };
      
      // Удаляем все null значения, чтобы не отправлять их на сервер
      Object.keys(processedData).forEach(key => {
        if (processedData[key] === null) {
          delete processedData[key];
        }
      });
      
      const result = await onSave(processedData);
      
      if (result) {
        onClose();
      }
    } catch (error) {
      console.error('Error saving patient:', error);
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
            {patient ? 'Редактировать пациента' : 'Добавить пациента'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <span className="sr-only">Закрыть</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
              ФИО
            </label>
            <input
              type="text"
              id="full_name"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
              Телефон
            </label>
            <input
              type="text"
              id="phone_number"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="birth_date" className="block text-sm font-medium text-gray-700">
              Дата рождения
            </label>
            <input
              type="date"
              id="birth_date"
              name="birth_date"
              value={formData.birth_date}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
              Пол
            </label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Выберите пол</option>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
            </select>
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
              Адрес
            </label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="contraindications" className="block text-sm font-medium text-gray-700">
              Противопоказания
            </label>
            <textarea
              id="contraindications"
              name="contraindications"
              value={formData.contraindications}
              onChange={handleChange}
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Укажите любые противопоказания или особенности здоровья"
            />
          </div>

          <div>
            <label htmlFor="inn" className="block text-sm font-medium text-gray-700">
              ИНН
            </label>
            <input
              type="text"
              id="inn"
              name="inn"
              value={formData.inn}
              onChange={handleChange}
              maxLength={12}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="123456789012"
            />
            <p className="mt-1 text-xs text-gray-500">
              ИНН необходим для налогового вычета
            </p>
          </div>

          {!patient && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Пароль
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                {...(!patient && { required: true })}
              />
            </div>
          )}

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

          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="mt-5 sm:mt-6">
            <button
              type="submit"
              disabled={loading || isSubmitting}
              className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
