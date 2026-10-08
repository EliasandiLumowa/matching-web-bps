'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Download, 
  Loader2, 
  ExternalLink,
  User
} from 'lucide-react';

export default function HistoryDetailPage() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'matched' | 'unmatched'>('matched');

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/history/${params.id}`);
        const json = await res.json();
        if (res.ok && json.data) {
          // Mendukung struktur Strapi v4 dan v5
          setData(json.data.attributes || json.data);
        }
      } catch (err) {
        console.error('Gagal mengambil detail:', err);
      } finally {
        setLoading(false);
      }
    };
    if (params.id) fetchDetail();
  }, [params.id]);

  // Helper untuk membersihkan URL Fasih
  const getCleanUrl = (rawLink: string): string => {
    if (!rawLink) return '';
    let val = rawLink.replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&amp;/gi, '&').replace(/&#39;/gi, "'");
    const match = val.match(/href=['"]?([^'" >]+)/i);
    let url = match ? match[1] : val.trim();
    url = url.replace(/<[^>]*>/g, '').replace(/^['"]|['"]$/g, '').trim();
    if (url.startsWith('file:///') || url.startsWith('file://')) return '';
    if (url.startsWith('//')) url = 'https:' + url;
    return url;
  };

  // Handler Download CSV
  const handleDownloadCSV = () => {
    if (!data?.detail_matched) return;
    const targetData = activeTab === 'matched' ? data.detail_matched.matched_data : data.detail_matched.unmatched_data;
    if (!targetData || targetData.length === 0) return alert('Tidak ada data untuk didownload.');

    const headers = Object.keys(targetData[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of targetData) {
      const values = headers.map(header => {
        const val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
        return `"${val.replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Riwayat_${activeTab}_${data.nama_file_scraping}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-sm font-medium">Memuat dan membongkar data raksasa...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 bg-white rounded-xl border border-slate-200 text-center text-slate-500">
        Data tidak ditemukan atau terjadi kesalahan.
      </div>
    );
  }

  const dateFormatted = new Date(data.createdAt || Date.now()).toLocaleString('id-ID', {
    dateStyle: 'full', timeStyle: 'short'
  });
  const uploaderName = data.users_permissions_user?.username || 'Sistem / Tidak Diketahui';
  
  // Mengekstrak array data dari kolom JSON
  const matchedData = data.detail_matched?.matched_data || [];
  const unmatchedData = data.detail_matched?.unmatched_data || [];

  return (
    <div className="space-y-6 pb-10">
      {/* Header & Back Button */}
      <div className="flex items-center gap-4">
        <Link href="/history" className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Detail Rekaman Matching</h2>
          <p className="text-xs text-slate-400 mt-0.5">ID Dokumen: {params.id}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Informasi Eksekusi</span>
          <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium mt-1">
            <Calendar className="w-3.5 h-3.5 text-blue-500" /> {dateFormatted}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium mt-2">
            <User className="w-3.5 h-3.5 text-blue-500" /> {uploaderName}
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-medium text-slate-500">Total Baris Scraping</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{data.total_data_scraping}</p>
        </div>

        <div className="p-5 bg-white rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">Berhasil Matching</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-1">
            {data.matched_count} <span className="text-sm font-normal text-emerald-600 ml-1">({data.persentase_match}%)</span>
          </p>
        </div>

        <div className="p-5 bg-white rounded-xl border border-rose-200 bg-rose-50/30 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800">Belum Matching</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-rose-700 mt-1">{data.unmatched_count}</p>
        </div>
      </div>

      {/* Dataset Info */}
      <div className="p-4 bg-slate-800 rounded-xl text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-md shadow-slate-800/20">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">File Target (Scraping)</span>
          <span className="text-sm font-medium">{data.nama_file_scraping}</span>
        </div>
        <div className="hidden md:block w-8 border-t border-dashed border-slate-600"></div>
        <div className="md:text-right">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">File Utama (Master)</span>
          <span className="text-sm font-medium">{data.nama_file_master}</span>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setActiveTab('matched')} className={`px-4 py-2 rounded-md text-xs font-semibold transition ${activeTab === 'matched' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              Data Sudah Matching ({matchedData.length})
            </button>
            <button onClick={() => setActiveTab('unmatched')} className={`px-4 py-2 rounded-md text-xs font-semibold transition ${activeTab === 'unmatched' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              Data Belum Matching ({unmatchedData.length})
            </button>
          </div>
          
          <button onClick={handleDownloadCSV} className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold shadow hover:bg-slate-800 transition">
            <Download className="w-3.5 h-3.5" /> Unduh CSV ({activeTab === 'matched' ? 'Matched' : 'Unmatched'})
          </button>
        </div>

        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          {activeTab === 'matched' ? (
            <table className="w-max min-w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 whitespace-nowrap sticky top-0 z-20">
                <tr>
                  <th className="p-3.5 sticky left-0 bg-slate-50 z-30 shadow-[1px_0_0_0_#e2e8f0]">Kemiripan</th>
                  <th className="p-3.5">Cocok Via</th>
                  <th className="p-3.5 text-indigo-700 bg-indigo-50/50">Nama Usaha (Scraping)</th>
                  <th className="p-3.5">Code Identity (Master)</th>
                  <th className="p-3.5">Nama Usaha (Master)</th>
                  <th className="p-3.5">Nama Pengusaha</th>
                  <th className="p-3.5">Kode KBLI</th>
                  <th className="p-3.5">Status Pendataan</th>
                  <th className="p-3.5">Kecamatan</th>
                  <th className="p-3.5">Link Fasih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matchedData.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition whitespace-nowrap">
                    <td className="p-3.5 sticky left-0 bg-white shadow-[1px_0_0_0_#f1f5f9] z-10">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">{row.similarity_score}%</span>
                    </td>
                    <td className="p-3.5"><span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">{row.matched_by_field}</span></td>
                    <td className="p-3.5 font-medium text-slate-900 bg-indigo-50/10">{row.scraping_nama_usaha}</td>
                    <td className="p-3.5 font-mono text-slate-500">{row.master_code_identity || '-'}</td>
                    <td className="p-3.5 font-medium text-slate-800">{row.master_nama_usaha}</td>
                    <td className="p-3.5 text-slate-600">{row.master_nama_pengusaha || '-'}</td>
                    <td className="p-3.5 font-mono text-slate-700">{row.master_kode_kbli || '-'}</td>
                    <td className="p-3.5">{row.master_status_pendataan || '-'}</td>
                    <td className="p-3.5">{row.master_nama_kecamatan || '-'}</td>
                    <td className="p-3.5">
                      {row.master_link_fasih ? (
                        (() => {
                          const cleanUrl = getCleanUrl(row.master_link_fasih);
                          return cleanUrl.startsWith('http') ? (
                            <a href={cleanUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium">
                              Buka Link <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : <span className="text-slate-400">-</span>;
                        })()
                      ) : <span className="text-slate-400">-</span>}
                    </td>
                  </tr>
                ))}
                {matchedData.length === 0 && (
                  <tr><td colSpan={10} className="p-10 text-center text-slate-400">Tidak ada data matched.</td></tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-20">
                <tr>
                  <th className="p-3.5">Skor Tertinggi</th>
                  <th className="p-3.5">Nama Usaha (Scraping)</th>
                  <th className="p-3.5">Alamat (Scraping)</th>
                  <th className="p-3.5">Jenis Usaha</th>
                  <th className="p-3.5">Kandidat Master Terdekat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unmatchedData.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700">{row.similarity_score}%</span></td>
                    <td className="p-3.5 font-medium text-slate-900">{row.scraping_nama_usaha}</td>
                    <td className="p-3.5">{row.scraping_alamat || '-'}</td>
                    <td className="p-3.5">{row.scraping_jenis_usaha || '-'}</td>
                    <td className="p-3.5 italic text-slate-400">{row.closest_candidate}</td>
                  </tr>
                ))}
                {unmatchedData.length === 0 && (
                  <tr><td colSpan={5} className="p-10 text-center text-slate-400">Tidak ada data unmatched.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}