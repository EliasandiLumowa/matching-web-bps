'use client';

import React from 'react';
import { ShieldCheck, GitCompare, FileCheck2, Database, ArrowRight, Zap, Lock } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 transform translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-teal-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 transform translate-y-1/2"></div>
        
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold tracking-wide uppercase mb-6">
            <ShieldCheck className="w-4 h-4" />
            Sistem Informasi Matchstat
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
            Enterprise Data Matching <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-300">
              Database Terintegrasi
            </span>
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed mb-8 max-w-2xl">
            Aplikasi khusus untuk melakukan proses pemadanan (matching) data skala besar. Dilengkapi dengan algoritma perbandingan presisi untuk memastikan akurasi data master BPS Sulawesi Utara.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/matching_usaha" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium transition-colors shadow-lg shadow-blue-900/50">
              Mulai Matching Data
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/matching_asn" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium transition-colors shadow-lg shadow-blue-900/50">
              Mulai Matching ASN
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/review" className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-6 py-3 rounded-xl font-medium transition-colors">
              Lihat Hasil Review
            </Link>
          </div>
        </div>
      </div>

      {/* Fitur Utama */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          Layanan & Fitur Utama
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-5">
              <GitCompare className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Matching Data Usaha</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Fasilitas untuk mencocokkan data usaha (perusahaan/bisnis) dengan database master menggunakan parameter string matching yang tingkat kemiripannya dapat disesuaikan.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center mb-5">
              <GitCompare className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Matching Data ASN</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Modul khusus untuk pemadanan data kepegawaian (Aparatur Sipil Negara) berdasarkan informasi NIP, Nama, atau atribut kepegawaian lainnya.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-5">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Review CSV</h3>
            <p className="text-sm text-slate-500 leading-relaxed">
              Setelah proses pemadanan selesai, Anda dapat melakukan peninjauan hasil (review), memberikan validasi persetujuan, serta mengunduh hasil matching ke format CSV.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}