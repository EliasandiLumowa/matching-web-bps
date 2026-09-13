import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import * as fuzzball from 'fuzzball';

// Stopwords bisnis untuk pembersihan teks nama usaha
const BUSINESS_STOPWORDS = new Set([
  "official", "store", "shop", "toko", "collection", "collections", 
  "mart", "indomaret", "alfamart", "grosir", "olshop", "mall", 
  "resmi", "authorized", "indonesia", "manado", "sulawesi", "utara",
  "cv", "pt", "ud", "tbk", "id", "co", "cell", "cellular", "warung", "kios", "rumah makan"
]);

// Fungsi membersihkan teks untuk matching
function cleanTextWords(text: any): string {
  if (text === null || text === undefined) return "";
  let t = String(text).toLowerCase();
  t = t.replace(/[^a-z0-9\s]/gi, ' ');
  let words = t.split(/\s+/).filter(w => w.length > 1 && !BUSINESS_STOPWORDS.has(w));
  if (words.length === 0) {
    words = t.split(/\s+/).filter(w => w.length > 1);
  }
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

  const fileMaster = formData.get('file_master') as File | null;
  const fileScraping = formData.get('file_scraping') as File | null;
  const thresholdInput = formData.get('threshold');
  const threshold = thresholdInput ? Number(thresholdInput) : 80;

  if (!fileMaster || !fileScraping) {
    return NextResponse.json({ detail: "Kedua file CSV (Master & Scraping) wajib diunggah." }, { status: 400 });
  }

  const textMaster = await fileMaster.text();
  const textScraping = await fileScraping.text();
  
  const parsedMaster = Papa.parse(textMaster, { header: true, skipEmptyLines: "greedy" });
  const parsedScraping = Papa.parse(textScraping, { header: true, skipEmptyLines: "greedy" });
  
  const masterRows = parsedMaster.data as any[];
  const scrapingRows = parsedScraping.data as any[];

  if (masterRows.length === 0 || scrapingRows.length === 0) {
    return NextResponse.json({ detail: "Salah satu atau kedua file CSV tidak memiliki baris data." }, { status: 400 });
  }

  const masterHeaders = parsedMaster.meta.fields || Object.keys(masterRows[0]);
  const scrapingHeaders = parsedScraping.meta.fields || Object.keys(scrapingRows[0]);

  // ----------------------------------------------------------------------
  // KOLOM FILE SCRAPING (Terbaru)
  // Kolom: No | Nama_Usaha | Kab_Kota | Titik_Lokasi
  // ----------------------------------------------------------------------
  const colScrapNama = findColumnName(scrapingHeaders, ["Nama_Usaha", "Nama Usaha", "nama"]);
  const colScrapKabKota = findColumnName(scrapingHeaders, ["Kab_Kota", "Kab Kota", "kabupaten", "kota"]);
  const colScrapTitikLokasi = findColumnName(scrapingHeaders, ["Titik_Lokasi", "Titik Lokasi", "lokasi", "koordinat"]);

  if (!colScrapNama) {
    return NextResponse.json({ detail: "Kolom 'Nama_Usaha' tidak ditemukan di File Scraping." }, { status: 400 });
  }

  // ----------------------------------------------------------------------
  // KOLOM FILE MASTER (Terbaru)
  // Kolom: code_identity | nama_kabupaten | nama_kecamatan | nama_desa | nama_usaha | alamat | klasifikasi_usaha | keberadaan_usaha_label
  // ----------------------------------------------------------------------
  const colMasterCodeIdentity = findColumnName(masterHeaders, ["code_identity", "code identity", "code"]);
  const colMasterKab = findColumnName(masterHeaders, ["nama_kabupaten", "nama kabupaten", "kabupaten"]);
  const colMasterKec = findColumnName(masterHeaders, ["nama_kecamatan", "nama kecamatan", "kecamatan"]);
  const colMasterDesa = findColumnName(masterHeaders, ["nama_desa", "nama desa", "desa", "kelurahan"]);
  const colMasterNama = findColumnName(masterHeaders, ["nama_usaha", "nama usaha"]);
  const colMasterAlamat = findColumnName(masterHeaders, ["alamat"]);
  const colMasterKlasifikasi = findColumnName(masterHeaders, ["klasifikasi_usaha", "klasifikasi usaha"]);
  const colMasterKeberadaan = findColumnName(masterHeaders, ["keberadaan_usaha_label", "keberadaan usaha", "keberadaan"]);

  if (!colMasterNama) {
    return NextResponse.json({ detail: "Kolom 'nama_usaha' tidak ditemukan di File Master." }, { status: 400 });
  }

  // ========== STREAMING RESPONSE ==========
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(data: any) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      }

      try {
        sendEvent({ type: "progress", phase: "Membersihkan data Master & Scraping...", current: 0, total: scrapingRows.length, percent: 0 });
        await new Promise(resolve => setTimeout(resolve, 10)); 

        const cleanMasterRecords = masterRows.map((row, idx) => {
          const uClean = cleanTextWords(row[colMasterNama!]);
          return { originalIndex: idx, originalRow: row, uClean };
        });

        const cleanScrapingRecords = scrapingRows.map((row, idx) => {
          const scrapNama = getRowValue(row, colScrapNama);
          const uClean = cleanTextWords(scrapNama);
          return { originalIndex: idx, originalRow: row, scrapNama, uClean };
        });

        const totalScraping = cleanScrapingRecords.length;

        // Fase 2: Proses Matching (Fokus pada Nama_Usaha)
        sendEvent({ type: "progress", phase: "Mencocokkan data...", current: 0, total: totalScraping, percent: 0 });
        await new Promise(resolve => setTimeout(resolve, 10));

        interface MatchPair { scrapIdx: number; masterIdx: number; score: number; }
        const possibleMatches: MatchPair[] = [];

        for (let i = 0; i < cleanScrapingRecords.length; i++) {
          const sRec = cleanScrapingRecords[i];
          if (!sRec.uClean || sRec.uClean.length <= 2) continue;

          for (const mRec of cleanMasterRecords) {
            // FOKUS: Hanya mencocokkan Nama_Usaha vs nama_usaha menggunakan ratio string
            const scoreUsaha = fuzzball.ratio(sRec.uClean, mRec.uClean);

            if (scoreUsaha >= threshold) {
              possibleMatches.push({ 
                scrapIdx: sRec.originalIndex, 
                masterIdx: mRec.originalIndex, 
                score: scoreUsaha 
              });
            }
          }

          if ((i + 1) % 10 === 0 || i === cleanScrapingRecords.length - 1) {
            const percent = Math.round(((i + 1) / totalScraping) * 100);
            sendEvent({ type: "progress", phase: "Mencocokkan data...", current: i + 1, total: totalScraping, percent });
            await new Promise(resolve => setTimeout(resolve, 2)); 
          }
        }

        // Fase 3: Menyusun hasil akhir
        sendEvent({ type: "progress", phase: "Menyusun hasil akhir...", current: totalScraping, total: totalScraping, percent: 99 });

        // Sortir skor tertinggi lebih dulu
        possibleMatches.sort((a, b) => b.score - a.score);

        const matchedScrapingIndices = new Set<number>();
        const matchedMasterIndices = new Set<number>();
        const matchedList: any[] = [];

        for (const match of possibleMatches) {
          if (matchedScrapingIndices.has(match.scrapIdx) || matchedMasterIndices.has(match.masterIdx)) continue;
          matchedScrapingIndices.add(match.scrapIdx);
          matchedMasterIndices.add(match.masterIdx);

          const sRec = cleanScrapingRecords[match.scrapIdx];
          const mRec = cleanMasterRecords[match.masterIdx];
          const rowMaster = mRec.originalRow;
          const rowScraping = sRec.originalRow;

          matchedList.push({
            similarity_score: match.score, 
            
            // Kolom Scraping
            scraping_nama_usaha: sRec.scrapNama, 
            scraping_kab_kota: getRowValue(rowScraping, colScrapKabKota),
            scraping_titik_lokasi: getRowValue(rowScraping, colScrapTitikLokasi),
            
            // Kolom Master
            master_code_identity: getRowValue(rowMaster, colMasterCodeIdentity),
            master_nama_kabupaten: getRowValue(rowMaster, colMasterKab),
            master_nama_kecamatan: getRowValue(rowMaster, colMasterKec),
            master_nama_desa: getRowValue(rowMaster, colMasterDesa),
            master_nama_usaha: getRowValue(rowMaster, colMasterNama), 
            master_alamat: getRowValue(rowMaster, colMasterAlamat),
            master_klasifikasi_usaha: getRowValue(rowMaster, colMasterKlasifikasi),
            master_keberadaan_usaha_label: getRowValue(rowMaster, colMasterKeberadaan),
          });
        }

        const unmatchedList: any[] = [];
        for (const sRec of cleanScrapingRecords) {
          if (matchedScrapingIndices.has(sRec.originalIndex)) continue;
          
          let closestCandidateName = "-";
          let maxScore = 0;
          
          if (sRec.uClean && sRec.uClean.length > 2) {
            for (const mRec of cleanMasterRecords) {
              const scoreUsaha = fuzzball.ratio(sRec.uClean, mRec.uClean);
              if (scoreUsaha > maxScore) { 
                maxScore = scoreUsaha; 
                closestCandidateName = getRowValue(mRec.originalRow, colMasterNama); 
              }
            }
          }
          
          const rowScraping = sRec.originalRow;
          unmatchedList.push({ 
            similarity_score: Math.round(maxScore), 
            scraping_nama_usaha: sRec.scrapNama,
            scraping_kab_kota: getRowValue(rowScraping, colScrapKabKota),
            scraping_titik_lokasi: getRowValue(rowScraping, colScrapTitikLokasi),
            closest_candidate: closestCandidateName 
          });
        }

        const totalMaster = masterRows.length;
        const overallPercentage = totalScraping > 0 ? Math.round((matchedList.length / totalScraping * 100) * 100) / 100 : 0.0;

        sendEvent({
          type: "result",
          data: {
            summary: { total_scraping_rows: totalScraping, total_master_rows: totalMaster, matched_count: matchedList.length, unmatched_count: unmatchedList.length, overall_matched_percentage: overallPercentage },
            matched_data: matchedList,
            unmatched_data: unmatchedList
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