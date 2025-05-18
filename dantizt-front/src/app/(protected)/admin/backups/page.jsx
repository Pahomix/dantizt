'use client';

import { useEffect } from 'react';
import BackupList from '@/components/admin/BackupList';
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
      <BackupList
        backups={backups}
        onRestore={restoreBackup}
        onDelete={deleteBackup}
        isLoading={loading}
      />
    </div>
  );
}
