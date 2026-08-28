import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ message: 'Unauthorized. Sesi login tidak ditemukan.' }, { status: 401 });
    }

    const body = await request.json();

    // Kirim payload ke endpoint Strapi dengan Header Authorization Bearer JWT
    const strapiRes = await fetch(`${STRAPI_URL}/api/history-matchings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        data: {
          nama_file_master: body.nama_file_master,
          nama_file_scraping: body.nama_file_scraping,
          total_data_scraping: body.total_data_scraping,
          matched_count: body.matched_count,
          unmatched_count: body.unmatched_count,
          persentase_match: body.persentase_match,
          detail_matched: body.detail_matched,
          detail_unmatched: body.detail_unmatched,
        },
      }),
    });

    const result = await strapiRes.json();

    if (!strapiRes.ok) {
      return NextResponse.json(
        { message: result?.error?.message || 'Gagal menyimpan riwayat ke database.' },
        { status: strapiRes.status }
      );
    }

    return NextResponse.json({ message: 'Riwayat berhasil disimpan!', data: result.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}