## [1.1.0] - 2026-09-03
### Ditambahkan
- State management global menggunakan Zustand (`useMatchingStore`) agar data matching tidak hilang saat berpindah menu.
- Peringatan cegah reload (`beforeunload`) saat matching sedang berjalan atau data belum disimpan.

### Diubah
- Penyesuaian format 8 kolom Master CSV (Code_Identity, Nama_Kecamatan, Nama_Kelurahan, Kode_KBLI, Nama_Usaha, Nama_Pengusaha, Status_Pendataan, Status_Keberadaan).
- Pembaruan antarmuka tabel matching dan petunjuk unggahan file master.