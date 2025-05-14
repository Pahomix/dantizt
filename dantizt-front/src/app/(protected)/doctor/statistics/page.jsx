'use client';

import { useEffect, useState } from 'react';
import { useStatisticsStore } from '@/store/statisticsStore';
import { useDoctorStore } from '@/store/doctorStore';
import { DoctorStatistics } from '@/components/statistics/DoctorStatistics';
import { Spinner } from '@/components/ui/spinner';

export default function DoctorStatisticsPage() {
  const { doctorStats, loading, error, fetchDoctorStatistics } = useStatisticsStore();
  const { doctorProfile } = useDoctorStore();
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    to: new Date(),
  });

  useEffect(() => {
    if (doctorProfile?.id) {
      fetchDoctorStatistics(doctorProfile.id, dateRange.from, dateRange.to);
    }
  }, [doctorProfile?.id, dateRange, fetchDoctorStatistics]);

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Моя статистика</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => fetchDoctorStatistics(doctorProfile?.id, dateRange.from, dateRange.to)}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            Обновить
          </button>
        </div>
      </div>

      <DoctorStatistics data={doctorStats} />
    </div>
  );
}
