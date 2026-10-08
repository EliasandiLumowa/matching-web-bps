import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const maxDuration = 300;

const STRAPI_URL = process.env.STRAPI_URL || 'http://127.0.0.1:1337';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    // 1. Tarik 1 Data Riwayat Matching Terakhir
    // Kita tidak pakai filter fields[] karena datanya ada di dalam kolom JSON (detail_matched)
    const endpoint = `${STRAPI_URL}/api/history-matchings?sort=createdAt:desc&pagination[limit]=1`;
    
    const res = await fetch(endpoint, {
      cache: 'no-store',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` })
      }
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error?.message || 'Gagal mengambil data dari Strapi');
    }

    // Jika belum ada riwayat sama sekali, kembalikan data kosong agar UI tidak error
    if (!json.data || json.data.length === 0) {
       return NextResponse.json({ 
         data: {
           summary: { total_master: 0, cakupan_wilayah: 0, total_kecamatan: 0, total_kelurahan: 0 },
           grafik_kabupaten: [], grafik_kecamatan: []
         } 
       }, { status: 200 });
    }

    // 2. Ekstrak data dari dalam JSON detail_matched
    const latestHistory = json.data[0];
    const attr = latestHistory.attributes || latestHistory; // Mendukung Strapi v4 & v5
    const matchedData = attr.detail_matched?.matched_data || [];

    // 3. Proses Kalkulasi & Grouping Data
    const kecamatanCount: Record<string, number> = {};
    const kelurahanSet = new Set<string>();

    matchedData.forEach((item: any) => {
      // Menggunakan key JSON sesuai struktur Anda (master_nama_kecamatan)
      const kec = item.master_nama_kecamatan || 'Tidak Diketahui';
      const kel = item.master_nama_kelurahan || 'Tidak Diketahui';

      // Grouping Total per Kecamatan
      if (kec !== 'Tidak Diketahui' && kec !== '') {
        kecamatanCount[kec] = (kecamatanCount[kec] || 0) + 1;
      }
      
      // Hitung Kelurahan Unik
      if (kel !== 'Tidak Diketahui' && kel !== '') {
        kelurahanSet.add(`${kec}-${kel}`);
      }
    });

    // Format Objek menjadi Array untuk Recharts (diurutkan dari terbesar)
    const formatForChart = (obj: Record<string, number>) => {
      return Object.entries(obj)
        .map(([nama, total]) => ({ nama, total }))
        .sort((a, b) => b.total - a.total);
    };

    const grafikKecamatan = formatForChart(kecamatanCount).slice(0, 5); 

    // Karena tidak ada kolom kabupaten di struktur JSON Anda, kita asumsikan semuanya Manado
    const grafikKabupaten = [
      { nama: 'Kota Manado', total: matchedData.length }
    ];

    // 4. Bungkus ke dalam struktur yang dibaca UI
    const dynamicData = {
      summary: {
        total_master: attr.total_data_scraping || 0, // Mengambil total dari metrik riwayat
        cakupan_wilayah: grafikKabupaten.length,
        total_kecamatan: Object.keys(kecamatanCount).length,
        total_kelurahan: kelurahanSet.size
      },
      grafik_kabupaten: grafikKabupaten,
      grafik_kecamatan: grafikKecamatan
    };

    return NextResponse.json({ data: dynamicData }, { status: 200 });
  } catch (error: any) {
    console.error("Error Dashboard API:", error);
    return NextResponse.json({ message: 'Gagal memuat data dashboard.' }, { status: 500 });
  }
}