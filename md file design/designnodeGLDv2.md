# Design Node GLD v2

Target: ESP32-S3  
Radio Module: E22/LLCC68/SX1262 SPI x 1  
Sensor Front-End: ADS1256, TCA9548, MCP4725/CAT5171, sensor MQ 8 channel  
Dependencies: RadioLib, ArduinoJson, Preferences/NVS, TensorFlow Lite Micro model wrapper `NeuralNetwork`

Dokumen ini memakai struktur yang sejajar dengan `designClusterHeadMeshv3.md`, tetapi disesuaikan untuk node GLD. Node GLD bukan cluster head, bukan router, dan tidak memiliki queue uplink. Node hanya mengukur sensor, menjalankan ML, dan mengirim data ke parent cluster head.

## 1. System Overview

Node GLD adalah sensor node pada STAR Network.

Peran utama:

- Membaca 8 channel sensor gas.
- Melakukan warm-up sensor.
- Melakukan nulling/baseline hanya lewat perintah user, lalu menyimpan hasilnya per channel ke EEPROM/NVS.
- Menjalankan ML on-device.
- Mengirim `SENSOR_DATA` ke parent CH.
- Menandai alarm dengan `FLAG_ALARM` jika confidence ML >= 80% dan kelas prediksi bukan gas normal.

Node tidak melakukan:

- Routing mesh.
- Menjadi parent node lain.
- Buffer queue uplink.
- Node tidak mengirim langsung ke gateway/server; semua komunikasi uplink melalui parent cluster head.

Mode power:

- Mode baterai: wake, warm-up, load nulling dari EEPROM/NVS, baca data sensor dengan auto gain bertahap + proses ML, kirim, jendela RX, sleep.
- Mode power eksternal: menyala terus, baca data sensor dengan auto gain bertahap + proses ML kontinu, simpan sample terakhir, kirim periodik, alarm segera.

## 2. PIN MAPPING

Board target: ESP32-S3.

I2C BUS

| Fungsi | Pin |
| --- | --- |
| SDA | GPIO8 |
| SCL | GPIO9 |

SPI SHARED BUS

| Fungsi | Pin |
| --- | --- |
| MOSI | GPIO11 |
| MISO | GPIO13 |
| SCK | GPIO12 |

ADS1256

| Fungsi | Pin |
| --- | --- |
| CS / SS | GPIO47 |
| DRDY | GPIO10 |
| PDWN / RESET | GPIO18 |

LORA E22-900

| Fungsi | Pin |
| --- | --- |
| CS / NSS | GPIO15 |
| BUSY / AUX | GPIO7 |
| RESET | GPIO39 |
| DIO1 / IRQ | GPIO40 |
| RXEN | GPIO5 |
| TXEN | GPIO6 |

###### SEMUA PIN ESP32 dijelaskan


## 3. Switch Control (TXEN / RXEN)

Radio LoRa node memakai TXEN/RXEN.

Mode RX:

```text
RXEN = HIGH
TXEN = LOW
```

Mode TX:

```text
TXEN = HIGH
RXEN = LOW
```

Mode Sleep:

```text
TXEN = LOW
RXEN = LOW
```

Alur:

- Sebelum transmit `SENSOR_DATA`, set TX.
- Setelah transmit, set RX untuk ACK/downlink window.
- Sebelum deep sleep atau TPL5110 DONE, set sleep.

## 4A. Sensor Mapping

Sensor gas dan channel ADS dipetakan secara tetap sebagai berikut:

| Channel | Sensor |
| --- | --- |
| CH0 | MQ8 |
| CH1 | MQ135 |
| CH2 | MQ3 |
| CH3 | MQ5 |
| CH4 | MQ4 |
| CH5 | MQ7 |
| CH6 | MQ6 |
| CH7 | MQ2 |

Catatan:

- Semua channel dibaca sebagai satu sample gabungan untuk inferensi ML.
- Nilai sensor dan nilai nulling disimpan per channel.

## 4B. MCP to ADS Mapping

Mapping hardware aktual bersifat terbalik:

| ADS Channel | MCP Channel |
| --- | --- |
| ADS CH0 | MCP CH7 |
| ADS CH1 | MCP CH6 |
| ADS CH2 | MCP CH5 |
| ADS CH3 | MCP CH4 |
| ADS CH4 | MCP CH3 |
| ADS CH5 | MCP CH2 |
| ADS CH6 | MCP CH0 |
| ADS CH7 | MCP CH1 |

Catatan:

- Firmware mengikuti mapping ini untuk nulling, report runtime, dan mode test channel.
- `MCP DAC=...` pada log ADC selalu menunjukkan DAC MCP pasangan sensor itu.

## 4C. Gain Policy

Node mengikuti pola gain bertahap pada pembacaan ADS1256.
Gain dipilih berdasarkan tegangan hasil konversi ADC, bukan berdasarkan raw ADC mentah.

Aturan gain:

- Pembacaan channel selalu mulai dari gain tinggi.
- Urutan gain turun bertahap jika sample saturasi atau invalid:
  - `x64 -> x32 -> x16 -> x8 -> x4 -> x2 -> x1`
- Saat nulling, gain awal yang dipakai adalah `x64`.
- Saat runtime normal, setiap pembacaan mulai lagi dari gain `x64` lalu turun bertahap sampai ketemu gain yang sesuai untuk channel itu.
- Gain yang sesuai adalah gain yang menghasilkan tegangan pembacaan valid tanpa saturasi.

Catatan:

- `readSensors(sample)` harus menyimpan gain aktif per channel.
- Gain dipakai untuk konversi raw ke tegangan dan untuk logging runtime.

## 4. Network Behavior

Node hanya menggunakan STAR Network ke cluster head.

Battery mode:

1. Node wake.
2. Load config EEPROM ke RAM MCU.
3. Baca config pin saat boot. Jika LOW, masuk config window sebelum boot normal dilanjutkan.
4. Init ADS/I2C/LoRa.
5. Nyalakan DCFAN, untuk menarik udara luar kedalam (Optimasi waktu yg diperlukan)
6. Warm-up sensor. (Optimasi waktu yg diperlukan)
7. Apply wiper/nulling.
8. Ambil data 8 channel.
9. Jalankan ML.
10. Encode payload.
11. Kirim `SENSOR_DATA` ke CH.
12. Tunggu `STAR_ACK` dan/atau `NODE_DOWNLINK`.
13. Sleep/power off.

External power mode 5V(hanya untuk testing dilab) atau 24V(Sudah full protection):

`void setup()`:

1. Boot.
2. Load config.
3. Init hardware.
4. Warm-up.
5. Nulling.

`void loop()`:

1. Loop pembacaan sensor.
2. Simpan hasil terbaru ke `latestSample`.
3. Jalankan ML berkala.
4. Kirim normal setiap `uplinkPeriodSec`.
5. Kirim alarm segera jika confidence ML >= 80% dan kelas prediksi bukan gas normal.

Node tidak menyimpan queue. Pada external power, hanya sample terbaru yang disimpan.

## 5. Operating Modes

Node menentukan klasifikasi data berdasarkan hasil ML.

Kondisi normal:

- Predicted class gas normal, atau confidence < 80%.
- Kirim data sesuai periode.
- Frame flags: `FLAG_ACK_REQ`.

Kondisi alarm:

- Predicted class bukan gas normal.
- Confidence ML >= 80%.
- Kirim segera.
- Frame flags: `FLAG_ACK_REQ | FLAG_ALARM`.

Training:

- Data dipakai untuk uji model/dataset.
- Data sensor dikirim ke MQTT topic utama.
- Debug sistem dikirim ke Serial dan MQTT topic debug terpisah.
- Tidak wajib mengikuti periode uplink deployment.

Nulling:

- Hanya dilakukan lewat perintah user.
- Menghasilkan nilai nulling per channel.
- Nilai nulling disimpan ke EEPROM/NVS.
- Saat boot normal, node load nilai nulling dari EEPROM/NVS lalu apply ke masing-masing MCP.

## 5A. Nulling Calibration Procedure

Nulling calibration dipakai untuk menentukan nilai referensi awal tiap channel.

Flow:

1. Baca baseline awal dari MCP pada rentang rendah. Nilai MCP 1-10.. 0.0032
2. Set kandidat nilai DAC/nulling untuk channel yang sedang diuji.
3. Baca tegangan sensor yang stabil.
4. Bandingkan dengan baseline awal.
5. Jika nilai masih dekat baseline, geser pencarian ke nilai lebih tinggi.
6. Jika nilai sudah keluar dari baseline, simpan kandidat sebagai hasil nulling.
7. Ulangi sampai nilai referensi tiap channel ditemukan.
8. Simpan hasil akhir ke EEPROM/NVS.
9. Saat boot normal, load nilai nulling dari EEPROM/NVS lalu apply ke masing-masing MCP.

Catatan:

- Proses ini hanya dijalankan saat user meminta nulling.
- Hasilnya dipakai sebagai baseline kerja sensor pada run-time.

## 6. Application Frame Format

Node memakai format `AppFrame` yang sama dengan CH.

| Field | Size |
| --- | --- |
| Preamble `0xAA` | 1 |
| Version | 1 |
| Net: `0=STAR` | 1 |
| MsgType | 1 |
| Flags | 1 |
| SrcID | 2 |
| DstID | 2 |
| Len | 1 |
| Payload | N |
| CRC16 | 2 | 

    Total 1 frame penuh = 42 byte

Untuk node:

- `net = STAR`.
- `msgType = SENSOR_DATA`.
- `srcId = nodeId`.
- `dstId = parentChId`.
- `ttl = 1`.

Payload sensor v1:

| Byte | Isi | Ukuran |
| --- | --- | --- |
| 0 | schema version `1` | 1 byte |
| 1 | power mode: `0=battery`, `1=external` | 1 byte |
| 2 | operation mode: `0=running`, `1=training`, `2=nulling` | 1 byte |
| 3..4 | battery mV | 2 byte |
| 5 | predicted class | 1 byte |
| 6..7 | confidence x10000 | 2 byte |

    Payload sensor v1 = 7 byte

byte 1 dan 3 di satukan
net, msgtype, flags di satukan
## 7. Message Types

Node hanya memproses message STAR.

| Type | Nilai | Arah | Fungsi |
| --- | --- | --- | --- |
| `SENSOR_DATA` | `0x10` | Node -> CH | Data sensor |
| `STAR_ACK` | `0x12` | CH -> Node | ACK uplink |
| `NODE_DOWNLINK` | `0x14` | CH -> Node | Konfigurasi/perintah dari server |

disederhanakan jadi 1 byte saja
Node tidak membuat frame MESH.

## 8. ClusterHead Logic yang Relevan untuk Node

Node mengasumsikan CH melakukan:

- Buffer data normal.
- Forward alarm segera.
- Menyimpan downlink sampai node uplink berikutnya.

Dari sisi node:

1. Kirim `SENSOR_DATA`.
2. Jika ada `NODE_DOWNLINK`, parse dan apply config.

ACK hanya untuk Flag ALARM, selain ALARM tidak perlu ACK

## 9. Local Storage (Non-Alarm Buffer)

Node tidak memiliki uplink queue dan tidak menyimpan buffer data normal.

Alasan:

- Node tidak menjadi router.
- Queue di node battery mudah hilang saat power cut.
- CH adalah tempat buffer yang lebih tepat.

Storage lokal node hanya untuk konfigurasi permanen:

- `nodeId`
- `parentChId`
- `parentChIdAlt`
- `freq`
- `uplinkPeriodSec`
- `warmupMs`
- `powerMode`
- `operationMode`
- `nulling[8]`

External power:

- Menyimpan `latestSample` di RAM.
- Nilai lama ditimpa oleh pembacaan baru.

Battery:

- Tidak menyimpan data runtime seperti `latestSample`, hasil inferensi, dan status ACK setelah sleep, kecuali konfigurasi permanen berikut:
  - `nodeId`
  - `parentChId`
  - `parentChIdAlt`
  - `freq`
  - `uplinkPeriodSec`
  - `warmupMs`
  - `powerMode` Battery & External Power
  - `operationMode`
  - `nulling[8]`

## 10. Server Pull Mechanism

Node tidak menerima `SERVER_PULL_REQUEST`.

Kaitan node:

- Data normal yang dikirim node akan disimpan CH.
- Server mengambil data node dari CH melalui pull.
- Node tidak perlu tahu kapan server melakukan pull.

Konsekuensi:

- Node tetap sederhana.
- Node battery tetap hemat energi.
- Server registry memakai `nodeId` dari payload/record CH.

## 11. Mesh Priority Queue

Node tidak memiliki mesh priority queue.

Prioritas di node dilakukan melalui keputusan kirim:

- Normal dikirim periodik.
- Alarm dikirim segera.
- Alarm menggunakan retry lebih banyak.

CH yang menerima alarm akan memasukkannya ke `queue_mesh_alarm`.

## 12. Retry Policy

Normal:

- 3 retry per siklus.
- Delay retry: 1200 ms, 1800 ms, 2500 ms.
- Jika tetap gagal, naikkan `ackFailCount`.

Alarm:

- 5 retry per kejadian.
- Delay retry: 1200 ms, 1800 ms, 2500 ms, 3500 ms, 5000 ms.
- Jika gagal, coba parent alternatif jika tersedia.

ACK:

- Node menunggu ACK selama `ackTimeoutMs`, default 1500 ms.
- ACK valid jika `dstId == nodeId` dan `seq` sama.

Failover:

- Jika `ackFailCount >= 3`, swap `parentChId` dengan `parentChIdAlt`.
- Jika semua parent gagal beberapa menit, masuk config/discovery state.

## 13. Downlink Handling

Node menerima `NODE_DOWNLINK` hanya pada RX window setelah uplink.

Isi downlink:

- Update `uplinkPeriodSec`.
- Update `warmupMs`.
- Update `parentChId` dan `parentChIdAlt`.
- Update `freq`.
- Perintah `RUNNING`, `TRAINING`, `NULLING`.
- Perintah debug on/off.

Alur:

1. Node mengirim `SENSOR_DATA`.
2. Node set radio RX.
3. Node menunggu sampai `rxWindowMs`.
4. Jika menerima `STAR_ACK`, tandai uplink sukses.
5. Jika menerima `NODE_DOWNLINK`, parse payload.
6. Simpan config baru ke NVS.
7. Jika konfigurasi RF berubah, apply setelah window selesai atau reboot.

## 14. Server Node Registry

Node tidak menyimpan registry server.

Node berkontribusi pada registry melalui:

- `srcId = nodeId`.
- Payload sensor yang dikirim ke CH.
- CH menyertakan `node_id` saat mengirim `CH_DATA_UP` atau `CLUSTER_BULK_DATA`.

Server kemudian membuat:

```text
nodeId -> clusterId
```

Mapping ini digunakan untuk downlink targeted.

## 15. Routing (Tree)

Node **tidak** ikut routing tree dan **tidak** melakukan forwarding paket node lain.

Model komunikasi node hanya satu hop ke parent:

```text
Node GLD -> parentChId
```

Parameter:

- `parentChId`: cluster head utama yang menjadi tujuan uplink normal.
- `parentChIdAlt`: cluster head alternatif untuk failover.

Parent failover:

1. Node mengirim uplink ke `parentChId`.
2. Jika ACK gagal berulang, node menandai parent utama tidak layak.
3. Node pindah ke `parentChIdAlt`.
4. Perubahan parent disimpan ke NVS.
5. Jika parent utama dan alternatif sama-sama gagal, node masuk mode discovery/config.

Notes to be discuss:

- CH dapat menyediakan beacon STAR pada interval lambat untuk discovery.
- Node memilih CH berdasarkan RSSI dan network ID.
- Jika beacon belum diterapkan, parent ditentukan manual melalui Serial JSON atau downlink.

## 16. Firmware Architecture (FreeRTOS)

FreeRTOS adalah sistem penjadwalan task ringan untuk mikrokontroler. Di ESP32, FreeRTOS dipakai untuk membagi pekerjaan firmware menjadi beberapa task terpisah, misalnya baca sensor, kirim LoRa, dan handle konfigurasi.

Node dapat dibuat cooperative loop atau FreeRTOS. Untuk external power, FreeRTOS lebih rapi.

Task firmware:

| Task | Fungsi |
| --- | --- |
| `TaskSensorRead` | Baca ADS1256 8 channel |
| `TaskML` | Preprocessing dan inferensi untuk satu sample gabungan |
| `TaskLoRaTxRx` | Kirim frame, tunggu ACK/downlink |
| `TaskConfig` | Serial JSON dan downlink config |
| `TaskPower` | Battery monitor, sleep, TPL5110 DONE |

Battery mode dapat berjalan tanpa task panjang:

- Semua proses dilakukan di `setup()`.
- Setelah kirim dan RX window, node sleep.
- `loop()` tidak dipakai.

Catatan:

- `Channel` berarti satu jalur pembacaan sensor yang terpisah dari channel lain.
- Pada desain ini, node punya 8 channel sensor, yaitu `CH0` sampai `CH7`.
- Setiap channel punya nilai sensor dan nilai nulling masing-masing, sedangkan hasil inferensi ML dihitung dari kombinasi semua channel dalam satu sample.

## 17. SPI Protection

Node memakai dua bus SPI pada desain firmware:

- ADS1256 pada `SPI_ADS`.
- LoRa pada `SPI_LORA`.

Jika hardware memakai bus SPI terpisah:

- `spiMutex` tidak wajib antar ADS dan LoRa.
- Tetap hindari akses ADS saat LoRa transmit jika noise analog signifikan.

Jika hardware digabung ke satu SPI:

- Gunakan `spiMutex`.
- Pastikan CS ADS dan CS LoRa tidak aktif bersamaan.
- Set mode SPI sesuai device sebelum transaksi.
- Alur kerja:
  1. Task yang mau akses SPI harus lock `spiMutex` lebih dulu.
  2. Setelah `spiMutex` didapat, task aktifkan CS device yang dipakai.
  3. Lakukan transaksi SPI ke satu device saja.
  4. Matikan CS device setelah selesai.
  5. Release `spiMutex` supaya task lain boleh akses SPI.
- Selama `spiMutex` dipegang, task lain wajib menunggu dan tidak boleh mulai transaksi SPI.

Praktik pengukuran:

- Saat membaca ADS, radio tidak perlu TX.
- Saat TX LoRa, sampling ADS dapat dipause singkat untuk mengurangi noise.

## 18. Config Parameters (Config struct)

Node config:

| Field | Tipe | Fungsi |
| --- | --- | --- |
| `nodeId` | `uint16_t` | ID node |
| `parentChId` | `uint16_t` | CH utama |
| `parentChIdAlt` | `uint16_t` | CH alternatif |
| `freq` | `uint32_t` | Frekuensi STAR, hanya 920-923 MHz |
| `uplinkPeriodSec` | `uint16_t` | Periode kirim normal |
| `warmupMs` | `uint32_t` | Durasi warm-up |
| `rxWindowMs` | `uint32_t` | Window ACK/downlink |
| `ackTimeoutMs` | `uint32_t` | Timeout ACK |
| `powerMode` | `uint8_t` | `0=battery`, `1=external` |
| `operationMode` | `uint8_t` | `0=running`, `1=training`, `2=nulling` |
| `nulling[8]` | `uint16_t[8]` | Nilai nulling tiap channel |
| `batteryThresholdMv` | `uint16_t` | Ambang low battery |

Serial JSON:

```json
{"nodeId":101,"parentChId":1,"parentChIdAlt":2,"freq":920000000}
```

```json
{"powerMode":0,"operationMode":0,"uplinkPeriodSec":60,"warmupMs":60000}
```

Partial update harus didukung.

## 19. Failure Handling

Sensor failure:

- ADS1256 tidak terdeteksi:
  - Kalau `external power`:
    - node tidak tidur
    - node tetap hidup
    - node mengirim fault status
  - Kalau `battery`:
    - node tidur / sleep
    - tujuannya hemat daya
    - karena kalau sensor utama gagal, tidak ada gunanya node terus aktif dan menguras baterai
- I2C mux/DAC tidak terdeteksi: masuk safe mode dan laporkan fault.
- Nilai sensor invalid (contoh: `8388607`, `-8388608`, `NaN`, `inf`):
  - set flag internal bahwa sample tidak valid
  - jangan dipakai sebagai dasar inferensi ML
  - jangan trigger alarm dari data invalid
  - kalau semua channel invalid, node laporkan fault status
  - contoh: ADC saturasi mentok di nilai maksimum/minimum
  - contoh: hasil konversi jadi `NaN`, `inf`, atau gagal terbaca
  - contoh: nilai semua channel persis sama terus dalam waktu lama
  - contoh: lonjakan nilai sangat besar dan tidak masuk akal

ML failure:

- Model tidak initialized: jangan set `FLAG_ALARM`.
- Kirim payload dengan predicted class `0xFF` jika perlu.
- Training/debug dapat menampilkan error ke Serial dan MQTT topic debug terpisah.

LoRa failure:

- TX gagal: retry.
- ACK timeout: naikkan `ackFailCount`.
- ACK gagal berulang: switch parent.
- Semua parent gagal: masuk config/discovery.

Power failure:

- Battery mV selalu dikirim di payload.
- Jika battery di bawah ambang, node menandai status low battery dan menyesuaikan power policy.
- Jika sangat rendah, perpanjang periode wake atau masuk sleep lebih lama.

## 20. Boot Sequence

Battery mode:

1. Start Serial singkat.
2. Load config NVS.
3. Baca config pin saat boot. Jika LOW, buka config window sebelum proses normal.
4. Init I2C, ADS1256, LoRa.
5. Load nulling dari EEPROM/NVS lalu apply ke masing-masing MCP.
6. Warm-up.
7. Jika operation mode nulling, jalankan nulling atas perintah user dan simpan hasilnya ke EEPROM/NVS.
8. Baca sensor.
9. Jalankan ML.
10. Kirim `SENSOR_DATA`.
11. Tunggu ACK/downlink.
12. Set RF sleep.
13. Pulse TPL5110 DONE atau deep sleep.

External power:

1. Start Serial.
2. Load config NVS.
3. Init hardware.
4. Warm-up.
5. Load nulling dari EEPROM/NVS lalu apply ke masing-masing MCP.
6. Start loop/tasks.
7. Baca sensor kontinu.
8. Kirim normal periodik.
9. Kirim alarm segera.

## 21. Loop Sequence

Loop sequence adalah alur kerja node di `void loop()` setelah `setup()` selesai.

External power menjalankan `void loop()` secara kontinu:

1. Baca sensor kontinu.
2. Simpan sample terbaru ke RAM sebagai `latestSample`.
3. Jalankan preprocessing dan ML berkala.
4. Kirim data normal sesuai `uplinkPeriodSec`.
5. Kirim alarm segera jika confidence ML >= 80% dan kelas prediksi bukan gas normal.
6. Setelah TX, buka RX window untuk `STAR_ACK` dan `NODE_DOWNLINK`.
7. Jika retry diperlukan, jalankan sesuai retry policy.
8. Ulangi loop tanpa sleep.

## 22. Battery Monitor

Node minimal memiliki battery monitor pada IO4.

Battery:

- Pembagi 200k/100k.
- `Vin = Vadc x 3`.
- Nilai battery mV masuk payload byte 3..4.

Battery policy:

- Battery low ditetapkan saat battery <= 20%.
- Pada battery low, node tidak menjadikan battery sebagai alarm gas.
- Battery sangat rendah ditetapkan saat battery <= 10%.
- Pada battery sangat rendah, `uplinkPeriodSec` diperpanjang 100% dari nilai normal.
- Contoh: jika `uplinkPeriodSec = 60 detik`, maka menjadi `120 detik`.

## 23. Activity LED (IO19, Active LOW)

Node boleh memakai LED active LOW jika tersedia.

Pola:

| Durasi | Event | Arti |
| --- | --- | --- |
| 50 ms | Sensor read selesai | Pembacaan sensor berhasil |
| 150 ms | LoRa TX sukses | Paket terkirim dan ACK diterima |
| 300 ms | Alarm dikirim atau fault | Ada kondisi alarm atau error sistem |

Battery mode:

- LED hanya menyala sebentar saat transmit.
- LED tidak dipakai sebagai indikator kontinu.
- Tujuannya hemat energi.

External power:

- LED bisa dipakai untuk status running/training/nulling.
- Saat boot, LED pulse singkat menandakan sistem hidup.
- Saat sensor read selesai, LED pulse singkat menandakan pembacaan berhasil.
- Saat LoRa TX sukses, LED pulse lebih jelas menandakan paket terkirim dan ACK diterima.
- Saat alarm dikirim, LED menyala lebih lama sebagai tanda kondisi alarm.
- Saat fault, LED menyala dengan pola khusus untuk menandakan error sistem.
- Saat `running`, LED mengikuti aktivitas normal sistem.
- Saat `training`, LED menandakan mode training aktif.
- Saat `nulling`, LED menandakan proses nulling sedang berjalan.

## 23. System Characteristics

Karakter node GLD:

- Tidak ada uplink queue.
- Sederhana dan hemat RAM.
- Battery mode hemat energi.
- External mode monitoring kontinu.
- ML di node membuat alarm tidak bergantung server.
- Alarm dikirim segera.
- Data normal dikirim periodik dan dibuffer CH.
- Downlink hanya diproses pada RX window.
- Failover node berbasis ACK.

## 24. Network Topology

Node tidak berkomunikasi langsung dengan gateway.

Hubungan node ke gateway:

```text
Node GLD -> ClusterHead STAR -> Mesh/TREE -> Gateway -> MQTT Server
```

Konsekuensi:

- Node cukup tahu `parentChId`.
- Gateway dan path mesh dikelola CH/server.
- Server downlink ke node harus melewati CH yang menaungi node.

## 25. Software Library Structure

Komponen firmware node:

| Komponen | Fungsi |
| --- | --- |
| `NodeConfig` | Konfigurasi node di NVS |
| `SensorSample` | Global sample gabungan dari semua channel |
| `ADS1256` | ADC sensor MQ |
| `TCA9548` | Multiplexer I2C |
| `MCP4725/CAT5171` | Apply nilai nulling |
| `NeuralNetwork` | Inferensi ML dari sample gabungan |
| `scaler_params.h` | Mean/std preprocessing |
| `RadioLib` | Driver LoRa |
| `Frame encoder` | Encode `SENSOR_DATA` |
| `Power manager` | Battery sleep/TPL5110 |

File model yang wajib ada di folder sketch node:

- `NeuralNetwork.h`
- `NeuralNetwork.cpp`
- `model_data.h`
- `scaler_params.h`

Fungsi internal firmware:

- `loadConfig()`
- `saveConfig()`
- `applyWipers()`
- `warmupSensor()`
- `nullingRoutine()`
- `readSensors(sample)`
- `runMl(sample)`
- `buildPayload(sample)`
- `sendSample(sample)`
- `waitAck(seq)`
- `handleDownlink(payload)`
- `enterSleep()`

## 26. Validation Checklist

- Restart 20x normal.
- Sensor reading tiap channel stabil.
- Nulling load/save ke EEPROM/NVS valid.
- Gain per channel valid dan turun bertahap saat saturasi/invalid.
- LoRa send/receive valid dan tidak freeze.
- ACK handling dan failover parent bekerja.
- Tidak ada SPI collision.
- Battery monitor terbaca benar.
- 24 jam jalan tanpa freeze.
