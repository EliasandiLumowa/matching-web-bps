'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import { UploadCloud, CheckCircle2, AlertTriangle, FileText, Trash2, Wand2, Download, Save } from 'lucide-react';

// Standar kolom yang dibutuhkan sistem dan variasi penulisannya
const STANDARD_COLUMNS = [
  { key: "Code_Identity", aliases: ["codeidentity", "code", "id"] },
  { key: "Nama_Kecamatan", aliases: ["namakecamatan", "kecamatan", "kec", "namakec"] },
  { key: "Nama_Kelurahan", aliases: ["namakelurahan", "kelurahan", "desa", "kel", "namakel"] },
  { key: "Kode_KBLI", aliases: ["kodekbli", "kbli"] },
  { key: "Nama_Usaha", aliases: ["namausaha", "nama"] },
  { key: "Nama_Pengusaha", aliases: ["namapengusaha", "pengusaha", "pemilik"] },
  { key: "Status_Pendataan", aliases: ["statuspendataan", "status"] },
  { key: "Status_Keberadaan", aliases: ["statuskeberadaan", "keberadaan"] }
];

export default function ReviewCsvPage() {
  const [data, setData] = useState<any[]>([]);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  
  // State untuk export
  const [exportFileName, setExportFileName] = useState<string>('');

  // State untuk umpan balik standarisasi kolom
  const [unwantedColumns, setUnwantedColumns] = useState<string[]>([]);
  const [renamedColumns, setRenamedColumns] = useState<{original: string, standard: string}[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert('Hanya file .CSV yang diizinkan.');
      return;
    }

    setFileName(file.name);
    // Siapkan nama file default untuk ekspor (misal: "DataLama_Cleaned")
    setExportFileName(file.name.replace('.csv', '') + '_Cleaned');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        if (rows.length === 0) return;

        const originalHeaders = Object.keys(rows[0]);
        setHeaders(originalHeaders);
        setData(rows);

        const map: Record<string, string> = {};
        const matchedOriginals = new Set<string>();
        const toRename: {original: string, standard: string}[] = [];

        // 1. Analisis Kolom (Mencari alias & mendeteksi kesalahan penulisan nama)
        STANDARD_COLUMNS.forEach(std => {
          const match = originalHeaders.find(h => {
            const cleanH = h.toLowerCase().replace(/[^a-z0-9]/gi, ''); // Hapus spasi/simbol
            return std.aliases.includes(cleanH);
          });
          
          if (match) {
            map[std.key] = match;
            matchedOriginals.add(match);
            
            // Jika nama kolom di file tidak sama persis dengan standar baku
            if (match !== std.key) {
              toRename.push({ original: match, standard: std.key });
            }
          }
        });
        
        setColumnMapping(map);
        setRenamedColumns(toRename);

        // 2. Identifikasi kolom berlebih
        const extraCols = originalHeaders.filter(h => !matchedOriginals.has(h));
        setUnwantedColumns(extraCols);

        // 3. Algoritma Cek Duplikasi
        const seen = new Set();
        const dupes: any[] = [];
        const namaUsahaCol = map["Nama_Usaha"] || "Nama_Usaha"; 

        rows.forEach((row) => {
          const key = (row[namaUsahaCol] || row['nama_usaha'] || '').toLowerCase().trim();
          if (key && seen.has(key)) {
            dupes.push(row);
          } else if (key) {
            seen.add(key);
          }
        });
        setDuplicates(dupes);
      },
    });
  };

  const handleCleanColumns = () => {
    // Membentuk ulang data HANYA dengan 8 kolom standar yang baku
    const newData = data.map(row => {
      const cleanRow: any = {};
      STANDARD_COLUMNS.forEach(std => {
        const originalColName = columnMapping[std.key];
        cleanRow[std.key] = originalColName ? row[originalColName] : "";
      });
      return cleanRow;
    });

    const newHeaders = STANDARD_COLUMNS.map(std => std.key);
    
    setData(newData);
    setHeaders(newHeaders);
    setUnwantedColumns([]); // Hilangkan peringatan setelah dibersihkan
    setRenamedColumns([]);
  };

  const handleDownloadCSV = () => {
    if (data.length === 0) return;

    // Konversi JSON kembali menjadi format CSV text
    const csvContent = Papa.unparse(data);
    
    // Buat objek blob untuk file download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Pastikan nama file berakhiran .csv
    let finalFileName = exportFileName.trim() || 'Hasil_Review';
    if (!finalFileName.toLowerCase().endsWith('.csv')) {
      finalFileName += '.csv';
    }

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', finalFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setData([]);
    setDuplicates([]);
    setHeaders([]);
    setFileName('');
    setExportFileName('');
    setUnwantedColumns([]);
    setRenamedColumns([]);
    setColumnMapping({});
  };

  const needsCleanup = unwantedColumns.length > 0 || renamedColumns.length > 0;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-base font-bold text-slate-800 mb-1">Import & Review CSV</h3>
        <p className="text-xs text-slate-400 mb-6">Periksa integritas struktur dan potensi duplikasi data sebelum diproses</p>

        {!data.length ? (
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center bg-slate-50/50">
            <UploadCloud className="mx-auto h-12 w-12 text-slate-400 mb-3" />
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="csvReviewUpload" />
            <label 
              htmlFor="csvReviewUpload" 
              className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-lg shadow hover:bg-blue-700 transition"
            >
              Pilih File CSV untuk Direview
            </label>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200 gap-4">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">{fileName}</p>
                <p className="text-[11px] text-slate-500">{data.length} total baris terdeteksi</p>
              </div>
            </div>
            
            {/* Action Bar (Export & Reset) */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="flex-1 md:w-56 text-black">
                <input 
                  type="text" 
                  value={exportFileName}
                  onChange={(e) => setExportFileName(e.target.value)}
                  placeholder="Nama file simpan..."
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button 
                onClick={handleDownloadCSV}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition shadow-sm"
                title="Simpan / Download CSV"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Simpan</span>
              </button>
              <button 
                onClick={handleReset}
                className="p-2 text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 rounded-lg transition shadow-sm"
                title="Hapus / Reset"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {data.length > 0 && (
        <>
          {/* Umpan Balik Pembersihan Kolom Berlebih & Penyesuaian Nama */}
          {needsCleanup && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-3">
                <Wand2 className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-blue-900">Penyesuaian Struktur Kolom Diperlukan</h4>
                  
                  {unwantedColumns.length > 0 && (
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      <span className="font-semibold text-rose-600">Akan Dihapus ({unwantedColumns.length} Kolom):</span> Kolom berlebih yang tidak sesuai format sistem ({unwantedColumns.join(', ')}).
                    </p>
                  )}
                  
                  {renamedColumns.length > 0 && (
                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      <span className="font-semibold text-amber-600">Akan Diubah Nama ({renamedColumns.length} Kolom):</span>{' '}
                      {renamedColumns.map((c, i) => (
                        <span key={i}>
                          <span className="font-mono bg-blue-100 px-1 py-0.5 rounded">{c.original}</span> ➔ <span className="font-mono bg-blue-100 px-1 py-0.5 rounded font-bold">{c.standard}</span>
                          {i < renamedColumns.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleCleanColumns}
                className="shrink-0 whitespace-nowrap px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition shadow-md shadow-blue-600/20"
              >
                Bersihkan & Standarisasi Sekarang
              </button>
            </div>
          )}

          {/* Status Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium">Total Baris Valid</span>
                <p className="text-2xl font-bold text-slate-900 mt-1">{data.length}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>

            <div className="p-5 bg-white rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-amber-800 font-medium">Potensi Data Duplikat</span>
                <p className="text-2xl font-bold text-amber-700 mt-1">{duplicates.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
          </div>

          {/* Table Preview */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h4 className="text-xs font-bold text-slate-800">Preview 10 Baris Pertama</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-max min-w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="p-3.5 whitespace-nowrap">
                        {/* Memberikan penanda visual jika kolom belum standar */}
                        {unwantedColumns.includes(h) ? (
                          <span className="text-rose-500 line-through" title="Kolom ini akan dihapus">{h}</span>
                        ) : renamedColumns.find(r => r.original === h) ? (
                          <span className="text-amber-500 border-b border-dashed border-amber-500 pb-0.5" title="Kolom ini akan diubah namanya">{h}</span>
                        ) : (
                          h
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      {headers.map((h) => (
                        <td key={h} className={`p-3.5 whitespace-nowrap ${unwantedColumns.includes(h) ? 'text-rose-300' : ''}`}>
                          {row[h] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}