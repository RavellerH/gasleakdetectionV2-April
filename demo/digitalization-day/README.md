# Demo Digitalization Day — dashboard RU dengan data simulasi

Menjalankan backend + dashboard RU yang sebenarnya, lalu memutar skenario 5 langkah
dengan mengirim JSON yang sama persis dengan keluaran Node-RED PertaminaGLD
(`gld/server/decoded`, `gld/server/alarm`, `gld/server/topology`, `gld/gateway/status`).
Semua data **simulasi**; dashboard menampilkan label `DEMO — DATA SIMULASI`.

## Jalankan

- Windows: dobel-klik `start-demo.bat`
- Linux/macOS: `./start-demo.sh` (tambahkan `--auto` untuk jalan sendiri)

Lalu buka http://localhost:3002, login `demo@gld.local` / `demo-gld-2026`
(akun lokal di database demo, dibuat oleh `reset-db.js`).

Di jendela skenario: **Enter** = langkah berikutnya, **1–5** = loncat, **q** = keluar.

| # | Langkah | Topik MQTT yang dikirim |
|---|---|---|
| 1 | Operasi normal | `decoded` (Clean Air) tiap 5 dtk, `topology` + `gateway/status` tiap 5 dtk |
| 2 | Indikasi awal LPG di GLD 2 (74 %) | `decoded` LPG → THRESHOLD_BREACH (MIDDLE) |
| 3 | Alarm LPG (93 %) | `alarm` tiap 3 dtk → GAS_ALARM (CRITICAL) |
| 4 | CH 2 mati | topologi CH 2 berhenti → OFFLINE setelah 20 dtk; GLD 2 & CH 5 lewat CH 3 |
| 5 | Pulih | semua kembali normal |

## File

| File | Isi |
|---|---|
| `start-demo.bat` / `start-demo.sh` | Build, reset DB, jalankan broker + backend + dashboard + skenario |
| `broker.js` | Broker MQTT lokal di 127.0.0.1:1884 (dilewati bila port sudah dipakai broker PertaminaGLD) |
| `reset-db.js` | Database RU4 baru dari `deploy/ru4/devices.ru4.example.json` |
| `scenario.js` | Pemutar skenario |

Mode demo frontend: `NEXT_PUBLIC_DEMO_MODE=true` (label simulasi), `NEXT_PUBLIC_POLL_MS=3000`.
Backend: `DEVICE_OFFLINE_AFTER_SEC=20` agar efek CH mati terlihat cepat.

`reset-db.js` juga mengisi **riwayat simulasi 7 hari** (udara bersih tiap 10 menit per GLD
+ 3 kejadian lampau yang sudah diselesaikan) supaya Analytics, heatmap, dan log kejadian terisi.

### Peta

Peta memakai MapLibre tanpa token: tile lokal `apps/ru-frontend/public/tiles` (diunduh
otomatis oleh launcher bila ada internet, `npm run tiles -- RU4`), atau OSM online, atau latar
polos bila offline total. Tile yang diunduh **setelah** build baru terlihat sesudah build ulang
(launcher sudah mengunduh dulu baru build).

Tombol **PETA / SATELIT** di Map View mengganti basemap ke citra satelit Esri World Imagery.
Satelit hanya online (tidak boleh diunduh/di-cache) dan tampil dengan atribusi Esri; untuk
pemakaian produksi, cek dulu ketentuan lisensi Esri.

### Menaruh sensor di lokasi yang benar

Koordinat bawaan adalah contoh di sekitar titik tengah RU4. Untuk demo:

1. Buka Map View, **geser pin** tiap perangkat ke posisinya (tersimpan ke database demo).
2. Jalankan `node save-positions.js` (atau `npm run save-positions`) di folder ini. Posisi, nama,
   dan area ditulis ke `deploy/ru4/devices.ru4.json` (tidak masuk Git).
3. Reset/start berikutnya memakai file itu, jadi posisi tidak hilang.
