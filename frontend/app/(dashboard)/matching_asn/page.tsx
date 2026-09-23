'use client';

import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  ArrowRightLeft, 
  CheckCircle2, 
  XCircle, 
  Save, 
  Loader2,
  Download,
  Users
} from 'lucide-react';
import { useMatchingAsnStore } from '../../store/useMatchingAsnStore';
import * as XLSX from 'xlsx';

export default function MatchingAsnPage() {
  const { 
    matchingResult, 
    fileNameSeAsn, 
    fileNameAsnKota, 
    setMatchingResult, 
    clearResult 
  } = useMatchingAsnStore();

  const [fileSeAsn, setFileSeAsn] = useState<File | null>(null);
  const [fileAsnKota, setFileAsnKota] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'matched' | 'unmatched'>('matched');
  
  const [threshold, setThreshold] = useState<number>(85);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressPhase, setProgressPhase] = useState<string>('');
  const [progressDetail, setProgressDetail] = useState<string>('');

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (loading || matchingResult) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [loading, matchingResult]);

  const handleProcessMatching = async () => {
    if (!fileSeAsn || !fileAsnKota) {
      alert('Silakan pilih kedua file CSV (File SE ASN dan File ASN Kota Manado).');
      return;
    }

    setLoading(true);
    clearResult(); 
    setProgressPercent(0);
    setProgressPhase('Mengunggah file...');
    setProgressDetail('');

    const formData = new FormData();
    formData.append('file_se_asn', fileSeAsn);
    formData.append('file_asn_kota', fileAsnKota);
    formData.append('threshold', String(threshold));

    try {
      const res = await fetch('/api/matching_asn', {
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
              setMatchingResult(event.data, fileSeAsn.name, fileAsnKota.name);
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

    const formattedData = dataToDownload.map((row: any) => {
      if (activeTab === 'matched') {
        return {
          "Skor": `${row.similarity_score}%`,
          "Nama ASN": row.asn_nama || "-",
          "NIP": row.asn_nip || "-",
          "Unit Kerja": row.asn_unit_kerja || "-",
          "Nama di SE ASN": row.se_asn_nama || "-",
          "Kode Wilayah (NIK)": row.se_asn_kode_wilayah || "-",
          "Link FASIH": row.se_asn_link || "-",
        };
      } else {
        return {
          "Skor Tertinggi": `${row.similarity_score}%`,
          "Nama ASN": row.asn_nama || "-",
          "NIP": row.asn_nip || "-",
          "Unit Kerja": row.asn_unit_kerja || "-",
          "Kandidat SE ASN Terdekat": row.closest_candidate || "-",
        };
      }
    });

    const headers = Object.keys(formattedData[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));
    
    for (const row of formattedData) {
      const values = headers.map(header => {
        const val = (row as any)[header] === null || (row as any)[header] === undefined ? '' : String((row as any)[header]);
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
    link.setAttribute('download', `Hasil_Matching_ASN_${activeTab}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadExcel = () => {
    if (!matchingResult) return;

    const dataToDownload = activeTab === 'matched' 
      ? matchingResult.matched_data 
      : matchingResult.unmatched_data;

    if (dataToDownload.length === 0) {
      alert('Tidak ada data untuk didownload.');
      return;
    }

    const formattedData = dataToDownload.map((row: any) => {
      if (activeTab === 'matched') {
        const rawLink = row.se_asn_link ? String(row.se_asn_link).trim() : "";
        return {
          "Skor": `${row.similarity_score}%`,
          "Nama ASN": row.asn_nama || "-",
          "NIP": row.asn_nip || "-",
          "Unit Kerja": row.asn_unit_kerja || "-",
          "Nama di SE ASN": row.se_asn_nama || "-",
          "Kode Wilayah (NIK)": row.se_asn_kode_wilayah || "-",
          "Link FASIH": rawLink || "-",
        };
      } else {
        return {
          "Skor Tertinggi": `${row.similarity_score}%`,
          "Nama ASN": row.asn_nama || "-",
          "NIP": row.asn_nip || "-",
          "Unit Kerja": row.asn_unit_kerja || "-",
          "Kandidat SE ASN Terdekat": row.closest_candidate || "-",
        };
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    // Hyperlink kolom "Link FASIH" pada tab matched (kolom index 6 = G)
    if (activeTab === 'matched') {
      const linkColIndex = 6;
      dataToDownload.forEach((originalRow: any, index: number) => {
        const rawUrl = originalRow.se_asn_link;
        const url = rawUrl ? String(rawUrl).trim() : '';

        if (url && url.includes('http')) {
          const cellRef = XLSX.utils.encode_cell({ r: index + 1, c: linkColIndex });

          if (worksheet[cellRef]) {
            if (url.length < 255) {
              worksheet[cellRef] = {
                t: 's',
                v: '🔗 Buka FASIH',
                f: `HYPERLINK("${url}", "🔗 Buka FASIH")`
              };
            } else {
              worksheet[cellRef].t = 's';
              worksheet[cellRef].v = url;
              worksheet[cellRef].l = { Target: url };
            }
          }
        }
      });
    }

    // Lebar kolom
    const colWidths = activeTab === 'matched'
      ? [{ wch: 8 }, { wch: 35 }, { wch: 22 }, { wch: 45 }, { wch: 35 }, { wch: 22 }, { wch: 50 }]
      : [{ wch: 15 }, { wch: 35 }, { wch: 22 }, { wch: 45 }, { wch: 35 }];

    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hasil Matching ASN');
    XLSX.writeFile(workbook, `Hasil_Matching_ASN_${activeTab}_${new Date().getTime()}.xlsx`);
  };

  const handleSaveHistory = async () => {
    if (!matchingResult) return;

    setSaving(true);
    try {
      const payload = {
        nama_file_master: fileNameSeAsn,
        nama_file_scraping: fileNameAsnKota,
        total_data_scraping: matchingResult.summary.total_asn_kota_rows,
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

      alert('✅ Data hasil matching ASN berhasil disimpan ke database!');
    } catch (err: any) {
      alert('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-1">
          <Users className="w-5 h-5 text-teal-600" />
          <h3 className="text-base font-bold text-slate-800">Unggah Dataset untuk Matching ASN</h3>
        </div>
        <p className="text-xs text-slate-400 mb-6">Pilih File SE ASN (Data Referensi) dan File ASN Kota Manado (Data Target) — Format .CSV</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition ${
            fileSeAsn ? 'border-teal-500 bg-teal-50/20' : 'border-slate-300 hover:border-teal-400 bg-slate-50/50'
          }`}>
            <FileSpreadsheet className={`w-10 h-10 mb-2 ${fileSeAsn ? 'text-teal-600' : 'text-slate-400'}`} />
            <p className="text-xs font-semibold text-slate-700">1. File SE ASN (Data Referensi)</p>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-3 text-center">Kolom: Nama Penduduk, Kode Wilayah(NIK), Link</p>
            <input 
              type="file" 
              accept=".csv" 
              id="uploadSeAsn" 
              className="hidden" 
              onChange={(e) => setFileSeAsn(e.target.files?.[0] || null)}
            />
            <label 
              htmlFor="uploadSeAsn" 
              className="cursor-pointer text-xs font-medium px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-700 transition"
            >
              {fileSeAsn ? fileSeAsn.name : 'Pilih File SE ASN'}
            </label>
          </div>

          <div className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition ${
            fileAsnKota ? 'border-amber-500 bg-amber-50/20' : 'border-slate-300 hover:border-amber-400 bg-slate-50/50'
          }`}>
            <Upload className={`w-10 h-10 mb-2 ${fileAsnKota ? 'text-amber-600' : 'text-slate-400'}`} />
            <p className="text-xs font-semibold text-slate-700">2. File ASN Kota Manado (Data Target)</p>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-3 text-center">Kolom: No, Nama, NIP, Unit Kerja</p>
            <input 
              type="file" 
              accept=".csv" 
              id="uploadAsnKota" 
              className="hidden" 
              onChange={(e) => setFileAsnKota(e.target.files?.[0] || null)}
            />
            <label 
              htmlFor="uploadAsnKota" 
              className="cursor-pointer text-xs font-medium px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-700 transition"
            >
              {fileAsnKota ? fileAsnKota.name : 'Pilih File ASN Kota'}
            </label>
          </div>
        </div>

        <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs font-semibold text-slate-700">Tingkat Kemiripan Nama</span>
              <p className="text-[11px] text-slate-400">Gunakan nilai 85-100% untuk mencari nama yang Sangat Persis.</p>
            </div>
            <span className="text-sm font-bold px-2.5 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg">
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
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
          />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleProcessMatching}
            disabled={!mounted || !fileSeAsn || !fileAsnKota || loading}
            suppressHydrationWarning
            className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold shadow-md shadow-teal-600/20 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Sedang Memproses...</>
            ) : (
              <><ArrowRightLeft className="w-4 h-4" /> Mulai Pencocokan ASN</>
            )}
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">{progressPhase}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{progressDetail}</p>
            </div>
            <span className="text-lg font-bold text-teal-700">{progressPercent}%</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-teal-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {matchingResult && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-medium text-slate-500">Total Data ASN Kota</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{matchingResult.summary.total_asn_kota_rows}</p>
            </div>
            <div className="p-5 bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800">Ditemukan di SE ASN (≥ {threshold}%)</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {matchingResult.summary.matched_count} 
                <span className="text-sm font-normal text-emerald-600 ml-2">({matchingResult.summary.overall_matched_percentage}%)</span>
              </p>
            </div>
            <div className="p-5 bg-white rounded-xl border border-rose-200 bg-rose-50/20 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-800">Tidak Ditemukan</span>
                <XCircle className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-2xl font-bold text-rose-700 mt-1">{matchingResult.summary.unmatched_count}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('matched')}
                  className={`px-4 py-2 rounded-md text-xs font-semibold transition ${
                    activeTab === 'matched' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Data Cocok ({matchingResult.matched_data.length})
                </button>
                <button
                  onClick={() => setActiveTab('unmatched')}
                  className={`px-4 py-2 rounded-md text-xs font-semibold transition ${
                    activeTab === 'unmatched' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tidak Ditemukan ({matchingResult.unmatched_data.length})
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button 
                  onClick={handleDownloadCSV}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold shadow-sm border border-slate-200 hover:bg-slate-200 transition"
                >
                  <Download className="w-3.5 h-3.5" /> Unduh CSV
                </button>

                <button 
                  onClick={handleDownloadExcel}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold shadow-sm border border-emerald-200 hover:bg-emerald-100 transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Unduh Excel
                </button>

                <button 
                  onClick={handleSaveHistory}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold shadow hover:bg-teal-700 disabled:opacity-50 transition"
                >
                  {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...</> : <><Save className="w-3.5 h-3.5" /> Simpan ke Database</>}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              {activeTab === 'matched' ? (
                <table className="w-max min-w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 whitespace-nowrap">
                    <tr>
                      <th className="p-3.5 sticky left-0 bg-slate-50 z-10 shadow-[1px_0_0_0_#e2e8f0]">Skor</th>
                      <th className="p-3.5">Nama ASN</th>
                      <th className="p-3.5">NIP</th>
                      <th className="p-3.5">Unit Kerja</th>
                      <th className="p-3.5 text-teal-700 bg-teal-50/50">Nama di SE ASN</th>
                      <th className="p-3.5">Kode Wilayah (NIK)</th>
                      <th className="p-3.5">Link FASIH</th>
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
                        <td className="p-3.5 font-medium text-slate-800">{row.asn_nama}</td>
                        <td className="p-3.5 font-mono text-slate-500">{row.asn_nip || '-'}</td>
                        <td className="p-3.5">{row.asn_unit_kerja || '-'}</td>
                        <td className="p-3.5 font-medium text-teal-900 bg-teal-50/10">{row.se_asn_nama || '-'}</td>
                        <td className="p-3.5 font-mono text-slate-500">{row.se_asn_kode_wilayah || '-'}</td>
                        <td className="p-3.5 text-blue-600 underline">
                          <a href={row.se_asn_link} target="_blank" rel="noreferrer">
                            {row.se_asn_link ? "Buka FASIH" : "-"}
                          </a>
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
                      <th className="p-3.5">Nama ASN</th>
                      <th className="p-3.5">NIP</th>
                      <th className="p-3.5">Unit Kerja</th>
                      <th className="p-3.5">Kandidat SE ASN Terdekat</th>
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
                        <td className="p-3.5 font-medium text-slate-900">{row.asn_nama}</td>
                        <td className="p-3.5 font-mono text-slate-500">{row.asn_nip || '-'}</td>
                        <td className="p-3.5">{row.asn_unit_kerja || '-'}</td>
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
