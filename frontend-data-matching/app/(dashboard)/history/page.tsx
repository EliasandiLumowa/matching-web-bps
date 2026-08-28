'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Eye, Download, Loader2 } from 'lucide-react';

export default function HistoryPage() {
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history/list');
      const json = await res.json();
      if (res.ok) {
        setHistoryList(json.data || []);
      }
    } catch (err) {
      console.error('Gagal mengambil riwayat:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <h3 className="text-base font-bold text-slate-800">Riwayat Pemrosesan Matching</h3>
        <p className="text-xs text-slate-400 mt-1">Daftar rekaman eksekusi matching yang tersimpan di MySQL</p>
      </div>

      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-10 flex justify-center items-center text-slate-400 text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Memuat data riwayat...
          </div>
        ) : historyList.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs">
            Belum ada riwayat matching yang tersimpan.
          </div>
        ) : (
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-4">ID</th>
                <th className="p-4">Waktu Eksekusi</th>
                <th className="p-4">File Master & Target</th>
                <th className="p-4">Total Data</th>
                <th className="p-4">Tingkat Match</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyList.map((item: any) => {
                const attr = item.attributes || item; // Mendukung format Strapi v4 & v5
                const dateFormatted = new Date(attr.createdAt || Date.now()).toLocaleString('id-ID', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 font-mono font-semibold text-slate-900">#{item.id}</td>
                    <td className="p-4 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {dateFormatted} WITA
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-slate-800">{attr.nama_file_scraping}</p>
                      <p className="text-[11px] text-slate-400">vs {attr.nama_file_master}</p>
                    </td>
                    <td className="p-4 font-semibold text-slate-800">{attr.total_data_scraping} baris</td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                        {attr.persentase_match}%
                      </span>
                      <span className="text-[11px] text-slate-400 ml-1.5">({attr.matched_count} match)</span>
                    </td>
                    <td className="p-4 text-center">
                      <button className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-blue-600 transition" title="Lihat Detail Data">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}