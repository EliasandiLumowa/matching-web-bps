import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;

  const isLoginPage = pathname === '/login';
  const isAuthApi = pathname.startsWith('/api/auth');

  // 1. Belum Login: Cegah akses ke dashboard dan paksa ke /login
  if (!token) {
    if (!isLoginPage && !isAuthApi) {
      const loginUrl = new URL('/login', request.url);
      
      // Simpan callbackUrl hanya jika bukan rute root '/'
      if (pathname !== '/') {
        loginUrl.searchParams.set('callbackUrl', pathname);
      }
      
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 2. Sudah Login: Cegah akses kembali ke form /login
  if (isLoginPage && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

// Mencegat semua request kecuali file statis (_next, favicon, gambar)
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};