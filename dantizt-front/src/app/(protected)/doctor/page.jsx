'use client';

import { useState, useEffect } from 'react';
import { useDoctorStore } from '@/store/doctorStore';
import { useAppointmentsStore } from '@/store/appointmentsStore';
import {
  CalendarIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
  UserGroupIcon,
  UserIcon,
  ClockIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

export default function DoctorDashboard() {
  const router = useRouter();
  const { doctorProfile, loading: profileLoading, error: profileError, fetchDoctorProfile } = useDoctorStore();
  const { appointments, loading: appointmentsLoading, error: appointmentsError, fetchMyDoctorAppointments } = useAppointmentsStore();
  const [todayAppointments, setTodayAppointments] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      await fetchDoctorProfile();
      // Получаем приемы на сегодня
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      await fetchMyDoctorAppointments({
        from_date: today,
        to_date: tomorrow
      });
    };
    loadData();
  }, []);

  useEffect(() => {
    if (appointments.length > 0) {
      // Сортируем приемы по времени
      const sortedAppointments = [...appointments].sort(
        (a, b) => new Date(a.start_time) - new Date(b.start_time)
      );
      setTodayAppointments(sortedAppointments);
    } else {
      setTodayAppointments([]);
    }
  }, [appointments]);

  if (profileLoading || appointmentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (profileError || appointmentsError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600">Ошибка</h2>
          <p className="mt-2 text-gray-600">{profileError || appointmentsError}</p>
        </div>
      </div>
    );
  }

  const navigationCards = [
    {
      title: 'Мой профиль',
      description: 'Просмотр и редактирование личной информации',
      icon: UserIcon,
      href: '/doctor/profile',
      color: 'bg-blue-500'
    },
    {
      title: 'Расписание приёмов',
      description: 'Управление записями и расписанием',
      icon: CalendarIcon,
      href: '/doctor/appointments',
      color: 'bg-green-500'
    },
    {
      title: 'Мои пациенты',
      description: 'Список пациентов и их медицинские карты',
      icon: UserGroupIcon,
      href: '/doctor/patients',
      color: 'bg-purple-500'
    },
    {
      title: 'Статистика',
      description: 'Анализ работы и отчёты',
      icon: ChartBarIcon,
      href: '/doctor/statistics',
      color: 'bg-yellow-500'
    }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Добро пожаловать, {doctorProfile?.user?.full_name}
        </h1>
        <p className="mt-1 text-gray-500">
          {doctorProfile?.specialization?.name} • Стаж: {doctorProfile?.experience_years || 0} лет
        </p>
      </div>

      <div className="grid gap-6 mb-8 md:grid-cols-2 lg:grid-cols-4">
        {navigationCards.map((card) => (
          <div
            key={card.title}
            onClick={() => router.push(card.href)}
            className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className={`p-3 ${card.color} inline-block rounded-lg text-white mb-4`}>
              <card.icon className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{card.title}</h2>
            <p className="text-gray-600">{card.description}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Приёмы на сегодня</h2>
          <button
            onClick={() => router.push('/doctor/appointments')}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Смотреть все
          </button>
        </div>

        {todayAppointments.length === 0 ? (
          <div className="text-center py-12">
            <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-lg font-medium text-gray-900">Нет приёмов на сегодня</h3>
            <p className="mt-1 text-sm text-gray-500">На сегодня не запланировано приёмов пациентов</p>
          </div>
        ) : (
          <div className="space-y-4">
            {todayAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <UserIcon className="h-10 w-10 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{appointment.patient_name}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span className="flex items-center">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        {new Date(appointment.start_time).toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <span className="flex items-center">
                        <BuildingOfficeIcon className="h-4 w-4 mr-1" />
                        {appointment.service_name}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        appointment.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                        appointment.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        appointment.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {appointment.status === 'scheduled' ? 'Запланирован' :
                         appointment.status === 'in_progress' ? 'В процессе' :
                         appointment.status === 'completed' ? 'Завершен' :
                         'Отменен'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => router.push(`/appointments/${appointment.id}`)}
                    className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-600 rounded-md"
                  >
                    Подробнее
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
