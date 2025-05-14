'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePatientStore } from '@/store/patientStore';
import { UserIcon, PhoneIcon, MapPinIcon, IdentificationIcon, CalendarIcon } from '@heroicons/react/24/outline';

export default function PatientProfile() {
  const router = useRouter();
  const { patientProfile, loading, error, fetchPatientProfile, updatePatientProfile, clearError } = usePatientStore();
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    birth_date: '',
    gender: '',
    address: '',
    contraindications: '',
    inn: ''
  });

  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchPatientProfile();
  }, []);

  useEffect(() => {
    if (patientProfile) {
      setFormData({
        full_name: patientProfile.user?.full_name || '',
        phone_number: patientProfile.user?.phone_number || '',
        birth_date: patientProfile.birth_date || '',
        gender: patientProfile.gender || '',
        address: patientProfile.address || '',
        contraindications: patientProfile.contraindications || '',
        inn: patientProfile.inn || ''
      });
    }
  }, [patientProfile]);

  // Форматирование телефонного номера
  const formatPhoneNumber = (value) => {
    if (!value) return value;
    
    // Удаляем все нецифровые символы
    const phoneNumber = value.replace(/[^\d]/g, '');
    
    // Форматируем номер телефона
    if (phoneNumber.length <= 1) {
      return phoneNumber === '7' ? '+7' : phoneNumber === '8' ? '+7' : `+7${phoneNumber}`;
    }
    if (phoneNumber.length <= 4) {
      return `+7 (${phoneNumber.slice(1)}`;
    }
    if (phoneNumber.length <= 7) {
      return `+7 (${phoneNumber.slice(1, 4)}) ${phoneNumber.slice(4)}`;
    }
    if (phoneNumber.length <= 9) {
      return `+7 (${phoneNumber.slice(1, 4)}) ${phoneNumber.slice(4, 7)}-${phoneNumber.slice(7)}`;
    }
    return `+7 (${phoneNumber.slice(1, 4)}) ${phoneNumber.slice(4, 7)}-${phoneNumber.slice(7, 9)}-${phoneNumber.slice(9, 11)}`;
  };

  // Форматирование ИНН
  const formatInn = (value) => {
    if (!value) return value;
    
    // Удаляем все нецифровые символы
    return value.replace(/[^\d]/g, '').slice(0, 12);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'phone_number') {
      setFormData(prev => ({
        ...prev,
        [name]: formatPhoneNumber(value)
      }));
    } else if (name === 'inn') {
      setFormData(prev => ({
        ...prev,
        [name]: formatInn(value)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Очищаем телефон от форматирования перед отправкой
      const cleanPhone = formData.phone_number ? formData.phone_number.replace(/[^\d+]/g, '') : '';
      
      const updatedData = {
        ...formData,
        phone_number: cleanPhone
      };
      
      // Обновляем профиль и получаем обновленные данные
      const updatedProfile = await updatePatientProfile(updatedData);
      
      // Обновляем локальное состояние формы с новыми данными
      setFormData({
        full_name: updatedProfile.user?.full_name || '',
        phone_number: updatedProfile.user?.phone_number || '',
        birth_date: updatedProfile.birth_date || '',
        gender: updatedProfile.gender || '',
        address: updatedProfile.address || '',
        contraindications: updatedProfile.contraindications || '',
        inn: updatedProfile.inn || ''
      });
      
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Мой профиль</h2>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {isEditing ? 'Отменить' : 'Редактировать'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={clearError}
            className="mt-2 text-sm text-red-600 hover:text-red-500"
          >
            Закрыть
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
              ФИО
            </label>
            <div className="mt-1 relative">
              <input
                type="text"
                name="full_name"
                id="full_name"
                value={formData.full_name}
                onChange={handleChange}
                disabled={!isEditing}
                className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
              />
              <UserIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>

          <div>
            <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700">
              Телефон
            </label>
            <div className="mt-1 relative">
              <input
                type="tel"
                name="phone_number"
                id="phone_number"
                value={formData.phone_number}
                onChange={handleChange}
                disabled={!isEditing}
                className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                placeholder="+7 (999) 123-45-67"
              />
              <PhoneIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>

          <div>
            <label htmlFor="birth_date" className="block text-sm font-medium text-gray-700">
              Дата рождения
            </label>
            <div className="mt-1 relative">
              <input
                type="date"
                name="birth_date"
                id="birth_date"
                value={formData.birth_date}
                onChange={handleChange}
                disabled={!isEditing}
                className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
              />
              <CalendarIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>

          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
              Пол
            </label>
            <select
              name="gender"
              id="gender"
              value={formData.gender}
              onChange={handleChange}
              disabled={!isEditing}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
            >
              <option value="">Не указано</option>
              <option value="male">Мужской</option>
              <option value="female">Женский</option>
            </select>
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
              Адрес
            </label>
            <div className="mt-1 relative">
              <input
                type="text"
                name="address"
                id="address"
                value={formData.address}
                onChange={handleChange}
                disabled={!isEditing}
                className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                placeholder="г. Москва, ул. Примерная, д. 1, кв. 1"
              />
              <MapPinIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>

          <div>
            <label htmlFor="inn" className="block text-sm font-medium text-gray-700">
              ИНН
            </label>
            <div className="mt-1 relative">
              <input
                type="text"
                name="inn"
                id="inn"
                value={formData.inn}
                onChange={handleChange}
                disabled={!isEditing}
                maxLength={12}
                className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
                placeholder="123456789012"
              />
              <IdentificationIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            {isEditing && (
              <p className="mt-1 text-xs text-gray-500">
                ИНН необходим для налогового вычета
              </p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="contraindications" className="block text-sm font-medium text-gray-700">
            Противопоказания
          </label>
          <textarea
            name="contraindications"
            id="contraindications"
            rows={4}
            value={formData.contraindications}
            onChange={handleChange}
            disabled={!isEditing}
            placeholder="Укажите любые противопоказания или особенности здоровья"
            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
          />
        </div>

        {isEditing && (
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Сохранить
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
