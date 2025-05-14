'use client';

import { useState, useEffect, useMemo } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { usePatientStore } from '@/store/patientStore';
import PatientModal from './patient-modal';
import { showSuccess, showError } from '@/utils/notifications';

export default function PatientsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { 
    patients, 
    loading, 
    error, 
    fetchPatients, 
    createPatient,
    updatePatient,
    deletePatient
  } = usePatientStore();

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleCreate = async (patientData) => {
    try {
      const response = await createPatient(patientData);
      if (response) {
        showSuccess('Пациент успешно создан');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error creating patient:', error);
      const errorMessage = error.response?.data?.detail;
      if (Array.isArray(errorMessage)) {
        showError(errorMessage[0]?.msg || 'Ошибка при создании пациента');
      } else {
        showError(errorMessage || 'Ошибка при создании пациента');
      }
      return false;
    }
  };

  const handleEdit = async (patientData) => {
    try {
      const response = await updatePatient(selectedPatient.id, patientData);
      if (response) {
        showSuccess('Пациент успешно обновлен');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating patient:', error);
      const errorMessage = error.response?.data?.detail;
      if (Array.isArray(errorMessage)) {
        showError(errorMessage[0]?.msg || 'Ошибка при обновлении пациента');
      } else {
        showError(errorMessage || 'Ошибка при обновлении пациента');
      }
      return false;
    }
  };

  const handleSavePatient = async (formData) => {
    let result;
    if (selectedPatient) {
      result = await handleEdit(formData);
    } else {
      result = await handleCreate(formData);
    }
    
    if (result) {
      setIsModalOpen(false);
      setSelectedPatient(null);
      await fetchPatients();
    }
    return result;
  };

  const handleDelete = async (patientId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого пациента?')) {
      return;
    }

    try {
      await deletePatient(patientId);
      showSuccess('Пациент успешно удален');
      await fetchPatients();
    } catch (error) {
      showError('Ошибка при удалении пациента');
      console.error('Error deleting patient:', error);
    }
  };

  const filteredPatients = useMemo(() => {
    if (!searchQuery) return patients;
    
    const query = searchQuery.toLowerCase();
    return patients.filter(patient => 
      patient.user.full_name?.toLowerCase().includes(query) ||
      patient.user.email?.toLowerCase().includes(query) ||
      patient.user.phone_number?.toLowerCase().includes(query)
    );
  }, [patients, searchQuery]);

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
            <h3 className="text-sm font-medium text-red-800">Ошибка при загрузке данных</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Пациенты</h1>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => {
              setSelectedPatient(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Добавить пациента
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Поиск по имени, email или телефону..."
          />
        </div>
      </div>

      <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300 table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 w-40">
                ФИО
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-40">
                Email
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-32">
                Телефон
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-28">
                Дата рождения
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-24">
                Пол
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-40">
                Адрес
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-40">
                Противопоказания
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-28">
                ИНН
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-24">
                Статус
              </th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 w-28">
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredPatients.length === 0 ? (
              <tr>
                <td colSpan="9" className="px-6 py-4 text-center text-gray-500">
                  Пациенты не найдены
                </td>
              </tr>
            ) : (
              filteredPatients.map((patient) => (
                <tr key={patient.id}>
                  <td className="whitespace-nowrap py-2 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 truncate">
                    {patient.user.full_name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500 truncate">
                    {patient.user.email}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">
                    {patient.user.phone_number}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">
                    {patient.birth_date ? new Date(patient.birth_date).toLocaleDateString('ru-RU') : 'Не указана'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">
                    {patient.gender === 'male' ? 'Мужской' : patient.gender === 'female' ? 'Женский' : 'Не указан'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500 truncate max-w-xs">
                    {patient.address || 'Не указан'}
                  </td>
                  <td className="whitespace-normal px-3 py-2 text-sm text-gray-500 truncate max-w-xs">
                    {patient.contraindications || 'Нет данных'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">
                    {patient.inn || 'Не указан'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-500">
                    {patient.user.is_active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Активен
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Неактивен
                      </span>
                    )}
                  </td>
                  <td className="relative whitespace-nowrap py-2 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <button
                      onClick={() => {
                        setSelectedPatient(patient);
                        setIsModalOpen(true);
                      }}
                      className="text-indigo-600 hover:text-indigo-900 mr-2"
                      title="Изменить"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(patient.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Удалить"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <PatientModal
          patient={selectedPatient}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedPatient(null);
          }}
          onSave={handleSavePatient}
        />
      )}
    </div>
  );
}
