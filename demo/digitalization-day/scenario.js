#!/usr/bin/env node
// Digitalization Day demo: publishes the same JSON that the PertaminaGLD Node-RED
// flow publishes (gld/server/decoded, gld/server/alarm, gld/server/topology,
// gld/gateway/status), so the real RU backend + dashboard run unchanged.
//
//   node scenario.js          Enter = next step, angka 1-5 = loncat ke langkah, q = keluar
//   node scenario.js --auto   jalan sendiri (~2 menit), lalu berhenti di langkah terakhir
//
// All data is SIMULATED. Timing is compressed for the stage: normal readings every
// 5 s (field: ~90 s pull), alarm push every 3 s (field: ~10 s).
const crypto = require('crypto');
const readline = require('readline');
const mqtt = require('mqtt');

const URL = process.env.MQTT_URL || 'mqtt://127.0.0.1:1884';
const AUTO = process.argv.includes('--auto');

const GW = '0x0001';
const GLD = { g1: '0x1001', g2: '0x1002', g3: '0x1003' };
const CH = { c1: '0x0010', c2: '0x0011', c3: '0x0012', c4: '0x0013', c5: '0x0014', c6: '0x0015' };

// Mesh in normal operation: CH1-3 talk to the gateway, CH4-6 relay through them.
const NORMAL_PARENTS = {
  [CH.c1]: GW, [CH.c2]: GW, [CH.c3]: GW,
  [CH.c4]: CH.c1, [CH.c5]: CH.c2, [CH.c6]: CH.c3,
};
const NORMAL_GLD_CH = { [GLD.g1]: CH.c1, [GLD.g2]: CH.c2, [GLD.g3]: CH.c3 };

const state = {
  chParent: { ...NORMAL_PARENTS },
  gldCh: { ...NORMAL_GLD_CH },
  chDown: new Set(),
  gas: {}, // nodeIdHex -> { gasClass, confidence, alarm }
};
const seq = {};

const STEPS = [
  {
    title: 'Operasi normal',
    say: 'Semua GLD membaca udara bersih. Data normal disimpan di Cluster Head dan diambil berkala. Mesh: CH1-CH3 langsung ke Gateway, CH4-CH6 multi-hop.',
    show: 'Overview / Devices: semua ONLINE, kolom Last Gas = Clean Air.',
    autoSec: 20,
    apply() {
      state.chParent = { ...NORMAL_PARENTS };
      state.gldCh = { ...NORMAL_GLD_CH };
      state.chDown.clear();
      state.gas = {};
    },
  },
  {
    title: 'Indikasi awal LPG di GLD 2',
    say: 'Model AI di dalam GLD 2 mengenali pola LPG dengan keyakinan 74% — risiko MIDDLE. Belum alarm, tapi operator sudah melihat peringatan.',
    show: 'Devices: GLD 2 → LPG (oranye). Events: Threshold Breach WARNING.',
    autoSec: 15,
    apply() { state.gas[GLD.g2] = { gasClass: 1, confidence: 74, alarm: false }; },
  },
  {
    title: 'ALARM — kebocoran LPG dikonfirmasi',
    say: 'Keyakinan naik ke 93%. GLD mengirim alarm secara PUSH — tidak menunggu jadwal polling. Alarm muncul di dashboard lengkap dengan identitas sensor, area, jenis gas, dan tingkat risiko.',
    show: 'Alerts: GLD alarm CRITICAL dari 0x1002. Klik Acknowledge di depan audiens.',
    autoSec: 25,
    apply() { state.gas[GLD.g2] = { gasClass: 1, confidence: 93, alarm: true }; },
  },
  {
    title: 'Gangguan jaringan — CH 2 mati',
    say: 'Cluster Head 2 berhenti bekerja. Mesh LoRa privat memilih rute baru: GLD 2 dan CH 5 kini lewat CH 3, data dan alarm tetap sampai ke server.',
    show: 'Devices / Unit Layout: CH 2 menjadi OFFLINE (±20 dtk); parent GLD 2 → 0x0012.',
    autoSec: 35,
    apply() {
      state.chDown.add(CH.c2);
      state.chParent[CH.c5] = CH.c3;
      state.gldCh[GLD.g2] = CH.c3;
    },
  },
  {
    title: 'Pulih — area aman kembali',
    say: 'Sumber kebocoran ditangani, GLD 2 kembali membaca udara bersih, CH 2 kembali online dan mesh kembali ke rute normal.',
    show: 'Alerts: klik Resolve. Devices: semua ONLINE, Clean Air.',
    autoSec: 25,
    apply() {
      state.chDown.clear();
      state.chParent = { ...NORMAL_PARENTS };
      state.gldCh = { ...NORMAL_GLD_CH };
      state.gas = {};
    },
  },
];

const client = mqtt.connect(URL, { protocolVersion: 4, clientId: `gld-demo-${process.pid}`, reconnectPeriod: 2000 });
const pub = (topic, payload) => client.publish(topic, JSON.stringify(payload), { qos: 0 });

function gldEvent(nodeIdHex) {
  const g = state.gas[nodeIdHex] || { gasClass: 0, confidence: 95 + Math.floor(Math.random() * 5), alarm: false };
  const s = (seq[nodeIdHex] = ((seq[nodeIdHex] ?? Math.floor(Math.random() * 200)) + 1) & 0xff);
  const ch = state.gldCh[nodeIdHex];
  const nonceHex = crypto.randomBytes(12).toString('hex').toUpperCase();
  const flags = (g.alarm ? 0x01 : 0) | 0x10;
  return {
    ok: true,
    kind: 'gld-event',
    source: 'demo-simulator',
    receivedAt: new Date().toISOString(),
    sourceTopic: 'gld/gateway/uplink',
    outer: { srcIdHex: ch, gatewayIdHex: GW },
    nodeId: parseInt(nodeIdHex, 16),
    nodeIdHex,
    seq: s,
    flags,
    alarm: g.alarm,
    externalPower: true,
    ingressClass: 'production',
    payloadLen: 29,
    decryptOk: true,
    keyId: 1,
    nonceHex,
    gasClass: g.gasClass,
    gasName: ['clearGas', 'LPG', 'methane', 'propane', 'butane', 'reserve', 'anomaly', 'H2'][g.gasClass],
    confidence: g.confidence,
    confidenceValid: true,
    gasClassValid: true,
    batteryMv: 4100,
    batteryValid: true,
    dedupKey: `${ch}:${parseInt(nodeIdHex, 16)}:${s}:${g.alarm ? 'alarm' : 'normal'}`,
    replayStatus: 'new-record-forward',
  };
}

function publishReadings(onlyAlarm) {
  for (const id of Object.values(GLD)) {
    const ev = gldEvent(id);
    if (onlyAlarm && !ev.alarm) continue;
    pub(ev.alarm ? 'gld/server/alarm' : 'gld/server/decoded', ev);
  }
}

function publishTopology() {
  for (const ch of Object.values(CH)) {
    if (state.chDown.has(ch)) continue;
    const parent = state.chParent[ch];
    pub('gld/server/topology', {
      ok: true,
      kind: 'ch-topology',
      source: 'demo-simulator',
      receivedAt: new Date().toISOString(),
      report: 'ch-parent-report',
      gatewayIdHex: GW,
      clusterIdHex: ch,
      parentIdHex: parent,
      parentIsRoot: parent === GW,
      batteryMv: 3950 + Math.floor(Math.random() * 150),
      meshDepth: parent === GW ? 1 : 2,
      gatewayIngressRssiDbm: -60 - Math.floor(Math.random() * 25),
    });
  }
  pub('gld/gateway/status', { ok: true, kind: 'gateway-status', receivedAt: new Date().toISOString(), gatewayIdHex: GW });
}

let current = -1;
function goTo(i) {
  if (i < 0 || i >= STEPS.length) return;
  current = i;
  const st = STEPS[i];
  st.apply();
  publishTopology();
  publishReadings(false);
  console.log(`\n\x1b[1m[${i + 1}/${STEPS.length}] ${st.title}\x1b[0m`);
  console.log(`  Narasi : ${st.say}`);
  console.log(`  Tunjuk : ${st.show}`);
  if (!AUTO) console.log('  (Enter = lanjut, 1-5 = loncat, q = keluar)');
}

client.on('connect', () => {
  if (current >= 0) return;
  console.log(`Terhubung ke ${URL}. DATA SIMULASI — bukan data lapangan.`);
  goTo(0);
  setInterval(() => publishReadings(false), 5000);
  setInterval(() => publishReadings(true), 3000);
  setInterval(publishTopology, 5000);
  if (AUTO) {
    const next = () => {
      if (current >= STEPS.length - 1) return console.log('\nSkenario selesai (tetap mengirim data normal). Ctrl+C untuk keluar.');
      setTimeout(() => { goTo(current + 1); next(); }, STEPS[current].autoSec * 1000);
    };
    next();
  }
});
client.on('error', err => console.error(`MQTT: ${err.message}`));

if (!AUTO) {
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', line => {
    const t = line.trim().toLowerCase();
    if (t === 'q') { client.end(); process.exit(0); }
    if (/^[1-9]$/.test(t)) return goTo(Number(t) - 1);
    goTo(Math.min(current + 1, STEPS.length - 1));
  });
}
