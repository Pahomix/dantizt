'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  CalendarIcon,
  ClockIcon,
  UserIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useAppointmentDetailsStore } from '@/store/appointmentDetailsStore';

export default function AppointmentDetails() {
  const { id } = useParams();
  const router = useRouter();
  const { 
    appointment, 
    loading, 
    error, 
    fetchAppointment,
    updateAppointmentStatus,
    addAppointmentNote,
    clearAppointment 
  } = useAppointmentDetailsStore();

  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    fetchAppointment(id);
    return () => clearAppointment();
  }, [id]);

  useEffect(() => {
    if (appointment?.notes) {
      setNoteText(appointment.notes);
    }
  }, [appointment?.notes]);

  const handleStatusChange = async (newStatus) => {
    try {
      await updateAppointmentStatus(id, newStatus);
      setIsEditingStatus(false);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleSaveNote = async () => {
    try {
      await addAppointmentNote(id, noteText);
      setIsEditingNote(false);
    } catch (error) {
      console.error('Failed to save note:', error);
    }
  };

  const handleStartConsultation = async () => {
    try {
      await updateAppointmentStatus(id, 'in_progress');
      router.push(`/doctor/appointments/${id}/consultation`);
    } catch (error) {
      console.error('Failed to start consultation:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-gray-500">Прием не найден</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Детали приема</h1>
          {appointment.status === 'scheduled' && (
            <button
              onClick={() => setShowConfirmation(true)}
              className="
                inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md
                hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                transition-colors duration-200 font-semibold text-sm
              "
            >
              <ClockIcon className="h-5 w-5 mr-2" />
              Начать прием
            </button>
          )}
          {appointment.status === 'in_progress' && (
            <button
              onClick={() => router.push(`/doctor/appointments/${id}/consultation`)}
              className="
                inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-md
                hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2
                transition-colors duration-200 font-semibold text-sm
              "
            >
              <ClockIcon className="h-5 w-5 mr-2" />
              Продолжить прием
            </button>
          )}
        </div>
      
        <div className="bg-white shadow-sm rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div>
                <div className="flex items-center space-x-2">
                  <UserIcon className="h-5 w-5 text-gray-500" />
                  <span className="font-semibold text-gray-900">Пациент:</span>
                </div>
                <p className="text-gray-800">{appointment.patient_name}</p>
              </div>
              
              <div>
                <div className="flex items-center space-x-2">
                  <UserIcon className="h-5 w-5 text-gray-500" />
                  <span className="font-semibold text-gray-900">Врач:</span>
                </div>
                <p className="text-gray-800">
                  {appointment.doctor_name} {appointment.doctor_specialty && `(${appointment.doctor_specialty})`}
                </p>
              </div>
              
              <div>
                <div className="flex items-center space-x-2">
                  <CalendarIcon className="h-5 w-5 text-gray-500" />
                  <span className="font-semibold text-gray-900">Дата:</span>
                </div>
                <p className="text-gray-800">
                  {format(new Date(appointment.start_time), 'd MMMM yyyy', { locale: ru })}
                </p>
              </div>
              
              <div>
                <div className="flex items-center space-x-2">
                  <ClockIcon className="h-5 w-5 text-gray-500" />
                  <span className="font-semibold text-gray-900">Время:</span>
                </div>
                <p className="text-gray-800">
                  {format(new Date(appointment.start_time), 'HH:mm', { locale: ru })} - {format(new Date(appointment.end_time), 'HH:mm', { locale: ru })}
                </p>
              </div>
              
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-gray-900">Статус:</span>
                  {!isEditingStatus && (
                    <button
                      onClick={() => setIsEditingStatus(true)}
                      className="text-blue-600 hover:text-blue-700 focus:outline-none"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {isEditingStatus ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(statusLabels).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => handleStatusChange(key)}
                          className={`px-3 py-1 text-sm font-medium rounded-md ${
                            key === appointment.status
                              ? statusColors[key]
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => setIsEditingStatus(false)}
                        className="px-3 py-1 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${statusColors[appointment.status] || ''}`}>
                    {statusLabels[appointment.status] || appointment.status}
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-6">
              {/* Проведенные услуги */}
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="font-semibold text-gray-900">Проведенные услуги:</span>
                </div>
                {appointment.services && appointment.services.length > 0 ? (
                  <div className="space-y-2">
                    {appointment.services.map((service) => (
                      <div key={service.id} className="bg-gray-50 p-3 rounded-md">
                        <div className="flex justify-between">
                          <span className="text-gray-800">{service.name}</span>
                          <span className="font-medium text-gray-900">{service.price} ₽</span>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t border-gray-200 mt-2">
                      <span className="font-medium text-gray-900">Итого:</span>
                      <span className="font-bold text-gray-900">
                        {appointment.services.reduce((sum, service) => sum + (parseFloat(service.price) || 0), 0).toLocaleString('ru-RU')} ₽
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">Нет проведенных услуг</p>
                )}
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">Заметки:</span>
                  {!isEditingNote && (
                    <button
                      onClick={() => setIsEditingNote(true)}
                      className="text-blue-600 hover:text-blue-700 focus:outline-none"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {isEditingNote ? (
                  <div className="space-y-2">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
                      rows={4}
                    />
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setIsEditingNote(false)}
                        className="px-3 py-1 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none"
                      >
                        Отмена
                      </button>
                      <button
                        onClick={handleSaveNote}
                        className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        Сохранить
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-800 whitespace-pre-wrap">{appointment.notes || 'Нет заметок'}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Модальное окно подтверждения начала приема */}
        {showConfirmation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Подтверждение начала приема
              </h3>
              <p className="text-gray-700 mb-6">
                Вы уверены, что хотите начать прием пациента {appointment.patient_name}?
                Статус приема будет изменен на "В процессе".
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    setShowConfirmation(false);
                    handleStartConsultation();
                  }}
                  className="
                    px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md
                    hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  "
                >
                  Начать прием
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const statusColors = {
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  postponed: 'bg-purple-100 text-purple-800',
  no_show: 'bg-gray-100 text-gray-800'
};

const statusLabels = {
  scheduled: 'Запланирован',
  in_progress: 'В процессе',
  completed: 'Завершен',
  cancelled: 'Отменен',
  postponed: 'Отложен',
  no_show: 'Неявка'
};
