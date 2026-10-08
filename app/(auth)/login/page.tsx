'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  Loader2,
  Smartphone, // Tambahan ikon untuk UI OTP
  ArrowLeft   // Tambahan ikon untuk kembali
} from 'lucide-react';
import Image from 'next/image';

function LoginContent() {
  const searchParams = useSearchParams();
  const rawCallback = searchParams.get('callbackUrl');

  // Keamanan Navigasi: Pastikan target redirect TIDAK mengarah kembali ke /login
  const targetUrl = (rawCallback && !rawCallback.startsWith('/login')) ? rawCallback : '/';

  // --- STATE KONTROL MULTI-STEP ---
  const [step, setStep] = useState<'LOGIN' | 'OTP'>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // --- STATE FORM LOGIN ---
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // --- STATE FORM OTP (Khusus Superadmin) ---
  const [otp, setOtp] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');

  // 1. FUNGSI SUBMIT LOGIN AWAL
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Gagal melakukan autentikasi.');
      }

      // Jika user terdeteksi sebagai Superadmin, API akan meminta OTP
      if (data.requireOtp) {
        setMaskedPhone(data.phoneMasked); // Simpan nomor WA yang disamarkan
        setStep('OTP');                   // Ganti tampilan UI ke form OTP
        setLoading(false);
        return; // Hentikan eksekusi, JANGAN redirect
      }

      // Jika Operator biasa, hard redirect ke target URL
      window.location.href = targetUrl;
    } catch (err: any) {
      setErrorMessage(err.message);
      setLoading(false);
    }
  };

  // 2. FUNGSI SUBMIT VERIFIKASI OTP
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length < 6) {
      setErrorMessage('Kode OTP harus 6 digit.');
      return;
    }

    setErrorMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputOtp: otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Kode OTP salah atau sesi kedaluwarsa.');
      }

      // OTP Sukses! Hard redirect ke Dashboard
      window.location.href = targetUrl;
    } catch (err: any) {
      setErrorMessage(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Decorator */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 relative z-10">
        
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-3 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-500 mb-3 shadow-inner flex items-center justify-center">
            <Image 
              src="/icon-bps.png" 
              alt="Ikon BPS" 
              width={32} 
              height={32} 
              className="w-8 h-8 object-contain"
              priority
            />
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide">MATCHING STATISTIK</h1>
          <p className="text-xs text-slate-400 mt-1">Masuk untuk mengakses sistem pengolahan & matching data</p>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* LOGIKA KONDISIONAL TAMPILAN: LOGIN vs OTP */}
        {step === 'LOGIN' ? (
          
          /* --- TAMPILAN 1: FORM LOGIN STANDAR --- */
          <form onSubmit={handleLoginSubmit} className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email atau Username
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="nama@instansi.go.id"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Memverifikasi Akun...</>
                ) : (
                  <><ArrowRight className="w-4 h-4" /> Masuk ke Portal</>
                )}
              </button>
            </div>
          </form>

        ) : (

          /* --- TAMPILAN 2: FORM VERIFIKASI OTP --- */
          <form onSubmit={handleOtpSubmit} className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <div className="p-4 bg-blue-900/20 border border-blue-800/50 rounded-xl text-center mb-6">
              <Smartphone className="w-8 h-8 text-blue-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-white mb-1">Verifikasi 2 Langkah</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Kami telah mengirimkan 6 digit kode OTP ke WhatsApp Anda <br/>
                <span className="font-semibold text-blue-300">{maskedPhone}</span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 text-center">
                Masukkan 6 Digit OTP
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))} // Cegah input huruf
                placeholder="000000"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-xl tracking-[0.5em] font-bold text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div className="pt-4 flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Memverifikasi OTP...</>
                ) : (
                  <><ShieldCheck className="w-4 h-4" /> Konfirmasi & Masuk</>
                )}
              </button>

              {/* Tombol Batal jika OTP tidak masuk / ingin pakai akun lain */}
              <button
                type="button"
                onClick={() => setStep('LOGIN')}
                className="w-full py-2 px-4 text-xs font-medium text-slate-400 hover:text-white transition flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Batal & Kembali
              </button>
            </div>
          </form>

        )}

        <div className="mt-8 pt-4 border-t border-slate-800/80 text-center">
          <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            End-to-End Encrypted Session (HttpOnly JWT)
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}