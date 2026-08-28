// import { NextResponse } from 'next/server';
// import { cookies } from 'next/headers';

// const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';

// export async function GET() {
//   try {
//     const cookieStore = await cookies();
//     const token = cookieStore.get('auth_token')?.value;

//     if (!token) {
//       return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
//     }

//     const res = await fetch(`${STRAPI_URL}/api/history-matchings?sort=createdAt:desc`, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//       },
//       cache: 'no-store',
//     });

//     const data = await res.json();
//     return NextResponse.json(data);
//   } catch (error) {
//     return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
//   }
// }

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1337';
    
    // Deep Populate untuk memaksa Strapi mengeluarkan username dan email
    const endpoint = `${STRAPI_URL}/api/history-matchings?populate[users_permissions_user][fields][0]=username&populate[users_permissions_user][fields][1]=email&sort=createdAt:desc`;

    // Sisipkan token login agar Strapi membaca izin dari role Authenticated
    const res = await fetch(endpoint, {
      cache: 'no-store',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` })
      }
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.message || 'Gagal mengambil data dari database Strapi.');
    }

    return NextResponse.json({ data: data.data }, { status: 200 });

  } catch (error: any) {
    console.error("Error Fetch History:", error);
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}