'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CalendarIcon, 
  UserGroupIcon, 
  CurrencyDollarIcon, 
  DocumentCheckIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/axios';
import { toast } from 'react-toastify';

export default function ReceptionDashboard() {
  const [stats, setStats] = useState({
    todayAppointments: 0,
    pendingPayments: 0,
    waitingPatients: 0,
    documentsToIssue: 0
  });
  const [doctorsSchedule, setDoctorsSchedule] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    // Запрос к API для получения статистики
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/statistics/reception/dashboard');
        const data = response.data;
        
        setStats({
          todayAppointments: data.todayAppointments || 0,
          pendingPayments: data.pendingPayments || 0,
          waitingPatients: data.waitingPatients || 0,
          documentsToIssue: data.documentsToIssue || 0
        });
        
        setDoctorsSchedule(data.doctorsSchedule || []);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching stats:', error);
        toast.error('Ошибка при загрузке данных дашборда');
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const quickLinks = [
    { 
      name: 'Записи на сегодня', 
      href: '/reception/appointments', 
      icon: CalendarIcon, 
      color: 'bg-blue-500',
      count: stats.todayAppointments 
    },
    { 
      name: 'Ожидающие оплаты', 
      href: '/reception/payments', 
      icon: CurrencyDollarIcon, 
      color: 'bg-green-500',
      count: stats.pendingPayments 
    },
    { 
      name: 'Пациенты в ожидании', 
      href: '/reception/patients', 
      icon: UserGroupIcon, 
      color: 'bg-purple-500',
      count: stats.waitingPatients 
    },
    { 
      name: 'Справки к выдаче', 
      href: '/reception/documents', 
      icon: DocumentCheckIcon, 
      color: 'bg-amber-500',
      count: stats.documentsToIssue 
    },
  ];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Панель регистратуры</h1>
        <p className="mt-1 text-sm text-gray-500">
          Добро пожаловать, {user?.full_name}. Вот основная информация на сегодня.
        </p>
      </div>

      {/* Быстрые ссылки */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((link) => (
          <div
            key={link.name}
            className="overflow-hidden rounded-lg bg-white shadow cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push(link.href)}
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className={`${link.color} rounded-md p-3`}>
                  <link.icon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">{link.name}</dt>
                    <dd>
                      <div className="text-lg font-medium text-gray-900">{link.count}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Расписание врачей на сегодня */}
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900">Расписание врачей на сегодня</h2>
        <div className="mt-4 overflow-hidden rounded-lg bg-white shadow">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Врач
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Специализация
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Время работы
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Записи
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {doctorsSchedule.length > 0 ? (
                  doctorsSchedule.map((doctor) => (
                    <tr key={doctor.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {doctor.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {doctor.specialty}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {doctor.work_hours}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {doctor.appointments}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          doctor.status === 'Работает' 
                            ? 'bg-green-100 text-green-800' 
                            : doctor.status === 'Отпуск' 
                              ? 'bg-blue-100 text-blue-800'
                              : doctor.status === 'Больничный'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                        }`}>
                          {doctor.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                      Нет данных о расписании врачей на сегодня
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
