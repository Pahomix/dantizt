'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import api from '@/lib/axios';
import { showError, showSuccess } from '@/utils/notifications';
import { 
  BellIcon, 
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  CalendarIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';

const NOTIFICATION_ICONS = {
  appointment: CalendarIcon,
  payment: CurrencyDollarIcon,
  system: InformationCircleIcon,
  alert: ExclamationCircleIcon,
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications/me');
      setNotifications(response.data);
    } catch (error) {
      setError('Ошибка при загрузке уведомлений');
      showError('Не удалось загрузить уведомления');
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await api.post(`/notifications/${notificationId}/read`);
      setNotifications(notifications.map(notification => 
        notification.id === notificationId 
          ? { ...notification, is_read: true }
          : notification
      ));
      showSuccess('Уведомление отмечено как прочитанное');
    } catch (error) {
      showError('Не удалось отметить уведомление как прочитанное');
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications(notifications.map(notification => ({
        ...notification,
        is_read: true
      })));
      showSuccess('Все уведомления отмечены как прочитанные');
    } catch (error) {
      showError('Не удалось отметить уведомления как прочитанные');
      console.error('Error marking all notifications as read:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen text-red-600">
        {error}
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-gray-900">Уведомления</h1>
          {unreadCount > 0 && (
            <span className="ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
              {unreadCount} новых
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <CheckCircleIcon className="h-5 w-5 mr-2 text-gray-400" />
            Отметить все как прочитанные
          </button>
        )}
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <BellIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Нет уведомлений</h3>
            <p className="mt-1 text-sm text-gray-500">У вас пока нет новых уведомлений</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const Icon = NOTIFICATION_ICONS[notification.type] || InformationCircleIcon;
            return (
              <div
                key={notification.id}
                className={`
                  bg-white shadow rounded-lg p-4 transition-colors
                  ${!notification.is_read ? 'border-l-4 border-indigo-500' : ''}
                `}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <Icon className={`
                      h-6 w-6
                      ${!notification.is_read ? 'text-indigo-500' : 'text-gray-400'}
                    `} />
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {notification.title}
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {notification.message}
                    </div>
                    <div className="mt-2 text-xs text-gray-400 flex justify-between items-center">
                      <span>
                        {format(new Date(notification.created_at), 'PPp', { locale: ru })}
                      </span>
                      {!notification.is_read && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="text-indigo-600 hover:text-indigo-800"
                        >
                          Отметить как прочитанное
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}