// Fresh RU4 demo database: migrations + clean RU4 register + 7 days of SIMULATED
// history so Analytics, the 24h heatmap and the event log are populated on stage.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const net = require('net');

// Deleting the DB under a running backend leaves it writing to a removed file
// ("attempt to write a readonly database") and blocks the new one on port 4000.
function backendRunning() {
  return new Promise(resolve => {
    const sock = net.connect(4000, '127.0.0.1');
    sock.once('connect', () => { sock.destroy(); resolve(true); });
    sock.once('error', () => resolve(false));
  });
}

const backend = path.resolve(__dirname, '../../apps/backend');
const db = path.join(backend, 'prisma', 'dev.db');

async function main() {
if (await backendRunning()) {
  console.error('\nBackend lama masih berjalan di port 4000. Tutup dulu jendela "GLD Demo - Backend"');
  console.error('(dan Dashboard/Broker) dari run sebelumnya, lalu jalankan ulang start-demo.\n');
  process.exit(1);
}
for (const f of [db, `${db}-journal`]) if (fs.existsSync(f)) fs.rmSync(f);
const run = (cmd, env = {}) => execSync(cmd, { cwd: backend, stdio: 'inherit', env: { ...process.env, ...env } });
run('npx prisma migrate deploy');
// devices.ru4.json (saved positions, see save-positions.js) wins over the example register
const register = fs.existsSync(path.resolve(backend, '../../deploy/ru4/devices.ru4.json'))
  ? '../../deploy/ru4/devices.ru4.json' : '../../deploy/ru4/devices.ru4.example.json';
run(`node prisma/seed-ru4-cilacap.js ${register}`, {
  GLD_ADMIN_EMAIL: process.env.DEMO_ADMIN_EMAIL || 'demo@gld.local',
  GLD_ADMIN_PASSWORD: process.env.DEMO_ADMIN_PASSWORD || 'demo-gld-2026',
});

const { PrismaClient } = require(path.join(backend, 'generated/prisma-client'));
const prisma = new PrismaClient();
const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const STEP = 10 * MIN;

// Past incidents, all resolved by an operator. offset = time before now.
const INCIDENTS = [
  { gld: '0x1003', offset: 5 * DAY + 14 * HOUR, minutes: 30, gasClass: 7, peak: 0.78, alarm: false, gas: 'H2' },
  { gld: '0x1001', offset: 2 * DAY + 9 * HOUR, minutes: 40, gasClass: 1, peak: 0.88, alarm: true, gas: 'LPG' },
  { gld: '0x1002', offset: 6 * HOUR, minutes: 20, gasClass: 1, peak: 0.73, alarm: false, gas: 'LPG' },
];

function riskOf(cls, conf) {
  if (cls === 0) return 'LOW';
  return conf >= 0.8 ? 'HIGH' : conf >= 0.7 ? 'MIDDLE' : 'LOW';
}

async function backfill() {
  const now = Date.now();
  const glds = await prisma.device.findMany({ where: { deviceType: 'SENSOR', ruId: 'RU4' } });
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const byMac = Object.fromEntries(glds.map(d => [d.macAddress, d]));
  const readings = [];
  for (const d of glds) {
    for (let t = now - 7 * DAY; t < now - STEP; t += STEP) {
      const inc = INCIDENTS.find(i => i.gld === d.macAddress && t >= now - i.offset && t < now - i.offset + i.minutes * MIN);
      if (inc) {
        const frac = (t - (now - inc.offset)) / (inc.minutes * MIN);       // 0..1 across the incident
        const conf = Math.round((0.6 + (inc.peak - 0.6) * Math.sin(Math.PI * frac)) * 100) / 100;
        readings.push({ deviceId: d.id, aiClass: inc.gasClass, confidence: conf, riskLevel: riskOf(inc.gasClass, conf),
          alarm: inc.alarm && conf >= 0.8, timestamp: new Date(t), externalPower: true, gatewayId: '0x0001' });
      } else {
        const conf = Math.round((0.93 + Math.random() * 0.06) * 100) / 100;
        readings.push({ deviceId: d.id, aiClass: 0, confidence: conf, riskLevel: 'LOW', alarm: false,
          timestamp: new Date(t), externalPower: true, gatewayId: '0x0001' });
      }
    }
  }
  for (let i = 0; i < readings.length; i += 500) await prisma.gasReading.createMany({ data: readings.slice(i, i + 500) });

  for (const inc of INCIDENTS) {
    const d = byMac[inc.gld];
    const start = new Date(now - inc.offset + 5 * MIN);
    const done = new Date(now - inc.offset + (inc.minutes + 15) * MIN);
    const type = inc.alarm ? 'GAS_ALARM' : 'THRESHOLD_BREACH';
    const risk = riskOf(inc.gasClass, inc.peak);
    const ev = await prisma.eventLog.create({ data: {
      type, severity: inc.alarm || risk === 'HIGH' ? 'CRITICAL' : 'WARNING', deviceId: d.id, ruId: 'RU4',
      message: `${d.name} — ${inc.alarm ? 'GLD alarm' : `${risk} risk detected`} (${inc.gas}, confidence ${inc.peak.toFixed(2)})`,
      details: JSON.stringify({ simulated: true, aiClass: inc.gasClass, confidence: inc.peak, macAddress: d.macAddress, area: d.area }),
      timestamp: start, acknowledged: true, ackNote: 'RESOLVED', acknowledgedBy: admin.email, acknowledgedAt: done,
    } });
    await prisma.eventLog.create({ data: {
      type: 'ACK', severity: 'INFO', ruId: 'RU4', operatorId: admin.id, operatorEmail: admin.email, timestamp: done,
      message: `Event acknowledged by ${admin.email}: "${ev.message.slice(0, 80)}"`,
    } });
  }
  console.log(`Riwayat simulasi: ${readings.length} pembacaan (7 hari), ${INCIDENTS.length} kejadian lampau (sudah diselesaikan).`);
}

await backfill();
console.log('\nDatabase demo RU4 siap. Login: demo@gld.local / demo-gld-2026');
await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exitCode = 1; });
