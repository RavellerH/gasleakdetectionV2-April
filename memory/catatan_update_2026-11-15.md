# Catatan Update — 15 November 2026

Sinkronisasi repo aplikasi `gasleakdetectionV2-April` dengan update terbaru
`fadlurrahmanf/PertaminaGLD` (s/d 15 Nov 2026) dan `RavellerH/GLD-V2-Report-2026`
(s/d 13 Nov 2026, termasuk MoC Pertamina No. 15769/RU IV).

## Yang diubah

### 1. Branch `ccr-24ee6292-uhpqlk` sudah masuk `main`

`main` sebelumnya berhenti di commit 19 Agu ("stash"). 8 commit dari branch
19 Okt kini sudah masuk `main` (fast-forward, tanpa konflik):

- Backend MQTT ingest (`apps/backend/src/modules/ingest/`) yang mengikuti kontrak
  Node-RED PertaminaGLD.
- Nama kelas gas, kolom **Area** di perangkat, register RU4 + seed bersih.
- Mode demo Digitalization Day, opsi peta satelit, toggle tema, dan beberapa perbaikan.

Kontrak ingest **sudah dicek ulang** terhadap Node-RED PertaminaGLD terbaru
(`server/nodered/functions/pertamina-gld-decode.js` dan
`handover/state/nodered/flows.json`). Topik `gld/server/{decoded,alarm,topology,integrity,replay,test}`,
`gld/gateway/{status,error}`, nama field, dan kode kelas gas 0..7 tidak berubah.

### 2. Register RU4 mengikuti MoC

`deploy/ru4/devices.ru4.example.json` sebelumnya berisi 3 GLD + 6 CH + 1 GW.
Sekarang mengikuti MoC 15769/RU IV (area SRU):

| Perangkat | Node ID (placeholder) | Area |
|---|---|---|
| GW-01 | 0x0001 | SRU Control Room |
| CH-01 … CH-05 | 0x0010 … 0x0014 | SRU perimeter |
| GLD-01 … GLD-04 | 0x1001 … 0x1004 | SRU |

JB-01 (junction box di pipe support PS27) tidak didaftarkan karena perangkat
pasif. Alasan memakai MoC: MoC adalah dokumen Pertamina dan jadi acuan lapangan.

### 3. Database: dukungan MySQL/MariaDB untuk server RU

MoC menulis MySQL di PC server, dan paket handover PertaminaGLD sudah membawa
MariaDB 10.4 di PC yang sama. Backend sekarang punya dua schema Prisma dengan
model yang sama:

- `apps/backend/prisma/schema.prisma`: SQLite, dipakai untuk dev, demo,
  `start.bat`, dan `start.sh` (tidak berubah).
- `apps/backend/prisma/mysql/schema.prisma`: MySQL/MariaDB, dipakai di server RU,
  dengan URL dari `DATABASE_URL`. Kolom JSON/teks panjang memakai `@db.Text`.
- Migrasi baseline `prisma/mysql/migrations/20261115000000_init_mysql`.
- Script npm baru: `prisma:deploy:mysql`, `prisma:generate:mysql`, `build:mysql`,
  `prisma:check-parity` (gagal kalau kedua schema berbeda).
- Langkah pemasangan ada di `deploy/ru4/README.md`. Pakai database terpisah
  (`gasguard_ru`), **bukan** database `pertamina_gld` milik PertaminaGLD.

**Hasil uji** (MariaDB 10.11 + Mosquitto di kontainer, 15 Nov):

- Migrasi berhasil dan `migrate diff` tidak menunjukkan drift.
- Seed RU4 memasukkan 10 perangkat.
- Backend tersambung ke MQTT. Frame `gld/server/alarm` tersimpan sebagai GasReading +
  event `GAS_ALARM`, frame duplikat dibuang lewat `sourceKey`, dan
  `gld/server/topology` serta `gld/gateway/status` membuat CH/GW ONLINE.
- Teks UTF-8 tersimpan benar dan typecheck lolos.
- **Belum diuji** di MariaDB 10.4 yang ada di paket handover, dan belum diuji
  di PC Windows.

## Catatan / hal yang masih terbuka

1. **Jumlah perangkat RU4 belum final.** MoC menulis 4 GLD + 5 CH, tabel alokasi
   3 Nov menulis 3 GLD + 2 CH, dan BoQ Spesifikasi Material menulis 3 GLD + 6 CH.
   Konfirmasi ke Pertamina sebelum go-live, lalu hapus baris yang tidak dipakai.
2. **Node ID, koordinat, dan parent masih placeholder.** Ganti dengan ID yang
   benar-benar di-flash dan hasil survey.
3. **Pemasangan GLD menunggu sertifikat Ex** (kesimpulan MoC). Dashboard dan
   server boleh disiapkan lebih dulu.
4. **Paket handover PertaminaGLD belum menyertakan dashboard ini.** Isinya baru
   Operator Hub, Node-RED, MariaDB, dan MQTT. Perlu diputuskan cara memasang
   dashboard di PC server RU IV (manual, atau ditambahkan ke paket handover).
5. **Semantik alarm firmware berubah.** Alarm AUTO tidak lagi memakai ambang
   confidence; flag frame memakai ambang 1, atau 0 pada build ATEX. Alarm bisa
   datang dengan confidence 0. Ingest sudah menaikkannya minimal ke MIDDLE dan
   membuat event CRITICAL, tetapi UI masih menampilkan "confidence 0.00".
   Disarankan menjadikan flag alarm GLD sebagai status utama di UI.
6. Flow handover tidak lagi mengirim `parentLinkMetricValid`. Ingest tetap
   jalan karena ada fallback RSSI, jadi ini tidak merusak.
7. RU VI Balongan (rencana 4 GLD / 2 CH / **2 GW**) sudah didukung kontrak
   (ID gateway 0x0001–0x000F). Register RU6 dibuat setelah survey.
8. Setelah mengubah model Prisma, ubah **kedua** schema, buat migrasi untuk
   masing-masing, lalu jalankan `npm run prisma:check-parity`.
