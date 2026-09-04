import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { inputOtp } = await request.json();
    const cookieStore = await cookies();
    
    // Ambil cookie sementara
    const pendingCookie = cookieStore.get('pending_auth')?.value;

    if (!pendingCookie) {
      return NextResponse.json(
        { message: 'Sesi OTP habis (lebih dari 5 menit). Silakan login ulang.' }, 
        { status: 400 }
      );
    }

    // Decode cookie sementara
    const pendingData = JSON.parse(Buffer.from(pendingCookie, 'base64').toString('ascii'));

    // Verifikasi OTP
    if (inputOtp !== pendingData.otp) {
      return NextResponse.json({ message: 'Kode OTP salah!' }, { status: 400 });
    }

    // OTP BENAR! Buat sesi permanen 8 jam
    cookieStore.set('auth_token', pendingData.jwt, {
      httpOnly: true,
      secure: false, 
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 Jam
    });
    
    // Hapus cookie sementara
    cookieStore.delete('pending_auth');

    return NextResponse.json({ message: 'Verifikasi berhasil', user: pendingData.user }, { status: 200 });

  } catch (error) {
    console.error("Verify OTP Error:", error);
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}