'use client';

import { useState } from 'react';
import { CalendarIcon } from '@heroicons/react/24/outline';

export function DoctorStatistics({ data }) {
  if (!data) return null;

  const {
    appointments: {
      total: total_appointments,
      completed: completed_appointments,
      cancelled: cancelled_appointments,
    },
    payments: {
      total_count: total_payments,
      total_amount,
      average_amount,
    },
    treatment_plans: {
      total: total_treatments,
      completed: completed_treatments,
    },
  } = data;

  const stats = [
    {
      name: 'Всего приемов',
      value: total_appointments,
      description: `Завершено: ${completed_appointments}, Отменено: ${cancelled_appointments}`,
    },
    {
      name: 'Общая сумма оплат',
      value: `${total_amount?.toLocaleString() || 0} ₽`,
      description: `Средний чек: ${average_amount?.toLocaleString() || 0} ₽`,
    },
    {
      name: 'Количество оплат',
      value: total_payments || 0,
      description: 'Успешно проведенные платежи',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.name}
          className="relative overflow-hidden rounded-lg bg-white px-4 pb-12 pt-5 shadow sm:px-6 sm:pt-6"
        >
          <dt>
            <div className="absolute rounded-md bg-indigo-500 p-3">
              <CalendarIcon className="h-6 w-6 text-white" aria-hidden="true" />
            </div>
            <p className="ml-16 truncate text-sm font-medium text-gray-500">{stat.name}</p>
          </dt>
          <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
            <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
            <div className="absolute inset-x-0 bottom-0 bg-gray-50 px-4 py-4 sm:px-6">
              <div className="text-sm text-gray-500">
                {stat.description}
              </div>
            </div>
          </dd>
        </div>
      ))}
    </div>
  );
}
