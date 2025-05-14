'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useSpecializationStore } from '@/store/specializationStore';
import SpecializationModal from './specialization-modal';
import { showSuccess, showError } from '@/utils/notifications';

export default function SpecializationsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSpecialization, setSelectedSpecialization] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { specializations, loading, error, fetchSpecializations, createSpecialization, updateSpecialization, deleteSpecialization } = useSpecializationStore();

  useEffect(() => {
    fetchSpecializations();
  }, [fetchSpecializations]);

  const handleSaveSpecialization = async (formData) => {
    try {
      let result;
      if (selectedSpecialization) {
        result = await updateSpecialization(selectedSpecialization.id, formData);
        if (result) {
          showSuccess('Специализация успешно обновлена');
        }
      } else {
        result = await createSpecialization(formData);
        if (result) {
          showSuccess('Специализация успешно создана');
        }
      }
      
      if (result) {
        setIsModalOpen(false);
        setSelectedSpecialization(null);
        return true;
      }
      return false;
    } catch (error) {
      const errorMessage = error.response?.data?.detail;
      showError(errorMessage || 'Ошибка при сохранении специализации');
      return false;
    }
  };

  const handleDelete = async (specializationId) => {
    if (!confirm('Вы уверены, что хотите удалить эту специализацию?')) {
      return;
    }

    try {
      await deleteSpecialization(specializationId);
      showSuccess('Специализация успешно удалена');
    } catch (error) {
      showError('Ошибка при удалении специализации');
    }
  };

  const filteredSpecializations = specializations.filter(specialization => {
    return specialization.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (specialization.description && specialization.description.toLowerCase().includes(searchQuery.toLowerCase()));
  });

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
            <h3 className="text-sm font-medium text-red-800">Ошибка при загрузке специализаций</h3>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Специализации</h1>
          <p className="mt-2 text-sm text-gray-700">
            Список всех специализаций врачей с возможностью управления
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            onClick={() => {
              setSelectedSpecialization(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Добавить специализацию
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск специализаций..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                      Название
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Описание
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Длительность приема (мин)
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Действия</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredSpecializations.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-4 text-center">
                        Специализации не найдены
                      </td>
                    </tr>
                  ) : (
                    filteredSpecializations.map((specialization) => (
                      <tr key={specialization.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {specialization.name}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {specialization.description || '-'}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-500">
                          {specialization.appointment_duration} мин.
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <button
                            onClick={() => {
                              setSelectedSpecialization(specialization);
                              setIsModalOpen(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(specialization.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="h-5 w-5" />
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

      <SpecializationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSpecialization(null);
        }}
        onSave={handleSaveSpecialization}
        initialData={selectedSpecialization}
      />
    </div>
  );
}
