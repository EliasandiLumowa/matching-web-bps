// // app/api/auth/login/route.ts
// import { NextResponse } from 'next/server';

// const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';

// export async function POST(request: Request) {
//   try {
//     const { identifier, password } = await request.json();

//     const strapiRes = await fetch(`${STRAPI_URL}/api/auth/local`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ identifier, password }),
//     });

//     const data = await strapiRes.json();

//     if (!strapiRes.ok || !data.jwt) {
//       return NextResponse.json(
//         { message: data?.error?.message || 'Login gagal' },
//         { status: strapiRes.status || 400 }
//       );
//     }

//     const response = NextResponse.json(
//       { message: 'Login berhasil', user: data.user },
//       { status: 200 }
//     );

//     // Set cookie dengan konfigurasi aman untuk localhost
//     response.cookies.set('auth_token', data.jwt, {
//       httpOnly: true,
//       secure: false, // <-- Set false saat di localhost (ubah true hanya jika domain HTTPS di server produksi)
//       sameSite: 'lax',
//       path: '/',
//       maxAge: 60 * 60 * 8,
//     });

//     return response;
//   } catch (error) {
//     return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
//   }
// }

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';

export async function POST(request: Request) {
  try {
    const { identifier, password } = await request.json();

    // 1. Tembak login standar ke Strapi
    const strapiRes = await fetch(`${STRAPI_URL}/api/auth/local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    
    const data = await strapiRes.json();

    if (!strapiRes.ok || !data.jwt) {
      return NextResponse.json(
        { message: data?.error?.message || 'Email/Username atau password salah.' }, 
        { status: strapiRes.status || 400 }
      );
    }

    // 2. Ambil detail user yang baru saja login dari Strapi
    const userRes = await fetch(`${STRAPI_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${data.jwt}` },
    });
    
    const userData = await userRes.json();

    // 3. LOGIKA KHUSUS SUPERADMIN (Tahan login & Minta OTP WA)
    if (userData.is_superadmin === true) {
      const noWa = userData.no_wa;

      if (!noWa) {
        return NextResponse.json(
          { message: 'Nomor WA tidak ditemukan untuk akun Superadmin ini. Hubungi tim IT.' }, 
          { status: 400 }
        );
      }

      // Generate 6 digit OTP acak
      const otp = Math.floor(100000 + Math.random() * 900000).toString(); 

      // TODO: INTEGRASI API WHATSAPP DI SINI (Misal menggunakan Fonnte/Wablas)
      // await fetch('https://api.fonnte.com/send', { ... })
      console.log(`[SIMULASI WA] Mengirim ke ${noWa}: Kode OTP MATCHSTAT Anda adalah ${otp}`);

      // Simpan JWT, OTP, dan info user ke dalam cookie SEMENTARA (hanya berlaku 5 menit)
      const pendingData = JSON.stringify({ jwt: data.jwt, otp: otp, user: userData });
      
      const cookieStore = await cookies();
      cookieStore.set('pending_auth', Buffer.from(pendingData).toString('base64'), {
        httpOnly: true,
        secure: false, // Set true jika sudah live dengan HTTPS
        maxAge: 300,   // 5 Menit
        path: '/',
      });

      // Kembalikan instruksi ke frontend untuk memunculkan form OTP
      return NextResponse.json({ 
        message: 'OTP telah dikirim ke WhatsApp Anda', 
        requireOtp: true,
        phoneMasked: noWa.slice(0, 4) + '****' + noWa.slice(-3) // Menyamarkan nomor, ex: 0812****890
      }, { status: 200 });
    }

    // 4. LOGIKA OPERATOR BIASA (Langsung Masuk & Set Sesi 8 Jam)
    const cookieStore = await cookies();
    cookieStore.set('auth_token', data.jwt, {
      httpOnly: true,
      secure: false, 
      sameSite: 'lax',
      path: '/',
maxAge: 60 * 60 * 24 * 365, // <-- PASTIKAN UBAH KE 1 TAHUN JUGA DI SINI
    });

    return NextResponse.json({ message: 'Login berhasil', user: userData }, { status: 200 });

  } catch (error) {
    console.error("Login Error:", error);
    return NextResponse.json({ message: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}