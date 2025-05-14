'use client';

import { useState, useEffect, useMemo } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useAppointmentStore } from '@/store/appointmentStore';
import AppointmentModal from './appointment-modal';
import { showSuccess, showError } from '@/utils/notifications';
import { format } from 'date-fns';

export default function AppointmentsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { 
    appointments, 
    loading, 
    error, 
    fetchAppointments, 
    createAppointment,
    updateAppointment,
    deleteAppointment,
    updateAppointmentStatus
  } = useAppointmentStore();

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleCreate = async (appointmentData) => {
    try {
      const response = await createAppointment(appointmentData);
      if (response) {
        showSuccess('Запись успешно создана');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error creating appointment:', error);
      const errorMessage = error.response?.data?.detail;
      if (Array.isArray(errorMessage)) {
        showError(errorMessage[0]?.msg || 'Ошибка при создании записи');
      } else {
        showError(errorMessage || 'Ошибка при создании записи');
      }
      return false;
    }
  };

  const handleEdit = async (appointmentData) => {
    try {
      const response = await updateAppointment(selectedAppointment.id, appointmentData);
      if (response) {
        showSuccess('Запись успешно обновлена');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating appointment:', error);
      showError(error.response?.data?.detail || 'Ошибка при обновлении записи');
      return false;
    }
  };

  const handleDelete = async (appointment) => {
    if (window.confirm('Вы уверены, что хотите удалить эту запись?')) {
      try {
        await deleteAppointment(appointment.id);
        showSuccess('Запись успешно удалена');
      } catch (error) {
        console.error('Error deleting appointment:', error);
        showError(error.response?.data?.detail || 'Ошибка при удалении записи');
      }
    }
  };

  const handleStatusChange = async (appointment, status) => {
    try {
      await updateAppointmentStatus(appointment.id, status);
      showSuccess('Статус записи успешно обновлен');
    } catch (error) {
      console.error('Error updating appointment status:', error);
      showError(error.response?.data?.detail || 'Ошибка при обновлении статуса');
    }
  };

  const filteredAppointments = useMemo(() => {
    return appointments.filter(appointment => {
      const searchString = searchQuery.toLowerCase();
      const patientName = appointment.patient_name?.toLowerCase() || '';
      const doctorName = appointment.doctor_name?.toLowerCase() || '';
      const status = appointment.status?.toLowerCase() || '';
      
      return patientName.includes(searchString) ||
             doctorName.includes(searchString) ||
             status.includes(searchString);
    });
  }, [appointments, searchQuery]);

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Управление записями</h1>
        <button
          onClick={() => {
            setSelectedAppointment(null);
            setIsModalOpen(true);
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Создать запись
        </button>
      </div>

      <div className="mb-4 relative">
        <input
          type="text"
          placeholder="Поиск по пациенту, врачу или статусу..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border rounded-md pr-10"
        />
        <MagnifyingGlassIcon className="h-5 w-5 absolute right-3 top-2.5 text-gray-400" />
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Пациент
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Врач
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Начало
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Окончание
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Статус
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Заметки
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center">
                  Загрузка...
                </td>
              </tr>
            ) : filteredAppointments.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center">
                  Записи не найдены
                </td>
              </tr>
            ) : (
              filteredAppointments.map((appointment) => (
                <tr key={appointment.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {appointment.patient_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {appointment.doctor_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {format(new Date(appointment.start_time), 'dd.MM.yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {format(new Date(appointment.end_time), 'dd.MM.yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={appointment.status}
                      onChange={(e) => handleStatusChange(appointment, e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="scheduled">Запланирован</option>
                      <option value="confirmed">Подтвержден</option>
                      <option value="completed">Завершен</option>
                      <option value="cancelled">Отменен</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {appointment.notes}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        setSelectedAppointment(appointment);
                        setIsModalOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(appointment)}
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

      {isModalOpen && (
        <AppointmentModal
          appointment={selectedAppointment}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedAppointment(null);
          }}
          onSave={selectedAppointment ? handleEdit : handleCreate}
        />
      )}
    </div>
  );
}
