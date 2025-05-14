'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import api from '@/lib/axios';
import { showSuccess, showError } from '@/utils/notifications';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState(null);
  const [sortDesc, setSortDesc] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const pageSize = 10;

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/users', {
        params: {
          skip: currentPage * pageSize,
          limit: pageSize,
          search: searchQuery || undefined,
          sort_by: sortField,
          sort_desc: sortDesc,
          role: roleFilter || undefined,
          _is_active: statusFilter === '' ? undefined : statusFilter === 'active'
        }
      });
      setUsers(response.data.items);
      setTotalUsers(response.data.total);
    } catch (error) {
      showError('Ошибка при загрузке пользователей');
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchQuery, sortField, sortDesc, roleFilter, statusFilter]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(false);
    }
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Вы уверены, что хотите удалить этого пользователя?')) {
      try {
        await api.delete(`/users/${userId}`);
        await fetchUsers();
        showSuccess('Пользователь успешно удален');
      } catch (error) {
        showError('Ошибка при удалении пользователя');
        console.error('Error deleting user:', error);
      }
    }
  };

  const handleBulkStatusUpdate = async (isActive) => {
    if (selectedUsers.length === 0) {
      showError('Выберите пользователей для обновления');
      return;
    }

    try {
      await api.post('/users/bulk-update', {
        user_ids: selectedUsers,
        is_active: isActive
      });
      await fetchUsers();
      setSelectedUsers([]);
      showSuccess(`Пользователи успешно ${isActive ? 'активированы' : 'деактивированы'}`);
    } catch (error) {
      showError('Ошибка при обновлении пользователей');
      console.error('Error updating users:', error);
    }
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAllUsers = () => {
    setSelectedUsers(prev => 
      prev.length === users.length
        ? []
        : users.map(user => user.id)
    );
  };

  const totalPages = Math.ceil(totalUsers / pageSize);

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Пользователи</h1>
          <p className="mt-2 text-sm text-gray-700">
            Список всех пользователей системы
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            onClick={() => {
              setSelectedUser(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Добавить
          </button>
        </div>
      </div>

      {/* Фильтры и поиск */}
      <div className="mt-4 space-y-4">
        {/* Фильтры */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative rounded-md shadow-sm w-64">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(0);
              }}
              placeholder="Поиск..."
              className="block w-full rounded-md border-gray-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setCurrentPage(0);
            }}
            className="block w-48 rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
          >
            <option value="">Все роли</option>
            <option value="admin">Администратор</option>
            <option value="doctor">Врач</option>
            <option value="patient">Пациент</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(0);
            }}
            className="block w-48 rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
          >
            <option value="">Все статусы</option>
            <option value="active">Активные</option>
            <option value="inactive">Неактивные</option>
          </select>
        </div>

        {/* Кнопки массовых действий */}
        <div className="flex justify-end border-t border-gray-200 pt-4">
          {selectedUsers.length > 0 && (
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-700">
                Выбрано пользователей: {selectedUsers.length}
              </span>
              <button
                onClick={() => handleBulkStatusUpdate(true)}
                className="inline-flex items-center rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
              >
                <span className="mr-1.5">✓</span>
                Активировать
              </button>
              <button
                onClick={() => handleBulkStatusUpdate(false)}
                className="inline-flex items-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
              >
                <span className="mr-1.5">×</span>
                Деактивировать
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="relative px-6 py-3">
                      <input
                        type="checkbox"
                        className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedUsers.length === users.length && users.length > 0}
                        onChange={handleSelectAllUsers}
                      />
                    </th>
                    <th 
                      scope="col" 
                      className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 cursor-pointer"
                      onClick={() => handleSort('full_name')}
                    >
                      <div className="group inline-flex">
                        ФИО
                        <span className="ml-2 flex-none rounded text-gray-400">
                          {sortField === 'full_name' ? (
                            sortDesc ? (
                              <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
                            ) : (
                              <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                            )
                          ) : (
                            <ChevronUpIcon className="h-5 w-5 invisible group-hover:visible" aria-hidden="true" />
                          )}
                        </span>
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
                      onClick={() => handleSort('email')}
                    >
                      <div className="group inline-flex">
                        Email
                        <span className="ml-2 flex-none rounded text-gray-400">
                          {sortField === 'email' ? (
                            sortDesc ? (
                              <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
                            ) : (
                              <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                            )
                          ) : (
                            <ChevronUpIcon className="h-5 w-5 invisible group-hover:visible" aria-hidden="true" />
                          )}
                        </span>
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
                      onClick={() => handleSort('role')}
                    >
                      <div className="group inline-flex">
                        Роль
                        <span className="ml-2 flex-none rounded text-gray-400">
                          {sortField === 'role' ? (
                            sortDesc ? (
                              <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
                            ) : (
                              <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                            )
                          ) : (
                            <ChevronUpIcon className="h-5 w-5 invisible group-hover:visible" aria-hidden="true" />
                          )}
                        </span>
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer"
                      onClick={() => handleSort('is_active')}
                    >
                      <div className="group inline-flex">
                        Статус
                        <span className="ml-2 flex-none rounded text-gray-400">
                          {sortField === 'is_active' ? (
                            sortDesc ? (
                              <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
                            ) : (
                              <ChevronUpIcon className="h-5 w-5" aria-hidden="true" />
                            )
                          ) : (
                            <ChevronUpIcon className="h-5 w-5 invisible group-hover:visible" aria-hidden="true" />
                          )}
                        </span>
                      </div>
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Действия</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {isLoading ? (
                    <tr>
                      <td colSpan="6" className="text-center py-4">
                        <div className="flex justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                        </div>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-4 text-gray-500">
                        {searchQuery || roleFilter || statusFilter ? 'Пользователи не найдены' : 'Нет пользователей'}
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td className="relative px-6 py-4">
                          <input
                            type="checkbox"
                            className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            checked={selectedUsers.includes(user.id)}
                            onChange={() => handleSelectUser(user.id)}
                          />
                        </td>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {user.full_name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{user.email}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {user.role === 'admin' && 'Администратор'}
                          {user.role === 'doctor' && 'Врач'}
                          {user.role === 'patient' && 'Пациент'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          <span
                            className={classNames(
                              user.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800',
                              'inline-flex rounded-full px-2 text-xs font-semibold leading-5'
                            )}
                          >
                            {user.is_active ? 'Активен' : 'Неактивен'}
                          </span>
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsModalOpen(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            <PencilIcon className="h-5 w-5" aria-hidden="true" />
                            <span className="sr-only">Редактировать</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(user.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="h-5 w-5" aria-hidden="true" />
                            <span className="sr-only">Удалить</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Пагинация */}
      {!isLoading && users.length > 0 && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className={classNames(
                "relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium",
                currentPage === 0
                  ? "text-gray-300"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              Предыдущая
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage >= totalPages - 1}
              className={classNames(
                "relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium",
                currentPage >= totalPages - 1
                  ? "text-gray-300"
                  : "text-gray-700 hover:bg-gray-50"
              )}
            >
              Следующая
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Показано <span className="font-medium">{currentPage * pageSize + 1}</span>{' '}
                по{' '}
                <span className="font-medium">
                  {Math.min((currentPage + 1) * pageSize, totalUsers)}
                </span>{' '}
                из <span className="font-medium">{totalUsers}</span> результатов
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className={classNames(
                    "relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300",
                    currentPage === 0
                      ? "cursor-not-allowed"
                      : "hover:bg-gray-50"
                  )}
                >
                  <span className="sr-only">Предыдущая</span>
                  <ChevronUpIcon className="h-5 w-5 rotate-90" aria-hidden="true" />
                </button>
                {[...Array(totalPages)].map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPage(index)}
                    className={classNames(
                      "relative inline-flex items-center px-4 py-2 text-sm font-semibold",
                      index === currentPage
                        ? "z-10 bg-indigo-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                        : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                    )}
                  >
                    {index + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className={classNames(
                    "relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300",
                    currentPage >= totalPages - 1
                      ? "cursor-not-allowed"
                      : "hover:bg-gray-50"
                  )}
                >
                  <span className="sr-only">Следующая</span>
                  <ChevronDownIcon className="h-5 w-5 -rotate-90" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <UserModal
          user={selectedUser}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedUser(null);
          }}
          onSave={async (userData) => {
            try {
              if (selectedUser) {
                await api.put(`/users/${selectedUser.id}`, userData);
                showSuccess('Пользователь успешно обновлен');
              } else {
                await api.post('/users', userData);
                showSuccess('Пользователь успешно создан');
              }
              await fetchUsers();
              setIsModalOpen(false);
              setSelectedUser(null);
            } catch (error) {
              showError(error.response?.data?.detail || 'Ошибка при сохранении пользователя');
              console.error('Error saving user:', error);
            }
          }}
        />
      )}
    </div>
  );
}

function UserModal({ user, onClose, onSave }) {
  const [formData, setFormData] = useState({
    email: user?.email || '',
    full_name: user?.full_name || '',
    role: user?.role || 'patient',
    is_active: user?.is_active ?? true,
    password: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const inputClasses = "block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity animate-[fadeIn_0.2s_ease-in-out]" onClick={onClose} />
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all animate-[slideIn_0.3s_ease-out] sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
          <form onSubmit={handleSubmit}>
            <div>
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                {user ? 'Редактировать пользователя' : 'Добавить пользователя'}
              </h3>
              <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-6">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <div className="mt-1">
                    <input
                      type="email"
                      name="email"
                      id="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={inputClasses}
                    />
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                    ФИО
                  </label>
                  <div className="mt-1">
                    <input
                      type="text"
                      name="full_name"
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className={inputClasses}
                    />
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                    Роль
                  </label>
                  <div className="mt-1">
                    <select
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className={inputClasses}
                    >
                      <option value="patient">Пациент</option>
                      <option value="doctor">Врач</option>
                      <option value="admin">Администратор</option>
                    </select>
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    {user ? 'Новый пароль' : 'Пароль'}
                  </label>
                  <div className="mt-1">
                    <input
                      type="password"
                      name="password"
                      id="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={inputClasses}
                      placeholder={user ? 'Оставьте пустым, чтобы не менять' : 'Введите пароль'}
                    />
                  </div>
                </div>

                <div className="sm:col-span-6">
                  <div className="flex items-center">
                    <input
                      id="is_active"
                      name="is_active"
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                      Активен
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
              <button
                type="submit"
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm"
              >
                Сохранить
              </button>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
