'use client';

import React, { useEffect, useState } from 'react';
import { useLogStore } from '@/store/logStore';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export default function LogList() {
  const {
    logs,
    totalLogs,
    currentPage,
    pageSize,
    loading,
    error,
    tables,
    actions,
    filters,
    fetchLogs,
    fetchTables,
    fetchActions,
    setFilters,
    resetFilters,
    setPage,
    setPageSize,
  } = useLogStore();

  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    fetchLogs();
    fetchTables();
    fetchActions();
  }, [fetchLogs, fetchTables, fetchActions]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ [name]: value === '' ? null : value });
  };

  const handleApplyFilters = () => {
    fetchLogs();
  };

  const handleResetFilters = () => {
    resetFilters();
    fetchLogs();
  };

  const handlePageChange = (page) => {
    setPage(page);
  };

  const handleViewDetails = (log) => {
    setSelectedLog(log);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return format(new Date(dateString), 'dd.MM.yyyy HH:mm:ss', { locale: ru });
  };

  const totalPages = Math.ceil(totalLogs / pageSize);
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Журнал действий</h2>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
        >
          {showFilters ? 'Скрыть фильтры' : 'Показать фильтры'}
        </button>
      </div>

      {showFilters && (
        <div className="bg-gray-50 p-4 rounded-md shadow">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Таблица</label>
              <select
                name="table_name"
                value={filters.table_name || ''}
                onChange={handleFilterChange}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Все таблицы</option>
                {tables.map((table) => (
                  <option key={table} value={table}>
                    {table}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Действие</label>
              <select
                name="action_type"
                value={filters.action_type || ''}
                onChange={handleFilterChange}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Все действия</option>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Дата начала</label>
              <input
                type="datetime-local"
                name="start_date"
                value={filters.start_date || ''}
                onChange={handleFilterChange}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Дата окончания</label>
              <input
                type="datetime-local"
                name="end_date"
                value={filters.end_date || ''}
                onChange={handleFilterChange}
                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end space-x-2">
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Сбросить
            </button>
            <button
              onClick={handleApplyFilters}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Применить
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-4">Загрузка...</div>}

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md">
          {error}
        </div>
      )}

      {!loading && logs.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Записи не найдены
        </div>
      )}

      {!loading && logs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Таблица
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действие
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID записи
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {log.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.table_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.action_type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.record_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleViewDetails(log)}
                      className="text-indigo-600 hover:text-indigo-900 px-2 py-1 border border-indigo-600 rounded"
                    >
                      Подробнее
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-4">
          <nav className="inline-flex rounded-md shadow">
            <button
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              &laquo;
            </button>
            {pages.map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-2 border border-gray-300 text-sm font-medium ${
                  currentPage === page
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              &raquo;
            </button>
          </nav>
        </div>
      )}

      {/* Модальное окно с деталями лога */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Детали записи #{selectedLog.id}</h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  &times;
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Таблица</p>
                  <p>{selectedLog.table_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Действие</p>
                  <p>{selectedLog.action_type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">ID записи</p>
                  <p>{selectedLog.record_id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Дата</p>
                  <p>{formatDate(selectedLog.created_at)}</p>
                </div>
              </div>
              
              {selectedLog.old_data && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-500">Старые данные</p>
                  <pre className="mt-1 bg-gray-50 p-2 rounded text-sm overflow-x-auto">
                    {selectedLog.old_data}
                  </pre>
                </div>
              )}
              
              {selectedLog.new_data && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-500">Новые данные</p>
                  <pre className="mt-1 bg-gray-50 p-2 rounded text-sm overflow-x-auto">
                    {selectedLog.new_data}
                  </pre>
                </div>
              )}
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
