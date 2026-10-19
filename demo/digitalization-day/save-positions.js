// Saves device positions (and name/area) from the demo database into
// deploy/ru4/devices.ru4.json, so pins dragged on Map View survive the next reset.
// That file is gitignored: it holds real plant coordinates.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const local = path.join(root, 'deploy/ru4/devices.ru4.json');
const example = path.join(root, 'deploy/ru4/devices.ru4.example.json');
const { PrismaClient } = require(path.join(root, 'apps/backend/generated/prisma-client'));

(async () => {
  const prisma = new PrismaClient();
  const reg = JSON.parse(fs.readFileSync(fs.existsSync(local) ? local : example, 'utf8'));
  const rows = await prisma.device.findMany({ where: { ruId: reg.ruId } });
  const byMac = Object.fromEntries(rows.map(d => [d.macAddress, d]));
  let n = 0;
  for (const d of reg.devices) {
    const row = byMac[d.macAddress];
    if (!row) continue;
    const loc = JSON.parse(row.location || '{}');
    if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
      d.location = { lat: Math.round(loc.lat * 1e6) / 1e6, lng: Math.round(loc.lng * 1e6) / 1e6 };
    }
    d.name = row.name;
    d.area = row.area;
    n++;
  }
  reg._comment = `Saved from the demo database on ${new Date().toISOString().slice(0, 10)} (save-positions.js). Keep out of git.`;
  fs.writeFileSync(local, JSON.stringify(reg, null, 2) + '\n');
  console.log(`Posisi ${n} perangkat disimpan ke ${path.relative(root, local)}. Reset berikutnya memakai file ini.`);
  await prisma.$disconnect();
})().catch(e => { console.error(e.message || e); process.exit(1); });
