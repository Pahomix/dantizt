'use client';

import { useState, useEffect } from 'react';
import { useScheduleStore } from '@/store/scheduleStore';
import ScheduleModal from './schedule-modal';
import SpecialDayModal from './special-day-modal';
import Calendar from '@/components/Calendar';

export default function SchedulesPage() {
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isSpecialDayModalOpen, setIsSpecialDayModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSpecialDay, setSelectedSpecialDay] = useState(null);
  
  const { 
    doctors,
    schedules,
    specialDays,
    fetchDoctors,
    fetchDoctorSchedule,
    fetchDoctorSpecialDays
  } = useScheduleStore();

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  useEffect(() => {
    if (selectedDoctor) {
      fetchDoctorSchedule(selectedDoctor.id);
      fetchDoctorSpecialDays(selectedDoctor.id);
    }
  }, [selectedDoctor, fetchDoctorSchedule, fetchDoctorSpecialDays]);

  const handleDoctorChange = (event) => {
    const doctor = doctors.find(d => d.id === parseInt(event.target.value));
    setSelectedDoctor(doctor);
  };

  const handleDayClick = (date, specialDay) => {
    setSelectedDate(date);
    setSelectedSpecialDay(specialDay);
    setIsSpecialDayModalOpen(true);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Управление расписанием врачей</h1>

      <div className="mb-6">
        <select
          value={selectedDoctor?.id || ''}
          onChange={handleDoctorChange}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md text-gray-900"
        >
          <option value="">Выберите врача</option>
          {doctors.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.user?.full_name} - {doctor.specialization?.name}
            </option>
          ))}
        </select>
      </div>

      {selectedDoctor && (
        <div className="space-x-4 mb-6">
          <button
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
            onClick={() => setIsScheduleModalOpen(true)}
          >
            Редактировать расписание
          </button>
          <button
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            onClick={() => {
              setSelectedDate(new Date());
              setIsSpecialDayModalOpen(true);
            }}
          >
            Добавить особый день
          </button>
        </div>
      )}

      {selectedDoctor && (
        <div className="mt-6">
          <Calendar
            schedules={schedules}
            specialDays={specialDays}
            onDayClick={handleDayClick}
            doctorId={selectedDoctor.id}
            canEdit={true}
          />
        </div>
      )}

      {selectedDoctor && (
        <>
          <ScheduleModal
            isOpen={isScheduleModalOpen}
            onClose={() => setIsScheduleModalOpen(false)}
            doctorId={selectedDoctor.id}
            updateDoctorSchedule={useScheduleStore.getState().updateDoctorSchedule}
          />
          <SpecialDayModal
            isOpen={isSpecialDayModalOpen}
            onClose={() => {
              setIsSpecialDayModalOpen(false);
              setSelectedSpecialDay(null);
            }}
            doctorId={selectedDoctor.id}
            date={selectedDate}
            specialDay={selectedSpecialDay}
          />
        </>
      )}
    </div>
  );
}
