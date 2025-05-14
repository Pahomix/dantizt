'use client';

import Notifications from '@/components/Notifications';

export default function RootLayoutClient({ children }) {
  return (
    <>
      {children}
      <Notifications />
    </>
  );
}
