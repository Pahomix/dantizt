import { UserRole } from './roles';

export const HOME_ROUTES = {
  [UserRole.ADMIN]: '/admin/statistics',
  [UserRole.DOCTOR]: '/doctor',
  [UserRole.PATIENT]: '/patient',
  'reception': '/reception/dashboard', // Добавляем роль reception, которая используется в middleware
};

export const DEFAULT_HOME = '/dashboard';
