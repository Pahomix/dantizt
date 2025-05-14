'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  CalendarIcon, 
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/auth.store';
import { usePatientStore } from '@/store/patientStore';
import { usePaymentsStore } from '@/store/paymentsStore';

const stats = [
  { name: 'Медицинские записи', href: '/patient/medical-records', description: 'всего записей', icon: ClipboardDocumentListIcon },
  { name: 'Записи на прием', href: '/patient/appointments', description: 'предстоящих приемов', icon: CalendarIcon },
  { name: 'Платежи', href: '/patient/payments', description: 'ожидают оплаты', icon: CurrencyDollarIcon },
];

export default function PatientDashboard() {
  const router = useRouter();
  const { patientProfile, loading: profileLoading, fetchPatientProfile } = usePatientStore();
  const { payments, fetchPatientPayments } = usePaymentsStore();
  const [statistics, setStatistics] = useState({
    medicalRecordsCount: 0,
    upcomingAppointments: 0,
    pendingPayments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const profile = await fetchPatientProfile();
        
        if (profile?.id) {
          const response = await api.get(`/statistics/patient/${profile.id}`);
          const data = response.data;

          setStatistics({
            medicalRecordsCount: data.medical_records?.total || 0,
            upcomingAppointments: data.appointments?.upcoming || 0,
            pendingPayments: data.payments?.pending_count || 0,
          });
        }
      } catch (error) {
        console.error('Error fetching patient statistics:', error);
        setError(error.response?.data?.detail || 'Ошибка при загрузке статистики');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (patientProfile?.id) {
      fetchPatientPayments();
    }
  }, [patientProfile?.id]);

  useEffect(() => {
    // Фильтруем неоплаченные платежи
    const pending = payments?.filter(payment => payment.status === 'pending') || [];
    setPendingPayments(pending);
  }, [payments]);

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600">Ошибка</h2>
          <p className="mt-2 text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!patientProfile?.id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Профиль пациента не найден</h2>
          <p className="mt-2 text-gray-600">Пожалуйста, обратитесь к администратору</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">
          Личный кабинет
        </h1>
      </div>

      {/* Блок с неоплаченными платежами */}
      {statistics.pendingPayments > 0 && (
        <div className="mt-6">
          <div className="rounded-lg bg-yellow-50 p-4">
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
                    У вас есть {statistics.pendingPayments} неоплаченных {statistics.pendingPayments === 1 ? 'услуга' : 'услуг'}. 
                    Пожалуйста, оплатите их для продолжения лечения.
                  </p>
                </div>
                <div className="mt-4">
                  <div className="-mx-2 -my-1.5 flex">
                    <Link
                      href="/patient/payments"
                      className="rounded-md bg-yellow-100 px-2 py-1.5 text-sm font-medium text-yellow-800 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-600 focus:ring-offset-2 focus:ring-offset-yellow-50"
                    >
                      Перейти к оплате
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((item, index) => {
            let value = 0;
            switch (index) {
              case 0:
                value = statistics.medicalRecordsCount;
                break;
              case 1:
                value = statistics.upcomingAppointments;
                break;
              case 2:
                value = statistics.pendingPayments;
                break;
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className="relative bg-white pt-5 px-4 pb-12 sm:pt-6 sm:px-6 shadow rounded-lg overflow-hidden hover:bg-gray-50"
              >
                <dt>
                  <div className="absolute bg-indigo-500 rounded-md p-3">
                    <item.icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  <p className="ml-16 text-sm font-medium text-gray-500 truncate">
                    {item.name}
                  </p>
                </dt>
                <dd className="ml-16 pb-6 flex items-baseline sm:pb-7">
                  <p className="text-2xl font-semibold text-gray-900">{value}</p>
                  <p className="ml-2 flex items-baseline text-sm font-semibold text-gray-500">
                    {item.description}
                  </p>
                </dd>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Остальные блоки */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:border-gray-400">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <CalendarIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <Link href="/patient/appointments/new" className="focus:outline-none">
                <span className="absolute inset-0" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900">Записаться на прием</p>
                <p className="truncate text-sm text-gray-500">Выберите удобное время для посещения врача</p>
              </Link>
            </div>
          </div>
        </div>

        <div className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm hover:border-gray-400">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <ClipboardDocumentListIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <Link href="/patient/medical-records" className="focus:outline-none">
                <span className="absolute inset-0" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900">Медицинская карта</p>
                <p className="truncate text-sm text-gray-500">Просмотр истории лечения и медицинских записей</p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
