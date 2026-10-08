import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const maxDuration = 300;
const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1337';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    // 1. Validasi Token / Sesi
    if (!token) {
      return NextResponse.json({ message: 'Sesi login tidak ditemukan. Silakan masuk ulang.' }, { status: 401 });
    }

    const userRes = await fetch(`${STRAPI_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!userRes.ok) {
      return NextResponse.json({ message: 'Sesi tidak valid atau telah kedaluwarsa.' }, { status: 401 });
    }
    
    const userData = await userRes.json();

    // 2. Parsing Payload dengan Pengamanan (try-catch)
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Format request body tidak valid.' }, { status: 400 });
    }

    // 3. Eksekusi Simpan dengan Sanitasi Data (Fallback Default Values)
    const strapiRes = await fetch(`${STRAPI_URL}/api/history-matchings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        data: {
          // Konversi tipe data secara paksa agar sesuai standar database
          nama_file_master: String(body.nama_file_master || 'Unknown Master'),
          nama_file_scraping: String(body.nama_file_scraping || 'Unknown Scraping'),
          total_data_scraping: Number(body.total_data_scraping) || 0,
          matched_count: Number(body.matched_count) || 0,
          unmatched_count: Number(body.unmatched_count) || 0,
          persentase_match: Number(body.persentase_match) || 0,
          detail_matched: {
            matched_data: Array.isArray(body.detail_matched) ? body.detail_matched : [],
            unmatched_data: Array.isArray(body.detail_unmatched) ? body.detail_unmatched : []
          },
          users_permissions_user: userData.id,
        },
      }),
    });

    const result = await strapiRes.json();

    // 4. Validasi Respons Strapi
    if (!strapiRes.ok) {
      return NextResponse.json(
        { message: result?.error?.message || 'Gagal menyimpan riwayat ke database.' },
        { status: strapiRes.status } 
      );
    }

    return NextResponse.json({ message: 'Riwayat berhasil disimpan!', data: result.data }, { status: 201 });
    
  } catch (error) {
    // Sisakan log error internal saja untuk keamanan server
    console.error("[POST HISTORY ERROR]:", error);
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}