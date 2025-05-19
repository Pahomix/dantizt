import { NextResponse } from 'next/server';

// Базовый URL для редиректов
const IS_DEV = process.env.NODE_ENV === 'development';
const BASE_URL = IS_DEV ? 'http://localhost:3000' : (process.env.NEXT_PUBLIC_BASE_URL || 'https://www.dantizt.ru');

// Для отладки
console.log('Middleware - Using BASE_URL:', BASE_URL);

const roleRoutes = {
  admin: ['/dashboard', '/admin', '/admin/users', '/admin/schedules', '/admin/services', '/admin/diagnoses', '/admin/reviews', '/admin/payments', '/admin/statistics', '/admin/settings'],
  doctor: ['/dashboard', '/doctor', '/doctor/appointments', '/doctor/patients', '/doctor/profile'],
  patient: ['/dashboard', '/patient', '/patient/appointments', '/patient/medical-records', '/patient/profile'],
  reception: ['/dashboard', '/reception', '/reception/dashboard', '/reception/patients', '/reception/appointments', '/reception/payments', '/reception/documents', '/reception/schedules'],
};

const publicRoutes = ['/', '/auth/login', '/auth/register', '/auth/verify-email', '/verify-email', '/payment/success', '/payment/fail'];

export function middleware(request) {
  // Создаем URL для редиректов
  const url = new URL(request.url);
  
  // В режиме разработки не заменяем localhost на реальный домен
  if (!IS_DEV && url.hostname === 'localhost') {
    url.hostname = new URL(BASE_URL).hostname;
    // Не меняем протокол, чтобы не было принудительного перехода на HTTPS
    // url.protocol = new URL(BASE_URL).protocol;
  }
  
  // Удаляем порт из URL только в продакшн режиме
  if (!IS_DEV && url.port) {
    url.port = '';
    console.log('Middleware - Removed port from URL:', url.toString());
  } else if (IS_DEV && url.port) {
    console.log('Middleware - Keeping port in dev mode:', url.toString());
  }
  
  const { pathname } = request.nextUrl;
  
  console.log('Middleware - Path:', pathname);
  console.log('Middleware - Full URL:', url.toString());
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
    
    // Используем исправленный URL для создания адреса перенаправления
    const loginUrl = new URL('/auth/login', url.origin);
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
      return NextResponse.redirect(new URL('/admin/statistics', url.origin));
    } else if (userRole === 'doctor') {
      return NextResponse.redirect(new URL('/doctor', url.origin));
    } else if (userRole === 'patient') {
      return NextResponse.redirect(new URL('/patient', url.origin));
    } else if (userRole === 'reception') {
      return NextResponse.redirect(new URL('/reception/dashboard', url.origin));
    } else {
      return NextResponse.redirect(new URL('/auth/login', url.origin));
    }
  }

  // Если нет доступа к маршруту, редиректим на главную страницу роли
  if (!hasAccess) {
    console.log('Middleware - No access, redirecting to role home');
    const roleHome = userRole === 'admin' ? '/admin/statistics' : 
                    userRole === 'doctor' ? '/doctor' : 
                    userRole === 'patient' ? '/patient' : 
                    userRole === 'reception' ? '/reception/dashboard' : '/';
    return NextResponse.redirect(new URL(roleHome, url.origin));
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
