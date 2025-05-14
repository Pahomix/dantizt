'use client';

import { useState, useEffect } from 'react';
import { useDiagnosesStore } from '@/store/diagnosesStore';
import { usePatientStore } from '@/store/patientStore';
import { 
  HeartIcon,
  ClockIcon,
  UserIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

const statusColors = {
  active: 'bg-green-100 text-green-800',
  resolved: 'bg-blue-100 text-blue-800',
  chronic: 'bg-yellow-100 text-yellow-800',
  monitoring: 'bg-purple-100 text-purple-800'
};

const statusNames = {
  active: 'Активный',
  resolved: 'Разрешенный',
  chronic: 'Хронический',
  monitoring: 'Под наблюдением'
};

export default function PatientDiagnoses() {
  const { diagnoses, loading, error, fetchPatientDiagnoses } = useDiagnosesStore();
  const { patientProfile, fetchPatientProfile } = usePatientStore();
  
  const [expandedDiagnoses, setExpandedDiagnoses] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    const loadData = async () => {
      await fetchPatientProfile();
      if (patientProfile?.id) {
        await fetchPatientDiagnoses(patientProfile.id);
      }
    };
    loadData();
  }, []);

  const toggleDiagnosisExpansion = (diagnosisId) => {
    const newExpanded = new Set(expandedDiagnoses);
    if (newExpanded.has(diagnosisId)) {
      newExpanded.delete(diagnosisId);
    } else {
      newExpanded.add(diagnosisId);
    }
    setExpandedDiagnoses(newExpanded);
  };

  const filteredDiagnoses = diagnoses
    .filter(diagnosis => {
      const matchesSearch = diagnosis.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          diagnosis.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !selectedStatus || diagnosis.status === selectedStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const dateA = new Date(a.diagnosed_date);
      const dateB = new Date(b.diagnosed_date);
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4 sm:mb-0">
          Мои диагнозы
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="relative">
            <input
              type="text"
              placeholder="Поиск диагнозов..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Все статусы</option>
            {Object.entries(statusNames).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
          >
            <CalendarIcon className="h-5 w-5 text-gray-500" />
            {sortOrder === 'desc' ? 'Сначала новые' : 'Сначала старые'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {filteredDiagnoses.length === 0 ? (
          <div className="text-center py-12">
            <HeartIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Нет диагнозов</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || selectedStatus ? 'Попробуйте изменить параметры поиска' : 'У вас пока нет диагнозов'}
            </p>
          </div>
        ) : (
          filteredDiagnoses.map((diagnosis) => (
            <div
              key={diagnosis.id}
              className="bg-white shadow rounded-lg overflow-hidden"
            >
              <div className="px-4 py-5 sm:px-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div className="mb-4 sm:mb-0">
                    <div className="flex items-center">
                      <HeartIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <h3 className="text-lg font-medium text-gray-900">
                        {diagnosis.name}
                      </h3>
                    </div>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      {new Date(diagnosis.diagnosed_date).toLocaleDateString('ru-RU', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[diagnosis.status]}`}>
                      {statusNames[diagnosis.status]}
                    </span>
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <UserIcon className="h-4 w-4 mr-1" />
                      {diagnosis.doctor_name}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => toggleDiagnosisExpansion(diagnosis.id)}
                  className="mt-4 flex items-center text-sm text-indigo-600 hover:text-indigo-500"
                >
                  {expandedDiagnoses.has(diagnosis.id) ? (
                    <>
                      <ChevronUpIcon className="h-5 w-5 mr-1" />
                      Скрыть подробности
                    </>
                  ) : (
                    <>
                      <ChevronDownIcon className="h-5 w-5 mr-1" />
                      Показать подробности
                    </>
                  )}
                </button>

                {expandedDiagnoses.has(diagnosis.id) && (
                  <div className="mt-4 border-t pt-4">
                    <div className="prose prose-sm max-w-none text-gray-500">
                      <h4 className="text-sm font-medium text-gray-900">Описание</h4>
                      <p>{diagnosis.description}</p>
                      
                      {diagnosis.symptoms && (
                        <>
                          <h4 className="text-sm font-medium text-gray-900 mt-4">Симптомы</h4>
                          <p>{diagnosis.symptoms}</p>
                        </>
                      )}
                      
                      {diagnosis.treatment_plan && (
                        <>
                          <h4 className="text-sm font-medium text-gray-900 mt-4">План лечения</h4>
                          <p>{diagnosis.treatment_plan}</p>
                        </>
                      )}

                      {diagnosis.notes && (
                        <>
                          <h4 className="text-sm font-medium text-gray-900 mt-4">Заметки</h4>
                          <p>{diagnosis.notes}</p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
