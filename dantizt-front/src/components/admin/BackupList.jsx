import React, { useEffect } from 'react';
import { useBackupStore } from '@/store/backupStore';

export default function BackupList() {
  const { backups, fetchBackups, createBackup, restoreBackup, downloadBackup, deleteBackup, loading } = useBackupStore();

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleCreateBackup = async () => {
    await createBackup();
  };

  const handleRestoreBackup = async (filename) => {
    if (confirm('Вы уверены, что хотите восстановить базу данных из этой резервной копии? Все текущие данные будут заменены.')) {
      await restoreBackup(filename);
    }
  };

  const handleDownloadBackup = async (filename) => {
    await downloadBackup(filename);
  };

  const handleDeleteBackup = async (filename) => {
    if (confirm('Вы уверены, что хотите удалить эту резервную копию?')) {
      await deleteBackup(filename);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Резервные копии</h2>
        <button
          onClick={handleCreateBackup}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Создание...' : 'Создать резервную копию'}
        </button>
      </div>

      {loading && <div className="text-center py-4">Загрузка...</div>}

      {!loading && backups.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Резервные копии не найдены
        </div>
      )}

      {!loading && backups.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Имя файла
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата создания
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Размер
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {backups.map((backup) => (
                <tr key={backup.filename}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {backup.filename}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(backup.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {backup.size_human || Math.round(backup.size_bytes / (1024*1024)) + ' MB'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex space-x-2">
                    <button
                      onClick={() => handleDownloadBackup(backup.filename)}
                      className="text-blue-600 hover:text-blue-900 px-2 py-1 border border-blue-600 rounded"
                      disabled={loading}
                    >
                      Скачать
                    </button>
                    <button
                      onClick={() => handleRestoreBackup(backup.filename)}
                      className="text-indigo-600 hover:text-indigo-900 px-2 py-1 border border-indigo-600 rounded"
                      disabled={loading}
                    >
                      Восстановить
                    </button>
                    <button
                      onClick={() => handleDeleteBackup(backup.filename)}
                      className="text-red-600 hover:text-red-900 px-2 py-1 border border-red-600 rounded"
                      disabled={loading}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
