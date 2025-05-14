import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

export default function ProtectedRoute({ children, roles }) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (roles && !roles.includes(user?.role)) {
      router.replace('/403');
    }
  }, [isAuthenticated, user, roles, router]);

  if (!isAuthenticated) {
    return null;
  }

  if (roles && !roles.includes(user?.role)) {
    return null;
  }

  return children;
}
