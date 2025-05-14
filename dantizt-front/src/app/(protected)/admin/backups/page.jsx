'use client';

import { useEffect } from 'react';
import { BackupList } from '@/components/admin/BackupList';
import { useBackupStore } from '@/store/backupStore';

export default function BackupsPage() {
  const { backups, loading, error, fetchBackups, createBackup, restoreBackup, deleteBackup } = useBackupStore();

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleCreateBackup = async () => {
    try {
      await createBackup();
      alert('Backup created successfully');
    } catch (error) {
      alert(error.message);
    }
  };

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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Database Backups</h1>
        <button
          onClick={handleCreateBackup}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating...
            </>
          ) : (
            'Create Backup'
          )}
        </button>
      </div>

      <BackupList
        backups={backups}
        onRestore={restoreBackup}
        onDelete={deleteBackup}
        isLoading={loading}
      />
    </div>
  );
}
