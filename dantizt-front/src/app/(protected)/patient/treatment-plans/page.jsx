'use client';

import { useState, useEffect } from 'react';
import { useTreatmentPlansStore } from '@/store/treatmentPlansStore';
import { usePatientStore } from '@/store/patientStore';
import { 
  ClipboardDocumentCheckIcon,
  CalendarIcon,
  UserIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const statusColors = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
  on_hold: 'bg-yellow-100 text-yellow-800'
};

const statusNames = {
  active: 'Активный',
  completed: 'Завершен',
  cancelled: 'Отменен',
  on_hold: 'Приостановлен'
};

export default function PatientTreatmentPlans() {
  const { treatmentPlans, loading, error, fetchPatientTreatmentPlans } = useTreatmentPlansStore();
  const { patientProfile, fetchPatientProfile } = usePatientStore();
  
  const [expandedPlans, setExpandedPlans] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    const loadData = async () => {
      await fetchPatientProfile();
      if (patientProfile?.id) {
        await fetchPatientTreatmentPlans(patientProfile.id);
      }
    };
    loadData();
  }, []);

  const togglePlanExpansion = (planId) => {
    const newExpanded = new Set(expandedPlans);
    if (newExpanded.has(planId)) {
      newExpanded.delete(planId);
    } else {
      newExpanded.add(planId);
    }
    setExpandedPlans(newExpanded);
  };

  const calculateProgress = (plan) => {
    if (!plan.tasks || plan.tasks.length === 0) return 0;
    const completedTasks = plan.tasks.filter(task => task.status === 'completed').length;
    return Math.round((completedTasks / plan.tasks.length) * 100);
  };

  const filteredPlans = treatmentPlans
    .filter(plan => {
      const matchesSearch = plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          plan.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !selectedStatus || plan.status === selectedStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const dateA = new Date(a.start_date);
      const dateB = new Date(b.start_date);
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
          Мои планы лечения
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="relative">
            <input
              type="text"
              placeholder="Поиск планов..."
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
        {filteredPlans.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardDocumentCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Нет планов лечения</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || selectedStatus ? 'Попробуйте изменить параметры поиска' : 'У вас пока нет планов лечения'}
            </p>
          </div>
        ) : (
          filteredPlans.map((plan) => {
            const progress = calculateProgress(plan);
            
            return (
              <div
                key={plan.id}
                className="bg-white shadow rounded-lg overflow-hidden"
              >
                <div className="px-4 py-5 sm:px-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="mb-4 sm:mb-0">
                      <div className="flex items-center">
                        <ClipboardDocumentCheckIcon className="h-5 w-5 text-gray-400 mr-2" />
                        <h3 className="text-lg font-medium text-gray-900">
                          {plan.name}
                        </h3>
                      </div>
                      <div className="mt-1 flex items-center text-sm text-gray-500">
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        {new Date(plan.start_date).toLocaleDateString('ru-RU', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                        {plan.end_date && (
                          <>
                            <span className="mx-2">—</span>
                            {new Date(plan.end_date).toLocaleDateString('ru-RU', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:items-end">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[plan.status]}`}>
                        {statusNames[plan.status]}
                      </span>
                      <div className="mt-2 flex items-center text-sm text-gray-500">
                        <UserIcon className="h-4 w-4 mr-1" />
                        {plan.doctor_name}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Прогресс</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => togglePlanExpansion(plan.id)}
                    className="mt-4 flex items-center text-sm text-indigo-600 hover:text-indigo-500"
                  >
                    {expandedPlans.has(plan.id) ? (
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

                  {expandedPlans.has(plan.id) && (
                    <div className="mt-4 border-t pt-4">
                      <div className="prose prose-sm max-w-none text-gray-500">
                        <h4 className="text-sm font-medium text-gray-900">Описание</h4>
                        <p>{plan.description}</p>

                        {plan.tasks && plan.tasks.length > 0 && (
                          <>
                            <h4 className="text-sm font-medium text-gray-900 mt-4">Задачи</h4>
                            <ul className="mt-2 space-y-3">
                              {plan.tasks.map((task, index) => (
                                <li
                                  key={task.id}
                                  className="flex items-start"
                                >
                                  <div className={`flex-shrink-0 h-5 w-5 ${
                                    task.status === 'completed'
                                      ? 'text-green-500'
                                      : 'text-gray-400'
                                  }`}>
                                    {task.status === 'completed' ? (
                                      <CheckCircleIcon className="h-5 w-5" />
                                    ) : (
                                      <ClockIcon className="h-5 w-5" />
                                    )}
                                  </div>
                                  <div className="ml-3">
                                    <p className={`text-sm ${
                                      task.status === 'completed'
                                        ? 'text-gray-500 line-through'
                                        : 'text-gray-700'
                                    }`}>
                                      {task.description}
                                    </p>
                                    {task.due_date && (
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        Срок: {new Date(task.due_date).toLocaleDateString('ru-RU')}
                                      </p>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}

                        {plan.notes && (
                          <>
                            <h4 className="text-sm font-medium text-gray-900 mt-4">Заметки</h4>
                            <p>{plan.notes}</p>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
