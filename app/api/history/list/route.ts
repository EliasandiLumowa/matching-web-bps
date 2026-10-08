import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1337';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ message: 'Sesi tidak ditemukan. Silakan masuk ulang.' }, { status: 401 });
    }

    // 1. Verifikasi identitas user ke Strapi
    const userRes = await fetch(`${STRAPI_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });

    if (!userRes.ok) {
      return NextResponse.json({ message: 'Sesi tidak valid atau telah kedaluwarsa.' }, { status: 401 });
    }

    const userData = await userRes.json();
    const userId = userData.id;
    const isSuperadmin = userData.is_superadmin === true;

    // 2. Bangun URL Strapi (Lapis 1: Filter via Parameter URL)
    const strapiEndpoint = new URL(`${STRAPI_URL}/api/history-matchings`);
    strapiEndpoint.searchParams.append('populate', '*');
    strapiEndpoint.searchParams.append('sort', 'createdAt:desc');

    if (!isSuperadmin) {
      strapiEndpoint.searchParams.append('filters[users_permissions_user][id][$eq]', String(userId));
    }

    const historyRes = await fetch(strapiEndpoint.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });

    const historyData = await historyRes.json();

    if (!historyRes.ok) {
      throw new Error(historyData.error?.message || 'Gagal mengambil data dari database.');
    }

    // Pastikan data berupa Array agar fungsi .filter() tidak error
    let results = Array.isArray(historyData.data) ? historyData.data : [];

    // 3. PENGAMANAN GANDA (Lapis 2: Filter Manual Paksa di Next.js)
    if (!isSuperadmin) {
      results = results.filter((item: any) => {
        const attr = item.attributes || item; 
        const relation = attr.users_permissions_user;
        const ownerId = relation?.data?.id || relation?.id; 
        
        return ownerId === userId; 
      });
    }

    return NextResponse.json({ data: results }, { status: 200 });

  } catch (error) {
    console.error("[GET HISTORY ERROR]:", error);
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}