'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthContext } from '@/providers/AuthProvider';
import { RoleAccess } from '@/constants/roles';
import {
  HomeIcon,
  UserGroupIcon,
  UserMdIcon,
  CalendarIcon,
  ClipboardListIcon,
  HeartIcon,
  CogIcon,
  MenuIcon,
  XIcon,
  ChartBarIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  ClockIcon,
} from '@heroicons/react/outline';

const navigation = [
  { name: 'Панель управления', href: '/admin/dashboard', icon: HomeIcon },
  { name: 'Статистика', href: '/admin/statistics', icon: ChartBarIcon },
  { name: 'Врачи', href: '/admin/doctors', icon: UserMdIcon },
  { name: 'Пациенты', href: '/admin/patients', icon: UserGroupIcon },
  { name: 'Расписание', href: '/admin/schedules', icon: ClockIcon },
  { name: 'Медкарты', href: '/admin/medical-records', icon: DocumentTextIcon },
  { name: 'Услуги', href: '/admin/services', icon: CurrencyDollarIcon },
  { name: 'Настройки', href: '/admin/settings', icon: CogIcon },
];

export default function Sidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuthContext();
  const userAccess = RoleAccess[user?.role] || { routes: [] };

  const filteredNavigation = navigation.filter(item =>
    userAccess.routes.some(route => route === item.href || route.startsWith(`${item.href}/`))
  );

  return (
    <>
      <div className="lg:hidden">
        <button
          className="p-2 text-gray-500 hover:text-gray-600"
          onClick={() => setSidebarOpen(true)}
        >
          <MenuIcon className="h-6 w-6" />
        </button>
      </div>

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-0 flex z-40 lg:hidden ${
          sidebarOpen ? 'visible' : 'invisible'
        }`}
      >
        <div
          className={`fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity duration-300 ${
            sidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setSidebarOpen(false)}
        />

        <div
          className={`relative flex-1 flex flex-col max-w-xs w-full bg-white transform transition-transform duration-300 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <XIcon className="h-6 w-6 text-white" />
            </button>
          </div>

          <nav className="flex-1 px-2 pb-4 space-y-1">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <item.icon
                    className={`mr-3 flex-shrink-0 h-6 w-6 ${
                      isActive
                        ? 'text-gray-500'
                        : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col flex-grow border-r border-gray-200 bg-white overflow-y-auto">
            <nav className="flex-1 px-2 pb-4 space-y-1">
              {filteredNavigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                      isActive
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon
                      className={`mr-3 flex-shrink-0 h-6 w-6 ${
                        isActive
                          ? 'text-gray-500'
                          : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}
