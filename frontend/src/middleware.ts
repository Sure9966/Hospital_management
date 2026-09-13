import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const tokenCookie = req.cookies.get('hms_token')?.value;
  const userCookie = req.cookies.get('hms_user')?.value;

  let user: any = null;
  if (userCookie) {
    try {
      user = JSON.parse(decodeURIComponent(userCookie));
    } catch {
      try {
        user = JSON.parse(userCookie);
      } catch {
        user = null;
      }
    }
  }

  const isAuthenticated = !!tokenCookie && !!user;

  // Protect /login route: Logged in users trying to visit /login in address bar get redirected to their dashboard
  if (pathname === '/login' || pathname === '/') {
    if (isAuthenticated && user?.role) {
      const userRole = user.role === 'lab' ? 'lab_technician' : user.role;
      const targetDashboard = userRole === 'lab_technician' ? '/dashboard/lab' : `/dashboard/${userRole}`;
      return NextResponse.redirect(new URL(targetDashboard, req.url));
    }
  }

  // Protect /dashboard routes: Direct search bar access to /dashboard without auth redirects to /login
  if (pathname.startsWith('/dashboard')) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const userRole = user?.role;

    // Admin can access all dashboards
    if (userRole === 'admin') {
      return NextResponse.next();
    }

    // Role-based route authorization
    const roleRoutes: Record<string, string[]> = {
      doctor: ['/dashboard/doctor'],
      receptionist: ['/dashboard/receptionist'],
      nurse: ['/dashboard/nurse'],
      pharmacist: ['/dashboard/pharmacist'],
      lab_technician: ['/dashboard/lab', '/dashboard/lab_technician'],
      lab: ['/dashboard/lab', '/dashboard/lab_technician'],
      management: ['/dashboard/management'],
    };

    const allowedPaths = roleRoutes[userRole] || [];
    const isAllowed = allowedPaths.some((prefix) => pathname.startsWith(prefix));

    if (!isAllowed) {
      // Redirect to their assigned portal if trying to access unauthorized role dashboard
      const userDashboard = (userRole === 'lab_technician' || userRole === 'lab') ? '/dashboard/lab' : `/dashboard/${userRole || 'login'}`;
      return NextResponse.redirect(new URL(userDashboard, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*'],
};
