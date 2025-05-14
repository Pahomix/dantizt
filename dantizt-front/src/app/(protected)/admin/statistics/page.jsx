'use client';

import { useEffect } from 'react';
import { useStatisticsStore } from '@/store/statisticsStore';
import { ClinicStatistics } from '@/components/statistics/ClinicStatistics';
import { Spinner } from '@/components/ui/spinner';

export default function StatisticsPage() {
  const { clinicStats, loading, error, fetchClinicStatistics } = useStatisticsStore();

  useEffect(() => {
    fetchClinicStatistics();
  }, [fetchClinicStatistics]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500">
        Произошла ошибка при загрузке статистики
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Статистика клиники</h1>
        <button
          onClick={() => fetchClinicStatistics()}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
        >
          Обновить
        </button>
      </div>

      <ClinicStatistics data={clinicStats} />
    </div>
  );
}
