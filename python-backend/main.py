from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from rapidfuzz import fuzz
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BUSINESS_STOPWORDS = {
    "official", "store", "shop", "toko", "collection", "collections", 
    "mart", "indomaret", "alfamart", "grosir", "olshop", "mall", 
    "resmi", "authorized", "indonesia", "manado", "sulawesi", "utara",
    "cv", "pt", "ud", "tbk", "id", "co", "cell", "cellular"
}

def clean_text(text):
    if pd.isna(text): return ""
    t = str(text).lower()
    t = re.sub(r'[^a-z0-9\s]', ' ', t)
    words = [w for w in t.split() if len(w) > 1 and w not in BUSINESS_STOPWORDS]
    if not words:
        words = [w for w in t.split() if len(w) > 1]
    return " ".join(words).strip()

def get_col(df, possible_names):
    clean_cols = {re.sub(r'[^a-z0-9]', '', str(c).lower()): c for c in df.columns}
    for name in possible_names:
        target = re.sub(r'[^a-z0-9]', '', name.lower())
        if target in clean_cols: return clean_cols[target]
    return None

def clean_val(val):
    if pd.isna(val): return ""
    return str(val).strip()

@app.post("/match")
async def match_data(file_master: UploadFile = File(...), file_scraping: UploadFile = File(...), threshold: int = 80):
    
   # PERBAIKAN: Menggunakan encoding 'latin-1' agar kebal terhadap karakter aneh/spesial dari Excel Windows
    df_master = pd.read_csv(file_master.file, dtype=str, sep=None, engine='python', on_bad_lines='skip', encoding='latin-1').fillna("")
    df_scraping = pd.read_csv(file_scraping.file, dtype=str, sep=None, engine='python', on_bad_lines='skip', encoding='latin-1').fillna("")

    col_s_nama = get_col(df_scraping, ["Nama_Usaha", "Nama Usaha", "nama_usaha", "nama"])
    col_s_alamat = get_col(df_scraping, ["alamat", "Alamat", "alamat_usaha"])
    col_s_kec = get_col(df_scraping, ["kecamatan", "kec"])
    col_s_kel = get_col(df_scraping, ["kelurahan", "desa", "kel"])
    col_s_jenis = get_col(df_scraping, ["jenis usaha", "jenis_usaha", "kategori"])
    col_s_sumber = get_col(df_scraping, ["sumber", "Sumber"])
    col_s_ket = get_col(df_scraping, ["keterangan", "ket"])

    col_m_code = get_col(df_master, ["code_identity", "code identity"])
    col_m_id = get_col(df_master, ["ID", "id"])
    col_m_kbli = get_col(df_master, ["Kode_KBLI", "kode_kbli", "kbli"])
    col_m_nama = get_col(df_master, ["Nama_Usaha", "nama_usaha"])
    col_m_pengusaha = get_col(df_master, ["Nama_Pengusaha", "pengusaha", "pemilik"])
    col_m_status = get_col(df_master, ["Status_Pendataan", "status_pendataan", "status"])
    col_m_keluarga = get_col(df_master, ["Status_Keberadaan_Keluarga", "status_keberadaan_keluarga"])
    col_m_kec = get_col(df_master, ["Nama_Kecamatan", "nama_kecamatan", "kecamatan", "kec"])
    col_m_kel = get_col(df_master, ["Nama_Kelurahan", "nama_kelurahan", "kelurahan", "desa", "kel"])
    col_m_bangunan = get_col(df_master, ["Status_Bangunan", "status_bangunan"])
    col_m_catatan = get_col(df_master, ["Catatan", "catatan", "keterangan"])
    col_m_link = get_col(df_master, ["Link_Fasih", "link_fasih", "link"])

    # Pra-pembersihan data untuk mempercepat kalkulasi
    df_master['u_clean'] = df_master[col_m_nama].apply(clean_text) if col_m_nama else ""
    df_master['p_clean'] = df_master[col_m_pengusaha].apply(clean_text) if col_m_pengusaha else ""
    
    # PERBAIKAN: Jika kolom tidak ada, buatkan Pandas Series kosong (bukan string biasa)
    kec_series = df_master[col_m_kec] if col_m_kec else pd.Series([""] * len(df_master))
    kel_series = df_master[col_m_kel] if col_m_kel else pd.Series([""] * len(df_master))
    df_master['w_clean'] = (kec_series.astype(str) + " " + kel_series.astype(str)).apply(clean_text)

    df_scraping['u_clean'] = df_scraping[col_s_nama].apply(clean_text) if col_s_nama else ""
    
    s_alamat = df_scraping[col_s_alamat] if col_s_alamat else pd.Series([""] * len(df_scraping))
    s_kec = df_scraping[col_s_kec] if col_s_kec else pd.Series([""] * len(df_scraping))
    s_kel = df_scraping[col_s_kel] if col_s_kel else pd.Series([""] * len(df_scraping))
    df_scraping['w_clean'] = (s_alamat.astype(str) + " " + s_kec.astype(str) + " " + s_kel.astype(str)).apply(clean_text)
    
    kec_series = df_master[col_m_kec] if col_m_kec else ""
    kel_series = df_master[col_m_kel] if col_m_kel else ""
    df_master['w_clean'] = (kec_series + " " + kel_series).apply(clean_text)

    df_scraping['u_clean'] = df_scraping[col_s_nama].apply(clean_text) if col_s_nama else ""
    s_alamat = df_scraping[col_s_alamat] if col_s_alamat else ""
    s_kec = df_scraping[col_s_kec] if col_s_kec else ""
    s_kel = df_scraping[col_s_kel] if col_s_kel else ""
    df_scraping['w_clean'] = (s_alamat + " " + s_kec + " " + s_kel).apply(clean_text)

    matched_list = []
    unmatched_list = []
    matched_master_indices = set()

    records_master = df_master.to_dict('records')
    records_scraping = df_scraping.to_dict('records')

    for i, s_rec in enumerate(records_scraping):
        # Tambahkan dua baris ini agar terminal mencetak laporan setiap kelipatan 1000
        if i > 0 and i % 1000 == 0:
            print(f"Sedang memproses baris ke-{i} dari {len(records_scraping)}...")

        if not s_rec['u_clean'] or len(s_rec['u_clean']) <= 2: continue

        best_score = 0

        best_score = 0
        matched_by = "Nama Usaha"
        best_master_idx = -1
        best_master_rec = None

        for j, m_rec in enumerate(records_master):
            if j in matched_master_indices: continue

            score_usaha = fuzz.token_sort_ratio(s_rec['u_clean'], m_rec['u_clean'])
            current_best = score_usaha
            current_matched_by = "Nama Usaha"

            if m_rec.get('p_clean'):
                score_pengusaha = fuzz.token_sort_ratio(s_rec['u_clean'], m_rec['p_clean'])
                if score_pengusaha > current_best:
                    current_best = score_pengusaha
                    current_matched_by = "Nama Pengusaha"

            score_wilayah = fuzz.token_set_ratio(s_rec['w_clean'], m_rec['w_clean']) if (s_rec['w_clean'] and m_rec['w_clean']) else 50.0
            final_score = (current_best * 0.75) + (score_wilayah * 0.25)

            if final_score > best_score:
                best_score = final_score
                matched_by = current_matched_by
                best_master_idx = j
                best_master_rec = m_rec

        final_score_rounded = round(best_score, 2)

        if final_score_rounded >= threshold and best_master_idx != -1:
            matched_master_indices.add(best_master_idx)
            matched_list.append({
                "similarity_score": final_score_rounded,
                "matched_by_field": matched_by,
                "scraping_nama_usaha": clean_val(s_rec.get(col_s_nama)),
                "scraping_alamat": clean_val(s_rec.get(col_s_alamat)),
                "scraping_jenis_usaha": clean_val(s_rec.get(col_s_jenis)),
                "scraping_sumber": clean_val(s_rec.get(col_s_sumber)),
                "scraping_keterangan": clean_val(s_rec.get(col_s_ket)),
                "master_code_identity": clean_val(best_master_rec.get(col_m_code)),
                "master_id": clean_val(best_master_rec.get(col_m_id)),
                "master_kode_kbli": clean_val(best_master_rec.get(col_m_kbli)),
                "master_nama_usaha": clean_val(best_master_rec.get(col_m_nama)),
                "master_nama_pengusaha": clean_val(best_master_rec.get(col_m_pengusaha)),
                "master_status_pendataan": clean_val(best_master_rec.get(col_m_status)),
                "master_status_keberadaan_keluarga": clean_val(best_master_rec.get(col_m_keluarga)),
                "master_nama_kecamatan": clean_val(best_master_rec.get(col_m_kec)),
                "master_nama_kelurahan": clean_val(best_master_rec.get(col_m_kel)),
                "master_status_bangunan": clean_val(best_master_rec.get(col_m_bangunan)),
                "master_catatan": clean_val(best_master_rec.get(col_m_catatan)),
                "master_link_fasih": clean_val(best_master_rec.get(col_m_link))
            })
        else:
            unmatched_list.append({
                "similarity_score": final_score_rounded,
                "scraping_nama_usaha": clean_val(s_rec.get(col_s_nama)),
                "scraping_alamat": clean_val(s_rec.get(col_s_alamat)),
                "scraping_jenis_usaha": clean_val(s_rec.get(col_s_jenis)),
                "closest_candidate": clean_val(best_master_rec.get(col_m_nama)) if best_master_rec else "-"
            })

    total_scraping = len(records_scraping)
    return {
        "type": "result",
        "data": {
            "summary": {
                "total_scraping_rows": total_scraping,
                "total_master_rows": len(records_master),
                "matched_count": len(matched_list),
                "unmatched_count": len(unmatched_list),
                "overall_matched_percentage": round((len(matched_list) / total_scraping * 100), 2) if total_scraping > 0 else 0.0
            },
            "matched_data": matched_list,
            "unmatched_data": unmatched_list
        }
    }