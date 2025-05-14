'use client';

import { useState, useEffect } from 'react';
import { ChartBarIcon, UsersIcon, CalendarIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/axios';

const stats = [
  { name: 'Всего пациентов', icon: UsersIcon },
  { name: 'Приёмы сегодня', icon: CalendarIcon },
  { name: 'Доход за месяц', icon: BanknotesIcon },
  { name: 'Рейтинг клиники', icon: ChartBarIcon },
];

export default function AdminPage() {
  const [statistics, setStatistics] = useState({
    totalPatients: 0,
    todayAppointments: 0,
    monthlyIncome: 0,
    clinicRating: 0,
  });

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        const response = await api.get('/statistics/clinic');
        const data = response.data || {};

        setStatistics({
          totalPatients: data.patients_count || 0,
          todayAppointments: data.today_appointments || 0,
          monthlyIncome: data.monthly_income || 0,
          clinicRating: data.rating || 0,
        });
      } catch (error) {
        console.error('Error fetching statistics:', error);
        // Оставляем текущие значения в случае ошибки
      }
    };

    fetchStatistics();
  }, []);

  const formatValue = (value, type) => {
    if (typeof value !== 'number') return '0';
    
    switch (type) {
      case 'money':
        return `${value.toLocaleString()} ₽`;
      case 'rating':
        return value.toFixed(1);
      default:
        return value.toString();
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-900">Добро пожаловать в админ панель!</h2>
      <p className="mt-2 text-sm text-gray-700">
        Здесь вы можете управлять всеми аспектами работы клиники
      </p>

      <dl className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item, index) => {
          let value = 0;
          let description = '';

          switch (index) {
            case 0:
              value = statistics.totalPatients;
              description = 'пациентов в базе';
              break;
            case 1:
              value = statistics.todayAppointments;
              description = 'приёмов запланировано';
              break;
            case 2:
              value = formatValue(statistics.monthlyIncome, 'money');
              description = 'заработано в этом месяце';
              break;
            case 3:
              value = formatValue(statistics.clinicRating, 'rating');
              description = 'средняя оценка клиники';
              break;
          }

          return (
            <div
              key={item.name}
              className="relative overflow-hidden rounded-lg bg-white px-4 pb-12 pt-5 shadow sm:px-6 sm:pt-6"
            >
              <dt>
                <div className="absolute rounded-md bg-indigo-500 p-3">
                  <item.icon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <p className="ml-16 truncate text-sm font-medium text-gray-500">{item.name}</p>
              </dt>
              <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
                <p className="text-2xl font-semibold text-gray-900">{value}</p>
                <div className="absolute inset-x-0 bottom-0 bg-gray-50 px-4 py-4 sm:px-6">
                  <div className="text-sm">
                    <p className="text-gray-500">{description}</p>
                  </div>
                </div>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
