'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMedicalRecordsStore } from '@/store/medicalRecordsStore';
import { usePatientStore } from '@/store/patientStore';
import { usePatientAppointmentsStore } from '@/store/patientAppointmentsStore';
import { MedicalRecordsList } from '@/components/medical-records/MedicalRecordsList';
import { MedicalRecordForm } from '@/components/medical-records/MedicalRecordForm';
import { Plus, ArrowLeft, X, Calendar, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function PatientMedicalRecordPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = parseInt(params.patientId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const {
    appointments,
    selectedAppointment,
    loading: appointmentsLoading,
    error: appointmentsError,
    fetchPatientAppointments,
    setSelectedAppointment,
    clearSelectedAppointment
  } = usePatientAppointmentsStore();

  const {
    selectedPatient,
    loading: patientLoading,
    error: patientError,
    fetchPatient
  } = usePatientStore();

  const {
    records,
    loading: recordsLoading,
    error: recordsError,
    createRecord,
    updateRecord,
    deleteRecord
  } = useMedicalRecordsStore();

  useEffect(() => {
    const loadData = async () => {
      if (patientId) {
        await fetchPatient(patientId);
        await fetchPatientAppointments(patientId);
      }
    };
    loadData();
  }, [patientId, fetchPatient, fetchPatientAppointments]);

  const handleCreateRecord = async (data) => {
    try {
      await createRecord({ 
        ...data, 
        patient_id: patientId,
        appointment_id: selectedAppointment?.id 
      });
      setIsFormOpen(false);
      await fetchPatientAppointments(patientId);
    } catch (error) {
      console.error('Error creating record:', error);
    }
  };

  const handleUpdateRecord = async (data) => {
    try {
      await updateRecord(selectedRecord.id, data);
      setSelectedRecord(null);
      await fetchPatientAppointments(patientId);
    } catch (error) {
      console.error('Error updating record:', error);
    }
  };

  const handleDeleteRecord = async (recordId) => {
    if (window.confirm('Вы уверены, что хотите удалить эту запись?')) {
      try {
        await deleteRecord(recordId);
        await fetchPatientAppointments(patientId);
      } catch (error) {
        console.error('Error deleting record:', error);
      }
    }
  };

  if (patientLoading || appointmentsLoading || recordsLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (patientError || appointmentsError || recordsError) {
    return (
      <div className="text-center text-red-500 p-4">
        {patientError || appointmentsError || recordsError}
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {selectedPatient?.user?.full_name || 'Пациент'}
            </h1>
            <p className="text-sm text-gray-500">
              {selectedPatient?.user?.email || 'Email не указан'}
            </p>
          </div>
        </div>
      </div>

      {/* Основной контент */}
      <div className="grid grid-cols-12 gap-6">
        {/* Список приемов */}
        <div className="col-span-4 bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-medium text-gray-900">Приемы</h2>
          </div>
          <div className="divide-y">
            {appointments.map((appointment) => (
              <div
                key={appointment.id}
                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedAppointment?.id === appointment.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => setSelectedAppointment(appointment)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <Calendar className="h-5 w-5 text-gray-400 mt-1" />
                    <div>
                      <div className="font-medium text-gray-900">
                        {format(new Date(appointment.start_time), 'PPp', { locale: ru })}
                      </div>
                      <div className="text-sm text-gray-500">
                        {appointment.service.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {appointment.doctor.user.full_name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-500">
                      {appointment.medical_records.length} записей
                    </span>
                    <ChevronRight className="h-5 w-5 text-gray-400 ml-2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Записи выбранного приема */}
        <div className="col-span-8">
          {selectedAppointment ? (
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    Записи приема от {format(new Date(selectedAppointment.start_time), 'PPp', { locale: ru })}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedAppointment.service.name} • {selectedAppointment.doctor.user.full_name}
                  </p>
                </div>
                <button
                  onClick={() => setIsFormOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить запись
                </button>
              </div>
              <div className="p-4">
                <MedicalRecordsList
                  records={selectedAppointment.medical_records}
                  onEdit={setSelectedRecord}
                  onDelete={handleDeleteRecord}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full bg-white rounded-lg shadow p-8">
              <div className="text-center">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Выберите прием
                </h3>
                <p className="text-gray-500">
                  Выберите прием слева, чтобы просмотреть связанные с ним записи
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно для создания/редактирования записи */}
      {(isFormOpen || selectedRecord) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">
                {selectedRecord ? 'Редактировать запись' : 'Новая запись'}
              </h2>
              <button
                onClick={() => {
                  setIsFormOpen(false);
                  setSelectedRecord(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              <MedicalRecordForm
                initialData={selectedRecord}
                onSubmit={selectedRecord ? handleUpdateRecord : handleCreateRecord}
                onCancel={() => {
                  setIsFormOpen(false);
                  setSelectedRecord(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
