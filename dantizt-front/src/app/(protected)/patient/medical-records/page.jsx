'use client';

import { useState, useEffect } from 'react';
import { useMedicalRecordsStore } from '@/store/medicalRecordsStore';
import { usePatientStore } from '@/store/patientStore';
import { usePathname } from 'next/navigation';
import { 
  DocumentTextIcon, 
  ClipboardDocumentListIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';

const recordTypeColors = {
  examination: 'bg-blue-100 text-blue-800',
  procedure: 'bg-green-100 text-green-800',
  prescription: 'bg-purple-100 text-purple-800',
  xray: 'bg-yellow-100 text-yellow-800',
  note: 'bg-gray-100 text-gray-800',
  lab_result: 'bg-pink-100 text-pink-800',
  diagnosis: 'bg-orange-100 text-orange-800',
  treatment: 'bg-teal-100 text-teal-800'
};

const recordTypeNames = {
  examination: 'Осмотр',
  procedure: 'Процедура',
  prescription: 'Рецепт',
  xray: 'Рентген',
  note: 'Заметка',
  lab_result: 'Результат анализов',
  diagnosis: 'Диагноз',
  treatment: 'План лечения'
};

const statusColors = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800'
};

const statusNames = {
  active: 'Активный',
  completed: 'Завершен',
  cancelled: 'Отменен',
  pending: 'Ожидает'
};

export default function PatientMedicalRecords() {
  const { records, loading, error, fetchPatientRecords } = useMedicalRecordsStore();
  const { patientProfile, fetchPatientProfile } = usePatientStore();
  const pathname = usePathname();
  
  const [expandedRecords, setExpandedRecords] = useState(new Set());
  const [expandedAppointments, setExpandedAppointments] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetchPatientProfile();
  }, [pathname]);

  useEffect(() => {
    if (patientProfile?.id) {
      fetchPatientRecords(patientProfile.id);
    }
  }, [patientProfile?.id]);

  const toggleRecordExpansion = (recordId) => {
    const newExpanded = new Set(expandedRecords);
    if (newExpanded.has(recordId)) {
      newExpanded.delete(recordId);
    } else {
      newExpanded.add(recordId);
    }
    setExpandedRecords(newExpanded);
  };

  const toggleAppointmentExpansion = (appointmentId) => {
    const newExpanded = new Set(expandedAppointments);
    if (newExpanded.has(appointmentId)) {
      newExpanded.delete(appointmentId);
    } else {
      newExpanded.add(appointmentId);
    }
    setExpandedAppointments(newExpanded);
  };

  // Фильтруем записи
  const filteredRecords = records
    .filter(record => {
      const matchesSearch = searchTerm === '' || 
        record.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (record.content && record.content.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesType = selectedType === '' || record.record_type === selectedType;
      
      return matchesSearch && matchesType;
    });

  // Группируем записи по приемам
  const recordsByAppointment = filteredRecords.reduce((acc, record) => {
    const appointmentId = record.appointment_id || 'no-appointment';
    if (!acc[appointmentId]) {
      acc[appointmentId] = [];
    }
    acc[appointmentId].push(record);
    return acc;
  }, {});

  // Сортируем группы по дате (берем дату первой записи в группе)
  const sortedAppointments = Object.entries(recordsByAppointment)
    .map(([appointmentId, appointmentRecords]) => {
      // Сортируем записи внутри приема
      const sortedRecords = [...appointmentRecords].sort((a, b) => {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
      
      return {
        appointmentId,
        records: sortedRecords,
        date: sortedRecords[0]?.created_at || ''
      };
    })
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
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
          Медицинские записи
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="relative">
            <input
              type="text"
              placeholder="Поиск записей..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
            <MagnifyingGlassIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Все типы</option>
            {Object.entries(recordTypeNames).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
          >
            <span>Дата</span>
            {sortOrder === 'desc' ? (
              <ChevronDownIcon className="h-5 w-5" />
            ) : (
              <ChevronUpIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {sortedAppointments.length === 0 ? (
          <div className="bg-white overflow-hidden shadow rounded-lg p-6">
            <p className="text-gray-500 text-center">Медицинских записей не найдено</p>
          </div>
        ) : (
          sortedAppointments.map(({ appointmentId, records, date }) => (
            <div key={appointmentId} className="bg-white overflow-hidden shadow rounded-lg">
              <div 
                onClick={() => toggleAppointmentExpansion(appointmentId)}
                className="px-4 py-4 sm:px-6 cursor-pointer hover:bg-gray-50 border-b border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      Прием {new Date(date).toLocaleDateString()}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {records.length} {records.length === 1 ? 'запись' : 
                        records.length < 5 ? 'записи' : 'записей'}
                    </p>
                  </div>
                  {expandedAppointments.has(appointmentId) ? (
                    <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </div>

              {expandedAppointments.has(appointmentId) && (
                <div className="divide-y divide-gray-200">
                  {records.map(record => (
                    <div key={record.id} className="bg-white overflow-hidden">
                      <div 
                        onClick={() => toggleRecordExpansion(record.id)}
                        className="px-4 py-5 sm:px-6 cursor-pointer hover:bg-gray-50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <DocumentTextIcon className="h-6 w-6 text-gray-400" />
                            <div>
                              <h3 className="text-lg font-medium text-gray-900">
                                {record.title}
                              </h3>
                              <div className="flex items-center mt-1 space-x-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${recordTypeColors[record.record_type]}`}>
                                  {recordTypeNames[record.record_type] || record.record_type}
                                </span>
                                {record.status && record.status !== 'active' && (
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[record.status] || 'bg-gray-100 text-gray-800'}`}>
                                    {statusNames[record.status] || record.status}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {expandedRecords.has(record.id) ? (
                            <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {expandedRecords.has(record.id) && (
                        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
                          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                            <div>
                              <dt className="text-sm font-medium text-gray-500">Описание</dt>
                              <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                                {record.content}
                              </dd>
                            </div>

                            {record.tooth_positions && (
                              <div>
                                <dt className="text-sm font-medium text-gray-500">Зубы</dt>
                                <dd className="mt-1 text-sm text-gray-900">
                                  {Array.isArray(record.tooth_positions) 
                                    ? record.tooth_positions.join(', ')
                                    : record.tooth_positions}
                                </dd>
                              </div>
                            )}

                            {record.notes && (
                              <div className="sm:col-span-2">
                                <dt className="text-sm font-medium text-gray-500">Заметки</dt>
                                <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                                  {record.notes}
                                </dd>
                              </div>
                            )}

                            {record.attachments && record.attachments.length > 0 && (
                              <div className="sm:col-span-2">
                                <dt className="text-sm font-medium text-gray-500">Прикрепленные файлы</dt>
                                <dd className="mt-1 text-sm text-gray-900">
                                  <ul className="divide-y divide-gray-200">
                                    {record.attachments.map((attachment, index) => (
                                      <li key={index} className="py-2">
                                        <a
                                          href={attachment.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-indigo-600 hover:text-indigo-500"
                                        >
                                          {attachment.name || `Файл ${index + 1}`}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                </dd>
                              </div>
                            )}
                          </dl>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
