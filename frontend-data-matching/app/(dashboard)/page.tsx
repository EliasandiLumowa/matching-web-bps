'use client';

import React from 'react';
import { 
  Building2, 
  Layers, 
  MapPin, 
  TrendingUp 
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const dataKabupaten = [
  { nama: 'Kota Manado', total: 4230 },
  { nama: 'Minahasa Utara', total: 2890 },
  { nama: 'Kota Bitung', total: 2150 },
  { nama: 'Kota Tomohon', total: 1680 },
  { nama: 'Minahasa', total: 3410 },
];

const dataKecamatan = [
  { nama: 'Wanea', total: 1120 },
  { nama: 'Malalayang', total: 980 },
  { nama: 'Sario', total: 840 },
  { nama: 'Mapanget', total: 720 },
  { nama: 'Tikala', total: 570 },
];

const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];

export default function HomePage() {
  return (
    <div className="space-y-6">
      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Master Usaha</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">14,360</h3>
            <span className="text-[11px] text-emerald-600 font-medium mt-1 inline-block">Terdata di Database</span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Cakupan Kabupaten/Kota</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">5 Wilayah</h3>
            <span className="text-[11px] text-slate-400 mt-1 inline-block">Sulawesi Utara</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <MapPin className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Kecamatan Terdata</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">38</h3>
            <span className="text-[11px] text-slate-400 mt-1 inline-block">Aktif tervalidasi</span>
          </div>
          <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Kelurahan / Desa</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">214</h3>
            <span className="text-[11px] text-emerald-600 font-medium mt-1 inline-block">100% Terpetakan</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Visualisasi Grafik */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribusi Kabupaten (Bar Chart) */}
        <div className="lg:col-span-2 p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Distribusi Data per Kabupaten / Kota</h3>
              <p className="text-xs text-slate-400">Jumlah sebaran unit usaha yang terdaftar di master</p>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataKabupaten} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="nama" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px' }} 
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top 5 Kecamatan (Donut Chart) */}
        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Top 5 Kecamatan</h3>
            <p className="text-xs text-slate-400 mb-4">Konsentrasi usaha tertinggi</p>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dataKecamatan} dataKey="total" nameKey="nama" innerRadius={50} outerRadius={75} paddingAngle={4}>
                    {dataKecamatan.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="space-y-1.5 mt-2">
            {dataKecamatan.map((item, idx) => (
              <div key={item.nama} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx] }}></span>
                  {item.nama}
                </span>
                <span className="font-semibold text-slate-800">{item.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}