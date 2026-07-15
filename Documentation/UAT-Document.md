# Dokumen User Acceptance Test (UAT)
## Gas Leak Detection System — Dashboard Mockup v2.1

| | |
|---|---|
| **Nama Proyek** | Gas Leak Detection System (GLD) v2 |
| **Objek Uji** | Mockup Dashboard Monitoring (frontend multi-RU & RU-frontend per-site) |
| **Versi Dokumen** | 1.0 |
| **Tanggal** | 15 Juli 2026 |
| **Status** | Draft — menunggu pelaksanaan UAT |

---

## 1. Pendahuluan

### 1.1 Tujuan
Dokumen ini menjadi acuan pelaksanaan **User Acceptance Test (UAT)** terhadap mockup dashboard Gas Leak Detection System. Tujuannya memastikan bahwa fungsionalitas, alur kerja, dan tampilan yang disajikan mockup **sesuai dengan kebutuhan pengguna akhir (operator dan admin refinery unit)** sebelum lanjut ke tahap pengembangan/deployment berikutnya.

### 1.2 Ruang Lingkup
Pengujian mencakup seluruh modul yang tersedia pada mockup:

| Modul | Deskripsi Singkat |
|---|---|
| Autentikasi | Login via email, sesi tersimpan, logout |
| Map View | Peta interaktif posisi sensor (landing view), clustering, topologi mesh, overlay gas trend heatmap 24 jam, mode 2D/3D |
| Overview | Kartu KPI: AVG Health, Compliance Rate, Active Alerts, Avg Battery, status node online/offline |
| Devices | Tabel perangkat (Sensor / Routing Node–Cluster Head / Gateway / Thermal) + tambah/ubah/hapus perangkat |
| Unit Layout | Denah tata letak unit dan posisi perangkat |
| Alerts | Alarm Console: daftar alert aktif, Acknowledge, Resolve |
| Events | Log kejadian: filter tipe & status ack, pencarian, acknowledge dengan catatan, export CSV & PDF |
| Analytics | Grafik tren deteksi gas (AI confidence), event count, perbandingan antar-RU, heatmap jam×RU, Top Risky Sensors, Fleet Health, toggle 24h/7d |
| Settings | Threshold risiko (MIDDLE / HIGH), manajemen pengguna (tambah/hapus) |

**Di luar lingkup (out of scope):**
- Akurasi model AI/klasifikasi di firmware edge (diuji terpisah — lihat `ML_Model_Quality_Report.md`)
- Pengujian perangkat keras ESP32 / sensor fisik
- Pengujian keamanan (penetration test) dan pengujian beban (load test)
- Data pada mockup adalah **data simulasi/seed**, bukan data produksi

### 1.3 Referensi
- `README.md` — panduan instalasi & menjalankan aplikasi
- `Gas-Leak-Design-v2.1.md` — dokumen desain sistem
- `Documentation/Usage-Guide.md` — panduan penggunaan
- `Documentation/Architecture.md` — arsitektur sistem

---

## 2. Lingkungan Pengujian

### 2.1 Prasyarat
| Item | Keterangan |
|---|---|
| Perangkat | PC/Laptop Windows, Mac, atau Linux |
| Software | Node.js LTS terpasang; browser modern (Chrome/Edge terbaru) |
| Cara menjalankan | Windows: klik dua kali `start.bat` · Mac/Linux: jalankan `./start.sh` |
| URL Dashboard | `http://localhost:3000` |
| URL Backend API | `http://localhost:4000/graphql` (GraphQL) |
| Akun uji | Email: `admin@gld.com` · Password: `admin` |
| Data uji | Data demo otomatis dimuat oleh skrip start (seed database SQLite) |
| Simulasi sensor | Opsional: `node simulate-sensors.js` untuk data pembacaan sensor berjalan |

### 2.2 Konfigurasi Khusus RU-Frontend
Dashboard per-site (RU-frontend) terkunci pada satu refinery unit melalui variabel `NEXT_PUBLIC_RU_ID` (default: **RU4 — Cilacap**). Penguji perlu memastikan data yang tampil **hanya** milik RU tersebut.

Unit yang tercakup sistem: RU2 (Dumai), RU3 (Plaju), RU4 (Cilacap), RU5 (Balikpapan), RU6 (Balongan), RU7 (Kasim).

---

## 3. Peran dan Tanggung Jawab

| Peran | Tanggung Jawab | Nama / TTD |
|---|---|---|
| UAT Lead / Koordinator | Menjadwalkan sesi UAT, memantau progres, konsolidasi hasil | |
| Penguji (Operator RU) | Menjalankan skenario uji harian operator (Map, Alerts, Events) | |
| Penguji (Admin) | Menjalankan skenario admin (Devices, Settings, User Management) | |
| Tim Pengembang | Pendampingan teknis, perbaikan defect | |
| Product Owner | Persetujuan akhir (sign-off) | |

---

## 4. Kriteria Masuk dan Keluar

### 4.1 Kriteria Masuk (Entry Criteria)
- Aplikasi mockup berhasil dijalankan di lingkungan uji (frontend + backend hidup)
- Data demo/seed berhasil dimuat
- Akun uji dapat digunakan
- Dokumen skenario UAT (dokumen ini) telah disetujui

### 4.2 Kriteria Keluar (Exit Criteria)
- Seluruh test case telah dieksekusi dan dicatat hasilnya
- **100% test case prioritas Tinggi berstatus PASS**
- Tidak ada defect terbuka dengan severity **Critical** atau **Major**
- Defect Minor/Kosmetik terdokumentasi dan disepakati rencana perbaikannya
- Formulir sign-off ditandatangani oleh Product Owner

---

## 5. Skenario dan Kasus Uji

**Petunjuk pengisian:** kolom *Status* diisi **PASS / FAIL / BLOCKED / N/A**. Jika FAIL, catat nomor defect pada kolom *Catatan* dan lengkapi Formulir Defect (Bab 6).

### UAT-01 — Autentikasi

| ID | Prioritas | Skenario | Langkah Pengujian | Hasil yang Diharapkan | Status | Catatan |
|---|---|---|---|---|---|---|
| UAT-01-01 | Tinggi | Login berhasil | 1. Buka `http://localhost:3000` 2. Masukkan email `admin@gld.com` 3. Klik Login | Pengguna masuk ke dashboard; halaman awal yang tampil adalah **Map View** | | |
| UAT-01-02 | Tinggi | Login gagal — email tidak terdaftar | Masukkan email acak yang tidak terdaftar, klik Login | Muncul pesan error yang jelas (mis. "No account found for that email"); tidak masuk ke dashboard | | |
| UAT-01-03 | Sedang | Login gagal — backend mati | Matikan backend, coba login | Muncul pesan "Server connection failed"; aplikasi tidak crash | | |
| UAT-01-04 | Sedang | Sesi tersimpan | Login, lalu refresh halaman browser | Pengguna tetap dalam kondisi login (tidak diminta login ulang) | | |
| UAT-01-05 | Tinggi | Logout | Klik tombol/menu Logout | Kembali ke halaman login; sesi terhapus; refresh tidak mengembalikan sesi | | |

### UAT-02 — Map View (Halaman Utama)

| ID | Prioritas | Skenario | Langkah Pengujian | Hasil yang Diharapkan | Status | Catatan |
|---|---|---|---|---|---|---|
| UAT-02-01 | Tinggi | Peta terbuka pada lokasi RU | Login ke RU-frontend (default RU4) | Peta langsung terbuka **zoom pada site RU4 (Cilacap)**, bukan tampilan seluruh Indonesia | | |
| UAT-02-02 | Tinggi | Pin perangkat tampil | Amati peta | Semua perangkat RU aktif tampil sebagai pin dengan warna sesuai status (online/offline/maintenance) | | |
| UAT-02-03 | Tinggi | Popup detail perangkat | Klik salah satu pin perangkat | Popup menampilkan detail perangkat (nama, tipe, status, health, battery, sinyal) | | |
| UAT-02-04 | Sedang | Clustering pin | Zoom out hingga pin berdekatan menyatu, klik cluster | Pin menyatu menjadi cluster berangka; klik cluster memperbesar peta dan memecah cluster | | |
| UAT-02-05 | Sedang | Garis topologi mesh | Aktifkan toggle topologi pada zoom ≥ 11 | Garis koneksi antar node (sensor → cluster head → gateway) tampil; tersembunyi saat zoom < 11 | | |
| UAT-02-06 | Tinggi | Overlay Gas Trend Heatmap | Klik tombol toggle "Gas trend" pada peta | Panel heatmap 24 jam per-sensor muncul dengan skala warna sesuai threshold; legenda warna tampil; toggle kedua menutup panel | | |
| UAT-02-07 | Sedang | Mode 2D / 3D | Ganti mode tampilan peta 2D ↔ 3D | Peta berpindah mode dengan animasi halus (pitch/bearing berubah); tidak ada flicker/error | | |
| UAT-02-08 | Sedang | Peta tanpa internet (tile lokal) | Putuskan koneksi internet, muat ulang Map View | Peta tetap tampil menggunakan tile lokal (MapLibre); tidak ada area kosong pada area site | | |

### UAT-03 — Overview

| ID | Prioritas | Skenario | Langkah Pengujian | Hasil yang Diharapkan | Status | Catatan |
|---|---|---|---|---|---|---|
| UAT-03-01 | Tinggi | Kartu KPI tampil benar | Buka tab Overview | Kartu **AVG Health, Compliance Rate, Active Alerts, Avg Battery** tampil dengan angka, sparkline, dan indikator tren | | |
| UAT-03-02 | Tinggi | Konsistensi angka | Bandingkan jumlah Online/Offline pada Overview dengan tabel Devices | Angka konsisten antar-halaman | | |
| UAT-03-03 | Sedang | Ringkasan node per tipe | Amati bagian ringkasan node | Jumlah Sensor (end nodes), Routing Node (cluster heads), Gateway (root nodes) sesuai data perangkat | | |
| UAT-03-04 | Sedang | Data hanya RU aktif | Periksa seluruh angka pada Overview (RU-frontend) | Semua metrik hanya menghitung perangkat RU yang dikonfigurasi (mis. RU4), tidak tercampur RU lain | | |

### UAT-04 — Devices (Manajemen Perangkat)

| ID | Prioritas | Skenario | Langkah Pengujian | Hasil yang Diharapkan | Status | Catatan |
|---|---|---|---|---|---|---|
| UAT-04-01 | Tinggi | Daftar perangkat | Buka tab Devices | Tabel menampilkan perangkat dengan kolom nama, tipe, status, battery, sinyal, health | | |
| UAT-04-02 | Tinggi | Tambah perangkat | Klik tambah perangkat, isi MAC address, nama, tipe, koordinat, simpan | Perangkat baru muncul di tabel dan di Map View pada koordinat yang diisi | | |
| UAT-04-03 | Sedang | Validasi form perangkat | Coba simpan dengan field wajib kosong | Form menolak simpan / menampilkan pesan validasi; tidak ada data korup | | |
| UAT-04-04 | Tinggi | Ubah perangkat | Edit nama/status salah satu perangkat, simpan | Perubahan tersimpan dan langsung terlihat di tabel & peta | | |
| UAT-04-05 | Tinggi | Hapus perangkat | Hapus perangkat uji yang dibuat pada UAT-04-02 | Perangkat hilang dari tabel dan peta; ada konfirmasi sebelum penghapusan | | |

### UAT-05 — Unit Layout

| ID | Prioritas | Skenario | Langkah Pengujian | Hasil yang Diharapkan | Status | Catatan |
|---|---|---|---|---|---|---|
| UAT-05-01 | Sedang | Denah unit tampil | Buka tab Unit Layout | Denah tata letak unit tampil dengan posisi perangkat sesuai area | | |
| UAT-05-02 | Rendah | Interaksi denah | Arahkan kursor / klik perangkat pada denah | Informasi perangkat tampil (nama/status) | | |

### UAT-06 — Alerts (Alarm Console)

| ID | Prioritas | Skenario | Langkah Pengujian | Hasil yang Diharapkan | Status | Catatan |
|---|---|---|---|---|---|---|
| UAT-06-01 | Tinggi | Daftar alert aktif | Buka tab Alerts | Alert tampil dengan severity berwarna (Critical/Warning/Info), nama perangkat, RU, tipe, waktu relatif (mis. "5m ago"), dan pesan | | |
| UAT-06-02 | Tinggi | Acknowledge alert | Klik **Acknowledge** pada alert berstatus ACTIVE | Status alert berubah menjadi ACKNOWLEDGED; tombol Acknowledge hilang; counter "Active" berkurang | | |
| UAT-06-03 | Tinggi | Resolve alert | Klik **Resolve** pada sebuah alert | Alert berstatus RESOLVED dan keluar dari daftar aktif | | |
| UAT-06-04 | Sedang | Kondisi tanpa alert | Resolve semua alert | Tampil pesan "SYSTEM CLEAR — NO ACTIVE ALERTS" dengan ikon perisai | | |

### UAT-07 — Events (Log Kejadian)

| ID | Prioritas | Skenario | Langkah Pengujian | Hasil yang Diharapkan | Status | Catatan |
|---|---|---|---|---|---|---|
| UAT-07-01 | Tinggi | Daftar event | Buka tab Events | Log event tampil terurut waktu, dengan tipe (deteksi gas, ack, dsb.), severity, RU, dan status acknowledged | | |
| UAT-07-02 | Tinggi | Filter tipe event | Pilih salah satu tipe pada filter | Daftar hanya menampilkan event tipe tersebut | | |
| UAT-07-03 | Tinggi | Filter status ack | Ganti filter All / Unacknowledged / Acknowledged | Daftar tersaring sesuai status; counter "unacknowledged" sesuai | | |
| UAT-07-04 | Sedang | Pencarian | Ketik kata kunci (nama perangkat / isi pesan) di kolom cari | Hasil tersaring sesuai kata kunci; kombinasi dengan filter tetap benar | | |
| UAT-07-05 | Tinggi | Acknowledge event + catatan | Klik acknowledge pada event, isi catatan, konfirmasi | Event tertandai acknowledged beserta nama pengguna & catatan; tersimpan setelah refresh | | |
| UAT-07-06 | Tinggi | Export CSV | Klik **Export CSV** dengan filter aktif | File CSV terunduh; isi sesuai daftar yang sedang tersaring; kolom lengkap (Timestamp, Type, Severity, RU, Message, Acknowledged, Acknowledged By, Ack Note) | | |
| UAT-07-07 | Tinggi | Export PDF / laporan | Klik **Export PDF** | Jendela laporan terbuka berisi identitas pengekspor, site, waktu generate, ringkasan (total/unacknowledged/acknowledged), dan tabel event; dapat dicetak/disimpan sebagai PDF | | |

### UAT-08 — Analytics

| ID | Prioritas | Skenario | Langkah Pengujian | Hasil yang Diharapkan | Status | Catatan |
|---|---|---|---|---|---|---|
| UAT-08-01 | Tinggi | Gas Detection Trend | Buka tab Analytics | Grafik area rata-rata AI confidence tampil (per jam untuk 24h / per hari untuk 7d) | | |
| UAT-08-02 | Tinggi | Gas Detection Events | Amati grafik batang event | Jumlah pembacaan berisiko MIDDLE/HIGH tampil per periode | | |
| UAT-08-03 | Sedang | Perbandingan antar-RU | Amati grafik Avg Confidence per RU & Breach Count per RU | Grafik batang horizontal per RU tampil dengan nilai masuk akal | | |
| UAT-08-04 | Sedang | Gas Detection Heatmap | Amati heatmap jam × RU (jendela 7 hari) | Sel heatmap berwarna sesuai jumlah deteksi; tooltip menunjukkan "RU @ jam — N detections" | | |
| UAT-08-05 | Sedang | Top Risky Sensors | Amati daftar Top Risky Sensors | Sensor terurut berdasarkan rata-rata confidence tertinggi | | |
| UAT-08-06 | Sedang | Fleet Health | Amati panel Fleet Health | Snapshot status perangkat saat ini sesuai data Devices | | |
| UAT-08-07 | Tinggi | Toggle 24h / 7d | Ganti rentang waktu 24h ↔ 7d | Seluruh grafik dan subjudul berganti rentang tanpa error | | |

### UAT-09 — Settings

| ID | Prioritas | Skenario | Langkah Pengujian | Hasil yang Diharapkan | Status | Catatan |
|---|---|---|---|---|---|---|
| UAT-09-01 | Tinggi | Ubah threshold MIDDLE | Ubah nilai **MIDDLE Risk Threshold**, simpan | Nilai tersimpan; pembacaan dengan confidence ≥ threshold terklasifikasi MIDDLE (cek warna heatmap/overlay) | | |
| UAT-09-02 | Tinggi | Ubah threshold HIGH | Ubah nilai **HIGH Risk Threshold**, simpan | Nilai tersimpan; confidence ≥ threshold terklasifikasi HIGH | | |
| UAT-09-03 | Sedang | Validasi threshold | Coba isi nilai tidak wajar (mis. HIGH < MIDDLE, atau > 1) | Sistem menolak / memberi peringatan | | |
| UAT-09-04 | Tinggi | Daftar pengguna | Buka bagian User Management | Tabel pengguna tampil (nama, email, role, RU) | | |
| UAT-09-05 | Tinggi | Tambah pengguna | Klik tambah user, isi email/nama/role/RU, simpan | Pengguna baru muncul di tabel dan bisa dipakai login | | |
| UAT-09-06 | Tinggi | Hapus pengguna | Hapus pengguna uji | Pengguna hilang dari tabel dan tidak bisa login lagi | | |

### UAT-10 — Non-Fungsional (Ringan)

| ID | Prioritas | Skenario | Langkah Pengujian | Hasil yang Diharapkan | Status | Catatan |
|---|---|---|---|---|---|---|
| UAT-10-01 | Sedang | Waktu muat awal | Ukur waktu dari buka URL hingga dashboard interaktif | Dashboard siap digunakan ≤ 10 detik pada PC standar (setelah setup pertama) | | |
| UAT-10-02 | Sedang | Pembaruan data berkala | Biarkan dashboard terbuka saat `simulate-sensors.js` berjalan | Angka/kartu/alert diperbarui tanpa perlu refresh manual; tidak ada memory leak yang terlihat (browser tetap responsif ≥ 30 menit) | | |
| UAT-10-03 | Rendah | Resolusi layar | Uji pada resolusi 1366×768 dan 1920×1080 | Tata letak tetap rapi; tabel dapat discroll; tidak ada elemen terpotong | | |
| UAT-10-04 | Sedang | Ketahanan koneksi backend | Matikan backend saat dashboard terbuka, lalu hidupkan lagi | Dashboard tidak crash; data kembali normal setelah backend hidup | | |
| UAT-10-05 | Rendah | Footer/status versi | Amati footer dashboard | Tampil status "System Live — v2.1 Stable" (atau versi berjalan) | | |

---

## 6. Formulir Pencatatan Defect

Setiap kegagalan (FAIL) dicatat dengan format berikut:

| No. Defect | ID Test Case | Judul Singkat | Deskripsi & Langkah Reproduksi | Severity* | Screenshot | Status Defect** | PIC Perbaikan |
|---|---|---|---|---|---|---|---|
| DEF-001 | | | | | | | |
| DEF-002 | | | | | | | |

\* **Severity:** Critical (sistem tak dapat dipakai / data salah membahayakan keputusan operasional) · Major (fungsi utama gagal, ada workaround) · Minor (fungsi sekunder terganggu) · Cosmetic (tampilan saja)
\** **Status Defect:** Open · In Progress · Fixed · Re-test · Closed

---

## 7. Ringkasan Hasil Pengujian

| Modul | Jumlah TC | PASS | FAIL | BLOCKED | N/A |
|---|---|---|---|---|---|
| UAT-01 Autentikasi | 5 | | | | |
| UAT-02 Map View | 8 | | | | |
| UAT-03 Overview | 4 | | | | |
| UAT-04 Devices | 5 | | | | |
| UAT-05 Unit Layout | 2 | | | | |
| UAT-06 Alerts | 4 | | | | |
| UAT-07 Events | 7 | | | | |
| UAT-08 Analytics | 7 | | | | |
| UAT-09 Settings | 6 | | | | |
| UAT-10 Non-Fungsional | 5 | | | | |
| **Total** | **53** | | | | |

---

## 8. Persetujuan (Sign-Off)

Dengan menandatangani dokumen ini, para pihak menyatakan bahwa UAT telah dilaksanakan sesuai skenario di atas dan hasilnya diterima berdasarkan kriteria keluar pada Bab 4.2.

| Peran | Nama | Tanda Tangan | Tanggal | Keputusan* |
|---|---|---|---|---|
| Product Owner | | | | ☐ Diterima ☐ Diterima dengan catatan ☐ Ditolak |
| UAT Lead | | | | ☐ Diterima ☐ Diterima dengan catatan ☐ Ditolak |
| Perwakilan Operator | | | | ☐ Diterima ☐ Diterima dengan catatan ☐ Ditolak |
| Perwakilan Pengembang | | | | ☐ Diterima ☐ Diterima dengan catatan ☐ Ditolak |

\* *"Diterima dengan catatan" berarti defect Minor/Cosmetic yang tersisa disepakati untuk diperbaiki pada iterasi berikutnya.*
