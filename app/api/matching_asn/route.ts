import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import * as fuzzball from 'fuzzball';

// ==================== UTILITAS PEMBERSIHAN ====================

// Gelar/title yang umum pada nama ASN — dihapus sebelum matching
const TITLE_PATTERNS = [
  /,\s*/g,
  /\b(S\.?H|S\.?E|S\.?S|S\.?T|S\.?Pd|S\.?Sos|S\.?Si|S\.?Kom|S\.?Ag|S\.?Hut|S\.?Ked|S\.?KM|S\.?Gz|S\.?Farm|S\.?Kep|S\.?IP|S\.?Pt|S\.?Pi|S\.?Psi)\b/gi,
  /\b(M\.?M|M\.?A|M\.?Si|M\.?Pd|M\.?Kes|M\.?Sc|M\.?Hum|M\.?Kom|M\.?H|M\.?Eng|M\.?Kn|M\.?AP|M\.?I\.?Kom|M\.?T)\b/gi,
  /\b(Dr|Drs|Dra|Ir|Prof|Apt|Ns)\b\.?/gi,
  /\b(Ph\.?D|MBA|MPA|Sp\.\w+)\b/gi,
];

/**
 * Membersihkan nama orang — hapus gelar, lowercase, buang karakter non-alfabet.
 */
function cleanPersonName(text: any): string {
  if (text === null || text === undefined) return "";
  let t = String(text).trim();

  for (const pattern of TITLE_PATTERNS) {
    t = t.replace(pattern, ' ');
  }

  t = t.replace(/[^a-z\s]/gi, ' ').toLowerCase();
  const words = t.split(/\s+/).filter(w => w.length > 1);
  const result = words.join(" ").trim();

  // Safeguard: Jika kolom sebenarnya berisi angka/NIK tapi pengguna memilih tipe 'name',
  // jangan sampai nilainya kosong (yang menyebabkan 0 match).
  if (!result && String(text).trim().length > 0) {
    return cleanIdentifier(text);
  }

  return result;
}

/**
 * Membersihkan teks biasa — lowercase, hapus karakter spesial, trim.
 */
function cleanPlainText(text: any): string {
  if (text === null || text === undefined) return "";
  let t = String(text).trim().toLowerCase();
  // Buang trailing .0 jika ada (misal float dari export Excel)
  t = t.replace(/\.0+$/, '');
  t = t.replace(/[^a-z0-9\s]/gi, ' ');
  const words = t.split(/\s+/).filter(w => w.length > 0);
  return words.join(" ").trim();
}

/**
 * Membersihkan identifier/kode (NIK, NIP, kode wilayah, nomor register, dll.)
 * Menghapus SEMUA karakter selain huruf dan angka — tanpa spasi.
 * Menangani kutip Excel, formula ="...", trailing .0, dan notasi ilmiah.
 * Contoh: "71.71.01.2345.6789.01" → "7171012345678901"
 */
function cleanIdentifier(text: any): string {
  if (text === null || text === undefined) return "";
  let t = String(text).trim();

  // Hapus kutip satu/dua di awal & akhir (format text Excel sering: '717101...)
  t = t.replace(/^['"]+|['"]+$/g, '');

  // Hapus formula Excel ="..." jika ada
  t = t.replace(/^="?([^"]*)"?$/, '$1');

  // Hapus trailing .0 atau .00 (kasus float dari Excel/Pandas)
  t = t.replace(/\.0+$/, '');

  // Tangani scientific notation (misal: 7.17101E+15 dari Excel)
  if (/^[0-9]+(?:\.[0-9]+)?[eE]\+?[0-9]+$/i.test(t)) {
    try {
      const num = Number(t);
      if (!isNaN(num)) {
        t = BigInt(Math.floor(num)).toString();
      }
    } catch {
      // fallback tetap menggunakan t
    }
  }

  return t.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function getRowValue(row: any, colName: string | undefined): string {
  if (!colName || !(colName in row)) return "";
  const val = row[colName];
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

// ==================== INTERFACE ====================

interface MatchConfig {
  col_file1: string;
  col_file2: string;
  type: 'name' | 'text' | 'id';
}

// ==================== HANDLER ====================

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ detail: "Gagal membaca form data." }, { status: 400 });
  }

  const file1 = formData.get('file_1') as File | null;
  const file2 = formData.get('file_2') as File | null;
  const thresholdInput = formData.get('threshold');
  const threshold = thresholdInput ? Number(thresholdInput) : 80;
  const matchConfigRaw = formData.get('match_config') as string | null;

  if (!file1 || !file2) {
    return NextResponse.json({ detail: "Kedua file CSV wajib diunggah." }, { status: 400 });
  }

  // Parse match config
  let matchConfig: MatchConfig[];
  try {
    matchConfig = matchConfigRaw ? JSON.parse(matchConfigRaw) : [];
  } catch {
    return NextResponse.json({ detail: "Format konfigurasi kolom matching tidak valid." }, { status: 400 });
  }

  if (matchConfig.length === 0) {
    return NextResponse.json({ detail: "Minimal satu pasangan kolom matching harus dipilih." }, { status: 400 });
  }

  // Parse kedua CSV
  const text1 = await file1.text();
  const text2 = await file2.text();

  const parsed1 = Papa.parse(text1, { header: true, skipEmptyLines: "greedy" });
  const parsed2 = Papa.parse(text2, { header: true, skipEmptyLines: "greedy" });

  const rows1 = parsed1.data as any[];
  const rows2 = parsed2.data as any[];

  if (rows1.length === 0 || rows2.length === 0) {
    return NextResponse.json({ detail: "Salah satu atau kedua file CSV tidak memiliki baris data." }, { status: 400 });
  }

  const headers1 = parsed1.meta.fields || Object.keys(rows1[0]);
  const headers2 = parsed2.meta.fields || Object.keys(rows2[0]);

  // Validasi kolom yang dipilih ada di file
  for (const mc of matchConfig) {
    if (!headers1.includes(mc.col_file1)) {
      return NextResponse.json({ detail: `Kolom "${mc.col_file1}" tidak ditemukan di File 1.` }, { status: 400 });
    }
    if (!headers2.includes(mc.col_file2)) {
      return NextResponse.json({ detail: `Kolom "${mc.col_file2}" tidak ditemukan di File 2.` }, { status: 400 });
    }
  }

  // ========== STREAMING RESPONSE ==========
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(data: any) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      }

      try {
        // --------- Fase 1: Persiapan Data ---------
        sendEvent({ type: "progress", phase: "Membersihkan data...", current: 0, total: rows2.length, percent: 0 });
        await new Promise(resolve => setTimeout(resolve, 10));

        // Fungsi untuk membersihkan nilai berdasarkan tipe
        function cleanValue(val: string, type: 'name' | 'text' | 'id'): string {
          if (type === 'name') return cleanPersonName(val);
          if (type === 'id') return cleanIdentifier(val);
          return cleanPlainText(val);
        }

        // Pre-compute cleaned values untuk File 1 (Referensi)
        const cleanRecords1 = rows1.map((row, idx) => {
          const cleanedPairs: Record<string, string> = {};
          for (const mc of matchConfig) {
            const rawVal = getRowValue(row, mc.col_file1);
            cleanedPairs[mc.col_file1] = cleanValue(rawVal, mc.type);
          }
          return { idx, row, cleanedPairs };
        });

        // Pre-compute cleaned values untuk File 2 (Target)
        const cleanRecords2 = rows2.map((row, idx) => {
          const cleanedPairs: Record<string, string> = {};
          for (const mc of matchConfig) {
            const rawVal = getRowValue(row, mc.col_file2);
            cleanedPairs[mc.col_file2] = cleanValue(rawVal, mc.type);
          }
          return { idx, row, cleanedPairs };
        });

        const totalTarget = cleanRecords2.length;

        // --------- Fase 2: Proses Matching ---------
        sendEvent({ type: "progress", phase: "Mencocokkan data...", current: 0, total: totalTarget, percent: 0 });
        await new Promise(resolve => setTimeout(resolve, 10));

        interface MatchPair { targetIdx: number; refIdx: number; score: number; }
        const possibleMatches: MatchPair[] = [];

        for (let i = 0; i < cleanRecords2.length; i++) {
          const rec2 = cleanRecords2[i];

          // Cek minimal ada 1 kolom yang cleaned-nya valid (panjang > 2)
          const hasValidTarget = matchConfig.some(mc => {
            const v = rec2.cleanedPairs[mc.col_file2];
            return v && v.length > 2;
          });
          if (!hasValidTarget) {
            // Skip baris target yang tidak punya data matching valid
            if ((i + 1) % 10 === 0 || i === cleanRecords2.length - 1) {
              const percent = Math.round(((i + 1) / totalTarget) * 100);
              sendEvent({ type: "progress", phase: "Mencocokkan data...", current: i + 1, total: totalTarget, percent });
              await new Promise(resolve => setTimeout(resolve, 2));
            }
            continue;
          }

          for (const rec1 of cleanRecords1) {
            // Hitung skor per pasangan kolom
            let totalScore = 0;
            let validPairs = 0;

            for (const mc of matchConfig) {
              const val2 = rec2.cleanedPairs[mc.col_file2];
              const val1 = rec1.cleanedPairs[mc.col_file1];

              if ((!val1 || val1.length <= 2) && (!val2 || val2.length <= 2)) {
                // Kedua kolom kosong/terlalu pendek — skip pasangan ini
                continue;
              }

              const score = fuzzball.ratio(val2 || '', val1 || '');
              totalScore += score;
              validPairs++;
            }

            if (validPairs === 0) continue;
            const avgScore = Math.round(totalScore / validPairs);

            if (avgScore >= threshold) {
              possibleMatches.push({
                targetIdx: rec2.idx,
                refIdx: rec1.idx,
                score: avgScore,
              });
            }
          }

          if ((i + 1) % 10 === 0 || i === cleanRecords2.length - 1) {
            const percent = Math.round(((i + 1) / totalTarget) * 100);
            sendEvent({ type: "progress", phase: "Mencocokkan data...", current: i + 1, total: totalTarget, percent });
            await new Promise(resolve => setTimeout(resolve, 2));
          }
        }

        // --------- Fase 3: Menyusun Hasil ---------
        sendEvent({ type: "progress", phase: "Menyusun hasil akhir...", current: totalTarget, total: totalTarget, percent: 99 });

        // Sortir skor tertinggi lebih dulu (greedy 1:1 matching)
        possibleMatches.sort((a, b) => b.score - a.score);

        const matchedTargetIdx = new Set<number>();
        const matchedRefIdx = new Set<number>();
        const matchedList: any[] = [];

        for (const match of possibleMatches) {
          if (matchedTargetIdx.has(match.targetIdx) || matchedRefIdx.has(match.refIdx)) continue;
          matchedTargetIdx.add(match.targetIdx);
          matchedRefIdx.add(match.refIdx);

          const rec2 = cleanRecords2[match.targetIdx];
          const rec1 = cleanRecords1[match.refIdx];

          // Build row dengan semua kolom dari kedua file
          const resultRow: any = { similarity_score: match.score };

          // Kolom file 2 (target) — prefix "file2_"
          for (const h of headers2) {
            resultRow[`file2_${h}`] = getRowValue(rec2.row, h);
          }

          // Kolom file 1 (referensi) — prefix "file1_"
          for (const h of headers1) {
            resultRow[`file1_${h}`] = getRowValue(rec1.row, h);
          }

          matchedList.push(resultRow);
        }

        // Data yang tidak cocok (unmatched) — dari target
        const unmatchedList: any[] = [];
        for (const rec2 of cleanRecords2) {
          if (matchedTargetIdx.has(rec2.idx)) continue;

          // Cari kandidat terdekat
          let closestScore = 0;
          let closestRefIdx = -1;

          const hasValidTarget = matchConfig.some(mc => {
            const v = rec2.cleanedPairs[mc.col_file2];
            return v && v.length > 2;
          });

          if (hasValidTarget) {
            for (const rec1 of cleanRecords1) {
              let totalScore = 0;
              let validPairs = 0;

              for (const mc of matchConfig) {
                const val2 = rec2.cleanedPairs[mc.col_file2];
                const val1 = rec1.cleanedPairs[mc.col_file1];

                if ((!val1 || val1.length <= 2) && (!val2 || val2.length <= 2)) continue;

                const score = fuzzball.ratio(val2 || '', val1 || '');
                totalScore += score;
                validPairs++;
              }

              if (validPairs === 0) continue;
              const avgScore = Math.round(totalScore / validPairs);

              if (avgScore > closestScore) {
                closestScore = avgScore;
                closestRefIdx = rec1.idx;
              }
            }
          }

          const resultRow: any = {
            similarity_score: closestScore,
          };

          // Kolom file 2 (target)
          for (const h of headers2) {
            resultRow[`file2_${h}`] = getRowValue(rec2.row, h);
          }

          // Kandidat terdekat dari file 1 — hanya kolom matching saja
          if (closestRefIdx >= 0) {
            const closestRec1 = cleanRecords1[closestRefIdx];
            for (const mc of matchConfig) {
              resultRow[`closest_file1_${mc.col_file1}`] = getRowValue(closestRec1.row, mc.col_file1);
            }
          } else {
            for (const mc of matchConfig) {
              resultRow[`closest_file1_${mc.col_file1}`] = "-";
            }
          }

          unmatchedList.push(resultRow);
        }

        const overallPercentage = totalTarget > 0
          ? Math.round((matchedList.length / totalTarget * 100) * 100) / 100
          : 0.0;

        sendEvent({
          type: "result",
          data: {
            summary: {
              total_file1_rows: rows1.length,
              total_file2_rows: totalTarget,
              matched_count: matchedList.length,
              unmatched_count: unmatchedList.length,
              overall_matched_percentage: overallPercentage,
            },
            file1_headers: headers1,
            file2_headers: headers2,
            match_columns: matchConfig,
            matched_data: matchedList,
            unmatched_data: unmatchedList,
          }
        });

      } catch (error: any) {
        sendEvent({ type: "error", detail: `Terjadi kesalahan: ${error.message || error}` });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}