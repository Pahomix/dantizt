'use client';

import { useEffect } from 'react';
import LogList from '@/components/admin/LogList';
import { useLogStore } from '@/store/logStore';

export default function LogsPage() {
  const { fetchLogs, error } = useLogStore();

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (error) {
    return (
      <div className="p-4">
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded-md">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <LogList />
    </div>
  );
}