'use client';

import { useState, useEffect } from 'react';
import { useDoctorStore } from '@/store/doctorStore';
import { UserIcon, AcademicCapIcon, ClockIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

export default function DoctorProfile() {
  const { doctorProfile, loading, error, fetchDoctorProfile, updateDoctorProfile } = useDoctorStore();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    phone_number: '',
    specialization_id: '',
    experience_years: '',
    education: '',
    bio: ''
  });

  useEffect(() => {
    fetchDoctorProfile();
  }, []);

  useEffect(() => {
    if (doctorProfile) {
      setFormData({
        email: doctorProfile.user?.email || '',
        full_name: doctorProfile.user?.full_name || '',
        phone_number: doctorProfile.user?.phone_number || '',
        specialization_id: doctorProfile.specialization?.id || '',
        experience_years: doctorProfile.experience_years || '',
        education: doctorProfile.education || '',
        bio: doctorProfile.bio || ''
      });
    }
  }, [doctorProfile]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateDoctorProfile(formData);
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

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600">Ошибка</h2>
          <p className="mt-2 text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Мой профиль</h1>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          {isEditing ? 'Отменить' : 'Редактировать'}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        {isEditing ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">ФИО</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Телефон</label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Стаж (лет)</label>
                <input
                  type="number"
                  name="experience_years"
                  value={formData.experience_years}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Образование</label>
              <textarea
                name="education"
                value={formData.education}
                onChange={handleInputChange}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">О себе</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                rows={4}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Сохранить
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="flex items-center space-x-3">
                <UserIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-500">ФИО</p>
                  <p className="text-base text-gray-900">{doctorProfile?.user?.full_name || 'Не указано'}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <AcademicCapIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Специализация</p>
                  <p className="text-base text-gray-900">{doctorProfile?.specialization?.name || 'Не указано'}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <ClockIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Стаж</p>
                  <p className="text-base text-gray-900">
                    {doctorProfile?.experience_years 
                      ? `${doctorProfile.experience_years} ${
                          doctorProfile.experience_years === 1 ? 'год' : 
                          doctorProfile.experience_years < 5 ? 'года' : 'лет'
                        }`
                      : 'Не указано'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Образование</p>
                  <p className="text-base text-gray-900">{doctorProfile?.education || 'Не указано'}</p>
                </div>
              </div>
            </div>

            {doctorProfile?.bio && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">О себе</h3>
                <p className="text-gray-700 whitespace-pre-line">{doctorProfile.bio}</p>
              </div>
            )}

            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Контактная информация</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="text-base text-gray-900">{doctorProfile?.user?.email || 'Не указано'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Телефон</p>
                  <p className="text-base text-gray-900">{doctorProfile?.user?.phone_number || 'Не указано'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
