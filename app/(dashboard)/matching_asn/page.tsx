'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload,
  FileSpreadsheet,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Save,
  Loader2,
  Download,
  Users,
  Plus,
  Trash2,
  Settings2,
  Columns3,
  Link as LinkIcon,
} from 'lucide-react';
import { useMatchingAsnStore } from '../../store/useMatchingAsnStore';
import type { MatchColumnPair } from '../../store/useMatchingAsnStore';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// ==================== TIPE ====================

interface ColumnPairUI {
  id: string;
  col_file1: string;
  col_file2: string;
  type: 'name' | 'text' | 'id';
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

// ==================== KOMPONEN UTAMA ====================

export default function MatchingAsnPage() {
  const {
    matchingResult,
    fileName1,
    fileName2,
    file1Headers: storedH1,
    file2Headers: storedH2,
    matchColumns: storedMatchCols,
    setMatchingResult,
    clearResult,
  } = useMatchingAsnStore();

  // File state
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);

  // Detected headers from uploaded files
  const [file1Headers, setFile1Headers] = useState<string[]>([]);
  const [file2Headers, setFile2Headers] = useState<string[]>([]);

  // Column pair configuration
  const [columnPairs, setColumnPairs] = useState<ColumnPairUI[]>([
    { id: generateId(), col_file1: '', col_file2: '', type: 'name' },
  ]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'matched' | 'unmatched'>('matched');
  const [threshold, setThreshold] = useState<number>(85);

  // Progress
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressPhase, setProgressPhase] = useState<string>('');
  const [progressDetail, setProgressDetail] = useState<string>('');

  // Hydration guard
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Prevent accidental page leave
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

  // ==================== FILE UPLOAD + HEADER DETECTION ====================

  const readCsvHeaders = useCallback((file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        // Parse hanya 2 baris pertama untuk ambil header
        const parsed = Papa.parse(text, {
          header: true,
          preview: 2,
          skipEmptyLines: 'greedy',
        });
        const fields = parsed.meta.fields || [];
        resolve(fields);
      };
      reader.onerror = () => reject(new Error('Gagal membaca file'));
      reader.readAsText(file);
    });
  }, []);

  const handleFile1Change = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFile1(file);
    if (file) {
      try {
        const headers = await readCsvHeaders(file);
        setFile1Headers(headers);
      } catch {
        setFile1Headers([]);
      }
    } else {
      setFile1Headers([]);
    }
    // Reset column pairs when file changes
    setColumnPairs([{ id: generateId(), col_file1: '', col_file2: '', type: 'name' }]);
  }, [readCsvHeaders]);

  const handleFile2Change = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFile2(file);
    if (file) {
      try {
        const headers = await readCsvHeaders(file);
        setFile2Headers(headers);
      } catch {
        setFile2Headers([]);
      }
    } else {
      setFile2Headers([]);
    }
    setColumnPairs([{ id: generateId(), col_file1: '', col_file2: '', type: 'name' }]);
  }, [readCsvHeaders]);

  // ==================== COLUMN PAIR MANAGEMENT ====================

  // Auto-detect tipe pencocokan berdasarkan nama kolom
  const guessMatchingType = (colName: string): 'name' | 'text' | 'id' | null => {
    const lower = colName.toLowerCase();
    if (/(nik|nip|ktp|id|kode|nomor|no_)/i.test(lower)) return 'id';
    if (/(nama|name)/i.test(lower)) return 'name';
    return null;
  };

  const addColumnPair = () => {
    setColumnPairs(prev => [
      ...prev,
      { id: generateId(), col_file1: '', col_file2: '', type: 'id' },
    ]);
  };

  const removeColumnPair = (id: string) => {
    setColumnPairs(prev => prev.length > 1 ? prev.filter(p => p.id !== id) : prev);
  };

  const updateColumnPair = (id: string, field: keyof ColumnPairUI, value: string) => {
    setColumnPairs(prev => prev.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, [field]: value };
      // Otomatis ubah tipe ke ID atau Nama saat kolom baru dipilih
      if ((field === 'col_file1' || field === 'col_file2') && value) {
        const guessed = guessMatchingType(value);
        if (guessed) {
          updated.type = guessed;
        }
      }
      return updated;
    }));
  };

  // Check apakah konfigurasi valid
  const isConfigValid = columnPairs.every(p => p.col_file1 && p.col_file2);
  const bothFilesUploaded = file1Headers.length > 0 && file2Headers.length > 0;

  // ==================== PROSES MATCHING ====================

  const handleProcessMatching = async () => {
    if (!file1 || !file2) {
      alert('Silakan pilih kedua file CSV.');
      return;
    }

    if (!isConfigValid) {
      alert('Silakan lengkapi konfigurasi pasangan kolom matching.');
      return;
    }

    setLoading(true);
    clearResult();
    setProgressPercent(0);
    setProgressPhase('Mengunggah file...');
    setProgressDetail('');

    const matchConfig: MatchColumnPair[] = columnPairs.map(p => ({
      col_file1: p.col_file1,
      col_file2: p.col_file2,
      type: p.type,
    }));

    const formData = new FormData();
    formData.append('file_1', file1);
    formData.append('file_2', file2);
    formData.append('threshold', String(threshold));
    formData.append('match_config', JSON.stringify(matchConfig));

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
              setMatchingResult(
                event.data,
                file1.name,
                file2.name,
                event.data.file1_headers || file1Headers,
                event.data.file2_headers || file2Headers,
                matchConfig,
              );
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

  // ==================== HELPER: detect URL columns ====================

  function isUrlValue(val: string): boolean {
    return val.startsWith('http://') || val.startsWith('https://');
  }

  // Headers untuk tabel (dari store jika ada hasil, atau dari state)
  const activeH1 = matchingResult ? storedH1 : file1Headers;
  const activeH2 = matchingResult ? storedH2 : file2Headers;
  const activeMatchCols: MatchColumnPair[] = matchingResult ? storedMatchCols : [];

  // Kolom yang digunakan untuk matching (untuk highlighting)
  const matchedFile2Cols = new Set(activeMatchCols.map(mc => mc.col_file2));
  const matchedFile1Cols = new Set(activeMatchCols.map(mc => mc.col_file1));

  // ==================== DOWNLOAD CSV ====================

  const handleDownloadCSV = () => {
    if (!matchingResult) return;

    const data = activeTab === 'matched'
      ? matchingResult.matched_data
      : matchingResult.unmatched_data;

    if (data.length === 0) {
      alert('Tidak ada data untuk diunduh.');
      return;
    }

    // Bangun header berurutan
    const headers: string[] = ['Skor (%)'];
    // Kolom File 2 (Target)
    for (const h of activeH2) headers.push(`[Target] ${h}`);

    if (activeTab === 'matched') {
      // Kolom File 1 (Referensi)
      for (const h of activeH1) headers.push(`[Referensi] ${h}`);
    } else {
      // Kolom kandidat terdekat
      for (const mc of activeMatchCols) headers.push(`[Kandidat Terdekat] ${mc.col_file1}`);
    }

    const csvRows = [headers.join(',')];

    for (const row of data) {
      const vals: string[] = [`"${row.similarity_score}%"`];
      for (const h of activeH2) {
        const v = row[`file2_${h}`] ?? '-';
        vals.push(`"${String(v).replace(/"/g, '""')}"`);
      }
      if (activeTab === 'matched') {
        for (const h of activeH1) {
          const v = row[`file1_${h}`] ?? '-';
          vals.push(`"${String(v).replace(/"/g, '""')}"`);
        }
      } else {
        for (const mc of activeMatchCols) {
          const v = row[`closest_file1_${mc.col_file1}`] ?? '-';
          vals.push(`"${String(v).replace(/"/g, '""')}"`);
        }
      }
      csvRows.push(vals.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Hasil_Matching_${activeTab}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==================== DOWNLOAD EXCEL ====================

  const handleDownloadExcel = () => {
    if (!matchingResult) return;

    const data = activeTab === 'matched'
      ? matchingResult.matched_data
      : matchingResult.unmatched_data;

    if (data.length === 0) {
      alert('Tidak ada data untuk diunduh.');
      return;
    }

    // Bangun formatted rows
    const formattedData = data.map((row: any) => {
      const obj: any = { 'Skor (%)': `${row.similarity_score}%` };

      for (const h of activeH2) {
        obj[`[Target] ${h}`] = row[`file2_${h}`] || '-';
      }

      if (activeTab === 'matched') {
        for (const h of activeH1) {
          obj[`[Referensi] ${h}`] = row[`file1_${h}`] || '-';
        }
      } else {
        for (const mc of activeMatchCols) {
          obj[`[Kandidat Terdekat] ${mc.col_file1}`] = row[`closest_file1_${mc.col_file1}`] || '-';
        }
      }

      return obj;
    });

    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    // Auto-hyperlink kolom yang berisi URL
    if (activeTab === 'matched') {
      const allHeaders = Object.keys(formattedData[0]);
      for (let colIdx = 0; colIdx < allHeaders.length; colIdx++) {
        for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
          const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 1, c: colIdx });
          const cell = worksheet[cellRef];
          if (cell && typeof cell.v === 'string' && isUrlValue(cell.v.trim())) {
            const url = cell.v.trim();
            if (url.length < 255) {
              worksheet[cellRef] = {
                t: 's',
                v: '🔗 Buka Link',
                f: `HYPERLINK("${url}", "🔗 Buka Link")`,
              };
            } else {
              cell.l = { Target: url };
            }
          }
        }
      }
    }

    // Auto column widths
    const allHeaders = Object.keys(formattedData[0]);
    worksheet['!cols'] = allHeaders.map(h => {
      if (h.includes('Skor')) return { wch: 10 };
      if (h.includes('Link') || h.includes('link') || h.includes('url') || h.includes('URL')) return { wch: 50 };
      return { wch: Math.min(Math.max(h.length + 4, 18), 45) };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hasil Matching');
    XLSX.writeFile(workbook, `Hasil_Matching_${activeTab}_${Date.now()}.xlsx`);
  };

  // ==================== SIMPAN KE DATABASE ====================

  const handleSaveHistory = async () => {
    if (!matchingResult) return;

    setSaving(true);
    try {
      const payload = {
        nama_file_master: fileName1,
        nama_file_scraping: fileName2,
        total_data_scraping: matchingResult.summary.total_file2_rows,
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

      alert('✅ Data hasil matching berhasil disimpan ke database!');
    } catch (err: any) {
      alert('❌ ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      {/* ========== STEP 1: UPLOAD FILES ========== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-1">
          <Users className="w-5 h-5 text-teal-600" />
          <h3 className="text-base font-bold text-slate-800">Unggah Dataset untuk Matching</h3>
        </div>
        <p className="text-xs text-slate-400 mb-6">Unggah dua file CSV — kolom akan otomatis terdeteksi, lalu Anda pilih kolom mana yang ingin dicocokkan.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* File 1 — Referensi */}
          <div className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition ${
            file1 ? 'border-teal-500 bg-teal-50/20' : 'border-slate-300 hover:border-teal-400 bg-slate-50/50'
          }`}>
            <FileSpreadsheet className={`w-10 h-10 mb-2 ${file1 ? 'text-teal-600' : 'text-slate-400'}`} />
            <p className="text-xs font-semibold text-slate-700">1. File Referensi (Data Pembanding)</p>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-3 text-center">Contoh: SE ASN, Data Master, dll.</p>
            <input
              type="file"
              accept=".csv"
              id="uploadFile1"
              className="hidden"
              onChange={handleFile1Change}
            />
            <label
              htmlFor="uploadFile1"
              className="cursor-pointer text-xs font-medium px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-700 transition"
            >
              {file1 ? file1.name : 'Pilih File Referensi'}
            </label>
            {file1Headers.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1 justify-center">
                {file1Headers.map(h => (
                  <span key={h} className="text-[10px] px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-full">{h}</span>
                ))}
              </div>
            )}
          </div>

          {/* File 2 — Target */}
          <div className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition ${
            file2 ? 'border-amber-500 bg-amber-50/20' : 'border-slate-300 hover:border-amber-400 bg-slate-50/50'
          }`}>
            <Upload className={`w-10 h-10 mb-2 ${file2 ? 'text-amber-600' : 'text-slate-400'}`} />
            <p className="text-xs font-semibold text-slate-700">2. File Target (Data yang Dicari)</p>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-3 text-center">Contoh: ASN Kota, Data Scraping, dll.</p>
            <input
              type="file"
              accept=".csv"
              id="uploadFile2"
              className="hidden"
              onChange={handleFile2Change}
            />
            <label
              htmlFor="uploadFile2"
              className="cursor-pointer text-xs font-medium px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-700 transition"
            >
              {file2 ? file2.name : 'Pilih File Target'}
            </label>
            {file2Headers.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1 justify-center">
                {file2Headers.map(h => (
                  <span key={h} className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">{h}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========== STEP 2: COLUMN CONFIGURATION ========== */}
      {bothFilesUploaded && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 transition-all animate-in fade-in duration-300">
          <div className="flex items-center gap-3 mb-1">
            <Settings2 className="w-5 h-5 text-violet-600" />
            <h3 className="text-base font-bold text-slate-800">Konfigurasi Kolom Matching</h3>
          </div>
          <p className="text-xs text-slate-400 mb-5">Pilih kolom mana dari kedua file yang ingin dicocokkan. Anda bisa menambah beberapa pasangan kolom.</p>

          <div className="space-y-3">
            {columnPairs.map((pair, idx) => (
              <div key={pair.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                {/* Nomor */}
                <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-[11px] font-bold bg-violet-100 text-violet-700 rounded-full">
                  {idx + 1}
                </span>

                {/* Dropdown File 1 */}
                <div className="flex-1 min-w-0 w-full sm:w-auto text-black">
                  <label className="block text-[10px] font-semibold text-teal-700 mb-1 uppercase tracking-wider">Kolom Referensi</label>
                  <select
                    value={pair.col_file1}
                    onChange={(e) => updateColumnPair(pair.id, 'col_file1', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition"
                  >
                    <option value="" >— Pilih Kolom —</option>
                    {file1Headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Arrow */}
                <ArrowRightLeft className="w-4 h-4 text-slate-400 flex-shrink-0 mt-5 sm:mt-0 hidden sm:block" />

                {/* Dropdown File 2 */}
                <div className="flex-1 min-w-0 w-full sm:w-auto text-black">
                  <label className="block text-[10px] font-semibold text-amber-700 mb-1 uppercase tracking-wider">Kolom Target</label>
                  <select
                    value={pair.col_file2}
                    onChange={(e) => updateColumnPair(pair.id, 'col_file2', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                  >
                    <option value="">— Pilih Kolom —</option>
                    {file2Headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Tipe */}
                <div className="flex-shrink-0 w-full sm:w-52">
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">Tipe Pencocokan</label>
                  <select
                    value={pair.type}
                    onChange={(e) => updateColumnPair(pair.id, 'type', e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500 outline-none transition font-medium"
                  >
                    <option value="id">🔢 Nomor ID / NIK / NIP / Kode</option>
                    <option value="name">🏷️ Nama (Bersihkan Gelar)</option>
                    <option value="text">📝 Teks Biasa</option>
                  </select>
                </div>

                {/* Tombol Hapus */}
                <button
                  type="button"
                  onClick={() => removeColumnPair(pair.id)}
                  disabled={columnPairs.length <= 1}
                  className="flex-shrink-0 p-2 mt-5 sm:mt-0 text-slate-400 hover:text-rose-500 disabled:opacity-30 disabled:hover:text-slate-400 transition"
                  title="Hapus pasangan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addColumnPair}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Tambah Pasangan Kolom
          </button>
        </div>
      )}

      {/* ========== STEP 3: THRESHOLD + PROSES ========== */}
      {bothFilesUploaded && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-1">
            <Columns3 className="w-5 h-5 text-teal-600" />
            <h3 className="text-base font-bold text-slate-800">Pengaturan & Proses</h3>
          </div>

          <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-xs font-semibold text-slate-700">Tingkat Kemiripan Minimum</span>
                <p className="text-[11px] text-slate-400">Skor rata-rata dari semua pasangan kolom. Gunakan 85-100% untuk hasil sangat persis.</p>
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
              disabled={!mounted || !file1 || !file2 || !isConfigValid || loading}
              suppressHydrationWarning
              className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold shadow-md shadow-teal-600/20 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sedang Memproses...</>
              ) : (
                <><ArrowRightLeft className="w-4 h-4" /> Mulai Pencocokan</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ========== PROGRESS BAR ========== */}
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

      {/* ========== RESULTS ========== */}
      {matchingResult && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-medium text-slate-500">Total Data Target</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{matchingResult.summary.total_file2_rows}</p>
            </div>
            <div className="p-5 bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800">Ditemukan (≥ {threshold}%)</span>
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

          {/* Data Table */}
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

            {/* ===== DYNAMIC TABLE ===== */}
            <div className="overflow-x-auto">
              {activeTab === 'matched' ? (
                <table className="w-max min-w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 whitespace-nowrap">
                    <tr>
                      <th className="p-3.5 sticky left-0 bg-slate-50 z-10 shadow-[1px_0_0_0_#e2e8f0]">Skor</th>
                      {/* Kolom File 2 (Target) */}
                      {activeH2.map(h => (
                        <th
                          key={`h2-${h}`}
                          className={`p-3.5 ${matchedFile2Cols.has(h) ? 'text-amber-800 bg-amber-50/50' : ''}`}
                        >
                          {h}
                          {matchedFile2Cols.has(h) && <span className="ml-1 text-[9px] text-amber-500">★</span>}
                        </th>
                      ))}
                      {/* Kolom File 1 (Referensi) */}
                      {activeH1.map(h => (
                        <th
                          key={`h1-${h}`}
                          className={`p-3.5 ${matchedFile1Cols.has(h) ? 'text-teal-800 bg-teal-50/50' : 'text-slate-500'}`}
                        >
                          {h}
                          {matchedFile1Cols.has(h) && <span className="ml-1 text-[9px] text-teal-500">★</span>}
                        </th>
                      ))}
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
                        {activeH2.map(h => {
                          const val = row[`file2_${h}`] || '-';
                          const isUrl = isUrlValue(String(val));
                          return (
                            <td
                              key={`v2-${h}`}
                              className={`p-3.5 ${matchedFile2Cols.has(h) ? 'font-medium text-amber-900 bg-amber-50/10' : ''}`}
                            >
                              {isUrl ? (
                                <a href={val} target="_blank" rel="noreferrer" className="text-blue-600 underline inline-flex items-center gap-1">
                                  <LinkIcon className="w-3 h-3" /> Buka Link
                                </a>
                              ) : val}
                            </td>
                          );
                        })}
                        {activeH1.map(h => {
                          const val = row[`file1_${h}`] || '-';
                          const isUrl = isUrlValue(String(val));
                          return (
                            <td
                              key={`v1-${h}`}
                              className={`p-3.5 ${matchedFile1Cols.has(h) ? 'font-medium text-teal-900 bg-teal-50/10' : 'text-slate-500'}`}
                            >
                              {isUrl ? (
                                <a href={val} target="_blank" rel="noreferrer" className="text-blue-600 underline inline-flex items-center gap-1">
                                  <LinkIcon className="w-3 h-3" /> Buka Link
                                </a>
                              ) : val}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-max min-w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 whitespace-nowrap">
                    <tr>
                      <th className="p-3.5">Skor Tertinggi</th>
                      {/* Kolom File 2 (Target) */}
                      {activeH2.map(h => (
                        <th key={`uh2-${h}`} className="p-3.5">{h}</th>
                      ))}
                      {/* Kandidat terdekat per kolom matching */}
                      {activeMatchCols.map(mc => (
                        <th key={`ucand-${mc.col_file1}`} className="p-3.5 text-slate-400 italic">
                          Kandidat: {mc.col_file1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {matchingResult.unmatched_data.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition whitespace-nowrap">
                        <td className="p-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700">
                            {row.similarity_score}%
                          </span>
                        </td>
                        {activeH2.map(h => {
                          const val = row[`file2_${h}`] || '-';
                          return <td key={`uv2-${h}`} className="p-3.5">{val}</td>;
                        })}
                        {activeMatchCols.map(mc => (
                          <td key={`ucandv-${mc.col_file1}`} className="p-3.5 italic text-slate-400">
                            {row[`closest_file1_${mc.col_file1}`] || '-'}
                          </td>
                        ))}
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
