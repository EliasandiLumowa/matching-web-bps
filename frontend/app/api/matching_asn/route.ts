import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import * as fuzzball from 'fuzzball';

// Gelar/title yang umum pada nama ASN — dihapus sebelum matching
const TITLE_PATTERNS = [
  /,\s*/g,  // koma pemisah gelar
  /\b(S\.?H|S\.?E|S\.?S|S\.?T|S\.?Pd|S\.?Sos|S\.?Si|S\.?Kom|S\.?Ag|S\.?Hut|S\.?Ked|S\.?KM|S\.?Gz|S\.?Farm|S\.?Kep|S\.?IP|S\.?Pt|S\.?Pi|S\.?Psi)\b/gi,
  /\b(M\.?M|M\.?A|M\.?Si|M\.?Pd|M\.?Kes|M\.?Sc|M\.?Hum|M\.?Kom|M\.?H|M\.?Eng|M\.?Kn|M\.?AP|M\.?I\.?Kom|M\.?T)\b/gi,
  /\b(Dr|Drs|Dra|Ir|Prof|Apt|Ns)\b\.?/gi,
  /\b(Ph\.?D|MBA|MPA|Sp\.\w+)\b/gi,
];

// Fungsi membersihkan nama dengan menghilangkan gelar
function cleanPersonName(text: any): string {
  if (text === null || text === undefined) return "";
  let t = String(text).trim();

  // Hapus semua gelar
  for (const pattern of TITLE_PATTERNS) {
    t = t.replace(pattern, ' ');
  }

  // Bersihkan karakter non-alfabet, lowercase, dan hilangkan spasi berlebih
  t = t.replace(/[^a-z\s]/gi, ' ').toLowerCase();
  const words = t.split(/\s+/).filter(w => w.length > 1);
  return words.join(" ").trim();
}

// Deteksi nama kolom secara fleksibel
function findColumnName(columns: string[], possibleNames: string[]): string | undefined {
  const cleanCols = new Map<string, string>();
  for (const col of columns) { cleanCols.set(col.replace(/[^a-z0-9]/gi, '').toLowerCase(), col); }
  for (const name of possibleNames) {
    const cleanTarget = name.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (cleanCols.has(cleanTarget)) return cleanCols.get(cleanTarget);
  }
  // Fallback: partial match
  for (const name of possibleNames) {
    const cleanTarget = name.replace(/[^a-z0-9]/gi, '').toLowerCase();
    for (const [cleanCol, originalCol] of cleanCols) {
      if (cleanCol.includes(cleanTarget) || cleanTarget.includes(cleanCol)) return originalCol;
    }
  }
  return undefined;
}

function getRowValue(row: any, colName: string | undefined): string {
  if (!colName || !(colName in row)) return "";
  const val = row[colName];
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

export async function POST(request: Request) {
  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return NextResponse.json({ detail: "Gagal membaca form data." }, { status: 400 }); }

  const fileSeAsn = formData.get('file_se_asn') as File | null;
  const fileAsnKota = formData.get('file_asn_kota') as File | null;
  const thresholdInput = formData.get('threshold');
  const threshold = thresholdInput ? Number(thresholdInput) : 80;

  if (!fileSeAsn || !fileAsnKota) {
    return NextResponse.json({ detail: "Kedua file CSV (SE ASN & ASN Kota Manado) wajib diunggah." }, { status: 400 });
  }

  const textSeAsn = await fileSeAsn.text();
  const textAsnKota = await fileAsnKota.text();

  const parsedSeAsn = Papa.parse(textSeAsn, { header: true, skipEmptyLines: "greedy" });
  const parsedAsnKota = Papa.parse(textAsnKota, { header: true, skipEmptyLines: "greedy" });

  const seAsnRows = parsedSeAsn.data as any[];
  const asnKotaRows = parsedAsnKota.data as any[];

  if (seAsnRows.length === 0 || asnKotaRows.length === 0) {
    return NextResponse.json({ detail: "Salah satu atau kedua file CSV tidak memiliki baris data." }, { status: 400 });
  }

  const seAsnHeaders = parsedSeAsn.meta.fields || Object.keys(seAsnRows[0]);
  const asnKotaHeaders = parsedAsnKota.meta.fields || Object.keys(asnKotaRows[0]);

  // ----------------------------------------------------------------------
  // KOLOM FILE SE ASN (Data Referensi / "Master")
  // Kolom: Nama Penduduk | Kode Wilayah(NIK) | Link
  // ----------------------------------------------------------------------
  const colSeAsnNama = findColumnName(seAsnHeaders, ["Nama Penduduk", "NamaPenduduk", "nama_penduduk", "nama"]);
  const colSeAsnKodeWilayah = findColumnName(seAsnHeaders, ["Kode Wilayah(NIK)", "KodeWilayahNIK", "Kode Wilayah", "kode_wilayah", "NIK"]);
  const colSeAsnLink = findColumnName(seAsnHeaders, ["Link", "link", "link_fasih", "url"]);

  if (!colSeAsnNama) {
    return NextResponse.json({ detail: "Kolom 'Nama Penduduk' tidak ditemukan di File SE ASN." }, { status: 400 });
  }

  // ----------------------------------------------------------------------
  // KOLOM FILE ASN KOTA MANADO (Data Target)
  // Kolom: No | Nama | NIP | Unit Kerja
  // ----------------------------------------------------------------------
  const colAsnNama = findColumnName(asnKotaHeaders, ["Nama", "nama", "nama_asn"]);
  const colAsnNip = findColumnName(asnKotaHeaders, ["NIP", "nip"]);
  const colAsnUnitKerja = findColumnName(asnKotaHeaders, ["Unit Kerja", "UnitKerja", "unit_kerja", "instansi"]);

  if (!colAsnNama) {
    return NextResponse.json({ detail: "Kolom 'Nama' tidak ditemukan di File ASN Kota Manado." }, { status: 400 });
  }

  // ========== STREAMING RESPONSE ==========
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(data: any) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      }

      try {
        sendEvent({ type: "progress", phase: "Membersihkan data SE ASN & ASN Kota Manado...", current: 0, total: asnKotaRows.length, percent: 0 });
        await new Promise(resolve => setTimeout(resolve, 10));

        // Bersihkan data SE ASN (referensi)
        const cleanSeAsnRecords = seAsnRows.map((row, idx) => {
          const namaAsli = getRowValue(row, colSeAsnNama);
          const namaClean = cleanPersonName(namaAsli);
          return { originalIndex: idx, originalRow: row, namaAsli, namaClean };
        });

        // Bersihkan data ASN Kota (target)
        const cleanAsnKotaRecords = asnKotaRows.map((row, idx) => {
          const namaAsli = getRowValue(row, colAsnNama);
          const namaClean = cleanPersonName(namaAsli);
          return { originalIndex: idx, originalRow: row, namaAsli, namaClean };
        });

        const totalAsnKota = cleanAsnKotaRecords.length;

        // Fase 2: Proses Matching (Fuzzy match Nama ASN vs Nama Penduduk SE ASN)
        sendEvent({ type: "progress", phase: "Mencocokkan nama ASN dengan SE ASN...", current: 0, total: totalAsnKota, percent: 0 });
        await new Promise(resolve => setTimeout(resolve, 10));

        interface MatchPair { asnIdx: number; seAsnIdx: number; score: number; }
        const possibleMatches: MatchPair[] = [];

        for (let i = 0; i < cleanAsnKotaRecords.length; i++) {
          const asnRec = cleanAsnKotaRecords[i];
          if (!asnRec.namaClean || asnRec.namaClean.length <= 2) continue;

          for (const seRec of cleanSeAsnRecords) {
            if (!seRec.namaClean || seRec.namaClean.length <= 2) continue;

            const score = fuzzball.ratio(asnRec.namaClean, seRec.namaClean);

            if (score >= threshold) {
              possibleMatches.push({
                asnIdx: asnRec.originalIndex,
                seAsnIdx: seRec.originalIndex,
                score
              });
            }
          }

          if ((i + 1) % 10 === 0 || i === cleanAsnKotaRecords.length - 1) {
            const percent = Math.round(((i + 1) / totalAsnKota) * 100);
            sendEvent({ type: "progress", phase: "Mencocokkan nama ASN dengan SE ASN...", current: i + 1, total: totalAsnKota, percent });
            await new Promise(resolve => setTimeout(resolve, 2));
          }
        }

        // Fase 3: Menyusun hasil akhir
        sendEvent({ type: "progress", phase: "Menyusun hasil akhir...", current: totalAsnKota, total: totalAsnKota, percent: 99 });

        // Sortir skor tertinggi lebih dulu
        possibleMatches.sort((a, b) => b.score - a.score);

        const matchedAsnIndices = new Set<number>();
        const matchedSeAsnIndices = new Set<number>();
        const matchedList: any[] = [];

        for (const match of possibleMatches) {
          if (matchedAsnIndices.has(match.asnIdx) || matchedSeAsnIndices.has(match.seAsnIdx)) continue;
          matchedAsnIndices.add(match.asnIdx);
          matchedSeAsnIndices.add(match.seAsnIdx);

          const asnRec = cleanAsnKotaRecords[match.asnIdx];
          const seRec = cleanSeAsnRecords[match.seAsnIdx];
          const rowAsn = asnRec.originalRow;
          const rowSeAsn = seRec.originalRow;

          matchedList.push({
            similarity_score: match.score,

            // Kolom ASN Kota Manado
            asn_nama: asnRec.namaAsli,
            asn_nip: getRowValue(rowAsn, colAsnNip),
            asn_unit_kerja: getRowValue(rowAsn, colAsnUnitKerja),

            // Kolom SE ASN (hasil matching)
            se_asn_nama: seRec.namaAsli,
            se_asn_kode_wilayah: getRowValue(rowSeAsn, colSeAsnKodeWilayah),
            se_asn_link: getRowValue(rowSeAsn, colSeAsnLink),
          });
        }

        const unmatchedList: any[] = [];
        for (const asnRec of cleanAsnKotaRecords) {
          if (matchedAsnIndices.has(asnRec.originalIndex)) continue;

          let closestCandidateName = "-";
          let maxScore = 0;

          if (asnRec.namaClean && asnRec.namaClean.length > 2) {
            for (const seRec of cleanSeAsnRecords) {
              if (!seRec.namaClean || seRec.namaClean.length <= 2) continue;
              const score = fuzzball.ratio(asnRec.namaClean, seRec.namaClean);
              if (score > maxScore) {
                maxScore = score;
                closestCandidateName = seRec.namaAsli;
              }
            }
          }

          const rowAsn = asnRec.originalRow;
          unmatchedList.push({
            similarity_score: Math.round(maxScore),
            asn_nama: asnRec.namaAsli,
            asn_nip: getRowValue(rowAsn, colAsnNip),
            asn_unit_kerja: getRowValue(rowAsn, colAsnUnitKerja),
            closest_candidate: closestCandidateName,
          });
        }

        const totalSeAsn = seAsnRows.length;
        const overallPercentage = totalAsnKota > 0 ? Math.round((matchedList.length / totalAsnKota * 100) * 100) / 100 : 0.0;

        sendEvent({
          type: "result",
          data: {
            summary: {
              total_asn_kota_rows: totalAsnKota,
              total_se_asn_rows: totalSeAsn,
              matched_count: matchedList.length,
              unmatched_count: unmatchedList.length,
              overall_matched_percentage: overallPercentage,
            },
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