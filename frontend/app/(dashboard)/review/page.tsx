'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import { UploadCloud, CheckCircle2, AlertTriangle, FileText, Trash2 } from 'lucide-react';

export default function ReviewCsvPage() {
  const [data, setData] = useState<any[]>([]);
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert('Hanya file .CSV yang diizinkan.');
      return;
    }

    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        if (rows.length === 0) return;

        setHeaders(Object.keys(rows[0]));
        setData(rows);

        // Algoritma Cek Duplikasi berdasarkan Nama Usaha
        const seen = new Set();
        const dupes: any[] = [];
        rows.forEach((row) => {
          const key = (row['Nama Usaha'] || row['nama_usaha'] || '').toLowerCase().trim();
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

  const handleReset = () => {
    setData([]);
    setDuplicates([]);
    setHeaders([]);
    setFileName('');
  };

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
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs font-semibold text-slate-800">{fileName}</p>
                <p className="text-[11px] text-slate-400">{data.length} total baris terdeteksi</p>
              </div>
            </div>
            <button 
              onClick={handleReset}
              className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition"
              title="Hapus / Reset"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {data.length > 0 && (
        <>
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
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="p-3.5 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      {headers.map((h) => (
                        <td key={h} className="p-3.5 whitespace-nowrap">{row[h] || '-'}</td>
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