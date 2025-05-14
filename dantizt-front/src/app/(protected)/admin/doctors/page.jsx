'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useDoctorStore } from '@/store/doctorStore';
import DoctorModal from './doctor-modal';
import { showSuccess, showError } from '@/utils/notifications';

export default function DoctorsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { doctors, loading, error, fetchDoctors, createDoctor, updateDoctor, deleteDoctor } = useDoctorStore();

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const handleSaveDoctor = async (formData) => {
    try {
      let result;
      if (selectedDoctor) {
        // Обновляем существующего врача
        result = await updateDoctor(selectedDoctor.id, formData);
        if (result) {
          showSuccess('Врач успешно обновлен');
        }
      } else {
        // Создаем нового врача
        result = await createDoctor(formData);
        if (result) {
          showSuccess('Врач успешно создан');
        } else {
          // Если result === null, значит врач с таким email уже существует
          showError('Врач с таким email уже существует');
          return false;
        }
      }
      
      if (result) {
        // Закрываем модальное окно только после успешного сохранения
        setIsModalOpen(false);
        setSelectedDoctor(null);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error saving doctor:', error);
      // Получаем текст ошибки из ответа API
      const errorMessage = error.response?.data?.detail;
      if (Array.isArray(errorMessage)) {
        // Если это массив ошибок валидации, берем первую
        showError(errorMessage[0]?.msg || 'Ошибка при сохранении врача');
      } else {
        showError(errorMessage || 'Ошибка при сохранении врача');
      }
      // НЕ закрываем модальное окно при ошибке
      return false;
    }
  };

  const handleDelete = async (doctorId) => {
    if (!confirm('Вы уверены, что хотите удалить этого врача?')) {
      return;
    }

    try {
      await deleteDoctor(doctorId);
      showSuccess('Врач успешно удален');
    } catch (error) {
      showError('Ошибка при удалении врача');
      console.error('Error deleting doctor:', error);
    }
  };

  const filteredDoctors = searchQuery
    ? doctors.filter(doctor =>
        doctor.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.specialization?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : doctors;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{error}</h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900">Врачи</h1>
          <p className="mt-2 text-sm text-gray-700">
            Список всех врачей клиники
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            onClick={() => {
              setSelectedDoctor(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Добавить врача
          </button>
        </div>
      </div>

      {/* Поиск */}
      <div className="mt-4">
        <div className="relative rounded-md shadow-sm max-w-xs">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск..."
            className="block w-full rounded-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
          />
        </div>
      </div>

      <div className="mt-8 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                      ФИО
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Email
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Телефон
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Специализация
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Опыт работы
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Образование
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Действия</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredDoctors.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-4 text-gray-500">
                        {searchQuery ? 'Врачи не найдены' : 'Нет врачей'}
                      </td>
                    </tr>
                  ) : (
                    filteredDoctors.map((doctor) => (
                      <tr key={doctor.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                          <div className="flex items-center">
                            {doctor.user?.avatar && (
                              <div className="h-10 w-10 flex-shrink-0">
                                <img className="h-10 w-10 rounded-full" src={doctor.user.avatar} alt="" />
                              </div>
                            )}
                            <div className={doctor.user?.avatar ? "ml-4" : ""}>
                              <div className="font-medium text-gray-900">{doctor.user?.full_name || 'Имя не указано'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {doctor.user?.email || 'Не указан'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {doctor.user?.phone || 'Не указан'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {doctor.specialization?.name || 'Не указана'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {doctor.experience_years ? `${doctor.experience_years} лет` : 'Не указан'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {doctor.education || 'Не указано'}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <button
                            onClick={() => {
                              setSelectedDoctor(doctor);
                              setIsModalOpen(true);
                            }}
                            className="inline-flex items-center px-3 py-1.5 text-indigo-600 hover:text-indigo-900 mr-2"
                          >
                            <PencilIcon className="h-4 w-4 mr-1" />
                          </button>
                          <button
                            onClick={() => handleDelete(doctor.id)}
                            className="inline-flex items-center px-3 py-1.5 text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="h-4 w-4 mr-1" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <DoctorModal
          doctor={selectedDoctor}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDoctor(null);
          }}
          onSave={handleSaveDoctor}
        />
      )}
    </div>
  );
}
