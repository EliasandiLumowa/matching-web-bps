import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import * as fuzzball from 'fuzzball';

// Stopwords bisnis untuk pembersihan teks nama usaha
const BUSINESS_STOPWORDS = new Set([
  "official", "store", "shop", "toko", "collection", "collections", 
  "mart", "indomaret", "alfamart", "grosir", "olshop", "mall", 
  "resmi", "authorized", "indonesia", "manado", "sulawesi", "utara",
  "cv", "pt", "ud", "tbk", "id", "co", "cell", "cellular"
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

// Ekstraksi url bersih
function extractCleanUrl(rawVal: any): string {
  if (rawVal === null || rawVal === undefined) return "";
  let valStr = String(rawVal).trim();
  if (!valStr) return "";
  valStr = valStr
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&').replace(/&#39;/gi, "'");
  const hrefMatch = valStr.match(/href=['"]?([^'" >]+)/i);
  let url = hrefMatch ? hrefMatch[1].trim() : valStr;
  url = url.replace(/<[^>]*>/g, '').replace(/^['"]|['"]$/g, '').trim();
  if (url.startsWith('file:///') || url.startsWith('file://')) return "";
  if (url.startsWith('//')) { url = 'https:' + url; }
  else if (!url.startsWith('http://') && !url.startsWith('https://') && url.includes('.') && !url.startsWith('<')) { url = 'https://' + url; }
  if (url.includes('<') || url.includes('>')) return "";
  return url;
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
  // Parse form data & validasi sebelum streaming
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
  
  // Update skipEmptyLines ke greedy untuk mencegah error data berantakan
  const parsedMaster = Papa.parse(textMaster, { header: true, skipEmptyLines: "greedy" });
  const parsedScraping = Papa.parse(textScraping, { header: true, skipEmptyLines: "greedy" });
  
  const masterRows = parsedMaster.data as any[];
  const scrapingRows = parsedScraping.data as any[];

  if (masterRows.length === 0 || scrapingRows.length === 0) {
    return NextResponse.json({ detail: "Salah satu atau kedua file CSV tidak memiliki baris data." }, { status: 400 });
  }

  const masterHeaders = parsedMaster.meta.fields || Object.keys(masterRows[0]);
  const scrapingHeaders = parsedScraping.meta.fields || Object.keys(scrapingRows[0]);

  // Kolom File Scraping (Tetap sama)
  const colScrapNama = findColumnName(scrapingHeaders, ["Nama_Usaha", "Nama Usaha", "nama_usaha", "nama"]);
  const colScrapAlamat = findColumnName(scrapingHeaders, ["alamat", "Alamat", "alamat_usaha"]);
  const colScrapKec = findColumnName(scrapingHeaders, ["kecamatan", "kec"]);
  const colScrapKel = findColumnName(scrapingHeaders, ["kelurahan", "desa", "kel"]);
  const colScrapJenis = findColumnName(scrapingHeaders, ["jenis usaha", "jenis_usaha", "kategori"]);
  const colScrapSumber = findColumnName(scrapingHeaders, ["sumber", "Sumber"]);
  const colScrapKet = findColumnName(scrapingHeaders, ["keterangan", "ket"]);

  if (!colScrapNama) {
    return NextResponse.json({ detail: "Kolom 'Nama_Usaha' tidak ditemukan di File Scraping." }, { status: 400 });
  }

  // ----------------------------------------------------------------------
  // UPDATE: Setup Deteksi Kolom File Master Sesuai Format Baru Anda
  // ----------------------------------------------------------------------
  const colMasterCodeIdentity = findColumnName(masterHeaders, ["code_identity", "code identity", "code"]);
  const colMasterKec = findColumnName(masterHeaders, ["Nama_Kecamatan", "nama_kecamatan", "kecamatan", "kec"]);
  const colMasterKel = findColumnName(masterHeaders, ["Nama_Kelurahan", "nama_kelurahan", "kelurahan", "desa", "kel"]);
  const colMasterKbli = findColumnName(masterHeaders, ["Kode_KBLI", "kode_kbli", "kbli", "kode kbli"]);
  const colMasterNama = findColumnName(masterHeaders, ["Nama_Usaha", "nama_usaha", "nama usaha"]);
  const colMasterPengusaha = findColumnName(masterHeaders, ["Nama_Pengusaha", "nama_pengusaha", "nama pengusaha", "pengusaha", "pemilik"]);
  const colMasterStatus = findColumnName(masterHeaders, ["Status_Pendataan", "status_pendataan", "status pendataan", "status"]);
  const colMasterStatusKeberadaan = findColumnName(masterHeaders, ["Status Keberadaan", "status_keberadaan", "status keberadaan", "keberadaan"]);

  if (!colMasterNama) {
    return NextResponse.json({ detail: "Kolom 'Nama_Usaha' tidak ditemukan di File Master." }, { status: 400 });
  }

  // ========== STREAMING RESPONSE ==========
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(data: any) {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      }

      try {
        // Fase 1: Membersihkan data
        sendEvent({ type: "progress", phase: "Membersihkan data Master & Scraping...", current: 0, total: scrapingRows.length, percent: 0 });
        
        // Jeda agar UI merender awal progress bar
        await new Promise(resolve => setTimeout(resolve, 10)); 

        const cleanMasterRecords = masterRows.map((row, idx) => {
          const uClean = cleanTextWords(row[colMasterNama!]);
          const pClean = colMasterPengusaha ? cleanTextWords(row[colMasterPengusaha]) : "";
          
          // Menggunakan kolom Kecamatan dan Kelurahan sebagai pedoman pencocokan wilayah
          const wilayahParts = [
            colMasterKec ? String(row[colMasterKec] || "") : "",
            colMasterKel ? String(row[colMasterKel] || "") : ""
          ];
          return { originalIndex: idx, originalRow: row, uClean, pClean, wClean: cleanTextWords(wilayahParts.join(" ")) };
        });

        const cleanScrapingRecords = scrapingRows.map((row, idx) => {
          const scrapNama = getRowValue(row, colScrapNama);
          const uClean = cleanTextWords(scrapNama);
          const wilayahParts = [
            getRowValue(row, colScrapAlamat),
            colScrapKec ? getRowValue(row, colScrapKec) : "",
            colScrapKel ? getRowValue(row, colScrapKel) : ""
          ];
          return { originalIndex: idx, originalRow: row, scrapNama, uClean, wClean: cleanTextWords(wilayahParts.join(" ")) };
        });

        const totalScraping = cleanScrapingRecords.length;

        // Fase 2: Proses Matching
        sendEvent({ type: "progress", phase: "Mencocokkan data...", current: 0, total: totalScraping, percent: 0 });
        await new Promise(resolve => setTimeout(resolve, 10));

        interface MatchPair { scrapIdx: number; masterIdx: number; score: number; matchedByField: string; }
        const possibleMatches: MatchPair[] = [];

        for (let i = 0; i < cleanScrapingRecords.length; i++) {
          const sRec = cleanScrapingRecords[i];
          if (!sRec.uClean || sRec.uClean.length <= 2) continue;

          for (const mRec of cleanMasterRecords) {
            let bestFieldScore = 0;
            let matchedByField = "Nama Usaha";

            const scoreUsaha = fuzzball.token_sort_ratio(sRec.uClean, mRec.uClean);
            bestFieldScore = scoreUsaha;

            if (mRec.pClean) {
              const scorePengusaha = fuzzball.token_sort_ratio(sRec.uClean, mRec.pClean);
              if (scorePengusaha > bestFieldScore) {
                bestFieldScore = scorePengusaha;
                matchedByField = "Nama Pengusaha";
              }
            }

            const scoreWilayah = (sRec.wClean && mRec.wClean)
              ? fuzzball.token_set_ratio(sRec.wClean, mRec.wClean) : 50.0;
            const finalScore = (bestFieldScore * 0.75) + (scoreWilayah * 0.25);

            if (finalScore >= threshold) {
              possibleMatches.push({ scrapIdx: sRec.originalIndex, masterIdx: mRec.originalIndex, score: Math.round(finalScore * 100) / 100, matchedByField });
            }
          }

          // Kirim update progress setiap 10 baris 
          if ((i + 1) % 10 === 0 || i === cleanScrapingRecords.length - 1) {
            const percent = Math.round(((i + 1) / totalScraping) * 100);
            sendEvent({ type: "progress", phase: "Mencocokkan data...", current: i + 1, total: totalScraping, percent });
            
            // JEDA INI SANGAT PENTING AGAR UI TIDAK NGE-FREEZE
            await new Promise(resolve => setTimeout(resolve, 2)); 
          }
        }

        // Fase 3: Menyusun hasil akhir
        sendEvent({ type: "progress", phase: "Menyusun hasil akhir...", current: totalScraping, total: totalScraping, percent: 99 });

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

          // ----------------------------------------------------------------------
          // UPDATE: Menyusun Variabel Kolom Sesuai dengan Format CSV Master Anda
          // ----------------------------------------------------------------------
          matchedList.push({
            similarity_score: match.score, 
            matched_by_field: match.matchedByField,
            
            // Kolom dari data Scraping
            scraping_nama_usaha: sRec.scrapNama, 
            scraping_alamat: getRowValue(rowScraping, colScrapAlamat),
            scraping_jenis_usaha: getRowValue(rowScraping, colScrapJenis), 
            scraping_sumber: getRowValue(rowScraping, colScrapSumber),
            scraping_keterangan: getRowValue(rowScraping, colScrapKet),
            
            // Kolom dari data Master Format Terbaru
            master_code_identity: getRowValue(rowMaster, colMasterCodeIdentity),
            master_nama_kecamatan: getRowValue(rowMaster, colMasterKec),
            master_nama_kelurahan: getRowValue(rowMaster, colMasterKel),
            master_kode_kbli: getRowValue(rowMaster, colMasterKbli),
            master_nama_usaha: getRowValue(rowMaster, colMasterNama), 
            master_nama_pengusaha: getRowValue(rowMaster, colMasterPengusaha),
            master_status_pendataan: getRowValue(rowMaster, colMasterStatus),
            master_status_keberadaan: getRowValue(rowMaster, colMasterStatusKeberadaan),
          });
        }

        const unmatchedList: any[] = [];
        for (const sRec of cleanScrapingRecords) {
          if (matchedScrapingIndices.has(sRec.originalIndex)) continue;
          const rowScraping = sRec.originalRow;
          let closestCandidateName = "-";
          let maxScore = 0;
          if (sRec.uClean && sRec.uClean.length > 2) {
            for (const mRec of cleanMasterRecords) {
              const scoreUsaha = fuzzball.token_sort_ratio(sRec.uClean, mRec.uClean);
              const scoreWilayah = (sRec.wClean && mRec.wClean) ? fuzzball.token_set_ratio(sRec.wClean, mRec.wClean) : 50.0;
              const finalScore = (scoreUsaha * 0.75) + (scoreWilayah * 0.25);
              if (finalScore > maxScore) { maxScore = finalScore; closestCandidateName = getRowValue(mRec.originalRow, colMasterNama); }
            }
          }
          unmatchedList.push({ 
            similarity_score: Math.round(maxScore * 100) / 100, 
            scraping_nama_usaha: sRec.scrapNama,
            scraping_alamat: getRowValue(rowScraping, colScrapAlamat), 
            scraping_jenis_usaha: getRowValue(rowScraping, colScrapJenis),
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

