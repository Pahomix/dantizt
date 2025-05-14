import { UserRole } from './roles';

export const HOME_ROUTES = {
  [UserRole.ADMIN]: '/dashboard',
  [UserRole.DOCTOR]: '/dashboard',
  [UserRole.PATIENT]: '/dashboard',
};

export const DEFAULT_HOME = '/dashboard';
