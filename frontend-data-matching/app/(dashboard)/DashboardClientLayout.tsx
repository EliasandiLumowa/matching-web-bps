'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  GitCompare, 
  FileCheck2, 
  History, 
  ShieldCheck, 
  LogOut, 
  Menu, 
  X,
  User,
  Loader2
} from 'lucide-react';

const navigation = [
  { name: 'Beranda', href: '/', icon: LayoutDashboard },
  { name: 'Matching Data', href: '/matching', icon: GitCompare },
  { name: 'Review CSV', href: '/review', icon: FileCheck2 },
  { name: 'Riwayat Matching', href: '/history', icon: History },
];

// Mendefinisikan tipe data untuk user
interface UserSession {
  username: string;
  email: string;
}

export default function DashboardClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // State untuk menyimpan data User yang login
  const [userData, setUserData] = useState<UserSession | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Ambil data user dari API session yang baru kita buat
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const json = await res.json();
          setUserData(json.user);
        }
      } catch (err) {
        console.error("Gagal menarik sesi pengguna");
      } finally {
        setLoadingUser(false);
      }
    };
    fetchSession();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out
        lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div>
          {/* Logo & Brand */}
          <div className="h-16 flex items-center justify-between px-6 bg-slate-950 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg text-white">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-sm tracking-wide text-white">DATA MATCHER</span>
                <span className="block text-[10px] text-slate-400">Enterprise Security</span>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30' 
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout (DINAMIS) */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-slate-200 shrink-0">
              {loadingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-5 h-5" />}
            </div>
            <div className="flex-1 overflow-hidden">
              {/* Tampilkan nama dan email dari Strapi */}
              {userData ? (
                <>
                  <p className="text-xs font-semibold text-white truncate capitalize">{userData.username}</p>
                  <p className="text-[11px] text-slate-400 truncate">{userData.email}</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold text-white truncate">Administrator</p>
                  <p className="text-[11px] text-slate-400 truncate">Sesi Tidak Aktif</p>
                </>
              )}
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-950/30 hover:text-red-300 rounded-lg transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar Sistem
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-base font-semibold text-slate-800">
              {navigation.find(n => n.href === pathname)?.name || 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Database Protected
            </span>
          </div>
        </header>

        {/* Page View Body */}
        <main className="p-6 md:p-8 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}