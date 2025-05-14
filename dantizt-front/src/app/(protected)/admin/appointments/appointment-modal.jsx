'use client';

import { useState, useEffect } from 'react';
import { useDoctorStore } from '@/store/doctorStore';
import { usePatientStore } from '@/store/patientStore';
import { format } from 'date-fns';
import { CalendarIcon, ClockIcon, UserIcon } from '@heroicons/react/24/outline';
import SlotPicker from '@/components/slot-picker';

export default function AppointmentModal({ appointment, onClose, onSave }) {
  const [formData, setFormData] = useState({
    patient_id: appointment?.patient_id || '',
    doctor_id: appointment?.doctor_id || '',
    date: appointment ? format(new Date(appointment.start_time), 'yyyy-MM-dd') : '',
    start_time: appointment ? format(new Date(appointment.start_time), 'HH:mm:ss') : '',
    end_time: appointment ? format(new Date(appointment.end_time), 'HH:mm:ss') : '',
    status: appointment?.status || 'scheduled',
    notes: appointment?.notes || '',
    start_time_full: appointment ? appointment.start_time : '',
    end_time_full: appointment ? appointment.end_time : ''
  });

  const { doctors, fetchDoctors } = useDoctorStore();
  const { patients, fetchPatients } = usePatientStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: Выбор пациента и врача, 2: Выбор даты и времени

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchDoctors(),
          fetchPatients()
        ]);
      } catch (err) {
        setError('Ошибка при загрузке данных');
      }
      setLoading(false);
    };

    loadData();
  }, [fetchDoctors, fetchPatients]);

  // Если редактируем существующую запись, сразу переходим к шагу 2
  useEffect(() => {
    if (appointment) {
      setStep(2);
    }
  }, [appointment]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Если на первом шаге и выбраны пациент и врач, переходим ко второму шагу
    if (step === 1) {
      if (formData.patient_id && formData.doctor_id) {
        setStep(2);
        return;
      } else {
        setError('Выберите пациента и врача');
        return;
      }
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Подготовка данных для отправки
      const appointmentData = {
        patient_id: parseInt(formData.patient_id),
        doctor_id: parseInt(formData.doctor_id),
        start_time: formData.start_time_full,
        end_time: formData.end_time_full,
        status: formData.status,
        notes: formData.notes
      };

      // Если нет выбранного слота, показываем ошибку
      if (!formData.start_time_full || !formData.end_time_full) {
        setError('Выберите время приема');
        setIsSubmitting(false);
        return;
      }

      await onSave(appointmentData);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Произошла ошибка при сохранении');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleDateSelect = (date) => {
    setFormData(prev => ({
      ...prev,
      date,
      // Сбрасываем выбранный слот при изменении даты
      start_time: '',
      end_time: '',
      start_time_full: '',
      end_time_full: ''
    }));
  };

  const handleSlotSelect = (slot) => {
    console.log('Selected slot:', slot);
    setFormData(prev => ({
      ...prev,
      start_time: slot.start_time,
      end_time: slot.end_time,
      start_time_full: slot.start_time_full,
      end_time_full: slot.end_time_full
    }));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-2 text-center">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            {appointment ? 'Редактировать запись' : 'Создать запись'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            disabled={isSubmitting}
            type="button"
          >
            <span className="sr-only">Закрыть</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="patient_id" className="block text-sm font-medium text-gray-900">
                  <div className="flex items-center">
                    <UserIcon className="h-5 w-5 text-indigo-500 mr-2" />
                    Пациент
                  </div>
                </label>
                <select
                  id="patient_id"
                  name="patient_id"
                  value={formData.patient_id}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
                >
                  <option value="">Выберите пациента</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.full_name || (patient.user && patient.user.full_name) || `Пациент ID: ${patient.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="doctor_id" className="block text-sm font-medium text-gray-900">
                  <div className="flex items-center">
                    <UserIcon className="h-5 w-5 text-indigo-500 mr-2" />
                    Врач
                  </div>
                </label>
                <select
                  id="doctor_id"
                  name="doctor_id"
                  value={formData.doctor_id}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
                >
                  <option value="">Выберите врача</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.user.full_name} - {doctor.specialization?.name || 'Без специализации'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {/* Если редактируем, показываем выбор пациента и врача */}
              {appointment && (
                <>
                  <div>
                    <label htmlFor="patient_id" className="block text-sm font-medium text-gray-900">
                      <div className="flex items-center">
                        <UserIcon className="h-5 w-5 text-indigo-500 mr-2" />
                        Пациент
                      </div>
                    </label>
                    <select
                      id="patient_id"
                      name="patient_id"
                      value={formData.patient_id}
                      onChange={handleChange}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
                    >
                      <option value="">Выберите пациента</option>
                      {patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.full_name || (patient.user && patient.user.full_name) || `Пациент ID: ${patient.id}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="doctor_id" className="block text-sm font-medium text-gray-900">
                      <div className="flex items-center">
                        <UserIcon className="h-5 w-5 text-indigo-500 mr-2" />
                        Врач
                      </div>
                    </label>
                    <select
                      id="doctor_id"
                      name="doctor_id"
                      value={formData.doctor_id}
                      onChange={handleChange}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
                    >
                      <option value="">Выберите врача</option>
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.user.full_name} - {doctor.specialization?.name || 'Без специализации'}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-900">
                  <div className="flex items-center">
                    <CalendarIcon className="h-5 w-5 text-indigo-500 mr-2" />
                    Дата приема
                  </div>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    id="date"
                    name="date"
                    value={formData.date}
                    onChange={(e) => handleDateSelect(e.target.value)}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
                  />
                </div>
              </div>

              {formData.date && formData.doctor_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-900">
                    <div className="flex items-center">
                      <ClockIcon className="h-5 w-5 text-indigo-500 mr-2" />
                      Доступное время
                    </div>
                  </label>
                  <SlotPicker
                    doctorId={parseInt(formData.doctor_id)}
                    selectedDate={new Date(formData.date)}
                    onSlotSelect={handleSlotSelect}
                  />
                </div>
              )}

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-900">
                  Статус
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
                >
                  <option value="scheduled">Запланирован</option>
                  <option value="confirmed">Подтвержден</option>
                  <option value="completed">Завершен</option>
                  <option value="cancelled">Отменен</option>
                </select>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-900">
                  Заметки
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
                  placeholder="Добавьте заметки..."
                />
              </div>
            </div>
          )}

          <div className="flex justify-between space-x-2 pt-4">
            {step === 2 && !appointment && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Назад
              </button>
            )}
            
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Отмена
            </button>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {isSubmitting ? 'Сохранение...' : (
                step === 1 ? 'Далее' : (appointment ? 'Сохранить' : 'Создать')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
