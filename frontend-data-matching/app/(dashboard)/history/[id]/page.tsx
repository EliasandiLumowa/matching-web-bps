import React from 'react';

interface HistoryDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function HistoryDetailPage({ params }: HistoryDetailPageProps) {
  const resolvedParams = await params;
  return (
    <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
      <h2 className="text-lg font-bold text-slate-800">Detail Riwayat #{resolvedParams.id}</h2>
      <p className="text-xs text-slate-400 mt-1">Halaman detail riwayat matching data.</p>
    </div>
  );
}
