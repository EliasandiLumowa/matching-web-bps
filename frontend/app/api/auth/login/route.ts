// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';

export async function POST(request: Request) {
  try {
    const { identifier, password } = await request.json();

    const strapiRes = await fetch(`${STRAPI_URL}/api/auth/local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });

    const data = await strapiRes.json();

    if (!strapiRes.ok || !data.jwt) {
      return NextResponse.json(
        { message: data?.error?.message || 'Login gagal' },
        { status: strapiRes.status || 400 }
      );
    }

    const response = NextResponse.json(
      { message: 'Login berhasil', user: data.user },
      { status: 200 }
    );

    // Set cookie dengan konfigurasi aman untuk localhost
    response.cookies.set('auth_token', data.jwt, {
      httpOnly: true,
      secure: false, // <-- Set false saat di localhost (ubah true hanya jika domain HTTPS di server produksi)
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}