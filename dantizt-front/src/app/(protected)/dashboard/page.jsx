'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDaysIcon, ClockIcon, DocumentTextIcon, UserIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/auth.store';
import { UserRole } from '@/constants/roles';
import Cookies from 'js-cookie';

// Функции для разных ролей
const roleFeatures = {
  [UserRole.PATIENT]: [
    {
      name: 'Записаться на приём',
      description: 'Выберите удобное время для посещения врача',
      icon: CalendarDaysIcon,
      href: '/appointments/new',
    },
    {
      name: 'Мои приёмы',
      description: 'Просмотр истории и предстоящих приёмов',
      icon: ClockIcon,
      href: '/appointments',
    },
    {
      name: 'Мои документы',
      description: 'Доступ к медицинским документам и справкам',
      icon: DocumentTextIcon,
      href: '/documents',
    },
    {
      name: 'Мой профиль',
      description: 'Управление личной информацией',
      icon: UserIcon,
      href: '/profile',
    },
  ],
  [UserRole.DOCTOR]: [
    {
      name: 'Мои пациенты',
      description: 'Просмотр списка пациентов',
      icon: UserIcon,
      href: '/patients',
    },
    {
      name: 'Расписание',
      description: 'Управление расписанием приёмов',
      icon: CalendarDaysIcon,
      href: '/schedule',
    },
    {
      name: 'Документы',
      description: 'Работа с медицинскими документами',
      icon: DocumentTextIcon,
      href: '/documents',
    },
    {
      name: 'Мой профиль',
      description: 'Управление профилем врача',
      icon: UserIcon,
      href: '/profile',
    },
  ],
  [UserRole.ADMIN]: [
    {
      name: 'Пользователи',
      description: 'Управление пользователями системы',
      icon: UserIcon,
      href: '/users',
    },
    {
      name: 'Расписание',
      description: 'Управление общим расписанием',
      icon: CalendarDaysIcon,
      href: '/schedule',
    },
    {
      name: 'Документы',
      description: 'Все медицинские документы',
      icon: DocumentTextIcon,
      href: '/documents',
    },
    {
      name: 'Настройки',
      description: 'Настройки системы',
      icon: UserIcon,
      href: '/settings',
    },
  ],
};

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Проверяем авторизацию
    const accessToken = Cookies.get('access_token');
    const refreshToken = Cookies.get('refresh_token');
    const userRole = Cookies.get('userRole');

    if (!accessToken && !refreshToken) {
      router.replace('/login');
      return;
    }

    if (!userRole || !user) {
      router.replace('/login');
      return;
    }

    setLoading(false);
  }, [router, user]);

  // Получаем функции для текущей роли
  const features = roleFeatures[user?.role] || [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Приветствие */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Добро пожаловать, {user?.full_name}!
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {user?.role === UserRole.PATIENT ? 'Управляйте своими приёмами и медицинскими документами' :
           user?.role === UserRole.DOCTOR ? 'Управляйте приёмами и документами пациентов' :
           'Управляйте системой и пользователями'}
        </p>
      </div>

      {/* Основные функции */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {features.map((feature) => (
          <div
            key={feature.name}
            onClick={() => router.push(feature.href)}
            className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
          >
            <div>
              <span className="rounded-lg inline-flex p-3 bg-indigo-50 text-indigo-700 ring-4 ring-white">
                <feature.icon className="h-6 w-6" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-8">
              <h3 className="text-lg font-medium">
                <a href={feature.href} className="focus:outline-none">
                  <span className="absolute inset-0" aria-hidden="true" />
                  {feature.name}
                </a>
              </h3>
              <p className="mt-2 text-sm text-gray-500">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Предстоящие приёмы (только для пациентов) */}
      {user?.role === UserRole.PATIENT && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Предстоящие приёмы</h2>
            <button
              onClick={() => router.push('/appointments/new')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Записаться
            </button>
          </div>
          {upcomingAppointments.length === 0 ? (
            <p className="text-gray-500">У вас пока нет предстоящих приёмов</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {upcomingAppointments.map((appointment) => (
                <li key={appointment.id} className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{appointment.doctor}</p>
                      <p className="text-sm text-gray-500">{appointment.service}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{appointment.date}</p>
                      <p className="text-sm text-gray-500">{appointment.time}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
