'use client';

import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  ArrowRightLeft, 
  CheckCircle2, 
  XCircle, 
  Save, 
  ExternalLink,
  Loader2,
  Download
} from 'lucide-react';

export default function MatchingPage() {
  const [fileMaster, setFileMaster] = useState<File | null>(null);
  const [fileScraping, setFileScraping] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'matched' | 'unmatched'>('matched');
  const [matchingResult, setMatchingResult] = useState<any>(null);
  const [threshold, setThreshold] = useState<number>(80);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressPhase, setProgressPhase] = useState<string>('');
  const [progressDetail, setProgressDetail] = useState<string>('');

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleProcessMatching = async () => {
    if (!fileMaster || !fileScraping) {
      alert('Silakan pilih kedua file CSV (File Master dan File Scraping).');
      return;
    }

    setLoading(true);
    setMatchingResult(null);
    setProgressPercent(0);
    setProgressPhase('Mengunggah file...');
    setProgressDetail('');

    const formData = new FormData();
    formData.append('file_master', fileMaster);
    formData.append('file_scraping', fileScraping);
    formData.append('threshold', String(threshold));

    try {
      const res = await fetch('/api/matching', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Gagal memproses data');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Streaming tidak didukung di browser ini.');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === 'progress') {
              setProgressPercent(event.percent);
              setProgressPhase(event.phase);
              setProgressDetail(`${event.current.toLocaleString('id-ID')} / ${event.total.toLocaleString('id-ID')} baris`);
            } else if (event.type === 'result') {
              setMatchingResult(event.data);
              setProgressPercent(100);
              setProgressPhase('Selesai!');
            } else if (event.type === 'error') {
              throw new Error(event.detail);
            }
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes('JSON')) throw parseErr;
          }
        }
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat memproses data.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!matchingResult) return;
    
    const dataToDownload = activeTab === 'matched' 
      ? matchingResult.matched_data 
      : matchingResult.unmatched_data;

    if (dataToDownload.length === 0) {
      alert('Tidak ada data untuk didownload.');
      return;
    }

    const headers = Object.keys(dataToDownload[0]);
    const csvRows = [];
    csvRows.push(headers.join(',')); 
    
    for (const row of dataToDownload) {
      const values = headers.map(header => {
        const val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
        const escaped = val.replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Hasil_Matching_${activeTab}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCleanUrl = (rawLink: string): string => {
    if (!rawLink) return '';
    let val = rawLink
      .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&amp;/gi, '&').replace(/&#39;/gi, "'");
    const match = val.match(/href=['"]?([^'" >]+)/i);
    let url = match ? match[1] : val.trim();
    url = url.replace(/<[^>]*>/g, '').replace(/^['"]|['"]$/g, '').trim();
    if (url.startsWith('file:///') || url.startsWith('file://')) return '';
    if (url.startsWith('//')) { url = 'https:' + url; }
    return url;
  };

  const handleSaveHistory = async () => {
    if (!matchingResult) return;

    setSaving(true);
    try {
      const payload = {
        nama_file_master: fileMaster?.name || 'Master.csv',
        nama_file_scraping: fileScraping?.name || 'Scraping.csv',
        total_data_scraping: matchingResult.summary.total_scraping_rows,
        matched_count: matchingResult.summary.matched_count,
        unmatched_count: matchingResult.summary.unmatched_count,
        persentase_match: matchingResult.summary.overall_matched_percentage,
        detail_matched: matchingResult.matched_data,
        detail_unmatched: matchingResult.unmatched_data,
      };

      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menyimpan riwayat matching.');

      alert('✅ Data hasil matching berhasil disimpan ke database Strapi!');
    } catch (err: any) {
      alert('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-base font-bold text-slate-800 mb-1">Unggah Dataset untuk Matching</h3>
        <p className="text-xs text-slate-400 mb-6">Pilih File Utama (Master) dan File Target Scraping (Format .CSV)</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition ${
            fileMaster ? 'border-blue-500 bg-blue-50/20' : 'border-slate-300 hover:border-blue-400 bg-slate-50/50'
          }`}>
            <FileSpreadsheet className={`w-10 h-10 mb-2 ${fileMaster ? 'text-blue-600' : 'text-slate-400'}`} />
            <p className="text-xs font-semibold text-slate-700">1. File Master (Data Utama)</p>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-3 text-center">Kolom: ID, Kode KBLI, Nama Usaha, Nama Pengusaha, Alamat, dll.</p>
            <input 
              type="file" 
              accept=".csv" 
              id="uploadMaster" 
              className="hidden" 
              onChange={(e) => setFileMaster(e.target.files?.[0] || null)}
            />
            <label 
              htmlFor="uploadMaster" 
              className="cursor-pointer text-xs font-medium px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-700 transition"
            >
              {fileMaster ? fileMaster.name : 'Pilih File Master'}
            </label>
          </div>

          <div className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition ${
            fileScraping ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50'
          }`}>
            <Upload className={`w-10 h-10 mb-2 ${fileScraping ? 'text-indigo-600' : 'text-slate-400'}`} />
            <p className="text-xs font-semibold text-slate-700">2. File Target (Data Scraping)</p>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-3 text-center">Kolom: Nama Usaha, Alamat, Jenis Usaha</p>
            <input 
              type="file" 
              accept=".csv" 
              id="uploadScraping" 
              className="hidden" 
              onChange={(e) => setFileScraping(e.target.files?.[0] || null)}
            />
            <label 
              htmlFor="uploadScraping" 
              className="cursor-pointer text-xs font-medium px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-700 transition"
            >
              {fileScraping ? fileScraping.name : 'Pilih File Scraping'}
            </label>
          </div>
        </div>

        {/* Slider Threshold */}
        <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs font-semibold text-slate-700">Tingkat Toleransi Matching</span>
              <p className="text-[11px] text-slate-400">Semakin tinggi nilai %, semakin ketat/akurat hasil pencocokan karakter.</p>
            </div>
            <span className="text-sm font-bold px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
              {threshold}%
            </span>
          </div>
          <input
            type="range"
            min="50"
            max="100"
            step="5"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1.5 px-0.5">
            <span>50% (Sangat Longgar)</span>
            <span>80% (Rekomendasi)</span>
            <span>100% (Sama Persis)</span>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleProcessMatching}
            disabled={!mounted || !fileMaster || !fileScraping || loading}
            suppressHydrationWarning
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Sedang Memproses Matching...</>
            ) : (
              <><ArrowRightLeft className="w-4 h-4" /> Mulai Proses Matching (Toleransi {threshold}%)</>
            )}
          </button>
        </div>
      </div>

      {/* Live Progress Bar */}
      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">{progressPhase}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{progressDetail}</p>
            </div>
            <span className="text-lg font-bold text-blue-700">{progressPercent}%</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Results View */}
      {matchingResult && (
        <div className="space-y-6">
          {/* Summary Metric Header */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-medium text-slate-500">Total Baris Scraping</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{matchingResult.summary.total_scraping_rows}</p>
            </div>
            <div className="p-5 bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800 border-b border-dashed border-emerald-300">Berhasil Matching (≥ {threshold}%)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {matchingResult.summary.matched_count} 
                <span className="text-sm font-normal text-emerald-600 ml-2">({matchingResult.summary.overall_matched_percentage}%)</span>
              </p>
            </div>
            <div className="p-5 bg-white rounded-xl border border-rose-200 bg-rose-50/20 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-800 border-b border-dashed border-rose-300">Belum Matching (&lt; {threshold}%)</span>
                <XCircle className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-2xl font-bold text-rose-700 mt-1">{matchingResult.summary.unmatched_count}</p>
            </div>
          </div>

          {/* Tab & Action Bar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('matched')}
                  className={`px-4 py-2 rounded-md text-xs font-semibold transition ${
                    activeTab === 'matched' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Data Sudah Matching ({matchingResult.matched_data.length})
                </button>
                <button
                  onClick={() => setActiveTab('unmatched')}
                  className={`px-4 py-2 rounded-md text-xs font-semibold transition ${
                    activeTab === 'unmatched' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Data Belum Matching ({matchingResult.unmatched_data.length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={handleDownloadCSV}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold shadow-sm border border-slate-200 hover:bg-slate-200 transition"
                >
                  <Download className="w-3.5 h-3.5" /> Download CSV
                </button>
                <button 
                  onClick={handleSaveHistory}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...</> : <><Save className="w-3.5 h-3.5" /> Simpan ke Database</>}
                </button>
              </div>
            </div>

            {/* Table Content (Memiliki lebar besar agar bisa menampung banyak kolom master) */}
            <div className="overflow-x-auto">
              {activeTab === 'matched' ? (
                <table className="w-max min-w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 whitespace-nowrap">
                    <tr>
                      <th className="p-3.5 sticky left-0 bg-slate-50 z-10 shadow-[1px_0_0_0_#e2e8f0]">Kemiripan</th>
                      <th className="p-3.5">Cocok Via</th>
                      <th className="p-3.5 text-indigo-700 bg-indigo-50/50">Nama Usaha (Scraping)</th>
                      <th className="p-3.5">Code Identity (Master)</th>
                      <th className="p-3.5">ID (Master)</th>
                      <th className="p-3.5">Nama Usaha (Master)</th>
                      <th className="p-3.5">Nama Pengusaha</th>
                      <th className="p-3.5">Kode KBLI</th>
                      <th className="p-3.5">Status Pendataan</th>
                      <th className="p-3.5">Status Keluarga</th>
                      <th className="p-3.5">Kecamatan</th>
                      <th className="p-3.5">Kelurahan</th>
                      <th className="p-3.5">Status Bangunan</th>
                      <th className="p-3.5">Catatan</th>
                      <th className="p-3.5">Link Fasih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {matchingResult.matched_data.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition whitespace-nowrap">
                        <td className="p-3.5 sticky left-0 bg-white shadow-[1px_0_0_0_#f1f5f9] z-10">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            {row.similarity_score}%
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                            {row.matched_by_field}
                          </span>
                        </td>
                        <td className="p-3.5 font-medium text-slate-900 bg-indigo-50/10">{row.scraping_nama_usaha}</td>
                        <td className="p-3.5 font-mono text-slate-500">{row.master_code_identity || '-'}</td>
                        <td className="p-3.5 font-mono text-slate-500">{row.master_id || '-'}</td>
                        <td className="p-3.5 font-medium text-slate-800">{row.master_nama_usaha}</td>
                        <td className="p-3.5 text-slate-600">{row.master_nama_pengusaha || '-'}</td>
                        <td className="p-3.5 font-mono text-slate-700">{row.master_kode_kbli || '-'}</td>
                        <td className="p-3.5">{row.master_status_pendataan || '-'}</td>
                        <td className="p-3.5">{row.master_status_keberadaan_keluarga || '-'}</td>
                        <td className="p-3.5">{row.master_nama_kecamatan || '-'}</td>
                        <td className="p-3.5">{row.master_nama_kelurahan || '-'}</td>
                        <td className="p-3.5">{row.master_status_bangunan || '-'}</td>
                        <td className="p-3.5 max-w-[200px] truncate" title={row.master_catatan}>{row.master_catatan || '-'}</td>
                        <td className="p-3.5">
                        {row.master_link_fasih ? (
                            (() => {
                            const cleanUrl = getCleanUrl(row.master_link_fasih);
                            return cleanUrl.startsWith('http') ? (
                                <a href={cleanUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium">
                                  Link Assignment <ExternalLink className="w-3 h-3" />
                                </a>
                            ) : <span className="text-slate-400">-</span>;
                            })()
                        ) : <span className="text-slate-400">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Skor Tertinggi</th>
                      <th className="p-3.5">Nama Usaha (Scraping)</th>
                      <th className="p-3.5">Alamat (Scraping)</th>
                      <th className="p-3.5">Jenis Usaha</th>
                      <th className="p-3.5">Kandidat Master Terdekat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {matchingResult.unmatched_data.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700">
                            {row.similarity_score}%
                          </span>
                        </td>
                        <td className="p-3.5 font-medium text-slate-900">{row.scraping_nama_usaha}</td>
                        <td className="p-3.5">{row.scraping_alamat || '-'}</td>
                        <td className="p-3.5">{row.scraping_jenis_usaha || '-'}</td>
                        <td className="p-3.5 italic text-slate-400">{row.closest_candidate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

//////PYTHON CODE
// 'use client';

// import React, { useState, useEffect } from 'react';
// import { 
//   Upload, 
//   FileSpreadsheet, 
//   ArrowRightLeft, 
//   CheckCircle2, 
//   XCircle, 
//   Save, 
//   ExternalLink,
//   Loader2,
//   Download
// } from 'lucide-react';

// // Helper ekstraksi dan validasi URL
// const getCleanUrl = (rawLink: string): string => {
//   if (!rawLink) return '';
//   let val = rawLink
//     .replace(/&lt;/gi, '<')
//     .replace(/&gt;/gi, '>')
//     .replace(/&quot;/gi, '"')
//     .replace(/&amp;/gi, '&')
//     .replace(/&#39;/gi, "'");
//   const match = val.match(/href=['"]?([^'" >]+)/i);
//   let url = match ? match[1] : val.trim();
//   url = url.replace(/<[^>]*>/g, '').replace(/^['"]|['"]$/g, '').trim();
//   if (url.startsWith('file:///') || url.startsWith('file://')) return '';
//   if (url.startsWith('//')) url = 'https:' + url;
//   return url;
// };

// export default function MatchingPage() {
//   const [fileMaster, setFileMaster] = useState<File | null>(null);
//   const [fileScraping, setFileScraping] = useState<File | null>(null);
//   const [loading, setLoading] = useState(false);
//   const [saving, setSaving] = useState(false);
//   const [activeTab, setActiveTab] = useState<'matched' | 'unmatched'>('matched');
//   const [matchingResult, setMatchingResult] = useState<any>(null);
//   const [threshold, setThreshold] = useState<number>(80);
//   const [progressPercent, setProgressPercent] = useState<number>(0);
//   const [progressPhase, setProgressPhase] = useState<string>('');
  
//   // Perbaikan Hydration Error
//   const [mounted, setMounted] = useState(false);
//   useEffect(() => {
//     setMounted(true);
//   }, []);

//   // Handler memproses matching: TEMBAK LANGSUNG KE PYTHON
//   const handleProcessMatching = async () => {
//     if (!fileMaster || !fileScraping) {
//       alert('Silakan pilih kedua file CSV (File Master dan File Scraping).');
//       return;
//     }

//     setLoading(true);
//     setMatchingResult(null);
//     setProgressPercent(20);
//     setProgressPhase('Membaca & Memproses Data di Mesin Python (Harap Tunggu)...');

//     const formData = new FormData();
//     formData.append('file_master', fileMaster);
//     formData.append('file_scraping', fileScraping);
//     formData.append('threshold', String(threshold));

//     try {
//       // Tembak langsung file ke server FastAPI Python
//       const res = await fetch('http://localhost:8000/match', {
//         method: 'POST',
//         body: formData,
//       });

//       if (!res.ok) {
//         const errData = await res.json().catch(() => ({}));
//         throw new Error(errData.detail || 'Gagal memproses data di server Python.');
//       }

//       setProgressPercent(80);
//       setProgressPhase('Menyusun hasil akhir...');

//       const result = await res.json();

//       if (result.type === 'result') {
//         setMatchingResult(result.data);
//         setProgressPercent(100);
//         setProgressPhase('Selesai!');
//       } else {
//         throw new Error("Format respons tidak dikenali.");
//       }

//     } catch (err: any) {
//       alert(err.message || 'Terjadi kesalahan saat memproses data.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleDownloadCSV = () => {
//     if (!matchingResult) return;
//     const dataToDownload = activeTab === 'matched' ? matchingResult.matched_data : matchingResult.unmatched_data;
//     if (dataToDownload.length === 0) {
//       alert('Tidak ada data untuk didownload.');
//       return;
//     }

//     const headers = Object.keys(dataToDownload[0]);
//     const csvRows = [];
//     csvRows.push(headers.join(',')); 
    
//     for (const row of dataToDownload) {
//       const values = headers.map(header => {
//         const val = row[header] === null || row[header] === undefined ? '' : String(row[header]);
//         const escaped = val.replace(/"/g, '""');
//         return `"${escaped}"`;
//       });
//       csvRows.push(values.join(','));
//     }

//     const csvString = csvRows.join('\n');
//     const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
//     const url = URL.createObjectURL(blob);
//     const link = document.createElement('a');
//     link.href = url;
//     link.setAttribute('download', `Hasil_Matching_${activeTab}_${new Date().getTime()}.csv`);
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   };

//   const handleSaveHistory = async () => {
//     if (!matchingResult) return;
//     setSaving(true);
//     try {
//       const payload = {
//         nama_file_master: fileMaster?.name || 'Master.csv',
//         nama_file_scraping: fileScraping?.name || 'Scraping.csv',
//         total_data_scraping: matchingResult.summary.total_scraping_rows,
//         matched_count: matchingResult.summary.matched_count,
//         unmatched_count: matchingResult.summary.unmatched_count,
//         persentase_match: matchingResult.summary.overall_matched_percentage,
//         detail_matched: matchingResult.matched_data,
//         detail_unmatched: matchingResult.unmatched_data,
//       };

//       const res = await fetch('/api/history', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(payload),
//       });

//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message || 'Gagal menyimpan riwayat matching.');

//       alert('✅ Data hasil matching berhasil disimpan ke database MySQL!');
//     } catch (err: any) {
//       alert('❌ ' + err.message);
//     } finally {
//       setSaving(false);
//     }
//   };
  
//   return (
//     <div className="space-y-6">
//       {/* Upload Zone */}
//       <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
//         <h3 className="text-base font-bold text-slate-800 mb-1">Unggah Dataset untuk Matching</h3>
//         <p className="text-xs text-slate-400 mb-6">Pilih File Utama (Master) dan File Target Scraping (Format .CSV)</p>

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//           <div className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition ${fileMaster ? 'border-blue-500 bg-blue-50/20' : 'border-slate-300 hover:border-blue-400 bg-slate-50/50'}`}>
//             <FileSpreadsheet className={`w-10 h-10 mb-2 ${fileMaster ? 'text-blue-600' : 'text-slate-400'}`} />
//             <p className="text-xs font-semibold text-slate-700">1. File Master (Data Utama)</p>
//             <p className="text-[11px] text-slate-400 mt-0.5 mb-3 text-center">Kolom: ID, KBLI, Nama Usaha, dll.</p>
//             <input type="file" accept=".csv" id="uploadMaster" className="hidden" onChange={(e) => setFileMaster(e.target.files?.[0] || null)} />
//             <label htmlFor="uploadMaster" className="cursor-pointer text-xs font-medium px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-700 transition">
//               {fileMaster ? fileMaster.name : 'Pilih File Master'}
//             </label>
//           </div>

//           <div className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition ${fileScraping ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50'}`}>
//             <Upload className={`w-10 h-10 mb-2 ${fileScraping ? 'text-indigo-600' : 'text-slate-400'}`} />
//             <p className="text-xs font-semibold text-slate-700">2. File Target (Data Scraping)</p>
//             <p className="text-[11px] text-slate-400 mt-0.5 mb-3 text-center">Kolom: Nama Usaha, Alamat, dll.</p>
//             <input type="file" accept=".csv" id="uploadScraping" className="hidden" onChange={(e) => setFileScraping(e.target.files?.[0] || null)} />
//             <label htmlFor="uploadScraping" className="cursor-pointer text-xs font-medium px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-700 transition">
//               {fileScraping ? fileScraping.name : 'Pilih File Scraping'}
//             </label>
//           </div>
//         </div>

//         <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
//           <div className="flex items-center justify-between mb-2">
//             <div>
//               <span className="text-xs font-semibold text-slate-700">Tingkat Toleransi Matching</span>
//               <p className="text-[11px] text-slate-400">Semakin tinggi nilai %, semakin ketat/akurat hasil pencocokan karakter.</p>
//             </div>
//             <span className="text-sm font-bold px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">{threshold}%</span>
//           </div>
//           <input type="range" min="50" max="100" step="5" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
//         </div>

//         <div className="mt-6 flex justify-end">
//           <button 
//             type="button" 
//             onClick={handleProcessMatching} 
//             disabled={!mounted || !fileMaster || !fileScraping || loading} 
//             suppressHydrationWarning
//             className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold shadow-md shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
//           >
//             {loading ? (
//               <>
//                 <Loader2 className="w-4 h-4 animate-spin" /> Sedang Memproses Matching...
//               </>
//             ) : (
//               <>
//                 <ArrowRightLeft className="w-4 h-4" /> Mulai Proses Matching ({threshold}%)
//               </>
//             )}
//           </button>
//         </div>
//       </div>

//       {/* Live Progress Bar */}
//       {loading && (
//         <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
//           <div className="flex items-center justify-between mb-2">
//             <p className="text-sm font-semibold text-slate-800">{progressPhase}</p>
//             <span className="text-lg font-bold text-blue-700">{progressPercent}%</span>
//           </div>
//           <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
//             <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out" style={{ width: `${progressPercent}%` }} />
//           </div>
//         </div>
//       )}

//       {/* Results View */}
//       {matchingResult && (
//         <div className="space-y-6">
//           <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
//             <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
//               <span className="text-xs font-medium text-slate-500">Total Baris Scraping</span>
//               <p className="text-2xl font-bold text-slate-900 mt-1">{matchingResult.summary.total_scraping_rows}</p>
//             </div>
//             <div className="p-5 bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
//               <div className="flex items-center justify-between">
//                 <span className="text-xs font-semibold text-emerald-800 border-b border-dashed border-emerald-300">Berhasil Matching (≥ {threshold}%)</span>
//                 <CheckCircle2 className="w-4 h-4 text-emerald-600" />
//               </div>
//               <p className="text-2xl font-bold text-emerald-700 mt-1">
//                 {matchingResult.summary.matched_count} 
//                 <span className="text-sm font-normal text-emerald-600 ml-2">({matchingResult.summary.overall_matched_percentage}%)</span>
//               </p>
//             </div>
//             <div className="p-5 bg-white rounded-xl border border-rose-200 bg-rose-50/20 shadow-sm">
//               <div className="flex items-center justify-between">
//                 <span className="text-xs font-semibold text-rose-800 border-b border-dashed border-rose-300">Belum Matching (&lt; {threshold}%)</span>
//                 <XCircle className="w-4 h-4 text-rose-600" />
//               </div>
//               <p className="text-2xl font-bold text-rose-700 mt-1">{matchingResult.summary.unmatched_count}</p>
//             </div>
//           </div>

//           <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
//             <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
//               <div className="flex bg-slate-100 p-1 rounded-lg">
//                 <button onClick={() => setActiveTab('matched')} className={`px-4 py-2 rounded-md text-xs font-semibold transition ${activeTab === 'matched' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
//                   Data Sudah Matching ({matchingResult.matched_data.length})
//                 </button>
//                 <button onClick={() => setActiveTab('unmatched')} className={`px-4 py-2 rounded-md text-xs font-semibold transition ${activeTab === 'unmatched' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
//                   Data Belum Matching ({matchingResult.unmatched_data.length})
//                 </button>
//               </div>

//               <div className="flex items-center gap-2">
//                 <button onClick={handleDownloadCSV} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold shadow-sm border border-slate-200 hover:bg-slate-200 transition">
//                   <Download className="w-3.5 h-3.5" /> Download CSV
//                 </button>
//                 <button onClick={handleSaveHistory} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold shadow hover:bg-emerald-700 disabled:opacity-50 transition">
//                   {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...</> : <><Save className="w-3.5 h-3.5" /> Simpan ke Database</>}
//                 </button>
//               </div>
//             </div>

//             <div className="overflow-x-auto">
//               {activeTab === 'matched' ? (
//                 <table className="w-full text-left text-xs text-slate-600">
//                   <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
//                     <tr>
//                       <th className="p-3.5">Kemiripan</th>
//                       <th className="p-3.5">Cocok Via</th>
//                       <th className="p-3.5">Nama Usaha (Scraping)</th>
//                       <th className="p-3.5">Nama Usaha (Master)</th>
//                       <th className="p-3.5">Nama Pengusaha (Master)</th>
//                       <th className="p-3.5">Kode KBLI</th>
//                       <th className="p-3.5">Status</th>
//                       <th className="p-3.5">Link Fasih</th>
//                     </tr>
//                   </thead>
//                   <tbody className="divide-y divide-slate-100">
//                     {matchingResult.matched_data.map((row: any, idx: number) => (
//                       <tr key={idx} className="hover:bg-slate-50/80 transition">
//                         <td className="p-3.5"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">{row.similarity_score}%</span></td>
//                         <td className="p-3.5"><span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">{row.matched_by_field}</span></td>
//                         <td className="p-3.5 font-medium text-slate-900">{row.scraping_nama_usaha}</td>
//                         <td className="p-3.5 text-slate-800">{row.master_nama_usaha}</td>
//                         <td className="p-3.5 text-slate-600">{row.master_nama_pengusaha || '-'}</td>
//                         <td className="p-3.5 font-mono text-slate-700">{row.master_kode_kbli}</td>
//                         <td className="p-3.5">{row.master_status_pendataan}</td>
//                         <td className="p-3.5">
//                         {row.master_link_fasih ? (
//                             (() => {
//                             const cleanUrl = getCleanUrl(row.master_link_fasih);
//                             return cleanUrl.startsWith('http') ? (
//                                 <a 
//                                 href={cleanUrl} 
//                                 target="_blank" 
//                                 rel="noopener noreferrer" 
//                                 className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium"
//                                 >
//                                 Link <ExternalLink className="w-3 h-3" />
//                                 </a>
//                             ) : <span className="text-slate-400">-</span>;
//                             })()
//                         ) : <span className="text-slate-400">-</span>}
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               ) : (
//                 <table className="w-full text-left text-xs text-slate-600">
//                   <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
//                     <tr>
//                       <th className="p-3.5">Skor Tertinggi</th>
//                       <th className="p-3.5">Nama Usaha (Scraping)</th>
//                       <th className="p-3.5">Alamat (Scraping)</th>
//                       <th className="p-3.5">Jenis Usaha</th>
//                       <th className="p-3.5">Kandidat Master Terdekat</th>
//                     </tr>
//                   </thead>
//                   <tbody className="divide-y divide-slate-100">
//                     {matchingResult.unmatched_data.map((row: any, idx: number) => (
//                       <tr key={idx} className="hover:bg-slate-50/80 transition">
//                         <td className="p-3.5"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700">{row.similarity_score}%</span></td>
//                         <td className="p-3.5 font-medium text-slate-900">{row.scraping_nama_usaha}</td>
//                         <td className="p-3.5">{row.scraping_alamat || '-'}</td>
//                         <td className="p-3.5">{row.scraping_jenis_usaha || '-'}</td>
//                         <td className="p-3.5 italic text-slate-400">{row.closest_candidate}</td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               )}
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }