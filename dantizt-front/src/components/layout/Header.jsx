'use client';

import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { useUser } from '@/hooks/useUser';
import { useRouter } from 'next/navigation';
import {
  BellIcon,
  UserCircleIcon,
  LogoutIcon,
} from '@heroicons/react/outline';

export default function Header() {
  const { user } = useUser();
  const router = useRouter();

  const handleLogout = async () => {
    // Очищаем куки и перенаправляем на страницу входа
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    router.push('/login');
  };

  return (
    <div className="flex-shrink-0 h-16 bg-white border-b border-gray-200 flex">
      <div className="flex-1 px-4 flex justify-between">
        <div className="flex-1 flex">
          <h1 className="text-2xl font-semibold text-gray-900 my-auto">
            DantiZT
          </h1>
        </div>
        <div className="ml-4 flex items-center md:ml-6">
          {/* Notifications */}
          <button className="p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            <span className="sr-only">Уведомления</span>
            <BellIcon className="h-6 w-6" />
          </button>

          {/* Profile dropdown */}
          <Menu as="div" className="ml-3 relative">
            <Menu.Button className="max-w-xs bg-white flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              <span className="sr-only">Открыть меню пользователя</span>
              <UserCircleIcon className="h-8 w-8 text-gray-400" />
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="px-4 py-2 text-sm text-gray-700">
                  <div>{user?.full_name}</div>
                  <div className="text-sm text-gray-500">{user?.email}</div>
                </div>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleLogout}
                      className={`${
                        active ? 'bg-gray-100' : ''
                      } flex w-full px-4 py-2 text-sm text-gray-700`}
                    >
                      <LogoutIcon className="mr-3 h-5 w-5 text-gray-400" />
                      Выйти
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>
    </div>
  );
}
