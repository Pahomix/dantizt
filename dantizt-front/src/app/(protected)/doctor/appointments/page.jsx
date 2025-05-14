'use client';

import { useState, useEffect } from 'react';
import { useDoctorAppointmentsStore } from '@/store/doctorAppointmentsStore';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import Link from 'next/link';
import {
  CalendarIcon,
  ClockIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';

const statusColors = {
  scheduled: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  postponed: 'bg-purple-100 text-purple-800',
  no_show: 'bg-gray-100 text-gray-800'
};

const statusTranslations = {
  scheduled: 'Запланирован',
  in_progress: 'В процессе',
  completed: 'Завершен',
  cancelled: 'Отменен',
  postponed: 'Отложен',
  no_show: 'Неявка'
};

export default function DoctorAppointments() {
  const { appointments, loading, error, fetchAppointments, updateAppointmentStatus, addAppointmentNote } = useDoctorAppointmentsStore();
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    const filters = {
      status: selectedStatus || undefined,
      from_date: selectedDate,
      to_date: selectedDate
    };
    fetchAppointments(filters);
  }, [selectedStatus, selectedDate]);

  const handleStatusChange = async (appointmentId, newStatus) => {
    await updateAppointmentStatus(appointmentId, newStatus);
  };

  const handleNoteSubmit = async (appointmentId) => {
    await addAppointmentNote(appointmentId, noteText);
    setEditingNote(null);
    setNoteText('');
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
          <ExclamationCircleIcon className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-2 text-xl font-semibold text-red-600">Ошибка загрузки данных</h2>
          <p className="mt-2 text-gray-600">{typeof error === 'string' ? error : 'Произошла ошибка при загрузке приемов'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Мои приемы</h1>
        
        <div className="flex space-x-4">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">Все статусы</option>
            {Object.entries(statusTranslations).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <input
            type="date"
            value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
            onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : null)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {appointments.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-gray-500">Нет приемов для отображения</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {appointments.map((appointment) => (
              <li key={appointment.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <UserIcon className="h-5 w-5 text-gray-400" />
                        <Link 
                          href={`/doctor/appointments/${appointment.id}`}
                          className="text-lg font-medium text-blue-600 hover:text-blue-800"
                        >
                          {appointment.patient_name}
                        </Link>
                      </div>

                      <div className="flex items-center space-x-2">
                        <CalendarIcon className="h-5 w-5 text-gray-400" />
                        <span className="text-sm text-gray-500">
                          {format(new Date(appointment.start_time), 'dd MMMM yyyy', { locale: ru })}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <ClockIcon className="h-5 w-5 text-gray-400" />
                        <span className="text-sm text-gray-500">
                          {format(new Date(appointment.start_time), 'HH:mm')}
                        </span>
                      </div>

                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[appointment.status]}`}>
                        {statusTranslations[appointment.status]}
                      </span>
                    </div>

                    <div className="mt-4">
                      {editingNote === appointment.id ? (
                        <div className="flex items-center space-x-2">
                          <textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            rows={2}
                            placeholder="Введите заметку..."
                          />
                          <button
                            onClick={() => handleNoteSubmit(appointment.id)}
                            className="px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                          >
                            Сохранить
                          </button>
                          <button
                            onClick={() => {
                              setEditingNote(null);
                              setNoteText('');
                            }}
                            className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                          >
                            Отмена
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <p>{appointment.notes || 'Нет заметок'}</p>
                          <button
                            onClick={() => {
                              setEditingNote(appointment.id);
                              setNoteText(appointment.notes || '');
                            }}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="ml-4">
                    <select
                      value={appointment.status}
                      onChange={(e) => handleStatusChange(appointment.id, e.target.value)}
                      className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    >
                      {Object.entries(statusTranslations).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
