'use client';

import { useEffect, useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import DiagnosisModal from './DiagnosisModal';

export default function DiagnosesList({ patientId }) {
  const [diagnoses, setDiagnoses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDiagnoses();
  }, [patientId]);

  const fetchDiagnoses = async () => {
    try {
      const response = await fetch(`/api/diagnoses/patient/${patientId}`);
      if (!response.ok) throw new Error('Failed to fetch diagnoses');
      const data = await response.json();
      setDiagnoses(data);
    } catch (error) {
      console.error('Error fetching diagnoses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDiagnosisCreated = async (newDiagnosis) => {
    try {
      const response = await fetch('/api/diagnoses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...newDiagnosis, patientId }),
      });
      
      if (!response.ok) throw new Error('Failed to create diagnosis');
      
      await fetchDiagnoses();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error creating diagnosis:', error);
    }
  };

  if (loading) return <div>Loading diagnoses...</div>;

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h2 className="text-base font-semibold leading-6 text-gray-900">Диагнозы</h2>
          <p className="mt-2 text-sm text-gray-700">
            Список всех диагнозов пациента
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <PlusIcon className="h-5 w-5 inline-block mr-1" />
            Добавить диагноз
          </button>
        </div>
      </div>

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                      Код
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Название
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Статус
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Дата
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Действия</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {diagnoses.map((diagnosis) => (
                    <tr key={diagnosis.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        {diagnosis.code}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {diagnosis.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {diagnosis.status}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {new Date(diagnosis.createdAt).toLocaleDateString()}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button
                          onClick={() => {/* TODO: Implement edit */}}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          Изменить
                        </button>
                        <button
                          onClick={() => {/* TODO: Implement delete */}}
                          className="text-red-600 hover:text-red-900"
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <DiagnosisModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleDiagnosisCreated}
      />
    </div>
  );
}
