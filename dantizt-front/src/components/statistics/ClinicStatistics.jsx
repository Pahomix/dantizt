'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export function ClinicStatistics({ data }) {
  if (!data) return null;

  // Данные для графика финансов
  const financialData = [
    {
      name: 'Средний платеж',
      amount: data.payments.average_amount
    },
    {
      name: 'Общая сумма',
      amount: data.payments.total_amount / data.payments.total_count // Сумма на один платеж
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Карточка с общей статистикой */}
      <Card>
        <CardHeader>
          <CardTitle className="text-gray-900">Общая статистика</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-gray-700">Всего пользователей</p>
            <p className="text-2xl font-bold text-gray-900">{data.users.total}</p>
          </div>
          <div>
            <p className="text-sm text-gray-700">Врачей</p>
            <p className="text-2xl font-bold text-gray-900">{data.users.doctors}</p>
          </div>
          <div>
            <p className="text-sm text-gray-700">Пациентов</p>
            <p className="text-2xl font-bold text-gray-900">{data.users.patients}</p>
          </div>
        </CardContent>
      </Card>

      {/* Карточка с финансовой статистикой */}
      <Card>
        <CardHeader>
          <CardTitle className="text-gray-900">Финансы</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-gray-700">Всего платежей</p>
            <p className="text-2xl font-bold text-gray-900">{data.payments.total_count}</p>
          </div>
          <div>
            <p className="text-sm text-gray-700">Общая сумма</p>
            <p className="text-2xl font-bold text-gray-900">{data.payments.total_amount.toLocaleString()} ₽</p>
          </div>
          <div>
            <p className="text-sm text-gray-700">Средний платеж</p>
            <p className="text-2xl font-bold text-gray-900">{data.payments.average_amount.toLocaleString()} ₽</p>
          </div>
        </CardContent>
      </Card>

      {/* Карточка со статистикой приемов */}
      <Card>
        <CardHeader>
          <CardTitle className="text-gray-900">Приемы</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-gray-700">Всего приемов</p>
            <p className="text-2xl font-bold text-gray-900">{data.appointments.total}</p>
          </div>
          <div>
            <p className="text-sm text-gray-700">Завершено</p>
            <p className="text-2xl font-bold text-gray-900">{data.appointments.completed}</p>
          </div>
          <div>
            <p className="text-sm text-gray-700">Процент завершения</p>
            <p className="text-2xl font-bold text-gray-900">{data.appointments.completion_rate}%</p>
          </div>
        </CardContent>
      </Card>

      {/* График финансовой статистики */}
      <Card className="md:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-gray-900">Финансовая статистика</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={financialData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => [`${value.toLocaleString()} ₽`, 'Сумма']}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    padding: '8px'
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="amount" 
                  fill="#3B82F6" 
                  name="Сумма (₽)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
