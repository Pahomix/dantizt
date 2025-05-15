import { NextResponse } from 'next/server';

// Базовый URL для редиректов
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

const roleRoutes = {
  admin: ['/admin', '/admin/users', '/admin/schedules', '/admin/services', '/admin/diagnoses', '/admin/reviews', '/admin/payments', '/admin/statistics', '/admin/settings'],
  doctor: ['/doctor', '/doctor/appointments', '/doctor/patients', '/doctor/profile'],
  patient: ['/patient', '/patient/appointments', '/patient/medical-records', '/patient/profile'],
  reception: ['/reception', '/reception/dashboard', '/reception/patients', '/reception/appointments', '/reception/payments', '/reception/documents', '/reception/schedules'],
};

const publicRoutes = ['/', '/auth/login', '/auth/register', '/auth/verify-email', '/verify-email', '/payment/success', '/payment/fail'];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  
  console.log('Middleware - Path:', pathname);
  console.log('Middleware - Full URL:', request.url);
  console.log('Middleware - Public routes:', publicRoutes);
  console.log('Middleware - Is public route:', publicRoutes.includes(pathname));
  
  // Публичные маршруты доступны всем
  if (publicRoutes.includes(pathname)) {
    console.log('Middleware - Allowing public route');
    return NextResponse.next();
  }

  // Получаем токены из куки
  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;
  
  console.log('Middleware - Access token:', !!accessToken);
  console.log('Middleware - Refresh token:', !!refreshToken);

  // Если нет токенов, редиректим на страницу входа
  if (!accessToken && !refreshToken) {
    console.log('Middleware - No tokens found, redirecting to login');
    const loginUrl = new URL('/auth/login', BASE_URL);
    console.log('Middleware - Login URL:', loginUrl.toString());
    return NextResponse.redirect(loginUrl);
  }

  // Получаем роль из куки
  const userRole = request.cookies.get('userRole')?.value;
  console.log('Middleware - User role:', userRole);

  // Проверяем доступ к маршруту в зависимости от роли
  const allowedRoutes = roleRoutes[userRole] || [];
  const hasAccess = allowedRoutes.some(route => pathname.startsWith(route));

  console.log('Middleware - Allowed routes:', allowedRoutes);
  console.log('Middleware - Has access:', hasAccess);

  // Если пользователь пытается зайти на главную, редиректим в зависимости от роли
  if (pathname === '/') {
    if (userRole === 'admin') {
      return NextResponse.redirect(new URL('/admin/statistics', BASE_URL));
    } else if (userRole === 'doctor') {
      return NextResponse.redirect(new URL('/doctor', BASE_URL));
    } else if (userRole === 'patient') {
      return NextResponse.redirect(new URL('/patient', BASE_URL));
    } else if (userRole === 'reception') {
      return NextResponse.redirect(new URL('/reception/dashboard', BASE_URL));
    }
  }

  // Если нет доступа к маршруту, редиректим на главную страницу роли
  if (!hasAccess) {
    console.log('Middleware - No access, redirecting to role home');
    const roleHome = userRole === 'admin' ? '/admin/statistics' : 
                    userRole === 'doctor' ? '/doctor' : 
                    userRole === 'patient' ? '/patient' : 
                    userRole === 'reception' ? '/reception/dashboard' : '/';
    return NextResponse.redirect(new URL(roleHome, BASE_URL));
  }

  return NextResponse.next();
}

// Конфигурация middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
