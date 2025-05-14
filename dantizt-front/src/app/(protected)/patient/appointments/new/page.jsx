'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppointmentsStore } from '@/store/appointmentsStore';
import { usePatientStore } from '@/store/patientStore';
import api from '@/lib/axios';
import Image from 'next/image';
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
  PencilIcon
} from '@heroicons/react/24/outline';
import SlotPicker from '@/components/slot-picker';

export default function NewAppointment() {
  const router = useRouter();
  const { loading: appointmentLoading, error, createAppointment } = useAppointmentsStore();
  const { patientProfile, fetchPatientProfile } = usePatientStore();
  
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
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadInitialData();
  }, []);

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
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Запись на прием</h1>
      <form onSubmit={handleSubmit}>
        <div className="space-y-8">
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between relative">
              <div className="w-full absolute top-1/2 transform -translate-y-1/2">
                <div className="h-1 bg-gray-200">
                  <div 
                    className="h-1 bg-indigo-500 transition-all duration-300"
                    style={{ width: `${((step - 1) / 1) * 100}%` }}
                  />
                </div>
              </div>
              {[1, 2].map((s) => (
                <div
                  key={s}
                  className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    s <= step
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : 'border-gray-300 bg-white text-gray-500'
                  }`}
                >
                  {s === 1 && <UserIcon className="w-5 h-5" />}
                  {s === 2 && <CalendarIcon className="w-5 h-5" />}
                </div>
              ))}
            </div>
          </div>

          {/* Step 1: Doctor Selection */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Фильтр по специализации */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Выберите специализацию
                </label>
                <div className="relative">
                  <select
                    className="block w-full rounded-lg border-2 border-gray-300 bg-white py-3 px-4 pr-10 shadow-sm hover:border-indigo-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 appearance-none"
                    value={selectedSpecialization || ''}
                    onChange={(e) => handleSpecializationSelect(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Все специализации</option>
                    {specializations.map((specialization) => (
                      <option key={specialization.id} value={specialization.id}>
                        {specialization.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <svg className="h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Список врачей */}
              {filteredDoctors.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {filteredDoctors.map((doctor) => (
                    <div
                      key={doctor.id}
                      onClick={() => handleDoctorSelect(doctor)}
                      className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedDoctor?.id === doctor.id
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex items-start space-x-4">
                        {doctor.photo_url ? (
                          <Image
                            src={doctor.photo_url}
                            alt={doctor.user.full_name}
                            width={80}
                            height={80}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                            <UserIcon className="w-12 h-12 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">
                            {doctor.user.full_name}
                          </h3>
                          <p className="text-sm text-gray-500 flex items-center mt-1">
                            <AcademicCapIcon className="w-4 h-4 mr-1" />
                            {doctor.specialization?.name}
                          </p>
                          <p className="text-sm text-gray-500 flex items-center mt-1">
                            <BriefcaseIcon className="w-4 h-4 mr-1" />
                            Стаж {doctor.experience_years} лет
                          </p>
                          <p className="text-sm text-gray-500 flex items-center mt-1">
                            <ClockIcon className="w-4 h-4 mr-1" />
                            Длительность приема: {doctor.specialization?.appointment_duration || 30} мин.
                          </p>
                          {doctor.rating && (
                            <div className="flex items-center mt-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <StarIcon
                                  key={star}
                                  className={`w-4 h-4 ${
                                    star <= doctor.rating
                                      ? 'text-yellow-400'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                              <span className="ml-1 text-sm text-gray-600">
                                ({doctor.review_count})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {doctor.bio && (
                        <p className="mt-4 text-sm text-gray-600">
                          {doctor.bio}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">Нет доступных врачей</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Date & Time Selection */}
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
    </div>
  );
}
