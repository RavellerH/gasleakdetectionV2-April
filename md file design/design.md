# Gas Leak Detector - Design Document

## 1. Document Control

| Aspek | Keterangan |
|-------|-----------|
| Versi | 1.6.3 |
| Tanggal | 2026-05-10 |
| Author | Design Team |
| Status | Draft |
| Catatan | Audit final: signal names lengkap di s8.1 diagram, s8.2 tabel, s11 step 5/7, s16.2 — CS_ADC, CS_LORA, BUSY_LORA konsisten di seluruh dokumen. |

---

## 2. Table of Contents

- 1. Document Control
- 2. Table of Contents
- 3. Introduction
- 4. Scope and Goals
- 5. Target Board
  - 5.1 Ringkasan Hardware
  - 5.2 Peripheral Support
  - 5.3 Sensor List
  - 5.4 Sensor Channel Mapping
- 6. Pin Mapping (Authoritative)
  - 6.1 I2C Pins
  - 6.2 SPI Pins (Shared Bus)
  - 6.3 ADS1256 Analog Input Pins
  - 6.4 Digital Pins
  - 6.5 UART Pins
  - 6.6 GPIO Final Mapping (Grouped)
  - 6.7 ADS1256 SPI Control Pins
- 7. I/O Mapping and Interface Circuits
  - 7.1 Analog Input Interfaces
    - 7.1.1 Battery Monitoring Circuit (BATMON)
    - 7.1.2 VREF Circuit (ADR03 + LM321 Buffer)
    - 7.1.3 AGND Virtual Ground Circuit (OPA333)
  - 7.2 Digital Input Interfaces
    - 7.2.1 Config Input Circuit (CFG)
    - 7.2.2 Power Good Input Circuit (PG24)
  - 7.3 Digital Output Interfaces
    - 7.3.1 DC Fan Control Circuit (DCFAN)
    - 7.3.2 Lamp Control Circuit (LAMP)
    - 7.3.3 Buzzer Control Circuit (BUZZER)
    - 7.3.4 Status LED Circuit (LED)
  - 7.4 Power System Architecture
    - 7.4.1 Input Source Selection (J1)
    - 7.4.2 Battery Supply Path
    - 7.4.3 External 5V Supply Path
    - 7.4.4 External 24V Supply Path
    - 7.4.5 Rail Distribution and TPL5110 Behavior
- 8. System Architecture
  - 8.1 Block Diagram
  - 8.2 Component Interaction
- 9. Software Modules
  - 9.1 Firmware Modules
  - 9.2 Folder Structure
- 10. Operating Modes
  - 10.1 Firmware Stages Overview
  - 10.2 Stage Permission by Power Mode
  - 10.3 Battery Inference Stage Flow
- 11. Boot Sequence
- 12. Runtime Scheduler
  - 12.1 Task Intervals
  - 12.2 Stage Timing Overview
- 13. Sensor Acquisition Pipeline
  - 13.1 ADS1256 Driver Design
  - 13.2 Output Format
  - 13.3 Count-to-Voltage Conversion
  - 13.4 AGC Strategy
  - 13.5 Voltage After Gain Compensation
  - 13.6 FilterManager
  - 13.7 Data Structures
- 14. Auto Nulling / Setup Calibration
  - 14.1 Tujuan
  - 14.2 Prinsip Nulling
  - 14.3 Algoritma Nulling
  - 14.4 Nulling Config
  - 14.5 Nulling Process Per Channel
  - 14.6 Data Structures
  - 14.7 Success / Failure Criteria
  - 14.8 Contoh Log
- 15. Machine Learning Pipeline
  - 15.1 Tujuan
  - 15.2 Power Policy
  - 15.3 Inference Process
  - 15.4 AI Runtime
  - 15.5 Feature Vector
  - 15.6 Data Structures
  - 15.7 Alarm Rule
- 16. Communication Design
  - 16.1 I2C
  - 16.2 SPI
  - 16.3 UART
    - 16.3.1 CH340C USB-UART Bridge Circuit
    - 16.3.2 Auto-Reset Circuit (UMH3NTN)
  - 16.4 RS-485 / Modbus RTU
  - 16.5 MQTT
- 17. LoRa Protocol
  - 17.1 LoRa Decision
  - 17.2 RadioLib Object
  - 17.3 LoRa Config
  - 17.4 Payload Format
- 18. Persistent Configuration
  - 18.1 EEPROM Structure
  - 18.2 EEPROM Memory Map
  - 18.3 Default Values
- 19. Serial Console Commands
  - 19.1 Command List
- 20. State Machine
  - 20.1 High-Level Flow
  - 20.2 Nulling Stage States
  - 20.3 Dataset Generation States
  - 20.4 Inference States
- 21. Safety, Failsafe, and Alarms
  - 21.1 Alarm Conditions
  - 21.2 Failsafe Logic
  - 21.3 Safety Rules
- 22. Timing Budget
  - 22.1 Total Cycle Time
- 23. Error Handling and Recovery
  - 23.1 Error Matrix
  - 23.2 Recovery Strategy
- 24. Logging Format
  - 24.1 Format Log
  - 24.2 Boot Logging
  - 24.3 Nulling Logging
  - 24.4 Inference Cycle Logging
- 25. SPI / I2C Bus Rules
  - 25.1 I2C Bus Rules
  - 25.2 SPI Bus Rules
  - 25.3 Bus Timing
- 26. Verification Plan
  - 26.1 Hardware Verification
  - 26.2 Software Verification
  - 26.3 System Verification
- 27. Limitations
- 28. Future Work
- 29. Appendix
  - A. Constants and Default Values
  - B. Library Dependencies
  - C. References

---

## 3. Introduction

### 3.1 Tujuan Proyek

Firmware ini dibuat untuk mendeteksi indikasi kebocoran gas menggunakan **8 jenis sensor MQ**. Sistem akan membaca sensor secara berkala, melakukan filtering dan kalibrasi, lalu menerapkan **inferensi model AI** yang sebelumnya sudah dibangun.

Apabila hasil inferensi menunjukkan kondisi berbahaya atau alarm, firmware akan mengaktifkan **alarm visual berupa lampu** dan **alarm suara berupa buzzer**. Selain itu, hasil inferensi model AI dan status perangkat akan dikirimkan ke **cluster head menggunakan LoRa**.

### 3.2 System Overview

```text
8x MQ Sensor Bridge
        ↓
INA333 Instrumentation Amplifier, gain 1x, per channel
        ↓
ADS1256 24-bit ADC, 8-channel single-ended
        ↓
ESP32-S3
        ↓
Filtering + Calibration + Feature Extraction
        ↓
TensorFlow Lite Micro Inference
        ↓
Alarm Lamp + Buzzer + LoRa Transmission
```

Nulling path:

```text
ESP32-S3
   ↓ I2C
TCA9548A I2C Multiplexer
   ↓
8x MCP4725 DAC
   ↓
INA333 REF / bridge nulling control
```

Power path:

```text
External 24VDC → Buck Converter → 5V Rail

Lithium Battery → TPL5110 → Boost Converter → 5V Rail
```

---

## 4. Scope and Goals

### 4.1 In Scope

- Desain hardware PCB gas leak detector dengan 8-channel MQ sensor array
- Firmware ESP32-S3 mencakup tiga stage: Nulling, Dataset Generation, dan Inference
- Auto-nulling otomatis per channel via MCP4725 DAC melalui TCA9548A I2C mux
- Pipeline akuisisi sinyal: INA333 → LM321 → ADS1256 24-bit ADC
- Klasifikasi jenis gas menggunakan model Neural Network (TensorFlow Lite Micro) yang dijalankan secara lokal di perangkat (edge computing / on-device inference)
- Komunikasi telemetri via LoRa E22-900MM22S (SX1262)
- Komunikasi Modbus RTU via RS-485 (THVD1410DR)
- Monitoring tegangan baterai dan manajemen daya (TPL5110)

### 4.2 Out of Scope

- Cloud backend atau server penerima data LoRa
- Mobile app atau dashboard monitoring
- Training model AI (dilakukan di lingkungan Python/Keras di luar firmware)

### 4.3 Goals

- Mendeteksi kebocoran gas dan mengklasifikasikan jenis gas menggunakan model AI secara on-device (edge computing) tanpa ketergantungan koneksi cloud
- Auto-nulling berjalan otomatis tanpa kalibrasi manual oleh user
- Sistem dapat beroperasi pada salah satu sumber daya: external 24VDC atau baterai
- Konsumsi daya minimal saat mode baterai (hanya stage Inference yang diizinkan)

---

## 5. Target Board

### 5.1 Ringkasan Hardware

| Parameter | Nilai |
|-----------|-------|
| Microcontroller | ESP32-S3-WROOM-1U-N16R8 |
| Clock Speed | 240 MHz (dual-core) |
| RAM | 512 KB SRAM + 8 MB PSRAM |
| Flash | 16 MB QSPI Flash |

### 5.2 Peripheral Support

- SPI (shared: ADS1256 ADC + E22-900MM22S LoRa)
- I2C (ESP32 → TCA9548A Mux → 8× MCP4725 DACs on channels 0-7)
- UART0 (CH340C USB debug console, 115200 baud)
- UART2 (THVD1410DR RS-485 Modbus, 9600 baud)
- ADC internal (BATMON on IO4)
- GPIO digital inputs (CFG, PG24, BUSY_LORA, DIO1_LORA, DRDY, UMH3NTN)
- GPIO digital outputs (DCFAN, LAMP, BUZZER, LED, CS_ADC, RESET_LORA, RXEN, TXEN, PDOWN, DIR, DONE)
- Wi-Fi 2.4 GHz (ESP32-S3 built-in; digunakan saat Dataset Generation Stage untuk MQTT ke broker lokal)
- ADC external (ADS1256 24-bit, 8-ch via SPI, AIN0-AIN7)
- Instrumentation amplifiers (8x INA333: U2/U3/U9/U13/U17/U21/U25/U29 for differential MQ sensor signal conditioning)
- Op-amp buffers (8x LM321: U4/U5/U10/U14/U18/U22/U26/U30 for MQ sensor signal conditioning)
- DAC references (8x MCP4725 via TCA9548A channels 0-7; address MCP4725 = 0x60 after channel select on TCA9548A = 0x71)

### 5.3 Sensor List

| Channel | Sensor | Fungsi Umum                      |
| ------: | ------ | -------------------------------- |
|       0 | MQ2    | LPG, methane, propane, smoke     |
|       1 | MQ3    | Alcohol, ethanol, VOC            |
|       2 | MQ4    | Methane, CNG                     |
|       3 | MQ5    | Natural gas, LPG                 |
|       4 | MQ6    | LPG, butane                      |
|       5 | MQ7    | Carbon monoxide                  |
|       6 | MQ8    | Hydrogen                         |
|       7 | MQ135  | Air quality, benzene, smoke, VOC |

> Sensor MQ tidak digunakan untuk klaim identifikasi gas absolut secara rule-based. Klasifikasi utama dilakukan oleh model AI berdasarkan pola respons 8 sensor.

### 5.4 Sensor Channel Mapping

| Posisi Board | Sensor Channel | MQ Sensor | INA333     | TCA9548A CH (MCP4725) | ADS1256 Input |
| -----------: | -------------: | --------- | ---------- | --------------------- | ------------- |
|            1 |            CH0 | MQ2       | INA333_CH0 | TCA_CH7               | AIN0          |
|            2 |            CH1 | MQ3       | INA333_CH1 | TCA_CH6               | AIN1          |
|            3 |            CH2 | MQ4       | INA333_CH2 | TCA_CH5               | AIN2          |
|            4 |            CH3 | MQ5       | INA333_CH3 | TCA_CH4               | AIN3          |
|            5 |            CH4 | MQ6       | INA333_CH4 | TCA_CH3               | AIN4          |
|            6 |            CH5 | MQ7       | INA333_CH5 | TCA_CH2               | AIN5          |
|            7 |            CH7 | MQ135     | INA333_CH7 | TCA_CH0               | AIN7          |
|            8 |            CH6 | MQ8       | INA333_CH6 | TCA_CH1               | AIN6          |

> Posisi Board adalah urutan fisik sensor di PCB, berputar searah jarum jam. Kolom TCA9548A CH menunjukkan channel mux yang di-select saat firmware mengakses MCP4725 untuk nulling channel tersebut. Mapping tidak linear — gunakan lookup table, bukan formula matematis.

Layout fisik sensor pada PCB (tampak atas, searah jarum jam):

```text
  [8] MQ8      MQ2 [1]
[7] MQ135         MQ3 [2]

  [6] MQ7         MQ4 [3]
    [5] MQ6    MQ5 [4]
```

---

## 6. Pin Mapping (Authoritative)

> Mapping ini WAJIB diikuti. Sumber: dokumen wiring board yang telah diverifikasi.

### 6.1 I2C Pins

| Pin | GPIO | Fungsi | Notes |
|-----|------|--------|-------|
| SDA | IO8 | I2C Data | Pull-up R97 10kΩ ke VCC (3.3V) |
| SCL | IO9 | I2C Clock | Pull-up R98 10kΩ ke VCC (3.3V), 400 kHz |

### 6.2 SPI Pins (Shared Bus)

| Pin | GPIO | Fungsi | Notes |
|-----|------|--------|-------|
| MOSI | IO11 | Serial In | Shared bus |
| MISO | IO13 | Serial Out | Shared bus |
| SCK | IO12 | Clock | Shared bus |
| CS_ADC | IO47 | Chip Select ADS1256 | Active LOW |
| CS_LORA | IO15 | Chip Select LoRa E22 | Active LOW |

### 6.3 ADS1256 Analog Input Pins

> ADS1256 (U35) 24-bit 8-channel ADC via SPI shared bus. Setiap AINx dilindungi oleh resistor seri 49.9Ω dan kapasitor filter 100nF ke GND. Clock: 8 MHz external crystal (U39). AINCOM = GND (single-ended mode).

| Pin | ADS1256 Pin | Fungsi | Notes |
|-----|-------------|--------|-------|
| AIN0 | Pin 6 | MQ Sensor Channel 0 | Via INA333 U2 + LM321 U5 → R65 49.9Ω → AIN0, C41 100nF ke GND |
| AIN1 | Pin 7 | MQ Sensor Channel 1 | Via INA333 U3 + LM321 U4 → R66 49.9Ω → AIN1, C42 100nF ke GND |
| AIN2 | Pin 8 | MQ Sensor Channel 2 | Via INA333 U9 + LM321 U10 → R67 49.9Ω → AIN2, C43 100nF ke GND |
| AIN3 | Pin 9 | MQ Sensor Channel 3 | Via INA333 U13 + LM321 U14 → R68 49.9Ω → AIN3, C47 100nF ke GND |
| AIN4 | Pin 10 | MQ Sensor Channel 4 | Via INA333 U17 + LM321 U18 → R69 49.9Ω → AIN4, C48 100nF ke GND |
| AIN5 | Pin 11 | MQ Sensor Channel 5 | Via INA333 U21 + LM321 U22 → R70 49.9Ω → AIN5, C49 100nF ke GND |
| AIN6 | Pin 12 | MQ Sensor Channel 6 | Via INA333 U25 + LM321 U26 → R71 49.9Ω → AIN6, C50 100nF ke GND |
| AIN7 | Pin 13 | MQ Sensor Channel 7 | Via INA333 U29 + LM321 U30 → R72 49.9Ω → AIN7, C44 100nF ke GND |
| AINCOM | Pin 5 | Analog Input Common | Terhubung ke GND — mode single-ended |
| VREFP | Pin 4 | Reference Voltage Positive | ADR03 2.5V precision reference (U38 via buffer U37) |
| VREFN | Pin 3 | Reference Voltage Negative | GND |

### 6.4 Digital Pins

**Digital Inputs**

| Pin | GPIO | Fungsi | Notes |
|-----|------|--------|-------|
| CFG | IO16 | Config Button Input | Pull-up 10k ke VCC, switch ke GND (active low) |
| PG24 | IO45 | Power Good Monitor | Open-drain dari buck regulator, pull-up 100k (active high) |
| BUSY_LORA | IO7 | LoRa Busy Indicator | E22-900MM22S BUSY pin (active high) |
| DIO1_LORA | IO40 | LoRa IRQ | E22-900MM22S DIO1 pin (rising edge: RX done, TX done) |
| DRDY | IO10 | ADC Data Ready | ADS1256 DRDY pin, pulled up (active LOW) |
| UMH3NTN | IO0 | UMH3NTN Sensor | UMH3NTN kaki C2 |

**Digital Outputs**

| Pin | GPIO | Fungsi | Notes |
|-----|------|--------|-------|
| LAMP | IO1 | Lamp/LED Control | ULN2003, active LOW |
| BUZZER | IO2 | Buzzer/Alarm Control | ULN2003, active LOW |
| LED | IO41 | Status LED Control | VCC -> LED -> R93 2k -> IO41 (active LOW sink) |
| DCFAN | IO42 | DC Fan Control | ULN2003, active LOW |
| CS_LORA | IO15 | LoRa Chip Select | E22-900MM22S NSS pin (active low) |
| RESET_LORA | IO39 | LoRa Reset | E22-900MM22S NRST pin (active low) |
| RXEN | IO5 | LoRa RX Enable | E22-900MM22S RXEN pin |
| TXEN | IO6 | LoRa TX Enable | E22-900MM22S TXEN pin |
| PDOWN | IO18 | ADC Sync/Power Down | ADS1256 SYNCPDWN pin (active LOW) |
| DIR | IO19 | RS-485 Direction | THVD1410DR DE/RE pin (HIGH=TX, LOW=RX) |
| DONE | IO14 | TPL5110 Power Timer Handshake | Output DONE dari ESP32 ke pin DONE TPL5110 (assert HIGH untuk mengakhiri siklus aktif) |
| CS_ADC | IO47 | ADS1256 Chip Select | SPI CS ADS1256 (active LOW); juga tercantum di s6.2 |

### 6.5 UART Pins

| UART | TX Pin | RX Pin | Direction/Other | Fungsi | Baud Rate | Notes |
|------|--------|--------|-----------------|--------|-----------|-------|
| UART0 | IO44 | IO43 | - | USB Debug Console (CH340C) | 115200 | Built-in USB-UART bridge |
| UART2 | IO21 | IO20 | IO19 (DIR) | RS-485 Modbus (THVD1410DR) | 9600 | Half-duplex, DIR (DE/RE) shared |

### 6.6 GPIO Final Mapping (Grouped)

**Input Signals**

| Signal | GPIO | Type | Active Level | Interface/Circuit |
|--------|------|------|--------------|-------------------|
| BATMON | IO4 | ADC Input | - | Divider 200k/100k + C 100nF, faktor x3 |
| CFG | IO16 | Digital Input | LOW | Pull-up 10k ke VCC, switch ke GND |
| PG24 | IO45 | Digital Input | HIGH | Open-drain dari LMR51450, pull-up 100k |
| BUSY_LORA | IO7 | Digital Input | HIGH | LoRa E22 module busy indicator |
| DIO1_LORA | IO40 | Digital Input | Rising edge | LoRa IRQ (RX done, TX done) |
| DRDY | IO10 | Digital Input | LOW | ADS1256 data ready, pulled up |
| UMH3NTN | IO0 | Digital Input | - | UMH3NTN sensor kaki C2 |

**Output Signals**

| Signal | GPIO | Type | Active Level | Interface/Circuit |
|--------|------|------|--------------|-------------------|
| LAMP | IO1 | Digital Output | LOW | ULN2003 low-side switch |
| BUZZER | IO2 | Digital Output | LOW | ULN2003 low-side switch |
| LED | IO41 | Digital Output | LOW | VCC -> LED -> R93 2k -> IO41 (sink) |
| DCFAN | IO42 | Digital Output | LOW | ULN2003 low-side switch |
| CS_LORA | IO15 | Digital Output | LOW | LoRa E22 SPI chip select |
| RESET_LORA | IO39 | Digital Output | LOW | LoRa E22 module reset |
| RXEN | IO5 | Digital Output | HIGH | LoRa E22 RX enable |
| TXEN | IO6 | Digital Output | HIGH | LoRa E22 TX enable |
| PDOWN | IO18 | Digital Output | LOW | ADS1256 SYNCPDWN |
| DIR | IO19 | Digital Output | HIGH | RS-485 DE/RE (HIGH=TX, LOW=RX) |
| DONE | IO14 | Digital Output | HIGH | Handshake ESP32 ke TPL5110 DONE untuk memutus siklus timer/power |
| CS_ADC | IO47 | Digital Output | LOW | SPI chip select ADS1256 (active LOW); juga tercantum di s6.2 |

**I2C Bus (Shared)**

| Signal | GPIO | Type | Notes |
|--------|------|------|-------|
| SDA | IO8 | Open-drain I/O | Pull-up R97 10kΩ ke VCC (3.3V) |
| SCL | IO9 | Open-drain Output | Pull-up R98 10kΩ ke VCC (3.3V), 400 kHz |

**SPI Bus (Shared)**

| Signal | GPIO | Type | Notes |
|--------|------|------|-------|
| MOSI | IO11 | Digital Output | Shared bus |
| MISO | IO13 | Digital Input | Shared bus |
| SCK | IO12 | Digital Output | Shared bus |

**UART Interfaces**

| Signal | GPIO | Type | Notes |
|--------|------|------|-------|
| UART0_TX | IO44 | Digital Output | CH340C USB debug console, 115200 baud |
| UART0_RX | IO43 | Digital Input | CH340C USB debug console, 115200 baud |
| UART2_TX | IO21 | Digital Output | THVD1410DR RS-485 Modbus, 9600 baud |
| UART2_RX | IO20 | Digital Input | THVD1410DR RS-485 Modbus, 9600 baud |
| UART2_DIR | IO19 | Digital Output | THVD1410DR DE/RE, HIGH=TX, LOW=RX |

### 6.7 ADS1256 SPI Control Pins

> Pin kontrol ADS1256 di luar shared SPI bus (MOSI/MISO/SCK/CS).

| Pin | GPIO | Fungsi | Notes |
|-----|------|--------|-------|
| DRDY | IO10 | Data Ready | ADS1256 DRDY pin (pin 21), pulled up, active LOW interrupt |
| PDOWN | IO18 | Sync/Power Down | ADS1256 SYNCPDWN pin (pin 14), active LOW |

---

## 7. I/O Mapping and Interface Circuits

### 7.1 Analog Input Interfaces

#### 7.1.1 Battery Monitoring Circuit (BATMON)

##### 7.1.1.1 Circuit Topology

> Tegangan battery dipantau menggunakan voltage divider resistor di IO4 (BATMON). Pembacaan ADC harus dikalikan 3 untuk mendapatkan tegangan battery sebenarnya.

**Schematic:**
```
VBattery ----[200kΩ]---- BATMON(IO4) ----[100kΩ]---- GND
                               |
                             [C1]
                            100nF
                               |
                              GND
```

**Component Details:**
- R1 = 200 kΩ (Voltage divider high side)
- R2 = 100 kΩ (Voltage divider low side)
- C1 = 100 nF (Capacitive filter for noise reduction, parasitic capacitance handling)

##### 7.1.1.2 Voltage Divider Calculation

- R1 (VBattery to BATMON) = 200 kΩ
- R2 (BATMON to GND) = 100 kΩ
- Voltage Ratio = (R1 + R2) / R2 = 300 kΩ / 100 kΩ = 3
- **Conversion Formula:** `V_Battery = ADC_Value × (3.3V / 4095) × 3`

**Contoh Perhitungan:**

| Kondisi | ADC Reading | Perhitungan | V_Battery |
|---------|-------------|------------|-----------|
| Battery Full (4.2V) | 1737 | 1737 × (3.3/4095) × 3 | 4.20V |
| Battery Medium (3.6V) | 1489 | 1489 × (3.3/4095) × 3 | 3.60V |
| Battery Low (3.1V) | 1283 | 1283 × (3.3/4095) × 3 | 3.10V |
| Battery Empty (0V) | 0 | 0 × (3.3/4095) × 3 | 0V |

**Detail Perhitungan (contoh: ADC = 1737):**
```
Step 1: Konversi ADC count ke voltage
  V_ADC = 1737 × (3.3V / 4095)
  V_ADC = 1737 × 0.00080586
  V_ADC = 1.3998V

Step 2: Kalikan dengan divider ratio
  V_Battery = 1.3998V × 3
  V_Battery = 4.1994V ≈ 4.2V (full battery)
```

##### 7.1.1.3 Measurement Range

| Parameter | Nilai | Notes |
|-----------|-------|-------|
| Max Input Voltage (VBattery) | 4.2V | Lithium baterai (full charge) |
| Max ADC Voltage (IO4) | 1.4V | 4.2V / 3 = 1.4V max |
| ADC Bit Resolution | 12-bit | 0-4095 counts |
| Measurement Range | 0V - 4.2V | Full battery voltage range |
| Filter Capacitor (C1) | 100 nF | Noise filtering dan parasitic capacitance handling |

**Battery Level Classification:**

| Level | Voltage Range | Approx ADC Range |
|-------|---------------|------------------|
| Full | 3.9V - 4.2V | 1614 - 1737 |
| Medium | 3.5V - 3.7V | 1448 - 1531 |
| Low | <= 3.1V | <= 1283 |

##### 7.1.1.4 Software Implementation

- ADC pin: IO4
- Conversion: `voltage = raw_adc * 3.3 / 4095 * 3`
- Max voltage: 4.2V (Lithium battery full charge)
- Min voltage: 0V (depleted)
- Update interval: 5000 ms (sesuai Runtime Scheduler Section 12)
- Threshold untuk full battery: 3.9V - 4.2V
- Threshold untuk medium battery: 3.5V - 3.7V
- Threshold untuk low battery alert: <= 3.1V
- Threshold untuk critical battery: <= 3.0V (opsional, sesuai kebijakan BMS)

---

### 7.1.2 VREF Circuit (ADR03 + LM321 Buffer)

> Tegangan referensi 2.5V untuk ADS1256 VREFP dihasilkan oleh ADR03AKSZ (U38) yang di-buffer oleh LM321DTR (U37) dalam konfigurasi voltage follower.

**Schematic:**
```
+5VA --[U38 ADR03AKSZ]-- VOUT
                          |
                         [R76 10kΩ] ──── GND
                          |
              C53 10uF  C54 100nF  C55 100nF  (semua ke GND)
                          |
                    [U37 LM321 IN+]
                    [U37 LM321 IN-] ←── [U37 LM321 OUT]  (voltage follower)
                          |
                         [R74 49.9Ω]
                          |
                         VREF ──── ADS1256 VREFP (pin 4)
                          |
              C51 22uF  C56 100nF  (semua ke GND)
```

**Komponen:**

| Referensi | Nilai/Part | Fungsi |
|-----------|------------|--------|
| U38 | ADR03AKSZ-REEL7 | Precision voltage reference 2.5V |
| R76 | 10 kΩ | Load resistor pada output ADR03 |
| C53 | 10 µF | Decoupling input LM321 |
| C54, C55 | 100 nF | HF bypass input LM321 |
| U37 | LM321DTR(XBLW) | Op-amp buffer (unity gain / voltage follower) |
| R74 | 49.9 Ω | Seri output buffer untuk isolasi kapasitif beban |
| C51 | 22 µF | Bulk output filter VREF |
| C56 | 100 nF | HF bypass output VREF |

**Karakteristik:**
- VREF nominal = 2.5V (ADR03 typical output)
- Buffer LM321 dikonfigurasi sebagai unity-gain voltage follower (IN- dihubungkan ke OUT)
- R74 49.9Ω antara output buffer dan net VREF untuk menstabilkan op-amp jika beban kapasitif besar
- C51 22µF + C56 100nF pada VREF menjamin kestabilan tegangan referensi saat ADS1256 melakukan konversi

> Net `VREF` terhubung langsung ke ADS1256 VREFP (pin 4). VREFN = GND.

---

### 7.1.3 AGND Virtual Ground Circuit (OPA333)

> Sirkuit ini menghasilkan tegangan **AGND = 2.5V** (setengah supply 5VA) sebagai virtual analog ground. AGND digunakan sebagai tegangan referensi (REF pin) bagi seluruh INA333 agar dapat mengamplifikasi sinyal sensor yang berpusat di pertengahan supply.

**Schematic:**
```
+5VA ──[R78 10kΩ]──┬──[R79 10kΩ]── GND
                   │
            [U34 OPA333 IN+]
            [U34 OPA333 IN-] ←── [U34 OPA333 OUT] = AGND (2.5V)
                   │
            C67 10µF  C68 100nF  (ke GND)

+5VA ──[L1 100Ω ferrite]── +5V
                 │
        C62 100nF  C63 22µF  (ke GND)
```

**Komponen:**

| Referensi | Nilai/Part | Fungsi |
|-----------|------------|--------|
| U34 | OPA333AIDBVR | Zero-drift op-amp sebagai virtual AGND buffer |
| R78, R79 | 10 kΩ (masing-masing) | Voltage divider: +5VA/2 = 2.5V ke IN+ |
| C64 | 100 nF | Bypass pada supply op-amp |
| C67 | 10 µF | Bulk bypass pada output AGND |
| C68 | 100 nF | HF bypass pada output AGND |
| L1 | 100 Ω (ferrite bead) | Isolasi EMI antara +5VA domain sensor dan +5V domain digital |
| C62 | 100 nF | HF bypass setelah ferrite bead |
| C63 | 22 µF | Bulk bypass setelah ferrite bead |

**Prinsip Kerja:**
- R78/R79 membentuk voltage divider → 5VA × (10k / 20k) = **2.5V** di IN+
- OPA333 dikonfigurasi sebagai unity-gain buffer → AGND = 2.5V stabil
- Net AGND terdistribusi ke REF pin setiap INA333 (8 channel)
- Karena REF = 2.5V, INA333 dapat merepresentasikan sinyal diferensial ±2.5V dalam range output 0–5V → ADS1256 membaca 0–5V single-ended

> **Catatan kritis:** Net `AGND` dalam schematic adalah **2.5V DC**, bukan ground digital (GND = 0V). Keduanya berbeda — jangan hubungkan secara langsung. L1 ferrite bead memisahkan domain supply sensor (+5VA) dari supply digital (+5V) untuk meminimalkan crosstalk EMI.

---

### 7.2 Digital Input Interfaces

#### 7.2.1 Config Input Circuit (CFG)

##### 7.2.1.1 Circuit Topology

> Input `CFG` menggunakan GPIO `IO16` sebagai digital input dengan pull-up resistor 10k ohm ke VCC dan push button ke GND. Konfigurasi ini bersifat active low.

**Schematic:**
```
VCC
 |
[R80 10k]
 |
 +---- CFG (ESP32 IO16)
 |
[SW1 CONFIG]
 |
GND
```

##### 7.2.1.2 Input Logic

| Kondisi Tombol | IO16 Level | Logic CFG | Keterangan |
|----------------|------------|-----------|------------|
| Tidak ditekan | HIGH (VCC) | 1 | Default karena pull-up 10k |
| Ditekan | LOW (GND) | 0 | Active low, mode config trigger |

> **Active LOW Configuration**: tombol `CONFIG` dianggap aktif saat `IO16 = LOW`.

##### 7.2.1.3 Software Implementation

- GPIO: `IO16`
- Direction: Input
- Pull-up: External `10k` (R80)
- Switch: `SW1 CONFIG` ke GND
- Debounce: wajib di firmware (software debounce 20-50 ms)
- Trigger event: falling edge (HIGH -> LOW)

---

#### 7.2.2 Power Good Input Circuit (PG24)

##### 7.2.2.1 Circuit Topology

> Input `PG24` menggunakan GPIO `IO45` sebagai digital input untuk monitoring status power-good dari buck regulator LMR51450. Open-drain output dengan pull-up resistor 100k ohm ke VCC. Konfigurasi ini bersifat active high (HIGH = power good, LOW = power fault).

**Schematic:**
```
VCC
 |
[R84 100k Pull-up]
 |
 +---- PG24 (ESP32 IO45)
 |
[Open-drain output dari LMR51450]
 |
GND
```

##### 7.2.2.2 Input Logic

| Kondisi | IO45 Level | Logic PG24 | Keterangan |
|---------|------------|------------|-----------|
| Normal/Power Good | HIGH (VCC) | 1 | Buck regulator output stable |
| Power Fault | LOW (GND) | 0 | Buck regulator output out of spec atau faulty |

> **Active HIGH Configuration**: sinyal `PG24` dianggap aktif (power-good) saat `IO45 = HIGH`.

##### 7.2.2.3 Measurement Characteristics

| Parameter | Nilai | Notes |
|-----------|-------|-------|
| Signal Type | Open-drain output | Dari LMR51450 buck regulator |
| Pull-up Resistor | 100 kΩ | R84 ke VCC |
| Logic HIGH Voltage | ≈3.3V | VCC level (pulled to logic supply) |
| Logic LOW Voltage | ≈0V | GND (open-drain sink) |
| Fault Detection | Active LOW | IO45 = LOW indicates power fault |
| Response Time | <1 ms | LMR51450 PG response time |

**Power-Good States:**

| State | IO45 Level | Meaning | Action |
|-------|-----------|---------|--------|
| Power Good | HIGH | Buck 5V output within spec | Normal operation |
| Power Fault | LOW | Buck 5V output below threshold | Trigger alarm/logging |

##### 7.2.2.4 LMR51450 Buck Regulator Integration

The LMR51450 buck converter provides PG (Power Good) monitoring:
- **Input**: Vin from USB/charging source
- **Output**: 5V regulated supply (untuk ULN2003, peripherals)
- **PG Pin**: Open-drain output tied to IO45
  - HIGH ketika 5V output within spec (typically 4.75V - 5.25V)
  - LOW ketika 5V output falls below regulation atau regulator faulty
- **Pull-up**: R84 100kΩ to VCC (3.3V ESP32 supply)

##### 7.2.2.5 Software Implementation

- GPIO: `IO45`
- Direction: Input
- Pull-up: External `100k` (R84) to VCC
- Logic: Open-drain, active high (HIGH = power-good, LOW = fault)
- Debounce: Optional software debounce 5-10 ms (open-drain signal typically stable)
- Trigger event: falling edge (HIGH -> LOW) untuk fault detection
- Monitoring: Periodic polling atau interrupt-driven pada level change
- Usage: 
  - Detect power supply faults sebelum mereka affect system
  - Trigger failsafe shutdown jika 5V supply fails
  - Log fault events untuk diagnostics
  - Warn user via LED/Buzzer jika battery backup needed

---

### 7.3 Digital Output Interfaces

#### 7.3.1 DC Fan Control Circuit (DCFAN)

##### 7.3.1.1 Circuit Topology

> DC Fan dikontrol menggunakan GPIO IO42 ESP32 yang terhubung ke driver transistor ULN2003. Output ULN2003 mengendalikan terminal block yang power-nya dari 5V supply. Konfigurasi ini bersifat **active LOW** (IO42 = LOW untuk ON).

**Schematic:**
```
                                 ---------
                                 | O   O | (DCFAN)
   -----------GND------------------|   |---------------------5V
   |
 ULN2003 ← Low-side switch output
   |
 ESP32(IO42)
```

**Current Path (when IO42 = LOW):**
```
+5V → FAN Motor → ULN2003(O1) → GND
       (all series)
```

**Component Details:**
- ESP32 GPIO: IO42 (Digital Output)
- Driver IC: ULN2003 (Low-side switch)
  - Input: I1 (dari IO42)
  - Output: O1 (provides GND path for motor)
- Power Supply: 5V (connects to FAN positive terminal)
- Fan Motor: 5V DC (series dengan ULN2003 O1)

##### 7.3.1.2 ULN2003 Characteristics

| Parameter | Nilai | Notes |
|-----------|-------|-------|
| Input Logic Voltage | 0-5V | TTL/CMOS compatible |
| Input Current | 1-2 mA (typical) | Per channel |
| Output Voltage Drop | 0.6-1.0V @ rated current | Saturation voltage |
| Max Output Current | 500 mA | Per channel (absolute max 600mA) |
| Darlington Array | 7 channels | ULN2003A |

##### 7.3.1.3 Fan Operation

| Kondisi | IO42 Logic | ULN2003 O1 | Motor Voltage | Fan Status |
|---------|-----------|-----------|---------------|-----------|
| Off | HIGH (3.3V) | OPEN (high Z) | 0V (circuit open) | OFF |
| On | LOW (0V) | LOW (≈0.7V) | ≈4.3V (5V - 0.7V drop) | ON |

> **Active LOW Configuration**: IO42 = LOW untuk ON
> **Low-side switch**: ULN2003 O1 menghubungkan motor ke GND untuk complete circuit

##### 7.3.1.4 Software Implementation

- GPIO: IO42
- Output Type: Digital (ON/OFF)
- Logic Level: 3.3V TTL output (compatible dengan ULN2003 input)
- Power Supply: 5V DC (motor positive)
- Control Method: Low-side switching
- **Active Logic: ACTIVE LOW** (IO42 = LOW untuk motor ON, IO42 = HIGH untuk motor OFF)
- **Motor Voltage when ON: ~4.3V** (5V - 0.7V ULN2003 drop)

##### 7.3.1.5 Current Limiting & Protection

- Pull-up/Pull-down: Tidak ada resistor eksternal — IO42 terhubung langsung ke input ULN2003
- Diode Protection: ULN2003 memiliki clamp diode internal pada pin COM yang terhubung ke **+5V** untuk menyerap back-EMF beban induktif (motor DC fan)
- Current Limit: Dibatasi oleh rating ULN2003 per channel (maks 500 mA)

##### 7.3.1.6 Output Connectors (ULN2003)

ULN2003 (U44) menyediakan dua jalur output eksternal:

| Konektor | Tipe | Pin | Sinyal | Keterangan |
|----------|------|-----|--------|------------|
| CN1 | XH-2A-black (2-pin) | 1, 2 | O2 (LAMP), O1 (DCFAN) | Beban luar: lampu + fan |
| J2 | Header 4-pin (ALARM) | 1–4 | O3 (BUZZER), O4–O6 (NC) | Konektor alarm eksternal |

> CN1 adalah konektor 2-pin untuk beban utama (DCFAN, LAMP). J2 adalah header 4-pin alarm untuk koneksi buzzer atau indikator eksternal tambahan. Semua output bersifat low-side sink (active LOW dari sisi GPIO ESP32).

---

#### 7.3.2 Lamp Control Circuit (LAMP)

##### 7.3.2.1 Circuit Topology

> Lamp/LED dikontrol menggunakan GPIO IO1 ESP32 ke ULN2003 channel 2 (I2). Beban LAMP dipasang pada header 2-pin: satu pin ke +5V, satu pin ke output O2 (low-side sink). Konfigurasi ini bersifat **active LOW** (IO1 = LOW untuk ON).

**Schematic:**
```
                .----------------- Header 2-pin ----------------.
GND ---- ULN2003(O2) ----o                                   o---- +5V
                         |               (LAMP)              |
                         '-----------------------------------'

ULN2003(O2) <- low-side switch output
    |
ULN2003(I2)
    |
ESP32(IO1)
```

**Current Path (when IO1 = LOW):**
```
+5V -> LAMP -> ULN2003(O2) -> GND
```

**Component Details:**
- ESP32 GPIO: IO1 (Digital Output)
- Driver IC: ULN2003 Channel 2
  - Input: I2 (dari IO1)
  - Output: O2 (ke pin negatif beban di header)
- Power Supply: 5V (ke pin positif beban di header)
- Load: Lamp/LED

##### 7.3.2.2 Lamp Operation

| Kondisi | IO1 Logic | ULN2003 O2 | Load Voltage | Lamp Status |
|---------|-----------|-----------|--------------|-------------|
| Off | HIGH (3.3V) | OPEN (high Z) | 0V (circuit open) | OFF |
| On | LOW (0V) | LOW (≈0.7V) | ≈4.3V (5V - 0.7V drop) | ON |

> **Active LOW Configuration**: IO1 = LOW untuk lamp ON

##### 7.3.2.3 Software Implementation

- GPIO: IO1
- Output Type: Digital (ON/OFF)
- Logic Level: 3.3V TTL output
- Power Supply: 5V DC (Header slot 1)
- Control Method: Low-side switching
- **Active Logic: ACTIVE LOW**
- **Load Voltage when ON: ~4.3V**

---

#### 7.3.3 Buzzer Control Circuit (BUZZER)

##### 7.3.3.1 Circuit Topology

> Buzzer dikontrol menggunakan GPIO IO2 ESP32 ke ULN2003 channel 3 (I3). Beban buzzer dipasang pada header 2-pin: satu pin ke +5V, satu pin ke output O3 (low-side sink). Konfigurasi ini bersifat **active LOW** (IO2 = LOW untuk ON).

**Schematic:**
```
                .----------------- Header 2-pin ----------------.
GND ---- ULN2003(O3) ----o                                  o---- +5V
                         |              (BUZZER)             |
                         '-----------------------------------'

ULN2003(O3) <- low-side switch output
    |
ULN2003(I3)
    |
ESP32(IO2)
```

**Current Path (when IO2 = LOW):**
```
+5V -> BUZZER -> ULN2003(O3) -> GND
```

**Component Details:**
- ESP32 GPIO: IO2 (Digital Output)
- Driver IC: ULN2003 Channel 3
  - Input: I3 (dari IO2)
  - Output: O3 (ke pin negatif beban di header)
- Power Supply: 5V (ke pin positif beban di header)
- Load: Buzzer

##### 7.3.3.2 Buzzer Operation

| Kondisi | IO2 Logic | ULN2003 O3 | Load Voltage | Buzzer Status |
|---------|-----------|-----------|--------------|---------------|
| Off | HIGH (3.3V) | OPEN (high Z) | 0V (circuit open) | OFF (silent) |
| On | LOW (0V) | LOW (≈0.7V) | ≈4.3V (5V - 0.7V drop) | ON (sound) |

> **Active LOW Configuration**: IO2 = LOW untuk buzzer ON

##### 7.3.3.3 Software Implementation

- GPIO: IO2
- Output Type: Digital (ON/OFF) atau PWM (variable tone frequency)
- Logic Level: 3.3V TTL output
- Power Supply: 5V DC (Header slot 2)
- Control Method: Low-side switching
- **Active Logic: ACTIVE LOW**
- **Load Voltage when ON: ~4.3V**

#### 7.3.4 Status LED Circuit (LED)

##### 7.3.4.1 Circuit Topology

> LED status terhubung ke GPIO `IO41` dengan konfigurasi sink (active low): anoda LED ke VCC, katoda LED ke `IO41` melalui resistor `R93 2k`.

**Schematic:**
```
VCC ----|>|----[R93 2k]---- LED (ESP32 IO41)
```

##### 7.3.4.2 Output Logic

| Kondisi | IO41 Level | Arus LED | Status LED |
|---------|------------|----------|------------|
| OFF | HIGH / High-Z | Tidak mengalir | Mati |
| ON | LOW (sink to GND) | VCC -> LED -> R93 -> IO41 | Menyala |

> **Active LOW Configuration**: `IO41 = LOW` menyalakan LED, `IO41 = HIGH` mematikan LED.

##### 7.3.4.3 Software Implementation

- GPIO: `IO41`
- Direction: Output
- Logic: active low
- Current limiting: `R93 = 2k ohm`
- Rekomendasi boot default: set `HIGH` agar LED tidak menyala saat startup

---

### 7.4 Power System Architecture

> Sistem power menggunakan selector `J1` untuk memilih **satu** sumber daya aktif. Hanya satu posisi jumper yang boleh dipasang pada satu waktu agar tidak terjadi backfeed antar-sumber.

#### 7.4.1 Input Source Selection (J1)

`J1` adalah header `2x3` yang berfungsi sebagai power source selector. Konektor `CN2` menjadi titik masuk sumber daya eksternal/battery sesuai mode yang dipilih.

| Jumper J1 | Sumber Aktif | Net Terpilih | Regulator Utama | Hasil Akhir |
|-----------|--------------|--------------|-----------------|-------------|
| Pin 1-2 | Battery | `VBAT` | `U41 TPS61088` | `VBAT -> +5V -> U43 -> VCC` |
| Pin 3-4 | PSU 5V eksternal | `5VEXT` | `U43 TPS62162` | `+5V -> VCC` |
| Pin 5-6 | PSU 24V eksternal | Input ke `U36` | `U36 LMR51450` + `U43 TPS62162` | `24V -> +5V -> VCC` |

**Aturan Operasi J1:**
- Hanya **satu** posisi jumper yang boleh aktif.
- `CN2` dipakai sesuai mode sumber daya yang dipilih.
- Rail distribusi board tetap dibagi menjadi dua domain utama:
  - `+5V` untuk beban/peripheral 5V
  - `VCC` untuk domain logika 3.3V

**Intended Use per Source:**
- **Battery (J1 1-2):** Operasi lapangan tanpa sumber daya eksternal. Hanya stage Inference yang diizinkan.
- **PSU 5V Eksternal (J1 3-4):** Hanya untuk keperluan testing dan development di lab. Bukan untuk operasi produksi atau deployment.
- **PSU 24V Eksternal (J1 5-6):** Mode operasi utama produksi. Mendukung semua stage (Nulling, Dataset Generation, Inference).

#### 7.4.2 Battery Supply Path

Pada mode battery, `CN2` menerima battery sekitar `4.2V` dan `J1` harus dijumper pada pin `1-2` untuk memilih net `VBAT`.

**Power Path:**
```text
Battery @ CN2 -> J1 (1-2) -> VBAT -> U41 TPS61088 -> +5V -> U43 TPS62162 -> VCC (3.3V)
                                      |
                                      +-> U42 TPL5110 (VBAT domain)
```

**Behavior:**
- `U41 TPS61088` berfungsi sebagai boost converter dari `VBAT` ke rail `+5V`.
- Rail `+5V` kemudian digunakan untuk supply beban/peripheral 5V board.
- `U43 TPS62162` menurunkan `+5V` menjadi `VCC` 3.3V untuk ESP32 dan IC logika 3.3V.
- `U42 TPL5110` berada pada domain `VBAT` dan dipakai untuk mekanisme low-power timer / wake control.
- ESP32 memberikan sinyal `DONE` ke `TPL5110` melalui `IO14` untuk mengakhiri siklus aktif dan masuk ke fase sleep/power-gated sesuai behavior TPL5110.

**Komponen TPS61088 Boost Converter (U41):**

| Referensi | Nilai | Fungsi |
|-----------|-------|--------|
| L2 | 2.2 µH | Induktor boost |
| C74, C75 | 10 µF (masing-masing) | Input decoupling VBAT |
| C78, C79, C80 | 22 µF (masing-masing) | Output bulk cap +5V |
| C81 | 1 µF | HF bypass output |
| R88 | ~255 kΩ | Resistor FSW (sets switching frequency) |
| C84 | 47 nF | Bootstrap cap |
| D9 | Schottky | Rectifier diode output |

**Komponen TPL5110 Timer (U42):**

| Referensi | Nilai | Fungsi |
|-----------|-------|--------|
| R100 | 33 kΩ | Resistor pada pin DELAY/M_DRV — menentukan interval timer TPL5110 |
| Q4 | S8050 (NPN) | Transistor driver: DRV → R101 → base Q4 → collector Q4 → ENA signal |
| R101 | 10 kΩ | Resistor base Q4 S8050 |
| R102 | 100 kΩ | Pull-up ENA ke VBAT |
| R103 | 100 kΩ | Pull-down/divider pada jalur ENA/DONE |

> R100 33kΩ pada pin DELAY/M_DRV TPL5110 menentukan periode wake-up timer. Nilai 33kΩ menghasilkan interval tertentu sesuai kurva datasheet TPL5110. Q4 S8050 memediasi sinyal DRV TPL5110 ke jalur ENA yang mengontrol enable TPS61088 boost converter.

#### 7.4.3 External 5V Supply Path

Pada mode external 5V, `CN2` menerima PSU `5V` eksternal dan `J1` harus dijumper pada pin `3-4` untuk memilih net `5VEXT`.

**Power Path:**
```text
External 5V @ CN2 -> J1 (3-4) -> 5VEXT / +5V board -> U43 TPS62162 -> VCC (3.3V)
```

**Behavior:**
- Rail `+5V` board disuplai langsung dari sumber `5VEXT`.
- `U43 TPS62162` menghasilkan `VCC` 3.3V dari rail `+5V`.
- Semua IC 5V disuplai dari `+5V`, sedangkan ESP32 dan IC 3.3V disuplai dari `VCC`.
- Pada mode ini path battery boost `U41` tidak menjadi sumber utama sistem.

#### 7.4.4 External 24V Supply Path

Pada mode external 24V, `CN2` menerima PSU `24V` eksternal dan `J1` harus dijumper pada pin `5-6` agar jalur input masuk ke buck regulator `U36`.

**Power Path:**
```text
External 24V @ CN2 -> J1 (5-6) -> U36 LMR51450 -> 5VBUCK / +5V board -> U43 TPS62162 -> VCC (3.3V)
```

**Behavior:**
- `U36 LMR51450` menurunkan tegangan input `24V` menjadi rail `+5V`.
- Output buck `U36` menjadi sumber utama domain `+5V` board.
- `U43 TPS62162` kembali menurunkan `+5V` menjadi `VCC` 3.3V.
- Sinyal `PG24` berasal dari pin `PG` pada `U36` untuk memonitor status power-good buck regulator.

**Input Protection Circuit (sebelum LMR51450):**

Jalur VIN dari CN2/J1 dilindungi oleh rangkaian berikut sebelum masuk ke U36:

| Referensi | Komponen | Fungsi |
|-----------|----------|--------|
| D1, D2 | SMBJ33A (TVS diode) | Proteksi overvoltage transient pada jalur VIN |
| F1 | Fuse | Proteksi arus lebih (overcurrent protection) |
| Q3 | Si7465DP-T1-GE3 (P-channel MOSFET) | Reverse polarity protection / load switch |
| LBZT52C12T1G | Zener 12V | Pembatas tegangan gate Q3 |
| R81 | 100 kΩ | Resistor gate Q3 |
| D7 | Schottky | Rectifier / protection diode pada jalur 5VEXT |
| D8 | Schottky | Output rectifier 5VBUCK → +5V |
| C59, C60 | 10 µF (masing-masing) | Input decoupling VIN pada U36 |
| C61 | 100 nF | HF bypass VIN |
| C69 | 100 nF | Bootstrap cap U36 |

**Komponen TPS62162 Buck 3.3V (U43):**

| Referensi | Nilai | Fungsi |
|-----------|-------|--------|
| L3 | 2.2 µH | Induktor buck |
| C94 | 10 µF | Input decoupling +5V |
| C95, C96 | 22 µF (masing-masing) | Output bulk cap VCC 3.3V |
| R104 | 100 kΩ | Pull-down pada EN atau PG pin |

> Q3 Si7465DP (P-MOSFET) melindungi seluruh rangkaian terhadap pembalikan polaritas input. D1/D2 SMBJ33A menyerap transient tegangan tinggi (surges). F1 fuse memutus arus jika terjadi short-circuit.

#### 7.4.5 Rail Distribution and TPL5110 Behavior

Setelah source selection dan regulasi tegangan, distribusi rail sistem dapat diringkas sebagai berikut:

| Rail | Sumber | Fungsi |
|------|--------|--------|
| `VBAT` | Battery mode (`J1 1-2`) | Domain battery mentah untuk boost dan TPL5110 |
| `5VEXT` | External 5V mode (`J1 3-4`) | Sumber langsung rail 5V board |
| `5VBUCK` | External 24V mode via `U36` | Hasil buck 24V ke 5V |
| `+5V` | Dari `U41`, `5VEXT`, atau `U36` sesuai mode | Supply peripheral/beban 5V |
| `VCC` | Output `U43 TPS62162` | Supply ESP32 dan domain logika 3.3V |

**Ringkasan Peran IC Power:**
- `U41 TPS61088`: boost `VBAT -> +5V` saat mode battery
- `U36 LMR51450`: buck `24V -> +5V` saat mode external 24V
- `U43 TPS62162`: buck `+5V -> VCC 3.3V` untuk domain logika
- `U42 TPL5110`: timer/power control pada domain battery, handshake dengan `DONE`

> Implikasi desain: seluruh sistem akhirnya tetap memakai arsitektur dua rail, yaitu `+5V` untuk peripheral dan `VCC` untuk logika 3.3V, sementara `J1` hanya menentukan dari jalur mana rail `+5V` tersebut dibentuk.


## 8. System Architecture

### 8.1 Block Diagram

```text
  ┌──────────────────────────────────────────────────────────┐
  │                   8x MQ Sensor Array                     │
  │       MQ2  MQ3  MQ4  MQ5  MQ6  MQ7  MQ8  MQ135         │
  └─────────────────────────┬────────────────────────────────┘
                            │ analog signal (differential)
  ┌─────────────────────────▼────────────────────────────────┐
  │        8x INA333  +  8x LM321  (per channel)            │
  │     Instrumentation Amp gain 1x  +  Buffer Op-Amp       │
  └─────────────────────────┬──────────────────▲────────────┘
                            │ analog            │ REF (nulling)
  ┌─────────────────────────▼──────┐   ┌────────┴──────────┐
  │  ADS1256  24-bit  8-ch  SPI   │   │    8x MCP4725     │
  │  CS_ADC IO47 · DRDY IO10      │   │    DAC 12-bit     │
  └─────────────────────────┬──────┘   └────────▲──────────┘
                            │ SPI               │ I2C
  ┌─────────────────────────▼──────────────────┬┴────────────┐
  │                     ESP32-S3               │ TCA9548A    │
  │                   240 MHz                  │ I2C Mux     │
  │  ┌──────────┐  ┌─────────────────────────┐│ 0x71        │
  │  │   AGC    │  │     Moving Average       ││             │
  │  │ 64x/cycle│  │     10 sample / 1s       ││             │
  │  └──────────┘  └─────────────────────────┘│             │
  │  ┌─────────────────────────────────────┐  │             │
  │  │ FilterManager → FeatureExtractor    │  │             │
  │  │ → TFLite Micro Neural Network       │  │             │
  │  └────────────────────┬────────────────┘  │             │
  └───────────────────────┼────────────────────┴────────────┘
                          │
          ┌───────────────┼──────────────────┐
          │               │                  │
  ┌───────▼──────┐  ┌─────▼──────────┐  ┌───▼──────────────┐
  │ Lamp + Buzzer│  │ LoRa SX1262    │  │ RS-485 Modbus    │
  │  Active LOW  │  │ 920 MHz TX     │  │ THVD1410DR       │
  └──────────────┘  └────────────────┘  └──────────────────┘
```

### 8.2 Component Interaction

| Komponen A | Arah | Komponen B | Bus | Keterangan |
|---|---|---|---|---|
| ESP32-S3 | → | ADS1256 | SPI (IO11/12/13, CS_ADC IO47) | Baca ADC 8-channel, set PGA gain |
| ESP32-S3 | → | E22-900MM22S (SX1262) | SPI (IO11/12/13, CS_LORA IO15) | Kirim paket LoRa ke cluster head |
| ESP32-S3 | → | TCA9548A | I2C (IO8/IO9) | Pilih channel mux untuk akses MCP4725 |
| TCA9548A | → | MCP4725 x8 | I2C (addr 0x60) | Tulis DAC code untuk nulling INA333 REF |
| MCP4725 | → | INA333 REF | Analog | Output DAC kontrol offset INA333 |
| MQ Sensor | → | INA333 | Analog | Sinyal bridge sensor (differential) |
| INA333 | → | LM321 | Analog | Output amp → buffer |
| LM321 | → | ADS1256 AINx | Analog | Output buffer → ADC input |
| ADS1256 DRDY | → | ESP32-S3 IO10 | GPIO | Interrupt saat data ADC siap dibaca |
| E22-900MM22S BUSY | → | ESP32-S3 IO7 | GPIO | LoRa BUSY indicator (active HIGH) |
| ESP32-S3 IO14 | → | TPL5110 DONE | GPIO | Pulse untuk mengakhiri siklus timer baterai |
| ESP32-S3 IO45 | ← | LMR51450 PG | GPIO | Monitor power-good sinyal buck 24V |
| ESP32-S3 IO4 | ← | BATMON divider | ADC internal | Baca tegangan baterai |
| ESP32-S3 IO16 | ← | CFG button | GPIO | Input konfigurasi manual |
| ESP32-S3 IO21/20 | ↔ | THVD1410DR | UART2 | Komunikasi RS-485 Modbus RTU |

---

## 9. Software Modules

### 9.1 Firmware Modules

```text
SystemController
- Boot, hardware init, dan stage selection.

StageManager
- Mengatur stage aktif.

NullingStage
- Menjalankan proses bridge nulling.

DatasetGenerationStage
- Mengambil data dataset.

InferenceStage
- Menjalankan inferensi AI, alarm, LoRa, dan TPL5110 done.

ADS1256Driver
- Low-level SPI driver untuk ADS1256.
- Menghasilkan voltage after gain compensation.
- Mengelola high-sensitivity-first AGC.

I2CMuxDriver
- Memilih channel TCA9548A.

MCP4725Driver
- Menulis nilai DAC per channel.

MQSensorArrayManager
- Membaca dan mengelola 8 sensor MQ.

FilterManager
- Filtering data sensor.

CalibrationManager
- Baseline dan normalisasi.

FeatureExtractor
- Menyiapkan input tensor AI.

AIInferenceEngine
- TensorFlow Lite Micro wrapper.

AlarmManager
- Kontrol lampu dan buzzer.

LoRaManager
- Wrapper RadioLib, packet formatting, send, retry.

PowerManager
- Power mode, battery voltage, stage permission, TPL5110 DONE.

StorageManager
- Menyimpan DAC null code, baseline, dan konfigurasi.

CommandParser
- Serial command untuk stage control.

HealthMonitor
- Status ADC, DAC, LoRa, sensor, battery, dan AI inference.
```

### 9.2 Folder Structure

```text
gas-leak-detector-firmware/
├── DESIGN.md
├── README.md
├── platformio.ini
├── include/
│   ├── config.h
│   ├── board_pins.h
│   ├── sensor_types.h
│   ├── stage_types.h
│   ├── power_types.h
│   └── scaler_param.h
├── src/
│   ├── main.cpp
│   ├── app/
│   │   ├── SystemController.h / .cpp
│   │   ├── StageManager.h / .cpp
│   │   ├── CommandParser.h / .cpp
│   │   ├── AlarmManager.h / .cpp
│   │   └── HealthMonitor.h / .cpp
│   ├── stages/
│   │   ├── NullingStage.h / .cpp
│   │   ├── DatasetGenerationStage.h / .cpp
│   │   └── InferenceStage.h / .cpp
│   ├── drivers/
│   │   ├── ADS1256Driver.h / .cpp
│   │   ├── I2CMuxDriver.h / .cpp
│   │   └── MCP4725Driver.h / .cpp
│   ├── sensing/
│   │   └── MQSensorArrayManager.h / .cpp
│   ├── processing/
│   │   ├── FilterManager.h / .cpp
│   │   ├── CalibrationManager.h / .cpp
│   │   └── FeatureExtractor.h / .cpp
│   ├── ai/
│   │   ├── AIInferenceEngine.h / .cpp
│   │   └── model_data.h
│   ├── comms/
│   │   └── LoRaManager.h / .cpp
│   ├── power/
│   │   └── PowerManager.h / .cpp
│   └── storage/
│       └── StorageManager.h / .cpp
├── lib/
│   ├── RadioLib/               # LoRa E22-900MM22S (SX1262) library
│   ├── tflite-micro/           # TensorFlow Lite Micro runtime
│   ├── MCP4725/                # MCP4725 DAC driver
│   └── ADS1256/                # ADS1256 24-bit ADC driver
└── test/
    ├── test_nulling.cpp
    ├── test_filter.cpp
    ├── test_calibration.cpp
    ├── test_feature_extractor.cpp
    └── test_power_manager.cpp
```

> Library di folder `lib/` di-load secara lokal oleh PlatformIO — tidak mengunduh dari internet saat build. Setiap library disimpan lengkap beserta source dan header-nya.

---

## 10. Operating Modes

### 10.1 Firmware Stages Overview

Firmware memiliki tiga tahapan utama:

| Stage                    | Tujuan                                                    | Output Utama                          |
| ------------------------ | --------------------------------------------------------- | ------------------------------------- |
| Nulling Stage            | Menentukan DAC nulling code per sensor channel            | Nulling profile                       |
| Dataset Generation Stage | Mengambil data sensor untuk dataset training/validasi AI  | Dataset rows                          |
| Inference Stage          | Menjalankan model TensorFlow Lite Micro untuk deteksi gas | Label, confidence, alarm, LoRa packet |

### 10.2 Stage Permission by Power Mode

| Stage                    | External 24VDC Mode |             Battery Mode |
| ------------------------ | ------------------: | -----------------------: |
| Nulling Stage            |             Allowed |              Not allowed |
| Dataset Generation Stage |             Allowed |              Not allowed |
| Inference Stage          |             Allowed |                  Allowed |
| Serial Debug             |             Allowed |                  Limited |
| LoRa Transmission        |             Allowed |                  Allowed |
| Alarm Lamp/Buzzer        |             Allowed | Allowed, but power-aware |
| Wi-Fi / MQTT             |             Allowed |              Not allowed |

### 10.3 Battery Inference Stage Flow

```text
BOOT
  ↓
INIT_HARDWARE
  ↓
APPLY_STORED_NULLING_PROFILE
  ↓
SENSOR_WARMUP
  ↓
READ_BATTERY_VOLTAGE
  ↓
READ_SENSOR_ARRAY
  ↓
FILTER / MOVING_AVERAGE
  ↓
FEATURE_EXTRACT
  ↓
TFLITE_MICRO_INFERENCE
  ↓
ALARM_UPDATE
  ↓
LORA_TRANSMIT
  ↓
TPL5110_DONE
  ↓
POWER_OFF
```

> Battery inference stage tidak menjalankan nulling ulang. Memakai nulling profile yang sudah dibuat sebelumnya dalam external 24VDC mode.

---

## 11. Boot Sequence

```text
1.  Power ON — supply dari battery/external 5V/external 24V melalui J1
2.  ESP32-S3 ROM bootloader → load app partition dari 16 MB flash
3.  GPIO init — set arah dan default state semua pin:
        Outputs (default HIGH/OFF): CS_ADC IO47, CS_LORA IO15, RESET_LORA IO39,
                                    DCFAN IO42, LAMP IO1, BUZZER IO2, LED IO41,
                                    RXEN IO5, TXEN IO6, PDOWN IO18, DIR IO19
        Inputs: DRDY IO10, BUSY_LORA IO7, DIO1_LORA IO40, PG24 IO45,
                CFG IO16, UMH3NTN IO0, BATMON IO4 (ADC internal)
4.  SPI bus init — shared bus: MOSI IO11, SCK IO12, MISO IO13
5.  ADS1256 init (CS_ADC IO47) — VREF 2.5V, single-ended mode, gain 64×, datarate 10 SPS
6.  I2C bus init — SDA IO8, SCL IO9, 400 kHz
        Scan TCA9548A di alamat 0x71
7.  LoRa init (RESET_LORA IO39, CS_LORA IO15, BUSY_LORA IO7, DIO1_LORA IO40)
        Konfigurasi default: freq 920 MHz (LORA_FREQUENCY_MHZ, hardcoded), BW 125 kHz, SF9, CR 4/7, power 17 dBm, preamble 8
8.  UART2 init — TX IO21, RX IO20, DIR IO19, 9600 baud (RS-485 Modbus RTU)
9.  Baca EEPROM — verifikasi magic 0xDEADBEEF dan checksum CRC32
        Valid   → load idConfig (power mode, nulling profiles per channel)
        Invalid → gunakan default config, flag EEPROM_CORRUPT di log
10. Baca BATMON (IO4) — konversi ke tegangan baterai
        Jika ≤ 3.0V: pulse TPL5110 DONE (IO14), shutdown segera
11. Detect power mode dari idConfig.default_power_mode
        POWER_MODE_BATTERY / EXT_5V / EXT_24V
12. Tentukan firmware stage berdasarkan konfigurasi:
        Nulling Stage → Dataset Generation Stage → Inference Stage
13. Masuk ke stage yang dipilih
```

---

## 12. Runtime Scheduler

### 12.1 Task Intervals

| Task | Interval | Keterangan |
|------|----------|------------|
| ADC sampling (ADS1256) | ~100 ms | 10 sample/detik untuk moving average |
| Moving average output | 1000 ms | 1 data voltage per detik per channel |
| FilterManager update | 1000 ms | Dipicu setelah moving average selesai |
| Inference cycle | 1000 ms | 1 inference per detik di Inference Stage |
| Battery voltage read | 5000 ms | Baca BATMON via ADC internal IO4 |
| LoRa heartbeat | 30000 ms | Kirim status rutin meski tidak alarm |
| LoRa alarm TX | Segera | Dipicu langsung saat alarm aktif |
| Serial command handler | Event-driven | Diproses saat karakter diterima di UART0 |
| TPL5110 DONE pulse | Akhir siklus | Dikirim setelah inference + LoRa TX selesai |

### 12.2 Stage Timing Overview

```text
=== Nulling Stage ===
Per channel:
  Exponential search  : hingga ~10 langkah x settling time
  Binary search       : hingga ~10 langkah x settling time
  Confirmation        : 3x baca ADC
  Total per channel   : ~3–10 detik (tergantung sensor)
  Total 8 channel     : ~24–80 detik

=== Dataset Generation Stage ===
Sampling berjalan terus sampai user menghentikan via serial command.
Output 1 record/detik.

=== Inference Stage ===
ADC sample (10x)  : ~1 detik
Filter + Feature  : < 10 ms
TFLite inference  : < 100 ms
LoRa TX           : ~200–500 ms (async)
Total per siklus  : ~1.3–1.6 detik
```

---

## 13. Sensor Acquisition Pipeline

### 13.1 ADS1256 Driver Design

```text
ADC device        : ADS1256
Resolution        : 24-bit
Input mode        : Single-ended, 8 channel
Reference voltage : 2.5V
Vref source       : ADR03 precision reference
Output to firmware: Voltage, not raw ADC count
Sampling output   : 1 data per second after moving average
Moving average    : 10 samples
Gain mode         : High-sensitivity-first AGC
```

### 13.2 Output Format

```text
ADS1256 raw count
        ↓
count-to-voltage conversion
        ↓
gain compensation
        ↓
voltage value
```

### 13.3 Count-to-Voltage Conversion

```cpp
float ADS1256Driver::rawToVoltage(int32_t rawCount, uint8_t pgaGain) {
    return ((float)rawCount / 8388607.0f) *
           (ADS1256_VREF_VOLTS / (float)pgaGain);
}
```

> Konfigurasi terkonfirmasi dari schematic: AINCOM = GND (single-ended), VREFP = ADR03 2.5V, VREFN = GND. Formula di atas sudah final untuk konfigurasi ini.

### 13.4 AGC Strategy

INA333 dikonfigurasi dengan gain **1x**. Penguatan utama berada di **PGA ADS1256**.

AGC digunakan sebagai perlindungan dari saturasi — bukan pencarian gain dari bawah ke atas.

**Aturan utama:** Setiap siklus akuisisi baru **selalu dimulai dari gain 64x**. Tidak ada memori gain dari siklus sebelumnya.

```text
Setiap siklus baru:
  1. Set gain = 64x
  2. Baca ADC
  3. Jika saturasi → turunkan gain satu langkah, ulangi baca
  4. Jika tidak saturasi → gunakan nilai ini, selesai
  5. Siklus berikutnya → kembali ke langkah 1 (reset ke 64x)
```

Gain sequence (turun jika saturasi):

```text
64x → 32x → 16x → 8x → 4x → 2x → 1x
```

Per-stage gain policy:

```text
Nulling           : gain 64x (fixed, ADC hanya untuk deteksi perubahan delta)
Dataset Generation: mulai 64x setiap sample, turunkan jika saturasi
Inference         : mulai 64x setiap sample, turunkan jika saturasi
```

> Tidak pernah ada kondisi memulai dari gain selain 64x. Gain dari siklus sebelumnya tidak diwariskan ke siklus berikutnya.

### 13.5 Voltage After Gain Compensation

`rawToVoltage()` menghasilkan tegangan yang sudah dikompensasi terhadap gain PGA. Nilainya merepresentasikan tegangan aktual di input ADS1256 (output LM321 buffer), bukan tegangan yang diperkuat.

```text
voltage_after_gain_compensation = (rawCount / 8388607.0) × (VREF / pgaGain)
```

Contoh:
```text
rawCount = 4194303 (setengah full-scale)
pgaGain  = 64
VREF     = 2.5V

voltage = (4194303 / 8388607.0) × (2.5 / 64)
        = 0.5 × 0.039065
        = 0.01953 V  (~19.5 mV di input ADC)
```

Nilai inilah yang digunakan di moving average dan FilterManager — bukan raw count, karena gain bisa berbeda antar siklus.

### 13.6 FilterManager

FilterManager menerima output moving average (`voltage_after_gain_compensation`) dan menghasilkan nilai bersih untuk FeatureExtractor.

**Pipeline FilterManager:**

```text
voltage_after_gain_compensation (per channel, 1/detik)
        ↓
Outlier rejection (opsional — skip jika delta terlalu besar dari moving avg)
        ↓
Smoothing / additional low-pass (opsional)
        ↓
filtered_voltage (per channel)
        ↓
→ FeatureExtractor
```

**Interface:**

```cpp
class FilterManager {
public:
    void update(const SensorArrayVoltageReading& raw);
    float getFilteredVoltage(uint8_t channel) const;
    bool isReady() const;
};
```

> Pada implementasi awal, FilterManager dapat berupa passthrough (langsung teruskan moving average output). Filter tambahan dapat ditambahkan tanpa mengubah interface ke FeatureExtractor.

### 13.7 Data Structures

```cpp
struct AdcChannelReading {
    uint8_t channel;
    int32_t rawCount;
    float voltage;
    uint8_t gain;
    bool saturated;
    bool valid;
};

struct SensorVoltage {
    float voltage;
    float movingAverageVoltage;
    uint8_t gain;
    bool valid;
    bool saturated;
};

struct SensorArrayVoltageReading {
    SensorVoltage channels[8];
    uint32_t timestampMs;
    bool allValid;
};
```

---

## 14. Auto Nulling / Setup Calibration

### 14.1 Tujuan

Nulling stage digunakan untuk menentukan **nilai DAC minimum** yang mulai menghasilkan perubahan pembacaan ADC pada setiap channel sensor.

Pada kondisi awal, DAC diset ke nol. Kemudian nilai DAC dinaikkan. Selama output ADC belum berubah dari kondisi awal atau masih berada dalam noise floor, firmware terus menaikkan DAC. Ketika ADC mulai menunjukkan perubahan yang valid, titik tersebut dianggap sebagai **nulling point**.

> Nulling point = DAC code pertama yang menyebabkan ADC mulai berubah dari kondisi awal.

### 14.2 Prinsip Nulling

```text
1. Set ADS1256 PGA ke gain maksimum.
2. Set DAC = 0.
3. Baca nilai ADC awal.
4. Naikkan DAC.
5. Setelah setiap perubahan DAC, baca ADC.
6. Selama ADC belum berubah signifikan, lanjutkan pencarian.
7. Ketika ADC mulai berubah melebihi threshold, simpan nilai DAC.
8. Nilai DAC tersebut menjadi nulling DAC code untuk channel itu.
```

### 14.3 Algoritma Nulling

```text
Primary  : Exponential Search + Binary Search + Confirmation
Fallback : Linear sweep for debug
Not used : Target-based mid-scale nulling
```

Alasan: linear sweep terlalu lambat untuk 4096 kemungkinan code DAC 12-bit. Exponential search menemukan region perubahan ADC; binary search mempersempit; confirmation step mencegah false trigger dari noise.

#### 14.3.1 Exponential Search

DAC dinaikkan secara eksponensial (1, 2, 4, 8, 16, 32, 64, …) sampai ADC mulai berubah melebihi threshold. Saat itu ditemukan range `[low, high]` tempat transisi terjadi.

```text
Step  DAC   ADC delta   Keterangan
  1     1       0       belum berubah
  2     2       0       belum berubah
  3     4       0       belum berubah
  4     8       0       belum berubah
  5    16       0       belum berubah
  6    32       0       belum berubah
  7    64     142       ADC mulai berubah → transisi ada di [32, 64]
```

→ `low = 32`, `high = 64`

#### 14.3.2 Binary Search

Binary search mempersempit range `[low, high]` untuk menemukan DAC code pertama yang menghasilkan perubahan ADC.

```text
Iterasi   low   high   mid   ADC delta   Hasil
  1        32     64    48       0        belum berubah → low = 48
  2        48     64    56     165        berubah → high = 56
  3        48     56    52       0        belum berubah → low = 52
  4        52     56    54      89        berubah → high = 54
  5        52     54    53      44        berubah → high = 53
  Konvergen: low = 52, high = 53 → kandidat dac_code = 53
```

#### 14.3.3 Confirmation

Setelah binary search konvergen, firmware memverifikasi:
- DAC code `52` (below) → ADC **tidak** berubah signifikan ✓
- DAC code `53` (result) → ADC **berubah** melebihi threshold ✓
- DAC code `54` (above) → ADC berubah lebih besar ✓

Jika semua kondisi terpenuhi → `dac_code = 53` dikonfirmasi dan disimpan.

### 14.4 Nulling Config

```cpp
#define NULLING_ADC_GAIN ADS1256_NULLING_GAIN

#define NULL_DAC_START_CODE                 0
#define NULL_DAC_END_CODE                   4095

#define NULL_ADC_CHANGE_THRESHOLD_COUNTS    100
#define NULL_ADC_AVERAGE_SAMPLE_COUNT       8
#define NULL_SETTLING_TIME_MS               5

#define NULL_EXP_INITIAL_STEP               1
#define NULL_EXP_MAX_STEP                   2048

#define NULL_CONFIRM_BELOW_OFFSET           1
#define NULL_CONFIRM_ABOVE_OFFSET           1
#define NULL_CONFIRM_SAMPLE_COUNT           5

#define NULLING_ALGORITHM_OPTIMIZED         true
#define NULLING_ALGORITHM_LINEAR_FALLBACK   true
```

> `NULL_ADC_CHANGE_THRESHOLD_COUNTS` harus ditentukan dari noise floor aktual saat gain 64x.

### 14.5 Nulling Process Per Channel

```text
1. Select TCA9548A channel.
2. Set ADS1256 gain to 64x.
3. Set MCP4725 DAC to 0.
4. Wait settling time.
5. Read baseline ADC from ADS1256.
6. Perform exponential search to find transition range.
7. Perform binary search to find first DAC code where ADC changes.
8. Confirm result using below/code/above check.
9. Save DAC code as nulling code for that sensor.
10. Repeat for all 8 channels.
```

### 14.6 Data Structures

```cpp
struct NullingResult {
    uint8_t channel;
    uint16_t dacCode;
    int32_t baselineAdc;
    int32_t nullAdc;
    int32_t deltaCount;
    bool success;
    int errorCode;
};

struct NullingProfile {
    NullingResult results[8];
    bool allSuccess;
    uint32_t createdAtMs;
};
```

### 14.7 Success / Failure Criteria

Nulling per channel **berhasil** jika:

```text
- ADC baseline awal berhasil dibaca.
- Saat DAC dinaikkan, ADC berubah melebihi threshold.
- DAC code ditemukan sebelum DAC mencapai nilai maksimum.
- Hasil confirmation valid.
- ADC tidak saturasi atau error.
```

Nulling channel **gagal** jika:

```text
- ADC tidak berubah sampai DAC mencapai 4095.
- ADS1256 read timeout.
- ADC value saturasi atau invalid.
- TCA9548A gagal memilih channel.
- MCP4725 gagal menerima DAC code.
- Confirmation step gagal.
```

### 14.8 Contoh Log

```text
[NULLING] Start channel=0 sensor=MQ2
[NULLING] CH0 baseline_adc=0
[NULLING] CH0 exp dac=1 adc=0 delta=0
[NULLING] CH0 exp dac=2 adc=0 delta=0
[NULLING] CH0 exp dac=4 adc=0 delta=0
[NULLING] CH0 exp dac=8 adc=0 delta=0
[NULLING] CH0 exp dac=16 adc=0 delta=0
[NULLING] CH0 exp dac=32 adc=0 delta=0
[NULLING] CH0 exp dac=64 adc=142 delta=142
[NULLING] CH0 range low=32 high=64
[NULLING] CH0 binary result dac_code=53
[NULLING] CH0 confirmed=true
[NULLING] CH0 success dac_code=53 baseline=0 null_adc=118 delta=118
```

---

## 15. Machine Learning Pipeline

### 15.1 Tujuan

Inference stage adalah mode operasi utama sistem. Sistem membaca sensor secara berkala, menyiapkan fitur, menjalankan inferensi TensorFlow Lite Micro, mengaktifkan alarm jika diperlukan, dan mengirim hasil ke cluster head melalui LoRa.

### 15.2 Power Policy

Inference stage dapat dijalankan pada external 24VDC mode maupun battery mode. Battery mode hanya digunakan untuk inference.

### 15.3 Inference Process

```text
1. Load nulling DAC profile.
2. Apply DAC code ke semua MCP4725.
3. Init TensorFlow Lite Micro model.
4. If battery mode, wait for MQ sensor warm-up.
5. Read ADS1256 8 channels.
6. Use high-sensitivity-first AGC.
7. Convert raw ADC to voltage.
8. Apply moving average 10 data.
9. Normalize / prepare feature vector.
10. Copy feature vector ke input tensor.
11. Invoke model.
12. Parse output tensor.
13. Determine label, confidence, and alarm status.
14. Update lamp and buzzer.
15. Send payload to cluster head via LoRa.
16. If battery mode, send DONE pulse to TPL5110.
17. Repeat periodically if external mode.
```

### 15.4 AI Runtime

```text
AI runtime        : TensorFlow Lite Micro
Model architecture: Neural Network (NN)
Execution target  : ESP32-S3
Model input       : Features from 8 MQ sensor channels (normalized)
Model output      : Gas/leak classification result
Scaler parameters : scaler_param.h (mean and scale per feature)
```

### 15.5 Feature Vector

8 nilai tegangan per channel, dinormalisasi menggunakan parameter dari `scaler_param.h`:

```text
feature[0] = (MQ2_voltage   - scaler_mean[0]) / scaler_scale[0]
feature[1] = (MQ3_voltage   - scaler_mean[1]) / scaler_scale[1]
feature[2] = (MQ4_voltage   - scaler_mean[2]) / scaler_scale[2]
feature[3] = (MQ5_voltage   - scaler_mean[3]) / scaler_scale[3]
feature[4] = (MQ6_voltage   - scaler_mean[4]) / scaler_scale[4]
feature[5] = (MQ7_voltage   - scaler_mean[5]) / scaler_scale[5]
feature[6] = (MQ8_voltage   - scaler_mean[6]) / scaler_scale[6]
feature[7] = (MQ135_voltage - scaler_mean[7]) / scaler_scale[7]
```

`scaler_param.h` berisi array `scaler_mean[8]` dan `scaler_scale[8]` yang diekspor dari proses training model (StandardScaler atau MinMaxScaler). File ini di-include langsung ke firmware.

> Urutan fitur firmware harus sama persis dengan urutan fitur saat training model AI. Parameter scaler firmware harus sama persis dengan parameter scaler saat training.

### 15.6 Data Structures

```cpp
struct InferenceResult {
    uint8_t predictedClass;
    const char* label;
    float confidence;
    bool alarm;
    bool valid;
};
```

### 15.7 Alarm Rule

Alarm aktif jika:

```text
- predicted label termasuk kelas berbahaya
- confidence >= threshold
```

```cpp
#define AI_CONFIDENCE_THRESHOLD 0.70f
```

---

## 16. Communication Design

### 16.1 I2C

| Parameter | Nilai |
|-----------|-------|
| Clock | 400 kHz |
| SDA | IO8 |
| SCL | IO9 |
| Pull-up | R97 + R98 10kΩ ke VCC (3.3V) |

| Device | Alamat | Channel Akses |
|--------|--------|---------------|
| TCA9548A (I2C Mux) | `0x71` | Langsung dari ESP32 |
| MCP4725 DAC (x8) | `0x60` | Via TCA9548A CH0–CH7 |

> MCP4725 semua menggunakan alamat `0x60` — konflik dihindari dengan select/deselect TCA9548A sebelum dan sesudah akses.

### 16.2 SPI

| Parameter | Nilai |
|-----------|-------|
| MOSI | IO11 |
| MISO | IO13 |
| SCK | IO12 |
| Mode | SPI Mode 1 (CPOL=0, CPHA=1) untuk ADS1256 |

| Device | CS GPIO | Max Clock | Keterangan |
|--------|---------|-----------|------------|
| ADS1256 | IO47 (Active LOW) | 1.92 MHz | Tunggu DRDY IO10 sebelum baca |
| E22-900MM22S (SX1262) | IO15 (Active LOW) | 16 MHz | Periksa BUSY_LORA IO7 sebelum akses |

> Kedua device berbagi satu SPI bus — hanya satu CS yang boleh aktif LOW pada satu waktu.

### 16.3 UART

| Port | GPIO TX | GPIO RX | Baud Rate | Format | Fungsi |
|------|---------|---------|-----------|--------|--------|
| UART0 | IO44 (TXD0) | IO43 (RXD0) | 115200 | 8N1 | Debug console via CH340C USB |
| UART2 | IO21 | IO20 | 9600 | 8N1 | RS-485 Modbus RTU (DIR IO19) |

#### 16.3.1 CH340C USB-UART Bridge Circuit

USB debug console menggunakan **CH340C** (U48) sebagai USB-UART bridge.

**Komponen:**

| Referensi | Nilai/Part | Fungsi |
|-----------|------------|--------|
| U48 | CH340C | USB-UART bridge IC |
| R96 | 470 Ω | Resistor seri pada jalur UART RX untuk proteksi arus |
| D4, D5 | ESD diode | Proteksi ESD pada jalur USB D+ dan D- |
| C88 | 10 µF | Bulk bypass VCC CH340C |
| C89 | 100 nF | HF bypass VCC CH340C |

**Koneksi:**
```
USB D+/D-  ──[D4, D5]── CH340C (U48) ──[R96 470Ω]── ESP32 RXD0 (IO43)
                                      ─────────────── ESP32 TXD0 (IO44)
```

> Pin V3 CH340C (tegangan I/O) dihubungkan ke VCC (3.3V), memastikan level sinyal UART kompatibel dengan ESP32-S3.

#### 16.3.2 Auto-Reset Circuit (UMH3NTN)

ESP32-S3 mendukung auto-reset via USB (masuk bootloader otomatis saat upload firmware) menggunakan sinyal **DTR** dan **RTS** dari CH340C yang diumpankan ke **Q1 UMH3NTN** (dual NPN transistor array, package SOT-363).

**Koneksi:**
```
CH340C RTS ── Q1 (transistor 1 base) ── collector → ESP32 RST (pin EN / CHIP_PU)
CH340C DTR ── Q1 (transistor 2 base) ── collector → ESP32 IO0
```

> **Fungsi:** Saat software upload (mis. esptool), DTR/RTS di-toggle secara berurutan oleh host PC. UMH3NTN menerjemahkan sinyal ini menjadi pulse reset (via pin EN/CHIP_PU ESP32-S3, bukan GPIO) dan boot-mode selection pada ESP32 (IO0 LOW saat reset = masuk Download Mode). Catatan: `IO39` adalah GPIO terpisah yang dialokasikan untuk `LORA_RST` (lihat s6.4) — tidak terhubung ke jalur reset CH340C. `IO0` pada tabel GPIO (UMH3NTN kaki C2) merujuk ke kaki collector transistor kedua Q1 yang dihubungkan ke ESP32 IO0.

### 16.4 RS-485 / Modbus RTU

| Parameter | Nilai |
|-----------|-------|
| Transceiver | THVD1410DR (U47) |
| TX GPIO | IO21 |
| RX GPIO | IO20 |
| DIR GPIO | IO19 (HIGH = TX, LOW = RX) |
| Baud rate | 9600 |
| Protocol | Modbus RTU |
| Role | Slave (ESP32 merespons request dari master) |
| Output Connector | CN3 XH-2A-black (2-pin: A, B) |

**Rangkaian Proteksi Line RS-485:**

| Referensi | Komponen | Fungsi |
|-----------|----------|--------|
| D6 | SM712 (TVS diode array) | Proteksi ESD dan transient pada line A dan B RS-485 |
| C87 | 100 nF | Bypass VCC THVD1410DR |

> **D6 SM712** adalah TVS diode array dual-line yang dipasang langsung di antara jalur A dan B RS-485 ke GND. Komponen ini melindungi THVD1410DR dari lonjakan tegangan akibat ESD atau transient pada kabel RS-485 di lingkungan industri.

**Konfigurasi DE/RE:**
- Pin DE dan RE# THVD1410DR keduanya dihubungkan ke sinyal `DIR` (IO19)
- HIGH → DE aktif (transmit enable), RE# non-aktif (receive disable) = mode TX
- LOW → DE non-aktif, RE# aktif = mode RX

> Modbus register map belum didefinisikan — akan ditentukan saat integrasi dengan sistem master.

### 16.5 MQTT

MQTT digunakan pada **Dataset Generation Stage** untuk mengirim data sensor ke broker lokal di PC, yang kemudian dikumpulkan sebagai dataset untuk training model AI.

| Parameter | Nilai |
|-----------|-------|
| Digunakan pada stage | Dataset Generation |
| Transport | Wi-Fi (ESP32-S3 built-in) |
| Broker | Lokal di PC (mis. Mosquitto) |
| QoS | 0 (best effort) |
| Payload format | JSON |

Contoh payload dataset:

```json
{
  "label": "LPG",
  "ch0": 0.182,
  "ch1": 0.041,
  "ch2": 0.119,
  "ch3": 0.244,
  "ch4": 0.291,
  "ch5": 0.033,
  "ch6": 0.021,
  "ch7": 0.073,
  "timestamp_ms": 32100
}
```

> MQTT hanya aktif saat Dataset Generation Stage dan mode External 24V. Tidak digunakan saat Inference Stage atau mode baterai.

---

## 17. LoRa Protocol

### 17.1 LoRa Decision

```text
LoRa library      : RadioLib
LoRa module       : E22-900MM22S (SX1262)
MCU               : ESP32-S3
Interface         : SPI (shared dengan ADS1256)
Role              : Sensor node transmitter
Receiver          : Cluster head
```

### 17.2 RadioLib Object

```cpp
#include <RadioLib.h>

// Shared SPI bus: SCK=GPIO12, MISO=GPIO13, MOSI=GPIO11

SX1262 radio = new Module(
    PIN_LORA_CS,    // GPIO15
    PIN_LORA_DIO1,  // GPIO40
    PIN_LORA_RST,   // GPIO39
    PIN_LORA_BUSY   // GPIO7
);
```

> Jika E22 yang digunakan berbasis SX1262/SX1268, gunakan class `SX1262` dari RadioLib. Jika varian E22 berbeda, class RadioLib harus disesuaikan.

### 17.3 LoRa Config

```cpp
#define LORA_FREQUENCY_MHZ       920.0
#define LORA_BANDWIDTH_KHZ       125.0
#define LORA_SPREADING_FACTOR    9
#define LORA_CODING_RATE         7
#define LORA_SYNC_WORD           RADIOLIB_SX126X_SYNC_WORD_PRIVATE
#define LORA_TX_POWER_DBM        17
#define LORA_PREAMBLE_LENGTH     8

#define LORA_TXEN_ACTIVE_HIGH    true
#define LORA_RXEN_ACTIVE_HIGH    true
#define LORA_RF_SWITCH_SETTLE_MS 5

#define LORA_SEND_EVERY_INFERENCE    true
#define LORA_HEARTBEAT_INTERVAL_MS   30000
#define LORA_SEND_IMMEDIATE_ON_ALARM true
#define LORA_ENABLE_ACK              false
#define LORA_MAX_RETRY               2
```

### 17.4 Payload Format

JSON minimal:

```json
{
  "device_id": "gld-001",
  "seq": 1024,
  "mode": "INFERENCE",
  "power_mode": "BATTERY",
  "battery_v": 3.87,
  "battery_low": false,
  "label": "LPG",
  "confidence": 0.91,
  "alarm": true,
  "health": "OK",
  "timestamp_ms": 987654
}
```

JSON dengan sensor summary (opsional):

```json
{
  "device_id": "gld-001",
  "seq": 1024,
  "mode": "INFERENCE",
  "power_mode": "BATTERY",
  "battery_v": 3.87,
  "battery_low": false,
  "label": "LPG",
  "confidence": 0.91,
  "alarm": true,
  "sensor_v": [0.18, 0.04, 0.12, 0.24, 0.29, 0.03, 0.02, 0.07],
  "timestamp_ms": 987654
}
```

> Untuk LoRa, payload JSON mungkin terlalu panjang. Nanti bisa dibuat compact binary payload.

---

## 18. Persistent Configuration

### 18.1 EEPROM Structure

```c
typedef struct {
    uint32_t magic;                  // Magic number untuk validasi: 0xDEADBEEF
    uint8_t  version;                // Versi struktur config
    char     device_id[16];          // ID unik perangkat, null-terminated
    uint8_t  default_power_mode;     // POWER_MODE_BATTERY=0x01, POWER_MODE_EXT_5V=0x02, POWER_MODE_EXT_24V=0x03
    uint8_t  reserved[10];           // Reserved untuk ekspansi

    // Nulling profile per channel
    struct {
        uint16_t dac_code;           // DAC code hasil nulling (0–4095)
        int32_t  baseline_adc;       // ADC baseline saat DAC = 0
        int32_t  null_adc;           // ADC saat DAC = dac_code
        bool     valid;              // true jika nulling berhasil
    } nulling[8];

    uint32_t checksum;               // CRC32 seluruh struct (kecuali field ini)
} idConfig;
```

### 18.2 EEPROM Memory Map

| Offset | Size (byte) | Field | Keterangan |
|--------|-------------|-------|------------|
| 0x00 | 4 | `magic` | Validasi struktur: `0xDEADBEEF` |
| 0x04 | 1 | `version` | Versi layout struct |
| 0x05 | 16 | `device_id` | String ID perangkat |
| 0x15 | 1 | `default_power_mode` | Mode default saat boot |
| 0x16 | 10 | `reserved` | Padding |
| 0x20 | 8×11 = 88 | `nulling[8]` | 8 channel × 11 byte (dac_code 2 + baseline_adc 4 + null_adc 4 + valid 1) |
| 0x78 | 4 | `checksum` | CRC32 validasi |

> Total: ~124 byte (packed). Jauh di bawah batas EEPROM ESP32 (NVS flash).

### 18.3 Default Values

| Field | Default | Keterangan |
|-------|---------|------------|
| `magic` | `0xDEADBEEF` | Diset saat pertama kali flash |
| `version` | `1` | Versi awal struct |
| `device_id` | `"gld-001"` | Dapat diubah via serial command |
| `default_power_mode` | `POWER_MODE_EXT_24V` (0x03) | Mode default saat boot |
| `nulling[i].valid` | `false` | Nulling belum pernah dijalankan |
| `nulling[i].dac_code` | `0` | Tidak valid sampai nulling dijalankan |

---

## 19. Serial Console Commands

### 19.1 Command List

```text
stage nulling
stage dataset
stage inference

power mode external
power mode battery

nulling start
nulling status
nulling save
nulling load

dataset start NORMAL 1000
dataset start LPG 1000
dataset stop

inference start
inference stop

battery status
status
help
```

---

## 20. State Machine

### 20.1 High-Level Flow

```text
BOOT
  ↓
INIT_HARDWARE
  ↓
SELECT_STAGE
  ↓
[NULLING_STAGE]
  or
[DATASET_GENERATION_STAGE]
  or
[INFERENCE_STAGE]
```

### 20.2 Nulling Stage States

```text
NULLING_INIT
NULLING_CHANNEL_SELECT
NULLING_BASELINE_READ
NULLING_EXPONENTIAL_SEARCH
NULLING_BINARY_SEARCH
NULLING_CONFIRMATION
NULLING_SAVE
NULLING_DONE
NULLING_ERROR
```

### 20.3 Dataset Generation States

```text
DATASET_INIT
DATASET_WAIT_LABEL
DATASET_RECORDING
DATASET_OUTPUT_RECORD
DATASET_DONE
DATASET_ERROR
```

### 20.4 Inference States

```text
INFERENCE_INIT
INFERENCE_APPLY_NULLING_PROFILE
INFERENCE_SENSOR_WARMUP
INFERENCE_BATTERY_READ
INFERENCE_SENSOR_READ
INFERENCE_FILTER
INFERENCE_FEATURE_EXTRACT
INFERENCE_MODEL_INVOKE
INFERENCE_ALARM_UPDATE
INFERENCE_LORA_SEND
INFERENCE_TPL5110_DONE
INFERENCE_ERROR
```

---

## 21. Safety, Failsafe, and Alarms

### 21.1 Alarm Conditions

| Alarm Type | Trigger | Action | Priority |
|------------|---------|--------|----------|
| Gas Detected | AI label berbahaya + confidence ≥ 0.70 | LAMP ON, BUZZER ON, kirim LoRa alarm | CRITICAL |
| Low Battery | BATMON ≤ 3.1V | Kirim warning via LoRa | HIGH |
| Critical Battery | BATMON ≤ 3.0V | Pulse TPL5110 DONE segera, matikan siklus | CRITICAL |
| Nulling Failure | Satu atau lebih channel gagal nulling | Flag di NullingProfile, lanjut dengan channel valid | MEDIUM |
| ADC Error | ADS1256 read timeout atau value invalid | Skip siklus inference, log error | HIGH |
| LoRa TX Failure | TX gagal setelah 2 retry | Log, lanjutkan siklus berikutnya | LOW |
| TCA9548A Error | I2C timeout saat select channel | Nulling channel tersebut gagal | HIGH |

### 21.2 Failsafe Logic

```text
1. Jika BATMON ≤ 3.0V saat inference berjalan:
   → Hentikan inference segera
   → Kirim paket LoRa "battery_critical" jika memungkinkan
   → Pulse TPL5110 DONE untuk matikan sistem

2. Jika ADS1256 tidak merespons (timeout):
   → Skip satu siklus inference
   → Jika 3 siklus berturut-turut error → log "ADC_FAIL", kirim LoRa

3. Jika semua channel nulling gagal:
   → Inference tetap berjalan dengan gain 64x tanpa nulling
   → Flag NullingProfile.allSuccess = false

4. Jika LoRa TX gagal:
   → Retry maksimum 2x
   → Jika masih gagal → lanjutkan, tidak block inference
```

### 21.3 Safety Rules

- Output LAMP, BUZZER hanya diaktifkan saat alarm dan dimatikan saat kondisi normal kembali.
- TPL5110 DONE hanya dipulse di akhir siklus inference yang berhasil atau saat critical battery.
- Firmware tidak pernah memulai stage Nulling atau Dataset Generation saat mode baterai.
- Jika `PG24` LOW (buck 24V fault), firmware log warning tapi tidak shutdown otomatis.

---

## 22. Timing Budget

| Komponen | Operasi | Estimasi Durasi | Keterangan |
|----------|---------|-----------------|------------|
| MQ Sensor | Warmup | 30.000 ms | Wajib sebelum baca pertama |
| ADS1256 | 1 sample read | ~100 ms | Untuk moving average 10 sample/detik |
| ADS1256 | Moving average (10x) | ~1.000 ms | Output 1 data/detik |
| AGC | Gain adjustment per sample | < 5 ms | Baca ulang jika saturasi |
| FilterManager | Update | < 1 ms | Passthrough atau low-pass ringan |
| TFLite Micro | Neural Network inference | < 100 ms | Tergantung ukuran model |
| LoRa E22 | TX kirim paket | 200–500 ms | Tergantung SF dan payload size |
| TPL5110 | DONE pulse | 100 ms | Pulse HIGH untuk akhiri siklus baterai |
| Nulling | Per channel (optimal) | 3–10 detik | Exp search + binary search + confirm |
| Nulling | Semua 8 channel | 24–80 detik | Berurutan, tidak paralel |

### 22.1 Total Cycle Time

```text
=== Inference Stage (mode normal, tanpa alarm) ===
ADC sampling + moving avg   : ~1.000 ms
FilterManager + Feature     : <  10 ms
TFLite inference            : < 100 ms
LoRa TX                     : ~300 ms
                            ─────────
Total per siklus            : ~1.4 detik

=== Inference Stage (mode baterai) ===
Identik di atas + TPL5110 DONE pulse (100 ms) di akhir siklus
Total                       : ~1.5 detik
```

---

## 23. Error Handling and Recovery

### 23.1 Error Matrix

| Error Code | Deskripsi | Recovery Action |
|------------|-----------|-----------------|
| `ERR_ADC_TIMEOUT` | ADS1256 tidak merespons DRDY dalam batas waktu | Skip siklus, log, retry siklus berikutnya |
| `ERR_ADC_INVALID` | Nilai ADC saturasi atau out of range | Jalankan AGC step-down, retry |
| `ERR_I2C_MUX` | TCA9548A tidak merespons saat select channel | Nulling channel tersebut gagal, lanjut channel berikutnya |
| `ERR_DAC_WRITE` | MCP4725 tidak acknowledge write I2C | Nulling channel tersebut gagal |
| `ERR_LORA_TX` | TX gagal setelah 2 retry | Log, lanjutkan inference siklus berikutnya |
| `ERR_TFLITE` | TFLite Micro inference error atau output invalid | Skip alarm update, log, retry siklus berikutnya |
| `ERR_BATTERY_CRITICAL` | BATMON ≤ 3.0V | Pulse TPL5110 DONE segera, shutdown siklus |
| `ERR_NULLING_ALL_FAIL` | Semua 8 channel nulling gagal | Inference tetap jalan tanpa nulling, flag di log |

### 23.2 Recovery Strategy

- Error non-kritis (LoRa TX fail, ADC satu siklus): log dan lanjutkan — tidak menghentikan firmware.
- Error berulang (ADC 3 siklus berturut-turut): kirim notifikasi via LoRa jika masih bisa.
- Error kritis (battery critical): segera pulse TPL5110 DONE tanpa menunggu siklus selesai.
- Nulling failure parsial: simpan NullingProfile dengan channel yang valid, tandai yang gagal sebagai `valid = false`.

---

## 24. Logging Format

### 24.1 Format Log

```text
[TIMESTAMP_MS] [LEVEL] [MODULE] message
```

Level: `INFO`, `WARN`, `ERROR`

### 24.2 Boot Logging

```text
[0] INFO [SYS] Gas Leak Detector booting...
[12] INFO [SYS] ESP32-S3 @ 240MHz, Flash 16MB, PSRAM 8MB
[45] INFO [POWER] Power mode: EXTERNAL_24V
[46] INFO [ADC] ADS1256 init OK
[47] INFO [I2C] TCA9548A found @ 0x71
[89] INFO [LORA] SX1262 init OK, freq=920MHz
[90] INFO [SYS] Boot complete, entering stage: NULLING
```

### 24.3 Nulling Logging

Lihat contoh lengkap di Section 14.8.

### 24.4 Inference Cycle Logging

```text
[32100] INFO [INF] Cycle #42 start
[32101] INFO [ADC] CH0=0.182V CH1=0.041V CH2=0.119V CH3=0.244V
[32102] INFO [ADC] CH4=0.291V CH5=0.033V CH6=0.021V CH7=0.073V
[32103] INFO [AI]  label=LPG confidence=0.91 alarm=true
[32104] INFO [ALARM] LAMP ON, BUZZER ON
[32105] INFO [LORA] TX sent seq=42 ok
[32106] INFO [BAT] voltage=3.87V ok
```

---

## 25. SPI / I2C Bus Rules

### 25.1 I2C Bus Rules

- TCA9548A harus di-select terlebih dahulu sebelum mengakses MCP4725 manapun.
- Setelah selesai akses MCP4725, deselect TCA9548A (tulis `0x00` ke TCA9548A) sebelum akses channel lain.
- Semua MCP4725 menggunakan alamat `0x60` — konflik hanya dihindari oleh TCA9548A channel select.
- I2C clock: 400 kHz. Pull-up R97 (SDA) dan R98 (SCL) 10kΩ ke VCC (3.3V).
- Jangan akses I2C saat SPI sedang aktif pada bus yang sama (tidak shared, aman).

### 25.2 SPI Bus Rules

- ADS1256 dan SX1262 (LoRa) berbagi satu SPI bus (MOSI IO11, MISO IO13, SCK IO12).
- Hanya satu CS yang boleh aktif LOW pada satu waktu: CS_ADC (IO47) atau CS_LORA (IO15).
- Sebelum akses ADS1256: pastikan CS_LORA HIGH dan periksa BUSY_LORA (IO7) tidak HIGH.
- Sebelum akses LoRa: pastikan CS_ADC HIGH.
- ADS1256: tunggu DRDY (IO10) LOW sebelum membaca data.
- LoRa: atur TXEN (IO6) dan RXEN (IO5) sebelum TX/RX sesuai mode.

### 25.3 Bus Timing

| Bus | Clock | Catatan |
|-----|-------|---------|
| I2C (TCA9548A + MCP4725) | 400 kHz | Pull-up 10kΩ |
| SPI ADS1256 | Maks 1.92 MHz (SCLK) | Sesuai datasheet ADS1256 |
| SPI LoRa SX1262 | Maks 16 MHz | Sesuai datasheet SX1262 |
| UART0 (debug) | 115200 baud | 8N1 |
| UART2 (RS-485) | 9600 baud | 8N1 |

---

## 26. Verification Plan

### 26.1 Hardware Verification

- [ ] Semua GPIO sesuai pin mapping Section 6 (ukur dengan multimeter/logic analyzer)
- [ ] SPI bus sharing ADS1256 dan SX1262 berfungsi tanpa konflik CS
- [ ] I2C TCA9548A dapat di-select semua 8 channel, MCP4725 merespons
- [ ] ADS1256 DRDY aktif saat data siap, AINCOM terhubung ke GND
- [ ] LoRa TX/RX: TXEN dan RXEN switching benar sesuai mode
- [ ] TPL5110 DONE pulse (IO14 HIGH) berhasil mematikan sistem saat mode baterai
- [ ] BATMON voltage divider: hasil baca IO4 sesuai formula × 3

### 26.2 Software Verification

- [ ] Nulling berhasil untuk semua 8 channel pada kondisi sensor idle
- [ ] AGC selalu reset ke 64x setiap siklus baru
- [ ] Moving average output stabil setelah 10 sample
- [ ] FilterManager tidak mengubah nilai jika tidak ada outlier
- [ ] TFLite Micro inference: output label dan confidence valid untuk input diketahui
- [ ] StorageManager: simpan dan load NullingProfile dari EEPROM dengan benar
- [ ] Serial command parser: semua command di Section 19 merespons dengan benar

### 26.3 System Verification

- [ ] End-to-end: gas test → sensor baca → inference → alarm aktif → LoRa TX berhasil
- [ ] Mode baterai: hanya inference stage yang berjalan, DONE pulse di akhir
- [ ] Mode 24V: ketiga stage berjalan normal, PG24 terbaca HIGH
- [ ] Nulling profile tersimpan di EEPROM dan di-load ulang saat boot

---

## 27. Limitations

- Sensor MQ mengalami drift jangka panjang — model AI perlu di-retrain secara berkala.
- Inference hanya valid untuk gas yang ada di dataset training. Gas baru tidak dikenali.
- Mode baterai tidak menjalankan nulling — menggunakan profil nulling dari sesi 24V sebelumnya.
- Payload LoRa JSON berpotensi melebihi batas panjang untuk SF tinggi — perlu compact binary payload di masa depan.
- Single-ended ADC input: semua channel menggunakan AINCOM sebagai referensi negatif, bukan truly differential per channel.
- Tidak ada OTA firmware update — update harus melalui USB/serial flashing.

---

## 28. Future Work

- OTA firmware update via LoRa atau Wi-Fi.
- Compact binary LoRa payload untuk efisiensi bandwidth dan mendukung SF tinggi.
- Drift compensation otomatis untuk sensor MQ tanpa re-nulling manual.
- Multi-node LoRa mesh — saat ini hanya single node ke cluster head.
- Dashboard monitoring berbasis cloud untuk visualisasi data inference real-time.
- Adaptive retraining model AI menggunakan data lapangan yang terkumpul.

---

## 29. Appendix

### A. Constants and Default Values

```c
// Battery Monitoring (BATMON)
#define BATMON_ADC_PIN         IO4          // ADC pin untuk battery monitoring
#define BATMON_R1              200000       // Resistor R1 (VBattery ke BATMON) = 200kΩ
#define BATMON_R2              100000       // Resistor R2 (BATMON ke GND) = 100kΩ
#define BATMON_DIVIDER_RATIO   3            // Voltage divider ratio = (R1+R2)/R2 = 3
#define BATMON_FILTER_CAP      100e-9       // Filter capacitor C1 = 100 nF
#define ADC_VREF               3.3f         // ADC reference voltage = 3.3V
#define ADC_BITS               12           // ADC resolution = 12-bit (0-4095)
#define ADC_MAX_VALUE          4095         // Maximum ADC count
#define BATMON_MAX_VOLTAGE     4.2f         // Max battery voltage (Lithium full charge) = 4.2V
#define BATMON_MIN_VOLTAGE     0.0f         // Min battery voltage (depleted) = 0V
#define BATMON_RANGE_FULL_MIN  3.9f         // Full battery lower bound (Volt)
#define BATMON_RANGE_FULL_MAX  4.2f         // Full battery upper bound (Volt)
#define BATMON_RANGE_MED_MIN   3.5f         // Medium battery lower bound (Volt)
#define BATMON_RANGE_MED_MAX   3.7f         // Medium battery upper bound (Volt)
#define BATMON_THRESHOLD_LOW   3.1f         // Low battery threshold (Volt)
#define BATMON_THRESHOLD_CRITICAL 3.0f     // Critical battery threshold (Volt)

// Power Source Selection and Rails
#define POWER_INPUT_SELECTOR   J1           // 2x3 header untuk pilih sumber power
#define POWER_INPUT_CONNECTOR  CN2          // Input connector untuk battery / external PSU
#define POWER_MODE_BATTERY     0x01         // J1 jumper pin 1-2
#define POWER_MODE_EXT_5V      0x02         // J1 jumper pin 3-4
#define POWER_MODE_EXT_24V     0x03         // J1 jumper pin 5-6
#define POWER_MAIN_RAIL        5.0f         // Main board rail = +5V
#define POWER_LOGIC_RAIL       3.3f         // Logic rail = VCC
#define TPS61088_OUTPUT_RAIL   "+5V"        // U41 boost output in battery mode
#define LMR51450_OUTPUT_RAIL   "5VBUCK"     // U36 buck output before +5V distribution
#define TPS62162_OUTPUT_RAIL   "VCC"        // U43 output rail for 3.3V domain

// DC Fan Control (DCFAN)
#define DCFAN_GPIO_PIN         IO42         // GPIO pin untuk DC fan control
#define DCFAN_DRIVER_IC        ULN2003      // Darlington array driver IC
#define DCFAN_SUPPLY_VOLTAGE   5.0f         // Fan supply voltage = 5V
#define DCFAN_MAX_CURRENT      500          // Max output current per channel (mA)
#define DCFAN_OUTPUT_HIGH      5.0f         // Output HIGH voltage (motor off)
#define DCFAN_OUTPUT_LOW       0.7f         // Output LOW voltage (motor on, ~4.3V across motor)
#define DCFAN_ACTIVE_LEVEL     0            // Active LOW (LOW = fan ON)

// Lamp Control (LAMP)
#define LAMP_GPIO_PIN          IO1          // GPIO pin untuk lamp control
#define LAMP_DRIVER_IC         ULN2003      // ULN2003 channel 2 (I2/O2)
#define LAMP_SUPPLY_VOLTAGE    5.0f         // Lamp supply voltage = 5V
#define LAMP_HEADER_SLOT       1            // Header slot 1 untuk lamp
#define LAMP_OUTPUT_LOW        0.7f         // Output LOW voltage when ON
#define LAMP_ACTIVE_LEVEL      0            // Active LOW (LOW = lamp ON)

// Buzzer Control (BUZZER)
#define BUZZER_GPIO_PIN        IO2          // GPIO pin untuk buzzer control
#define BUZZER_DRIVER_IC       ULN2003      // ULN2003 channel 3 (I3/O3)
#define BUZZER_SUPPLY_VOLTAGE  5.0f         // Buzzer supply voltage = 5V
#define BUZZER_HEADER_SLOT     2            // Header slot 2 untuk buzzer
#define BUZZER_OUTPUT_LOW      0.7f         // Output LOW voltage when ON
#define BUZZER_ACTIVE_LEVEL    0            // Active LOW (LOW = buzzer ON)

// LoRa E22-900MM22S Control
#define LORA_SS_GPIO           IO15         // SPI chip select (NSS)
#define LORA_RST_GPIO          IO39         // Module reset (NRST, active LOW)
#define LORA_BUSY_GPIO         IO7          // BUSY indicator (active HIGH)
#define LORA_DIO1_GPIO         IO40         // DIO1 interrupt (rising edge)
#define LORA_RXEN_GPIO         IO5          // RX enable pin
#define LORA_TXEN_GPIO         IO6          // TX enable pin

// RS-485 Modbus (THVD1410DR)
#define RS485_TX_GPIO          IO21         // UART2 TX
#define RS485_RX_GPIO          IO20         // UART2 RX
#define RS485_DIR_GPIO         IO19         // DE/RE direction control (HIGH=TX, LOW=RX)
#define RS485_BAUD_RATE        9600         // Modbus RTU baud rate

// ADS1256 ADC (U35)
#define ADS1256_CS_GPIO        IO47         // SPI chip select (active LOW)
#define ADS1256_DRDY_GPIO      IO10         // Data ready interrupt, pulled up (active LOW)
#define ADS1256_PDOWN_GPIO     IO18         // Sync/Power down (active LOW)
#define ADS1256_NUM_CHANNELS   8            // AIN0-AIN7
#define ADS1256_RESOLUTION     24           // 24-bit ADC
#define ADS1256_MAX_DATA_RATE  30000        // Max sample rate 30k SPS
#define ADS1256_VREF           2.5f         // Reference voltage (typical, depends on populated analog circuit)
#define ADS1256_GAIN           64           // Default PGA gain (high-sensitivity-first AGC)
#define ADS1256_AIN0           0            // MQ Sensor Channel 0
#define ADS1256_AIN1           1            // MQ Sensor Channel 1
#define ADS1256_AIN2           2            // MQ Sensor Channel 2
#define ADS1256_AIN3           3            // MQ Sensor Channel 3
#define ADS1256_AIN4           4            // MQ Sensor Channel 4
#define ADS1256_AIN5           5            // MQ Sensor Channel 5
#define ADS1256_AIN6           6            // MQ Sensor Channel 6
#define ADS1256_AIN7           7            // MQ Sensor Channel 7
#define ADS1256_AINCOM         8            // Analog input common

// TCA9548A I2C Mux (U33)
#define TCA9548A_I2C_ADDR      0x71         // I2C address used in this design
#define TCA9548A_NUM_CHANNELS  8            // Channel 0-7
#define TCA9548A_CHANNEL_0     0x01         // Select channel 0 (SDA0/SCL0)
#define TCA9548A_CHANNEL_1     0x02         // Select channel 1 (SDA1/SCL1)
#define TCA9548A_CHANNEL_2     0x04         // Select channel 2 (SDA2/SCL2)
#define TCA9548A_CHANNEL_3     0x08         // Select channel 3 (SDA3/SCL3)
#define TCA9548A_CHANNEL_4     0x10         // Select channel 4 (SDA4/SCL4)
#define TCA9548A_CHANNEL_5     0x20         // Select channel 5 (SDA5/SCL5)
#define TCA9548A_CHANNEL_6     0x40         // Select channel 6 (SDA6/SCL6)
#define TCA9548A_CHANNEL_7     0x80         // Select channel 7 (SDA7/SCL7)

// MCP4725 DACs (U31/U27/U23/U19/U15/U11/U6/U8) behind TCA9548A channels 0-7
#define MCP4725_I2C_ADDR_BASE  0x60         // MCP4725 target address after selecting TCA9548A channel
#define MCP4725_RESOLUTION     12           // 12-bit DAC
#define MCP4725_MAX_VALUE      4095         // 2^12 - 1
#define MCP4725_VDD            5.0f         // Supply voltage = 5V
#define MCP4725_CHANNEL_0      0  // TCA CH0 → ADS1256 AIN7 (CH7, MQ135, Posisi 7)
#define MCP4725_CHANNEL_1      1  // TCA CH1 → ADS1256 AIN6 (CH6, MQ8,   Posisi 8)
#define MCP4725_CHANNEL_2      2  // TCA CH2 → ADS1256 AIN5 (CH5, MQ7,   Posisi 6)
#define MCP4725_CHANNEL_3      3  // TCA CH3 → ADS1256 AIN4 (CH4, MQ6,   Posisi 5)
#define MCP4725_CHANNEL_4      4  // TCA CH4 → ADS1256 AIN3 (CH3, MQ5,   Posisi 4)
#define MCP4725_CHANNEL_5      5  // TCA CH5 → ADS1256 AIN2 (CH2, MQ4,   Posisi 3)
#define MCP4725_CHANNEL_6      6  // TCA CH6 → ADS1256 AIN1 (CH1, MQ3,   Posisi 2)
#define MCP4725_CHANNEL_7      7  // TCA CH7 → ADS1256 AIN0 (CH0, MQ2,   Posisi 1)

// AGND Virtual Ground (OPA333 U34)
#define AGND_VOLTAGE               2.5f         // Virtual analog ground = +5VA / 2
#define AGND_BUFFER_IC             "OPA333"     // Zero-drift op-amp, U34
#define AGND_DIVIDER_R1            10000        // R78 = 10 kΩ (+5VA ke IN+)
#define AGND_DIVIDER_R2            10000        // R79 = 10 kΩ (IN+ ke GND)
#define AGND_BULK_CAP              10e-6        // C67 = 10 µF (output bulk)
#define AGND_HF_CAP                100e-9       // C68 = 100 nF (HF bypass output)
#define AGND_SUPPLY_FERRITE        "L1 100Ω"   // Ferrite bead +5VA domain isolasi dari +5V digital

// INA333 Instrumentation Amplifier (U2/U3/U9/U13/U17/U21/U25/U29)
#define INA333_GAIN            1            // Gain = 1x (no external Rg)
#define INA333_NUM_CHANNELS    8            // One INA333 for each MQ sensor channel
#define INA333_VREF            2.5f         // Reference voltage (typical)
#define INA333_INPUT_IMPEDANCE 10000000     // 10 MOhm input impedance

// LM321 Op-Amp Buffer (U4/U5 + 6 additional for 8-channel sensor array)
#define LM321_NUM_CHANNELS     8            // One LM321 buffer per MQ sensor channel
#define LM321_VREF             2.5f         // Reference voltage (typical)

// Config Input (CFG)
#define CFG_GPIO_PIN           IO16         // GPIO input untuk tombol config
#define CFG_PULLUP_RESISTOR    10000        // R80 pull-up resistor = 10k ohm
#define CFG_ACTIVE_LEVEL       0            // Active low (pressed = LOW)
#define CFG_DEBOUNCE_MS        30           // Recommended software debounce

// Power Good Monitor (PG24)
#define PG24_GPIO_PIN          IO45         // GPIO input untuk power-good monitor
#define PG24_PULLUP_RESISTOR   100000       // R84 pull-up resistor = 100k ohm
#define PG24_ACTIVE_LEVEL      1            // Active high (HIGH = power good)
#define PG24_DEBOUNCE_MS       5            // Optional software debounce
#define PG24_SOURCE_IC         "LMR51450"   // Buck regulator IC yang provide PG signal

// Status LED (LED)
#define LED_GPIO_PIN           IO41         // GPIO output untuk status LED
#define LED_SERIES_RESISTOR    2000         // R93 resistor = 2k ohm
#define LED_ACTIVE_LEVEL       0            // Active low (LOW = LED ON)

// TPL5110 Power Timer
#define TPL5110_DONE_GPIO      IO14         // GPIO output ESP32 ke pin DONE TPL5110

// UMH3NTN Sensor
#define UMH3NTN_GPIO           IO0          // UMH3NTN kaki C2

// =============================
// ADS1256 AGC Constants
// =============================
#define ADS1256_VREF_VOLTS                  2.5f
#define ADS1256_GAIN_MIN                    1
#define ADS1256_GAIN_MAX                    64
#define ADS1256_STANDBY_GAIN                64
#define ADS1256_NULLING_GAIN                64
#define ADS1256_DATASET_INITIAL_GAIN        64
#define ADS1256_INFERENCE_INITIAL_GAIN      64
#define ADS1256_USE_AUTOMATIC_GAIN_CONTROL  true
#define ADS1256_GAIN_STRATEGY_HIGH_SENSITIVITY_FIRST true
#define ADS1256_AGC_SATURATION_RATIO        0.95f
#define ADS1256_AGC_GAIN_DOWN_RATIO         0.85f
#define ADS1256_AGC_GAIN_UP_RATIO           0.20f
#define ADS1256_AGC_GAIN_DOWN_CONFIRM_COUNT 1
#define ADS1256_AGC_GAIN_UP_CONFIRM_COUNT   5
#define ADS1256_AGC_MAX_ATTEMPTS            4
#define SENSOR_OUTPUT_INTERVAL_MS           1000
#define ADS1256_MOVING_AVERAGE_COUNT        10

// =============================
// Nulling Constants
// =============================
#define NULLING_ADC_GAIN                    ADS1256_NULLING_GAIN
#define NULL_DAC_START_CODE                 0
#define NULL_DAC_END_CODE                   4095
#define NULL_ADC_CHANGE_THRESHOLD_COUNTS    100
#define NULL_ADC_AVERAGE_SAMPLE_COUNT       8
#define NULL_SETTLING_TIME_MS               5
#define NULL_EXP_INITIAL_STEP               1
#define NULL_EXP_MAX_STEP                   2048
#define NULL_CONFIRM_BELOW_OFFSET           1
#define NULL_CONFIRM_ABOVE_OFFSET           1
#define NULL_CONFIRM_SAMPLE_COUNT           5
#define NULLING_ALGORITHM_OPTIMIZED         true
#define NULLING_ALGORITHM_LINEAR_FALLBACK   true

// =============================
// AI / Inference Constants
// =============================
#define USE_TFLITE_MICRO                    true
#define AI_MODEL_ARCHITECTURE               "NeuralNetwork"
#define AI_CONFIDENCE_THRESHOLD             0.70f
// scaler_param.h menyediakan:
//   extern const float scaler_mean[8];
//   extern const float scaler_scale[8];

// =============================
// LoRa / RadioLib Constants
// =============================
#define USE_LORA                            true
#define USE_RADIOLIB                        true
#define LORA_FREQUENCY_MHZ                  920.0
#define LORA_BANDWIDTH_KHZ                  125.0
#define LORA_SPREADING_FACTOR               9
#define LORA_CODING_RATE                    7
#define LORA_SYNC_WORD                      RADIOLIB_SX126X_SYNC_WORD_PRIVATE
#define LORA_TX_POWER_DBM                   17
#define LORA_PREAMBLE_LENGTH                8
#define LORA_TXEN_ACTIVE_HIGH               true
#define LORA_RXEN_ACTIVE_HIGH               true
#define LORA_RF_SWITCH_SETTLE_MS            5
#define LORA_SEND_EVERY_INFERENCE           true
#define LORA_HEARTBEAT_INTERVAL_MS          30000
#define LORA_SEND_IMMEDIATE_ON_ALARM        true
#define LORA_ENABLE_ACK                     false
#define LORA_MAX_RETRY                      2

// =============================
// Power / Firmware Constants
// =============================
#define DEFAULT_POWER_MODE                  POWER_MODE_EXT_24V
#define USE_TPL5110_POWER_GATING            true
#define TPL5110_DONE_ACTIVE_HIGH            true
#define TPL5110_DONE_PULSE_MS               100
#define ENABLE_BATTERY_VOLTAGE_MONITOR      true
#define BATTERY_LOW_VOLTAGE                 3.1f
#define BATTERY_CRITICAL_VOLTAGE            3.0f
#define MQ_SENSOR_POWER_GATED_IN_BATTERY_MODE true
#define MQ_SENSOR_WARMUP_REQUIRED           true
#define MQ_SENSOR_WARMUP_MS                 30000
#define ALLOW_NULLING_ON_BATTERY            false
#define ALLOW_DATASET_ON_BATTERY            false
#define ALLOW_INFERENCE_ON_BATTERY          true
```

### B. Library Dependencies

Library di-load lokal dari folder `lib/` — tidak mengunduh dari internet saat build.

| Library | Folder `lib/` | Fungsi | Sumber |
|---------|---------------|--------|--------|
| RadioLib | `lib/RadioLib/` | Driver SX1262 LoRa via SPI | github.com/jgromes/RadioLib |
| TensorFlow Lite Micro | `lib/tflite-micro/` | Runtime inferensi Neural Network di ESP32 | github.com/tensorflow/tflite-micro |
| MCP4725 | `lib/MCP4725/` | Driver DAC 12-bit via I2C | github.com/adafruit/Adafruit_MCP4725 |
| ADS1256 | `lib/ADS1256/` | Driver ADC 24-bit via SPI | custom / third-party |

### C. References

- Espressif Systems. *ESP32-S3 Technical Reference Manual*. v1.4. Espressif Systems, 2023.
- Texas Instruments. *ADS1256 Datasheet: Very Low Noise, 24-Bit Analog-to-Digital Converter*. SBAS288. Texas Instruments, 2013.
- Texas Instruments. *TCA9548A 8-Channel I2C-Bus Switch with Reset*. SCPS098. Texas Instruments, 2015.
- Microchip Technology. *MCP4725 12-Bit Digital-to-Analog Converter with EEPROM Memory*. DS22039. Microchip, 2009.
- Texas Instruments. *INA333 Micro-Power, Zero-Drift, Rail-to-Rail Out Instrumentation Amplifier*. SBOS458. Texas Instruments, 2010.
- Semtech. *SX1261/SX1262 Datasheet: Long Range, Low Power, Sub-GHz RF Transceiver*. Rev 2.1. Semtech, 2019.
- EBYTE. *E22-900MM22S User Manual: LoRa Module SX1262*. EBYTE, 2022.
- Texas Instruments. *TPL5110 Nano-Power System Timer for Power Gating*. SNAS659. Texas Instruments, 2016.
- Texas Instruments. *THVD1410 3.3V, Half-Duplex RS-485 Transceiver*. SLLSEP8. Texas Instruments, 2018.
- Texas Instruments. *LM321 Single General-Purpose Op-Amp*. SNOSC25. Texas Instruments, 2014.
- Analog Devices. *ADR03 Precision 2.500V Voltage Reference*. Rev F. Analog Devices, 2020.
- Google LLC. *TensorFlow Lite for Microcontrollers*. github.com/tensorflow/tflite-micro, 2023.
- Gromes, J. *RadioLib — Universal wireless communication library*. github.com/jgromes/RadioLib, 2024.

**End of Document**
