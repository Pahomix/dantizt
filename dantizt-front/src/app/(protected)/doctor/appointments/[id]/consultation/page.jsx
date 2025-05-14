'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';  
import { useDoctorAppointmentsStore } from '@/store/doctorAppointmentsStore';
import { useMedicalRecordsStore } from '@/store/medicalRecordsStore';
import { useDiagnosesStore } from '@/store/diagnosesStore';
import { ExaminationForm } from './ExaminationForm';
import { DiagnosisForm } from './DiagnosisForm';
import { TreatmentPlanForm } from './TreatmentPlanForm';
import { PatientHistory } from './PatientHistory';
import { ServiceSelection } from './ServiceSelection';

const tabs = [
  { id: 'examination', label: 'Осмотр' },
  { id: 'diagnosis', label: 'Диагноз' },
  { id: 'treatment', label: 'План лечения' },
  { id: 'services', label: 'Услуги' },
  { id: 'history', label: 'История' }
];

export default function ConsultationPage() {
  const { id } = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('examination');
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    examination: null,
    diagnosis: null,
    treatment: null,
    services: []
  });
  const [isCompleting, setIsCompleting] = useState(false);

  // Stores
  const { 
    appointment, 
    loading: appointmentLoading, 
    error: appointmentError, 
    fetchAppointment, 
    updateAppointmentStatus,
    addAppointmentServices,
    completeAppointment
  } = useDoctorAppointmentsStore();
  const { records, createRecord, fetchPatientRecords } = useMedicalRecordsStore();
  const { diagnoses, fetchPatientDiagnoses } = useDiagnosesStore();

  // Определяем, какие вкладки заполнены
  const hasExamination = formData.examination !== null;
  const hasDiagnosis = formData.diagnosis !== null;
  const hasTreatment = formData.treatment !== null;
  const hasServices = formData.services && formData.services.length > 0;

  // Определяем доступные вкладки
  const availableTabs = [
    { id: 'examination', label: 'Осмотр', enabled: true },
    { id: 'diagnosis', label: 'Диагноз', enabled: hasExamination },
    { id: 'treatment', label: 'План лечения', enabled: hasDiagnosis },
    { id: 'services', label: 'Услуги', enabled: true },
    { id: 'history', label: 'История', enabled: true }
  ];

  const handleFormDataChange = (tabId, data) => {
    setFormData(prev => ({
      ...prev,
      [tabId]: data
    }));

    // Автоматически переключаемся на следующую вкладку
    const currentTabIndex = availableTabs.findIndex(tab => tab.id === tabId);
    const nextTab = availableTabs[currentTabIndex + 1];
    if (nextTab && nextTab.enabled) {
      setActiveTab(nextTab.id);
    }
  };

  const handleSaveAll = async () => {
    try {
      setIsCompleting(true);
      // Сохраняем все формы последовательно
      if (formData.examination) {
        await createRecord({
          ...formData.examination,
          record_type: 'examination',
          patient_id: appointment.patient_id,
          doctor_id: appointment.doctor_id,
          appointment_id: appointment.id,
        });
      }

      if (formData.diagnosis) {
        await createRecord({
          ...formData.diagnosis,
          record_type: 'diagnosis',
          tooth_positions: [], 
          patient_id: appointment.patient_id,
          doctor_id: appointment.doctor_id,
          appointment_id: appointment.id,
        });
      }

      if (formData.treatment) {
        await createRecord({
          ...formData.treatment,
          record_type: 'treatment',
          tooth_positions: [], 
          patient_id: appointment.patient_id,
          doctor_id: appointment.doctor_id,
          appointment_id: appointment.id,
        });
      }

      // Если выбраны услуги, сохраняем их
      if (formData.services && formData.services.length > 0) {
        await completeAppointment(appointment.id, formData.services);
      }

      // Сохраняем ID приема перед очисткой
      const appointmentId = appointment.id;
      const patientId = appointment.patient_id;

      // Очищаем формы после успешного сохранения
      setFormData({
        examination: null,
        diagnosis: null,
        treatment: null,
        services: []
      });

      // Обновляем данные
      await fetchPatientRecords(patientId);
      await fetchPatientDiagnoses(patientId);
      
      // Перенаправляем на страницу приема
      router.push(`/doctor/appointments/${appointmentId}`);
    } catch (error) {
      console.error('Error saving data:', error);
      setError('Ошибка при сохранении данных');
    } finally {
      setIsCompleting(false);
    }
  };

  const handleServicesSelected = async (serviceIds) => {
    try {
      setFormData(prev => ({
        ...prev,
        services: serviceIds
      }));
    } catch (error) {
      console.error('Error selecting services:', error);
      setError('Ошибка при выборе услуг');
    }
  };

  const handleViewRecord = (record) => {
    // Просмотр записи
    console.log('View record:', record);
  };

  const handleEditRecord = (record) => {
    // Редактирование записи
    console.log('Edit record:', record);
  };

  const handleDeleteRecord = async (record) => {
    try {
      // Удаление записи
      await deleteRecord(record.id);
      
      // Обновляем данные
      await fetchPatientRecords(appointment.patient_id);
      await fetchPatientDiagnoses(appointment.patient_id);
    } catch (error) {
      console.error('Error deleting record:', error);
      setError('Ошибка при удалении записи');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        if (id) {
          const appointmentData = await fetchAppointment(id);
          
          if (appointmentData.patient_id) {
            await fetchPatientRecords(appointmentData.patient_id);
            await fetchPatientDiagnoses(appointmentData.patient_id);
          }
          
          // Если статус приема не "in_progress", меняем его
          if (appointmentData.status !== 'in_progress') {
            await updateAppointmentStatus(id, 'in_progress');
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setError('Ошибка при загрузке данных');
      }
    };
    
    loadData();
  }, [id, fetchAppointment, fetchPatientRecords, fetchPatientDiagnoses, updateAppointmentStatus]);

  // Если данные еще загружаются или произошла ошибка
  if (appointmentLoading || !appointment) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          {appointmentLoading ? (
            <p className="text-lg text-gray-600">Загрузка данных приема...</p>
          ) : (
            <p className="text-lg text-red-600">
              {appointmentError || error || 'Ошибка при загрузке данных приема'}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Заголовок и информация о пациенте */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Прием пациента: {appointment.patient_name}
              </h1>
              <p className="text-gray-600">
                Врач: {appointment.doctor_name}
                {appointment.doctor_specialty && ` (${appointment.doctor_specialty})`}
              </p>
            </div>
            <div className="mt-4 md:mt-0">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                Прием в процессе
              </span>
            </div>
          </div>
        </div>

        {/* Вкладки */}
        <div className="bg-white shadow-sm rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px overflow-x-auto">
              {availableTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => tab.enabled && setActiveTab(tab.id)}
                  className={`
                    py-4 px-8 font-medium text-sm border-b-2 transition-colors duration-200 whitespace-nowrap
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                    ${!tab.enabled && 'opacity-50 cursor-not-allowed'}
                  `}
                  disabled={!tab.enabled}
                >
                  {tab.label}
                  {!tab.enabled && (
                    <span className="ml-2 text-xs text-gray-400">
                      {tab.id === 'diagnosis' && '(Сначала заполните осмотр)'}
                      {tab.id === 'treatment' && '(Сначала поставьте диагноз)'}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Содержимое вкладок */}
          <div className="p-6">
            {activeTab === 'examination' && (
              <ExaminationForm
                appointment={appointment}
                initialData={formData.examination}
                onSave={(data) => handleFormDataChange('examination', data)}
              />
            )}
            {activeTab === 'diagnosis' && (
              <DiagnosisForm
                appointment={appointment}
                initialData={formData.diagnosis}
                onSave={(data) => handleFormDataChange('diagnosis', data)}
              />
            )}
            {activeTab === 'treatment' && (
              <TreatmentPlanForm
                appointment={appointment}
                initialData={formData.treatment}
                onSave={(data) => handleFormDataChange('treatment', data)}
              />
            )}
            {activeTab === 'services' && (
              <ServiceSelection
                appointment={appointment}
                onServicesSelected={handleServicesSelected}
              />
            )}
            {activeTab === 'history' && (
              <PatientHistory 
                records={records} 
                diagnoses={diagnoses} 
                appointment={appointment}
                handleViewRecord={handleViewRecord}
                handleEditRecord={handleEditRecord}
                handleDeleteRecord={handleDeleteRecord}
              />
            )}
          </div>
        </div>

        {/* Кнопка сохранения */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSaveAll}
            disabled={isCompleting || (!hasExamination && !hasDiagnosis && !hasTreatment && !hasServices)}
            className={`
              px-4 py-2 font-medium rounded
              ${isCompleting ? 'bg-gray-400 text-white cursor-not-allowed' : 
                (hasExamination || hasDiagnosis || hasTreatment || hasServices) ? 
                'bg-blue-600 text-white hover:bg-blue-700' : 
                'bg-gray-300 text-gray-500 cursor-not-allowed'}
            `}
          >
            {isCompleting ? 'Сохранение...' : 'Завершить прием'}
          </button>
        </div>
      </div>
    </div>
  );
}
