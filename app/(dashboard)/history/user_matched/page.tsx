'use client';

import React, { useEffect, useState } from 'react';
import { Calendar, Eye, Loader2, UserCircle, Search, Filter } from 'lucide-react';
import Link from 'next/link';

export default function HistoryPage() {
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [filteredList, setFilteredList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // State untuk Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  // Logika Filter Data Otomatis saat State Filter Berubah
  useEffect(() => {
    let result = historyList;

    // 1. Filter berdasarkan Nama User (Search)
    if (searchTerm) {
      result = result.filter((item: any) => {
        const attr = item.attributes || item;
        const userObj = attr.users_permissions_user;
        const username = (userObj?.username || userObj?.data?.attributes?.username || '').toLowerCase();
        return username.includes(searchTerm.toLowerCase());
      });
    }

    // 2. Filter berdasarkan Tanggal Mulai (Start Date)
    if (startDate) {
      result = result.filter((item: any) => {
        const attr = item.attributes || item;
        const itemDate = new Date(attr.createdAt || Date.now());
        const filterStart = new Date(startDate);
        filterStart.setHours(0, 0, 0, 0); // Set ke awal hari
        return itemDate >= filterStart;
      });
    }

    // 3. Filter berdasarkan Tanggal Akhir (End Date)
    if (endDate) {
      result = result.filter((item: any) => {
        const attr = item.attributes || item;
        const itemDate = new Date(attr.createdAt || Date.now());
        const filterEnd = new Date(endDate);
        filterEnd.setHours(23, 59, 59, 999); // Set ke akhir hari
        return itemDate <= filterEnd;
      });
    }

    setFilteredList(result);
  }, [searchTerm, startDate, endDate, historyList]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history/list');
      const json = await res.json();
      if (res.ok) {
        setHistoryList(json.data || []);
        setFilteredList(json.data || []); // Inisialisasi data tersaring
      }
    } catch (err) {
      console.error('Gagal mengambil riwayat:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetFilter = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Header & Filter Section */}
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-800">Pemantauan Riwayat Matching</h3>
          <p className="text-xs text-slate-400 mt-1 mb-6">Pantau aktivitas matching seluruh pengguna dan filter berdasarkan tanggal atau akun.</p>
          
          <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-200">
            
            {/* Search by User */}
           <div className="w-full md:w-1/3">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider text-black">Cari Akun</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 text-black" />
                <input 
                  type="text" 
                  placeholder="Ketik nama eksekutor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs text-black border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                />
              </div>
            </div>

            {/* Filter Start Date */}
            <div className="w-full md:w-1/4">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Dari Tanggal</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs text-black border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            {/* Filter End Date */}
            <div className="w-full md:w-1/4">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Sampai Tanggal</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs text-black border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            {/* Reset Button */}
            <div className="w-full md:w-auto">
              <button 
                onClick={resetFilter}
                disabled={!searchTerm && !startDate && !endDate}
                className="w-full px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Filter className="w-3.5 h-3.5" /> Reset
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-10 flex justify-center items-center text-slate-400 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Memuat data riwayat...
            </div>
          ) : filteredList.length === 0 ? (
            <div className="p-10 text-center text-slate-500 text-xs bg-slate-50/50">
              Tidak ada data riwayat yang sesuai dengan filter pencarian Anda.
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-600 whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-4">Waktu Eksekusi</th>
                  <th className="p-4 bg-blue-50/50">Eksekutor / Akun</th>
                  <th className="p-4">File Master & Target</th>
                  <th className="p-4">Total Data</th>
                  <th className="p-4">Tingkat Match</th>
                  <th className="p-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((item: any) => {
                  const attr = item.attributes || item;
                  const dateFormatted = new Date(attr.createdAt || Date.now()).toLocaleString('id-ID', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  });

                  // Mengambil nama user dari Strapi Relasi (v4/v5 support)
                  const userObj = attr.users_permissions_user;
                  const username = userObj?.username || userObj?.data?.attributes?.username || 'Sistem / Dihapus';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-4 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {dateFormatted} WITA
                        </div>
                      </td>
                      
                      <td className="p-4 bg-blue-50/30">
                        <div className="flex items-center gap-2">
                          <UserCircle className="w-4 h-4 text-blue-500" />
                          <span className="font-semibold text-slate-800 capitalize">{username}</span>
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
                        <Link 
                          href={`/history/user_matched/${item.documentId || item.id}`} 
                          className="inline-block p-1.5 bg-white border border-slate-200 hover:bg-blue-50 hover:border-blue-200 rounded text-slate-600 hover:text-blue-600 transition shadow-sm" 
                          title="Lihat Detail Data"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}