'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import {
  Bars3Icon,
  XMarkIcon,
  UserGroupIcon,
  CalendarIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ClockIcon,
  BellIcon,
  DocumentCheckIcon,
  UserIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Главная', href: '/reception/dashboard', icon: HomeIcon },
  { name: 'Пациенты', href: '/reception/patients', icon: UserGroupIcon },
  { name: 'Записи на прием', href: '/reception/appointments', icon: CalendarIcon },
  { name: 'Платежи', href: '/reception/payments', icon: CurrencyDollarIcon },
  { name: 'Справки', href: '/reception/documents', icon: DocumentCheckIcon },
  { name: 'Расписание врачей', href: '/reception/schedules', icon: ClockIcon },
];

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function ReceptionLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const handleNavigation = (href) => {
    setSidebarOpen(false);
    router.push(href);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      <div 
        className={classNames(
          'fixed inset-0 z-50 bg-gray-900/80 lg:hidden',
          sidebarOpen ? 'block' : 'hidden'
        )} 
        onClick={() => setSidebarOpen(false)} 
      />

      {/* Sidebar */}
      <div className={classNames(
        'fixed inset-y-0 left-0 z-50 w-72 bg-white shadow-xl transition-transform lg:block lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex h-16 items-center justify-between px-6 border-b">
          <div 
            className="text-xl font-semibold text-gray-900 cursor-pointer" 
            onClick={() => handleNavigation('/reception/dashboard')}
          >
            Регистратура
          </div>
          <button
            type="button"
            className="lg:hidden -m-2.5 p-2.5 text-gray-700 hover:text-gray-900"
            onClick={() => setSidebarOpen(false)}
          >
            <span className="sr-only">Закрыть сайдбар</span>
            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <nav className="mt-6 px-3">
          <ul role="list" className="space-y-1">
            {navigation.map((item) => (
              <li key={item.name}>
                <button
                  onClick={() => handleNavigation(item.href)}
                  className={classNames(
                    pathname === item.href
                      ? 'bg-gray-50 text-indigo-600'
                      : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50',
                    'group flex w-full gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold'
                  )}
                >
                  <item.icon
                    className={classNames(
                      pathname === item.href
                        ? 'text-indigo-600'
                        : 'text-gray-400 group-hover:text-indigo-600',
                      'h-6 w-6 shrink-0'
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Открыть сайдбар</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
          </button>

          <div className="flex flex-1 gap-x-4 self-stretch items-center justify-end">
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* Notifications */}
              <button
                className="relative p-2 text-gray-400 hover:text-gray-500"
                onClick={() => {/* TODO: Показать уведомления */}}
              >
                <BellIcon className="h-6 w-6" />
                {notifications.length > 0 && (
                  <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-600" />
                )}
              </button>

              {/* Profile dropdown */}
              <div className="relative">
                <button
                  className="flex items-center gap-x-2 text-sm"
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                >
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                    {user.full_name?.charAt(0) || 'У'}
                  </div>
                </button>

                {profileMenuOpen && (
                  <div 
                    className="absolute right-0 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
                    role="menu"
                  >
                    <div className="py-1" role="none">
                      <div className="px-4 py-2 text-sm">
                        <p className="font-medium text-gray-900">
                          {user.full_name}
                        </p>
                        <p className="text-gray-500">
                          {user.email}
                        </p>
                      </div>
                      <div className="border-t border-gray-100" />
                      <button
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          router.push('/reception/profile');
                        }}
                      >
                        Профиль
                      </button>
                      <div className="border-t border-gray-100" />
                      <button
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          handleLogout();
                        }}
                      >
                        Выйти
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
