// import { NextResponse } from 'next/server';
// import { cookies } from 'next/headers';

// const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';

// export async function POST(request: Request) {
//   try {
//     const cookieStore = await cookies();
//     const token = cookieStore.get('auth_token')?.value;

//     if (!token) {
//       return NextResponse.json({ message: 'Unauthorized. Sesi login tidak ditemukan.' }, { status: 401 });
//     }

//     const body = await request.json();

//     // Kirim payload ke endpoint Strapi dengan Header Authorization Bearer JWT
//     const strapiRes = await fetch(`${STRAPI_URL}/api/history-matchings`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         Authorization: `Bearer ${token}`,
//       },
//       body: JSON.stringify({
//         data: {
//           nama_file_master: body.nama_file_master,
//           nama_file_scraping: body.nama_file_scraping,
//           total_data_scraping: body.total_data_scraping,
//           matched_count: body.matched_count,
//           unmatched_count: body.unmatched_count,
//           persentase_match: body.persentase_match,
//           detail_matched: body.detail_matched,
//           detail_unmatched: body.detail_unmatched,
//         },
//       }),
//     });

//     const result = await strapiRes.json();

//     if (!strapiRes.ok) {
//       return NextResponse.json(
//         { message: result?.error?.message || 'Gagal menyimpan riwayat ke database.' },
//         { status: strapiRes.status }
//       );
//     }

//     return NextResponse.json({ message: 'Riwayat berhasil disimpan!', data: result.data }, { status: 201 });
//   } catch (error) {
//     return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 });
//   }
// }



// import { NextResponse } from 'next/server';
// import { cookies } from 'next/headers';

// // WAJIB: Tambahkan ini agar server tidak memutus koneksi saat menyimpan JSON berukuran besar
// export const maxDuration = 300;

// const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1337';

// export async function POST(request: Request) {
//   try {
//     const cookieStore = await cookies();
//     const token = cookieStore.get('auth_token')?.value;

//     if (!token) {
//       return NextResponse.json({ message: 'Unauthorized. Sesi login tidak ditemukan.' }, { status: 401 });
//     }

//     const body = await request.json();

//     // Kirim payload ke endpoint Strapi dengan Header Authorization Bearer JWT
//     const strapiRes = await fetch(`${STRAPI_URL}/api/history-matchings`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         Authorization: `Bearer ${token}`,
//       },
//       body: JSON.stringify({
//         data: {
//           nama_file_master: body.nama_file_master,
//           nama_file_scraping: body.nama_file_scraping,
//           total_data_scraping: body.total_data_scraping,
//           matched_count: body.matched_count,
//           unmatched_count: body.unmatched_count,
//           persentase_match: body.persentase_match,
          
//           // PERBAIKAN: Karena di Strapi hanya ada 1 kolom JSON bernama "detail_matched",
//           // kita bungkus kedua data (matched & unmatched) ke dalam kolom ini.
//           detail_matched: {
//             matched_data: body.detail_matched,
//             unmatched_data: body.detail_unmatched
//           },
//         },
//       }),
//     });

//     const result = await strapiRes.json();

//     if (!strapiRes.ok) {
//       console.error("Strapi Reject:", result);
//       return NextResponse.json(
//         { message: result?.error?.message || 'Gagal menyimpan riwayat ke database.' },
//         { status: strapiRes.status }
//       );
//     }

//     return NextResponse.json({ message: 'Riwayat berhasil disimpan!', data: result.data }, { status: 201 });
//   } catch (error) {
//     console.error("Error Save API:", error);
//     return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 });
//   }
// }


// Kode Simpan Sesuai User yang Login
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const maxDuration = 300;

const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1337';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ message: 'Unauthorized. Sesi login tidak ditemukan.' }, { status: 401 });
    }

    // 1. Minta ID User dari Strapi menggunakan token saat ini
    const userRes = await fetch(`${STRAPI_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (!userRes.ok) {
      return NextResponse.json({ message: 'Gagal memverifikasi identitas user.' }, { status: 401 });
    }
    
    const userData = await userRes.json();
    const body = await request.json();

    // 2. Kirim payload ke Strapi beserta ID User tersebut
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
          detail_matched: {
            matched_data: body.detail_matched,
            unmatched_data: body.detail_unmatched
          },
          // Menyuntikkan ID User ke dalam kolom relasi Strapi
          users_permissions_user: userData.id,
        },
      }),
    });

    const result = await strapiRes.json();

    if (!strapiRes.ok) {
      console.error("Strapi Reject:", result);
      return NextResponse.json(
        { message: result?.error?.message || 'Gagal menyimpan riwayat ke database.' },
        { status: strapiRes.status }
      );
    }

    return NextResponse.json({ message: 'Riwayat berhasil disimpan!', data: result.data }, { status: 201 });
  } catch (error) {
    console.error("Error Save API:", error);
    return NextResponse.json({ message: 'Terjadi kesalahan pada server.' }, { status: 500 });
  }
}