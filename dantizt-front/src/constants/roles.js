export const UserRole = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  PATIENT: 'patient',
};

export const RoleAccess = {
  [UserRole.ADMIN]: {
    routes: [
      '/dashboard',
      '/doctors',
      '/patients',
      '/appointments',
      '/services',
      '/schedules',
      '/medical-records',
      '/diagnoses',
      '/treatment-plans',
      '/settings',
    ],
    permissions: ['read', 'write', 'delete', 'manage'],
  },
  [UserRole.DOCTOR]: {
    routes: [
      '/dashboard',
      '/patients',
      '/appointments',
      '/medical-records',
      '/diagnoses',
      '/treatment-plans',
    ],
    permissions: ['read', 'write'],
  },
  [UserRole.PATIENT]: {
    routes: [
      '/dashboard',
      '/appointments',
      '/medical-records',
      '/treatment-plans',
    ],
    permissions: ['read'],
  },
};
