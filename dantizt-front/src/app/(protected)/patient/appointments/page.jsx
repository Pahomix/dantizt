'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppointmentsStore } from '@/store/appointmentsStore';
import { usePatientStore } from '@/store/patientStore';
import { 
  CalendarIcon, 
  ClockIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';

const statusColors = {
  scheduled: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  postponed: 'bg-orange-100 text-orange-800',
  no_show: 'bg-gray-100 text-gray-800'
};

const statusNames = {
  scheduled: 'Запланирована',
  in_progress: 'В процессе',
  completed: 'Завершена',
  cancelled: 'Отменена',
  postponed: 'Отложена',
  no_show: 'Неявка'
};

export default function PatientAppointments() {
  const router = useRouter();
  const { appointments, loading: appointmentsLoading, error, fetchPatientAppointments, cancelAppointment } = useAppointmentsStore();
  const { patientProfile, loading: profileLoading, fetchPatientProfile } = usePatientStore();
  
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const profile = await fetchPatientProfile();
        if (profile?.id) {
          await fetchPatientAppointments(profile.id);
        }
      } catch (error) {
        console.error('Error loading appointments:', error);
      }
    };
    loadData();
  }, []);

  const handleCancelAppointment = async (appointmentId) => {
    if (window.confirm('Вы уверены, что хотите отменить запись?')) {
      try {
        await cancelAppointment(appointmentId);
        if (patientProfile?.id) {
          await fetchPatientAppointments(patientProfile.id);
        }
      } catch (error) {
        console.error('Error cancelling appointment:', error);
      }
    }
  };

  const filteredAppointments = appointments
    .filter(appointment => {
      const appointmentDate = new Date(appointment.start_time);
      const now = new Date();
      const isPast = appointmentDate < now;

      return (showPast || !isPast) && 
        (selectedStatus === '' || appointment.status === selectedStatus);
    })
    .sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

  if (appointmentsLoading || profileLoading) {
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

  if (!patientProfile?.id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Профиль пациента не найден</h2>
          <p className="mt-2 text-gray-600">Пожалуйста, обратитесь к администратору</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4 sm:mb-0">
          Мои записи на прием
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
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
            onClick={() => setShowPast(!showPast)}
            className={`w-full sm:w-auto px-4 py-2 rounded-md ${
              showPast ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'
            } hover:bg-opacity-75 transition-colors`}
          >
            {showPast ? 'Скрыть прошедшие' : 'Показать прошедшие'}
          </button>

          <button
            onClick={() => router.push('/patient/appointments/new')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Записаться на прием
          </button>
        </div>
      </div>

      {filteredAppointments.length === 0 ? (
        <div className="text-center py-12">
          <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">Нет записей на прием</h3>
          <p className="mt-1 text-sm text-gray-500">
            Начните с создания новой записи на прием к врачу
          </p>
          <div className="mt-6">
            <button
              onClick={() => router.push('/patient/appointments/new')}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Новая запись
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredAppointments.map((appointment) => (
            <div
              key={appointment.id}
              className="bg-white rounded-lg shadow p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[appointment.status]}`}>
                  {statusNames[appointment.status]}
                </div>
                {appointment.status === 'scheduled' && (
                  <button
                    onClick={() => handleCancelAppointment(appointment.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <XCircleIcon className="h-6 w-6" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center text-gray-600">
                  <CalendarIcon className="h-5 w-5 mr-2" />
                  <span>
                    {new Date(appointment.start_time).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    }) + ' г.'}
                  </span>
                </div>

                <div className="flex items-center text-gray-600">
                  <ClockIcon className="h-5 w-5 mr-2" />
                  <span>
                    {new Date(appointment.start_time).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    {' - '}
                    {new Date(appointment.end_time).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>

                <div className="flex items-center text-gray-600">
                  <UserIcon className="h-5 w-5 mr-2" />
                  <span>
                    {appointment.doctor_name || 'Врач не указан'}
                    {appointment.doctor_specialty && `, ${appointment.doctor_specialty}`}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
