# Design ClusterHead Mesh GLD v3

Target: ESP32-S3-WROOM-1U  
Radio Module: E22-900MM22S/SX1262 SPI x 2  
Library: DualLoRaClusterHead  
Dependencies: RadioLib, ArduinoJson, Preferences/NVS

Dokumen ini memakai struktur `LibraryLoraMesh/meshLoRav2/doc/DESIGN.md`, tetapi disesuaikan dengan arsitektur GLD baru: node GLD hanya menjadi sensor node, cluster head menjadi agregator STAR dan router MESH, gateway menjadi jembatan MQTT ke server.

## 1. System Overview

ClusterHead GLD memiliki dua jaringan LoRa yang dipisah per radio.

Radio A, STAR Network:

- Dipakai untuk komunikasi node GLD ke cluster head.
- Topologi star.
- Node GLD mengirim `SENSOR_DATA` periodik atau alarm.
- Node battery sleep setelah uplink dan RX window.
- Node external power tetap menyala, tetapi tetap mengirim data ke CH secara periodik atau alarm segera.

Radio B, MESH/TREE Backbone:

- Dipakai untuk komunikasi antar cluster head menuju gateway.
- Topologi tree/mesh backbone.
- Gateway adalah root.
- Server berada di belakang gateway melalui MQTT/WiFi.

Prinsip utama:

- Data normal dari node tidak langsung dikirim ke server.
- Data normal dibuffer di CH dan dikirim saat ada `SERVER_PULL_REQUEST`.
- Data alarm dari node dikirim segera sebagai prioritas menggunakan `CH_DATA_UP + FLAG_ALARM`.
- CH tidak menjalankan ML gas leak. Keputusan alarm berada di node GLD.

## 2. Hardware Mapping (Final Pin Assignment)

Board target: ESP32-S3-WROOM-1U.

Shared SPI Bus:

| Fungsi | Pin |
| --- | --- |
| SCK | IO12 |
| MOSI | IO11 |
| MISO | IO13 |

SPI dipakai bersama oleh dua radio, sehingga semua transaksi SPI wajib memakai mutex.

Radio A STAR, E22-900MM22S/SX1262:

| Fungsi | Pin |
| --- | --- |
| RESET | IO7 |
| TXEN | IO5 |
| RXEN | IO6 |
| BUSY | IO15 |
| DIO1 | IO16 |
| NSS | IO17 |

Radio B MESH, E22-900MM22S/SX1262:

| Fungsi | Pin |
| --- | --- |
| RESET | IO41 |
| TXEN | IO40 |
| RXEN | IO39 |
| BUSY | IO38 |
| DIO1 | IO42 |
| NSS | IO14 |

Battery monitor solar + Li-ion 18650:

| Fungsi | Pin | Keterangan |
| --- | --- | --- |
| Battery ADC | IO4 | Pembagi 200k/100k, Vin = Vadc x 3 |

BQ25185 charger:

| Fungsi | Pin | Keterangan |
| --- | --- | --- |
| STAT1 | IO3 | Open-drain, wajib pull-up 1k-20k |
| STAT2 | IO46 | Open-drain, wajib pull-up 1k-20k |

Activity LED:

| Fungsi | Pin | Keterangan |
| --- | --- | --- |
| LED | IO19 | Active LOW |

## 3. Switch Control (TXEN / RXEN)

Setiap modul E22 memakai kontrol RF switch `TXEN` dan `RXEN`.

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

Aturan:

- Sebelum `send()`, set mode TX.
- Setelah `send()`, kembalikan ke mode RX.
- Saat radio tidak dipakai lama, boleh set sleep.
- Radio A dan Radio B mengontrol TXEN/RXEN masing-masing.

## 4. Network Behavior

### 4.1 STAR Network

Node GLD mengirim data ke CH.

Node battery:

1. Wake.
2. Warm-up.
3. Nulling cepat.
4. Measure.
5. ML inference.
6. Kirim `SENSOR_DATA`.
7. RX window untuk `STAR_ACK` atau `NODE_DOWNLINK`.
8. Sleep/power off.

Node external power:

1. Boot.
2. Warm-up.
3. Nulling.
4. Measure terus menerus.
5. Simpan sample terbaru di global variable.
6. Kirim normal periodik.
7. Kirim alarm segera jika confidence ML >= 80%.

### 4.2 MESH/TREE Network

CH mengirim frame mesh menuju parent aktif.

- Gateway root memiliki `parentId = 0`.
- CH non-gateway memilih parent melalui `CH_CONFIG`.
- CH mengirim topology update melalui `CH_HELLO`.
- Downlink server memakai routing path-based atau children-based.
- CH harus tetap menerima node STAR walaupun mesh sedang failover.

## 5. Data Classification

Data diklasifikasikan dari flag frame node.

Normal:

- `FLAG_ALARM` tidak aktif.
- Data masuk buffer CH.
- Data hanya dikirim saat server pull.

Alarm:

- `FLAG_ALARM` aktif.
- Di node GLD, alarm terjadi jika predicted class bukan normal dan confidence ML >= 80%.
- CH tidak perlu menjalankan ML ulang.
- CH langsung membuat `CH_DATA_UP + FLAG_ALARM`.
- Alarm masuk priority queue dan dikirim segera.

Flags:

| Flag | Nilai | Fungsi |
| --- | --- | --- |
| `FLAG_ACK_REQ` | `0x01` | Pengirim meminta ACK |
| `FLAG_ACK_RSP` | `0x02` | Frame adalah ACK response |
| `FLAG_ALARM` | `0x04` | Data urgent/alarm |

## 6. Application Frame Format

Semua frame memakai format `AppFrame`.

| Field | Size |
| --- | --- |
| Preamble `0xAA` | 1 |
| Version | 1 |
| Net: `0=STAR`, `1=MESH` | 1 |
| MsgType | 1 |
| Flags | 1 |
| SrcID | 2 |
| DstID | 2 |
| Seq | 2 |
| TTL | 1 |
| Len | 1 |
| Payload | N |
| CRC16 | 2 |

CRC:

- CRC16-CCITT-FALSE.
- Dihitung dari preamble sampai payload.

Aturan umum:

- Frame invalid dibuang.
- Version tidak dikenal dibuang.
- CRC gagal dibuang.
- TTL `0` tidak boleh diforward.
- Dedup memakai `srcId + seq`.

## 7. Message Types

STAR, Radio A:

| Type | Nilai | Arah | Fungsi |
| --- | --- | --- | --- |
| `SENSOR_DATA` | `0x10` | Node -> CH | Data sensor GLD |
| `STAR_ACK` | `0x12` | CH -> Node | ACK untuk uplink |
| `NODE_DOWNLINK` | `0x14` | CH -> Node | Downlink untuk node saat RX window |

MESH, Radio B:

| Type | Nilai | Arah | Fungsi |
| --- | --- | --- | --- |
| `CH_DATA_UP` | `0x20` | CH -> Gateway | Data urgent/alarm atau event CH |
| `SERVER_PULL_REQUEST` | `0x30` | Server/Gateway -> CH | Permintaan data normal |
| `CLUSTER_BULK_DATA` | `0x31` | CH -> Gateway | Batch data normal hasil pull |
| `NODE_DOWNLINK_REQUEST` | `0x32` | Server/Gateway -> CH | Downlink targeted untuk node |
| `CH_HELLO` | `0x33` | CH -> Gateway | Topology discovery/update |
| `CH_CONFIG_REQUEST` | `0x34` | CH -> CH/Gateway | Parent discovery broadcast |
| `CH_CONFIG_RESPONSE` | `0x35` | CH/Gateway -> requester | Respons kandidat parent |

## 8. ClusterHead Logic

### 8.1 Saat Menerima `SENSOR_DATA`

Alur:

1. Decode frame.
2. Validasi CRC, version, net, msgType.
3. Dedup `nodeId + seq`.
4. Update registry lokal node.
5. Jika `FLAG_ACK_REQ`, enqueue `STAR_ACK`.
6. Jika ada pending downlink untuk node, enqueue `NODE_DOWNLINK`.
7. Buat `StoredRecord`.
8. Jika `FLAG_ALARM` aktif:
   - Simpan record untuk audit.
   - Buat `CH_DATA_UP`.
   - Set `FLAG_ALARM`.
   - Payload: `node_id(2) + sensor_payload`.
   - Enqueue ke `queue_mesh_alarm`.
9. Jika `FLAG_ALARM` tidak aktif:
   - Simpan record ke buffer normal.
   - Jangan kirim ke mesh sampai ada `SERVER_PULL_REQUEST`.

### 8.2 Saat Menerima `SERVER_PULL_REQUEST`

1. Parse payload routing.
2. Jika target adalah CH ini, baca buffer.
3. Filter `from_time`.
4. Batasi `max_records` dan `max_bytes`.
5. Buat chunk `CLUSTER_BULK_DATA`.
6. Enqueue ke bulk queue.
7. Jika target bukan CH ini, forward sesuai path/children.

### 8.3 Saat Menerima `NODE_DOWNLINK_REQUEST`

1. Parse target cluster dan node.
2. Jika target CH ini, simpan payload ke `DownlinkStore`.
3. Jika target child/path berikutnya, forward.
4. Downlink dikirim ke node saat node uplink berikutnya.

### 8.4 Saat Menerima `CH_CONFIG_REQUEST`

1. Pastikan frame broadcast atau ditujukan ke CH ini.
2. Pastikan CH ini sudah punya koneksi ke gateway/root.
3. Kirim `CH_CONFIG_RESPONSE` ke requester.

### 8.5 Saat Menerima `CH_HELLO`

1. Parse `cluster_id`, `parent_id`, `path_len`, `path`.
2. Jika `parent_id == clusterId`, masukkan `cluster_id` ke `childrenClusterIds`.
3. Jika CH bukan gateway, tambahkan `clusterId` sendiri ke path.
4. Forward ke parent aktif.
5. Gateway meneruskan informasi topologi ke server.

## 9. Local Storage (Non-Alarm Buffer)

Buffer normal berada di CH.

Format record:

```text
timestamp uint32
nodeId    uint16
seq       uint16
flags     uint8
payload   vector<uint8_t>
```

Operasi:

- `store(record)`
- `readBatch(max_bytes, max_records)`
- `removeAfterSend(count)`
- `clear()`

Kebijakan:

- Data normal disimpan sampai server pull.
- Data alarm disimpan juga untuk audit.
- Jika buffer penuh, drop record tertua atau batasi record per node.
- Untuk lapangan, persistent storage disarankan: LittleFS, FRAM, atau EEPROM eksternal.

Downlink storage:

```text
pending_downlink[node_id] = payload
```

Operasi:

- `put(nodeId, payload)`
- `pop(nodeId, out)`

## 10. Server Pull Mechanism

`SERVER_PULL_REQUEST` mengambil data normal dari CH.

Payload:

```text
path_len(1)
if path_len == 0:
  target_cluster_id(2)
else:
  path(path_len * 2)
from_time(4)
max_records(2)
max_bytes(2)
```

Mode routing:

- `path_len == 0`: children-based.
- `path_len > 0`: path-based.

Jika target adalah CH ini:

1. Ambil batch dari buffer.
2. Filter record dengan `timestamp >= from_time`.
3. Batasi jumlah dan ukuran.
4. Pecah menjadi beberapa chunk jika perlu.
5. Kirim `CLUSTER_BULK_DATA`.

Payload `CLUSTER_BULK_DATA`:

```text
chunk_id(2)
total_chunks(2)
records:
  node_id(2)
  payload_len(1)
  payload(N)
```

Jika bukan target:

- Path-based: cek `path[0] == clusterId`, lalu forward ke `path[1]`.
- Children-based: cek target ada di `childrenClusterIds`, lalu forward ke child.

## 11. Mesh Priority Queue

CH memiliki dua queue mesh:

- `queue_mesh_alarm`: prioritas tinggi.
- `queue_mesh_bulk`: prioritas normal.

Urutan TX:

1. Cek `queue_mesh_alarm`.
2. Kirim semua alarm yang siap.
3. Jika alarm kosong, kirim bulk.

Isi alarm:

- `CH_DATA_UP + FLAG_ALARM`.
- Event CH urgent, misalnya battery low atau charger fault.

Isi bulk:

- `CLUSTER_BULK_DATA`.
- `CH_HELLO`.
- `CH_CONFIG_RESPONSE`.
- Forward request non-urgent.

## 12. Retry Policy

Alarm:

| Attempt | Delay |
| --- | --- |
| 1 | 100 ms |
| 2 | 200 ms |
| 3 | 400 ms |
| 4 | 800 ms |
| 5 | 1200 ms |

Bulk:

| Attempt | Delay |
| --- | --- |
| 1 | 200 ms |
| 2 | 400 ms |
| 3 | 800 ms |

Kebijakan:

- Alarm gagal tidak langsung dibuang.
- Bulk gagal tetap dapat dikirim ulang saat server pull berikutnya.
- Fail count mesh dipakai untuk memicu failover parent.

## 13. Downlink Handling

`NODE_DOWNLINK_REQUEST` bersifat targeted, bukan broadcast.

Payload:

```text
path_len(1)
if path_len == 0:
  target_cluster_id(2)
  node_id(2)
else:
  path(path_len * 2)
  node_id(2)
payload(N)
```

Alur:

1. Gateway menerima perintah server.
2. Gateway mengirim frame mesh.
3. CH di path melakukan forward hop-by-hop.
4. Target CH menyimpan payload ke `DownlinkStore`.
5. Node GLD uplink pada periode berikutnya.
6. CH mengirim `NODE_DOWNLINK` pada RX window node.
7. Pending payload dihapus setelah dikirim.

Aturan:

- Tidak broadcast.
- Jika node battery, downlink hanya tersedia setelah uplink.
- Jika node external power punya RX window lebih sering, CH tetap memakai mekanisme pending downlink.

## 14. Server Node Registry

Server membangun mapping:

```text
nodeId -> clusterId
clusterId -> gatewayId
clusterId -> pathFromGateway
clusterId -> parentId
```

Sumber registry:

- `CLUSTER_BULK_DATA`: `srcId = clusterId`, tiap record memuat `node_id`.
- `CH_DATA_UP`: `srcId = clusterId`, payload diawali `node_id`.
- `CH_HELLO`: memuat `cluster_id`, `parent_id`, dan path.

Fungsi registry:

- Server tahu CH mana yang menaungi node.
- Server dapat mengirim `NODE_DOWNLINK_REQUEST` secara targeted.
- Server dapat memilih path eksplisit untuk pull/downlink.

## 15. Routing (Tree)

Setiap CH menyimpan:

- `clusterId`
- `parentId`
- `parentIdAlt`
- `activeParentId`
- `gatewayId`
- `childrenClusterIds`

Routing uplink:

- `CH_DATA_UP` dikirim ke `activeParentId`.
- `CLUSTER_BULK_DATA` dikirim ke `activeParentId`.
- `CH_HELLO` dikirim ke `activeParentId`.
- TTL dikurangi setiap hop.

Routing downlink:

- Path-based lebih utama.
- Children-based sebagai fallback.

### 15.1 CH_CONFIG

Tujuan:

- Menemukan parent dan parent alternatif.

Alur:

1. CH non-gateway broadcast `CH_CONFIG_REQUEST` ke `0xFFFF`.
2. Gateway/CH yang sudah terkoneksi root menjawab `CH_CONFIG_RESPONSE`.
3. Requester mengumpulkan kandidat selama 30 detik.
4. Kandidat diurutkan berdasarkan RSSI/SNR dan kualitas.
5. Kandidat terbaik menjadi `parentId`.
6. Kandidat kedua menjadi `parentIdAlt`.
7. Konfigurasi disimpan ke NVS.
8. CH mengirim `CH_HELLO`.

Re-discovery:

- Jika parent utama dan alternatif gagal selama beberapa menit, CH menjalankan `CH_CONFIG` ulang.

### 15.2 CH_HELLO

Payload:

```text
cluster_id(2)
parent_id(2)
path_len(1)
path(path_len * 2)
```

Alur:

1. CH child mengirim hello ke parent.
2. Parent mencatat child jika `parent_id == clusterId`.
3. Parent menambah dirinya ke path.
4. Parent forward ke parent berikutnya.
5. Gateway/server membangun topology registry.

CH_HELLO dikirim:

- Setelah boot/discovery.
- Setelah failover parent.
- Setelah rediscovery berhasil.
- Opsional sebagai heartbeat lambat.

### 15.3 Failover Parent

Jika TX mesh gagal 3 kali berturut-turut:

- Jika aktif memakai `parentId`, pindah ke `parentIdAlt`.
- Jika aktif memakai `parentIdAlt`, kembali ke `parentId`.
- Kirim `CH_HELLO` ulang, throttle 60 detik.

Jika semua parent gagal selama `PARENT_DEAD_RESCAN_MS`, misalnya 180000 ms:

- Jalankan `CH_CONFIG` ulang.
- Jika tidak ada kandidat, masuk mode `DEGRADED_BUFFER_ONLY`.
- Tetap terima data node dan buffer data normal.
- Alarm tetap dicoba dengan backoff.

## 16. Firmware Architecture (FreeRTOS)

Task:

| Task | Fungsi |
| --- | --- |
| `TaskRadioA_RX` | Menerima `SENSOR_DATA` dari node |
| `TaskRadioA_TX` | Mengirim `STAR_ACK` dan `NODE_DOWNLINK` |
| `TaskRadioB_RX` | Menerima frame mesh |
| `TaskRadioB_TX` | Mengirim alarm, bulk, hello, config response |
| `TaskRouter` | Forward request, TTL, routing path |
| `TaskHousekeeping` | Battery, charger, LED, failover timer, health check |

Prioritas:

- RX dan TX radio lebih tinggi daripada housekeeping.
- Alarm queue diproses sebelum bulk.

## 17. SPI Protection

Karena Radio A dan Radio B berbagi SPI bus:

```text
SemaphoreHandle_t spiMutex
```

Semua operasi SPI:

1. Lock mutex.
2. Transaksi SPI.
3. Unlock mutex.

Receive split:

1. Dengan mutex: `standby()` dan `startReceive()`.
2. Tanpa mutex: tunggu DIO1/GPIO.
3. Dengan mutex: `readData()`.

Tujuan:

- Radio A dan Radio B bisa menunggu paket secara paralel.
- Tidak ada radio yang mengunci SPI saat hanya menunggu udara.

## 18. Config Parameters (Config struct)

Routing:

| Field | Tipe | Fungsi |
| --- | --- | --- |
| `clusterId` | `uint16_t` | ID cluster head |
| `parentId` | `uint16_t` | Parent utama |
| `parentIdAlt` | `uint16_t` | Parent alternatif |
| `gatewayId` | `uint16_t` | ID gateway/root |

Timing:

| Field | Fungsi |
| --- | --- |
| `downlinkWindowMs` | Durasi window node untuk downlink |
| `parentHealthIntervalMs` | Rekomendasi v3 untuk heartbeat |
| `parentDeadRescanMs` | Rekomendasi v3 untuk rediscovery |

SPI pins:

- `spiSck`
- `spiMiso`
- `spiMosi`

STAR radio:

- `starFreq`
- `starSf`
- `starBw`
- `starSyncWord`

MESH radio:

- `meshFreq`
- `meshSf`
- `meshBw`
- `meshSyncWord`

Buffer:

- `bufferMaxRecords`
- `maxBulkChunkBytes`

Battery:

- `batteryMonitorPin`
- `batteryThresholdMv`
- `batteryDividerRatio`

Charger:

- `chargerStat1Pin`
- `chargerStat2Pin`

LED:

- `activityLedPin`

Runtime config JSON:

```json
{"clusterId":1,"parentId":0,"parentIdAlt":0,"gatewayId":0,"starFreq":915000000,"meshFreq":915000000}
```

Partial update harus didukung.

## 19. Failure Handling

STAR failure:

- CRC invalid: drop.
- Duplicate seq: drop.
- ACK gagal dikirim: node akan retry.
- Downlink gagal: payload dapat disimpan sampai uplink berikutnya.

MESH failure:

- Alarm gagal: retry, failover parent, rediscovery jika perlu.
- Bulk gagal: data normal tetap di buffer.
- Parent mati: switch parent alternatif.
- Semua parent mati: `CH_CONFIG` ulang.
- Tidak ada parent: mode `DEGRADED_BUFFER_ONLY`.

Storage failure:

- Jika RAM buffer penuh, drop oldest atau batasi per node.
- Jika persistent storage gagal, fallback ke RAM dan kirim alarm fault CH.

## 20. Boot Sequence

Urutan boot:

1. Start Serial.
2. Load config NVS.
3. Jika tidak ada config, gunakan default.
4. Register persist callback.
5. Init pin radio A dan B.
6. Init battery ADC, BQ25185 status pin, LED.
7. Init shared SPI.
8. Init Radio A STAR.
9. Init Radio B MESH.
10. Set kedua radio RX.
11. Jika gateway, skip `CH_CONFIG`.
12. Jika bukan gateway, jalankan `CH_CONFIG`.
13. Simpan parent hasil discovery.
14. Start FreeRTOS tasks.
15. Kirim `CH_HELLO`.
16. Loop serial config.

## 21. Battery Monitor & BQ25185 Charger (Solar + Li-ion 18650)

Battery monitor:

- Pin IO4.
- Pembagi 200k/100k.
- `Vin = Vadc x 3`.
- Default threshold: 3200 mV.

BQ25185:

| STAT1 | STAT2 | Status |
| --- | --- | --- |
| HIGH | HIGH | Charge complete / sleep |
| HIGH | LOW | Charging in progress |
| LOW | HIGH | Recoverable fault |
| LOW | LOW | Non-recoverable fault |

Housekeeping:

- Cek charger tiap 1 detik.
- Cek battery tiap 60 detik.
- Jika battery rendah, kirim alarm CH type `0x01`.
- Jika charger fault, kirim alarm CH type `0x02`.
- Throttle alarm power minimal 5 menit.

Payload alarm CH:

Battery low:

```text
type(1)=0x01
voltage_mV(2)
stat1(1)
stat2(1)
```

Charger fault:

```text
type(1)=0x02
stat1(1)
stat2(1)
```

Alarm CH dikirim sebagai `CH_DATA_UP + FLAG_ALARM` dengan `node_id = 0`.

## 22. Activity LED (IO19, Active LOW)

LED active LOW:

- LOW = ON.
- HIGH = OFF.

Pola blink:

| Durasi | Event |
| --- | --- |
| 50 ms | STAR RX/TX, MESH RX |
| 150 ms | MESH TX, forward, CH_CONFIG_RESPONSE |
| 300 ms | CH_HELLO, CH_CONFIG_REQUEST, alarm battery/charger |

Blink harus non-blocking. Housekeeping update LED tiap 50 ms.

## 23. System Characteristics

Karakter sistem:

- Data normal hemat bandwidth.
- Alarm latency rendah.
- Node battery hemat energi.
- Node external power mendukung monitoring kontinu.
- CH tetap menerima node saat mesh failover.
- Server mengontrol kapan mengambil data normal.
- Downlink targeted, bukan broadcast.
- Routing tree mendukung banyak CH.
- Failover parent meningkatkan ketahanan lapangan.

## 24. Gateway (Single LoRa + MQTT)

Gateway memakai satu radio LoRa pada konfigurasi MESH.

Fungsi:

- RX LoRa mesh.
- Publish raw frame ke MQTT.
- Subscribe downlink MQTT.
- TX LoRa mesh untuk frame dari server.
- Menjawab `CH_CONFIG_REQUEST` sebagai root.

Topic:

```text
uplink:   dualLoRa/gw/{gatewayId}/uplink
downlink: dualLoRa/gw/{gatewayId}/downlink
```

Config gateway:

- `gatewayId`
- `mqttBroker`
- `mqttPort`
- `mqttUser`
- `mqttPass`
- `mqttClientId`
- `meshFreq`

Satu server dapat memakai banyak gateway dengan `gatewayId` berbeda.

## 25. Software Library Structure

Komponen:

| Komponen | Fungsi |
| --- | --- |
| `DualLoRaClusterHead` | Logic utama CH |
| `IRadioDriver` | Interface radio |
| `RadioLibDriver` | Implementasi SX1262/E22 via RadioLib |
| `ConfigManager` | Load/save NVS dan Serial JSON |
| `Frame/AppFrame` | Encode/decode frame dan CRC |
| `Storage/RingBuffer` | Buffer data normal |
| `DownlinkStore` | Pending downlink node |
| `MeshQueue` | Queue alarm dan bulk |

API publik:

- `begin(cfg, starDriver, starPins, meshDriver, meshPins)`
- `poll()`
- `enqueueDownlink(nodeId, payload)`
- `updateConfig(cfg)`
- `getConfig()`
- Rekomendasi v3: `rediscoverParent()`

Driver API:

- `begin(pins, spi, spiMutex, rfConfig)`
- `setRxMode()`
- `setTxMode()`
- `setSleep()`
- `send(data, len)`
- `receive(buf, maxLen, timeoutMs)`
- `setFrequency(freqHz)`

