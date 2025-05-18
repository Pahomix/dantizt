'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppointmentsStore } from '@/store/appointmentsStore';
import { usePatientStore } from '@/store/patientStore';
import { usePaymentsStore } from '@/store/paymentsStore';
import api from '@/lib/axios';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  CalendarIcon, 
  ClockIcon,
  UserIcon,
  BuildingOfficeIcon,
  CurrencyRupeeIcon,
  StarIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  XCircleIcon,
  PencilIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import SlotPicker from '@/components/slot-picker';

export default function NewAppointment() {
  const router = useRouter();
  const { loading: appointmentLoading, error, createAppointment } = useAppointmentsStore();
  const { patientProfile, fetchPatientProfile } = usePatientStore();
  const { payments, fetchPatientPayments } = usePaymentsStore();
  
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState([]);
  const [specializations, setSpecializations] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState(1); // 1: Doctor, 2: Date & Time
  const [selectedSpecialization, setSelectedSpecialization] = useState(null);
  const [filteredDoctors, setFilteredDoctors] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [hasPendingPayments, setHasPendingPayments] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        // Загружаем профиль пациента и все необходимые данные
        await fetchPatientProfile();
        const [doctorsRes, specializationsRes] = await Promise.all([
          api.get('/doctors'),
          api.get('/specializations')
        ]);
        
        setDoctors(Array.isArray(doctorsRes.data) ? doctorsRes.data : []);
        setFilteredDoctors(Array.isArray(doctorsRes.data) ? doctorsRes.data : []);
        setSpecializations(Array.isArray(specializationsRes.data) ? specializationsRes.data : []);
        
        // Загружаем платежи пациента
        await fetchPatientPayments();
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, [fetchPatientProfile, fetchPatientPayments]);
  
  // Проверяем наличие неоплаченных платежей
  useEffect(() => {
    if (payments && payments.length > 0) {
      // Фильтруем неоплаченные платежи
      const pending = payments.filter(payment => payment.status === 'pending');
      setPendingPayments(pending);
      setHasPendingPayments(pending.length > 0);
    }
  }, [payments]);

  const handleSpecializationSelect = (specializationId) => {
    setSelectedSpecialization(specializationId);
    if (specializationId) {
      const filtered = doctors.filter(doctor => doctor.specialization_id === specializationId);
      setFilteredDoctors(filtered);
    } else {
      setFilteredDoctors(doctors);
    }
  };

  const handleDoctorSelect = (doctor) => {
    setSelectedDoctor(doctor);
    setStep(2);
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const handleSlotSelect = (slot) => {
    console.log('Selected slot:', slot);
    setSelectedSlot(slot);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Submitting form with:', {
      selectedDoctor,
      selectedDate,
      selectedSlot,
      notes,
      patientProfile
    });

    if (!selectedDoctor || !selectedDate || !selectedSlot) {
      console.log('Missing required fields');
      return;
    }

    try {
      const appointmentData = {
        patient_id: patientProfile.id,
        doctor_id: selectedDoctor.id,
        start_time: new Date(`${selectedDate}T${selectedSlot.start_time}`).toISOString(),
        end_time: new Date(`${selectedDate}T${selectedSlot.end_time}`).toISOString(),
        notes
      };
      console.log('Creating appointment with:', appointmentData);

      await createAppointment(appointmentData);
      router.push('/patient/appointments');
    } catch (error) {
      console.error('Error creating appointment:', error);
    }
  };

  if (loading || appointmentLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Запись на прием
      </h1>
      
      {/* Предупреждение о неоплаченных услугах */}
      {hasPendingPayments && (
        <div className="rounded-md bg-yellow-50 p-4 mb-6 border border-yellow-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Внимание! У вас есть неоплаченные услуги
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  У вас есть {pendingPayments.length} {pendingPayments.length === 1 ? 'неоплаченная услуга' : 'неоплаченных услуг'}. 
                  Для записи на новый прием необходимо оплатить все предыдущие услуги.
                </p>
              </div>
              <div className="mt-4">
                <div className="flex">
                  <Link
                    href="/patient/payments"
                    className="rounded-md bg-yellow-100 px-3.5 py-2 text-sm font-medium text-yellow-800 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:ring-offset-2 focus:ring-offset-yellow-50"
                  >
                    Перейти к оплате
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {hasPendingPayments ? (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="text-center py-10">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
              <svg className="h-6 w-6 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0h-2m4-5a8 8 0 11-16 0 8 8 0 0116 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-medium text-gray-900 mb-2">Запись на прием недоступна</h2>
            <p className="text-gray-500 mb-6">Пожалуйста, оплатите все предыдущие услуги, чтобы продолжить</p>
            <Link
              href="/patient/payments"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Перейти к оплате
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6 mb-6">
          <div className="space-y-6">
            {step === 1 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Выберите врача</h2>
                
                {/* Фильтр по специализации */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Специализация
                  </label>
                  <div className="relative">
                    <select
                      className="block w-full rounded-lg border-2 border-gray-300 bg-white py-3 pl-4 pr-10 shadow-sm hover:border-indigo-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                      value={selectedSpecialization || ''}
                      onChange={(e) => handleSpecializationSelect(e.target.value || null)}
                    >
                      <option value="">Все специализации</option>
                      {specializations.map((spec) => (
                        <option key={spec.id} value={spec.id}>
                          {spec.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Список врачей */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Врач
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredDoctors.length > 0 ? (
                      filteredDoctors.map((doctor) => (
                        <div
                          key={doctor.id}
                          onClick={() => handleDoctorSelect(doctor)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedDoctor?.id === doctor.id
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-200 hover:border-indigo-200'
                          }`}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              {doctor.photo_url ? (
                                <Image
                                  src={doctor.photo_url}
                                  alt={doctor.full_name}
                                  width={48}
                                  height={48}
                                  className="rounded-full"
                                />
                              ) : (
                                <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                                  <UserIcon className="h-6 w-6 text-indigo-500" />
                                </div>
                              )}
                            </div>
                            <div>
                              <h3 className="text-sm font-medium text-gray-900">
                                {doctor.user.full_name || 'Доктор'}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {specializations.find(s => s.id === doctor.specialization_id)?.name || 'Специалист'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 py-8 text-center">
                        <p className="text-gray-500">Врачей с выбранной специализацией не найдено</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Кнопка далее */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={!selectedDoctor}
                    onClick={() => selectedDoctor && setStep(2)}
                    className={`
                      inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white
                      ${selectedDoctor 
                        ? 'bg-indigo-500 hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                        : 'bg-gray-300 cursor-not-allowed'
                      }
                    `}
                  >
                    Далее
                  </button>
                </div>
              </div>
            )}
            
            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">Выберите дату и время приема</h2>
                
                {/* Выбор даты */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Дата приема
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                      <CalendarIcon className="h-5 w-5 text-indigo-500" />
                    </div>
                    <input
                      type="date"
                      className="block w-full rounded-lg border-2 border-gray-300 bg-white py-3 pl-10 pr-4 shadow-sm hover:border-indigo-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                      value={selectedDate}
                      onChange={(e) => handleDateSelect(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>

                {/* Выбор слота */}
                {selectedDate && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Доступное время
                    </label>
                    <SlotPicker
                      doctorId={selectedDoctor.id}
                      selectedDate={new Date(selectedDate)}
                      onSlotSelect={handleSlotSelect}
                    />
                  </div>
                )}

                {/* Примечания */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Примечания к приему (необязательно)
                  </label>
                  <div className="relative">
                    <div className="absolute top-3 left-3 pointer-events-none">
                      <PencilIcon className="h-5 w-5 text-indigo-500" />
                    </div>
                    <textarea
                      className="block w-full rounded-lg border-2 border-gray-300 bg-white py-3 pl-10 pr-4 shadow-sm hover:border-indigo-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                      rows={4}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Опишите причину визита или дополнительную информацию..."
                    />
                  </div>
                </div>

                {/* Кнопки навигации */}
                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Назад
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedSlot}
                    className={`
                      inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white
                      ${selectedSlot 
                        ? 'bg-indigo-500 hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                        : 'bg-gray-300 cursor-not-allowed'
                      }
                    `}
                  >
                    Записаться на прием
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
