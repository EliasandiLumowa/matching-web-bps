import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1337';
    
    // Tarik data spesifik berdasarkan ID beserta relasi usernya
    const endpoint = `${STRAPI_URL}/api/history-matchings/${resolvedParams.id}?populate=users_permissions_user`;

    const res = await fetch(endpoint, {
      cache: 'no-store',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` })
      }
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || 'Gagal mengambil detail data dari database Strapi.');
    }

    return NextResponse.json({ data: data.data }, { status: 200 });

  } catch (error: any) {
    console.error("Error Fetch Detail History:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}