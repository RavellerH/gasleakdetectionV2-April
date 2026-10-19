// Clean RU IV Cilacap device register — no demo readings. See deploy/ru4/README.md.
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('../generated/prisma-client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();
const DEVICE_TYPES = new Set(['GATEWAY', 'CLUSTER', 'SENSOR']);
const ID_RANGES = { GATEWAY: [0x0001, 0x000f], CLUSTER: [0x0010, 0x0fff], SENSOR: [0x1001, 0xfeff] };

function loadRegister(file) {
  const reg = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!reg.ruId || !Array.isArray(reg.devices) || reg.devices.length === 0) {
    throw new Error('register must contain ruId and a non-empty devices array');
  }
  const seen = new Set();
  for (const d of reg.devices) {
    if (!DEVICE_TYPES.has(d.deviceType)) throw new Error(`${d.macAddress}: unknown deviceType ${d.deviceType}`);
    if (!/^0x[0-9A-F]{4}$/.test(d.macAddress)) throw new Error(`${d.macAddress}: macAddress must be nodeIdHex like 0x1001`);
    const id = parseInt(d.macAddress, 16);
    const [min, max] = ID_RANGES[d.deviceType];
    if (id < min || id > max) throw new Error(`${d.macAddress}: outside ${d.deviceType} ID range`);
    if (seen.has(d.macAddress)) throw new Error(`${d.macAddress}: duplicate`);
    seen.add(d.macAddress);
    if (typeof d.location?.lat !== 'number' || typeof d.location?.lng !== 'number') {
      throw new Error(`${d.macAddress}: location.lat/lng required`);
    }
  }
  for (const d of reg.devices) {
    if (d.parent && !seen.has(d.parent)) throw new Error(`${d.macAddress}: parent ${d.parent} not in register`);
  }
  return reg;
}

async function ensureAdmin(ruId) {
  const existing = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
  for (const u of await prisma.user.findMany()) {
    if (await bcrypt.compare('admin', u.password)) {
      console.warn(`WARNING: user ${u.email} still has the demo password "admin" — change it before go-live.`);
    }
  }
  if (existing) return existing;
  if (await prisma.user.count() > 0) throw new Error('users exist but none is ADMIN; create an admin first');
  const email = process.env.GLD_ADMIN_EMAIL;
  const password = process.env.GLD_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12 || password === 'admin') {
    throw new Error('no users yet: set GLD_ADMIN_EMAIL and GLD_ADMIN_PASSWORD (min 12 chars)');
  }
  return prisma.user.create({
    data: { email: email.trim().toLowerCase(), name: `${ruId} Admin`, password: await bcrypt.hash(password, 12), role: 'ADMIN', ruId },
  });
}

async function main() {
  const file = path.resolve(process.argv[2] || path.join(__dirname, '../../../deploy/ru4/devices.ru4.example.json'));
  const reg = loadRegister(file);
  console.log(`--- RU register ${reg.ruId}: ${reg.devices.length} devices from ${file} ---`);

  const dummyIds = (await prisma.device.findMany({ where: { isDummy: true }, select: { id: true } })).map(d => d.id);
  const readings = await prisma.gasReading.deleteMany({ where: { OR: [{ isDummy: true }, { deviceId: { in: dummyIds } }] } });
  // A database that still holds demo devices also holds demo operator events
  // (LOGIN/ACK with no deviceId), so those go too.
  const events = await prisma.eventLog.deleteMany({
    where: dummyIds.length ? { OR: [{ deviceId: { in: dummyIds } }, { deviceId: null }] } : { deviceId: { in: [] } },
  });
  await prisma.device.updateMany({ where: { parentId: { in: dummyIds } }, data: { parentId: null } });
  const devices = await prisma.device.deleteMany({ where: { isDummy: true } });
  console.log(`Removed demo data: ${devices.count} devices, ${readings.count} readings, ${events.count} events.`);

  const admin = await ensureAdmin(reg.ruId);

  // Parents first so parentId can be resolved.
  const order = { GATEWAY: 0, CLUSTER: 1, SENSOR: 2 };
  const byMac = {};
  for (const d of [...reg.devices].sort((a, b) => order[a.deviceType] - order[b.deviceType])) {
    const parent = d.parent ? byMac[d.parent] : null;
    const data = {
      name: d.name || d.macAddress,
      deviceType: d.deviceType,
      ruId: reg.ruId,
      area: (d.area || '').trim(),
      location: JSON.stringify(d.location),
      parentId: parent ? parent.id : null,
      isDummy: false,
    };
    const network = JSON.stringify({ rssi: -100, qualityScore: '-', parentMac: d.parent || null });
    byMac[d.macAddress] = await prisma.device.upsert({
      where: { macAddress: d.macAddress },
      create: {
        ...data,
        macAddress: d.macAddress,
        batteryStats: JSON.stringify({ voltage: 0, soc: 0 }),
        networkStats: network,
        healthScore: 0,
        status: 'OFFLINE',
        registeredBy: admin.id,
      },
      update: { ...data, networkStats: network },
    });
    console.log(`  ${d.macAddress}  ${d.deviceType.padEnd(7)}  ${data.area || '-'}  -> parent ${d.parent || '-'}`);
  }

  const extra = await prisma.device.findMany({ where: { ruId: reg.ruId, macAddress: { notIn: reg.devices.map(d => d.macAddress) } } });
  if (extra.length) console.warn(`Note: ${extra.length} other ${reg.ruId} device(s) kept (not in register): ${extra.map(d => d.macAddress).join(', ')}`);
  console.log('--- done ---');
}

main()
  .catch(e => { console.error(e.message || e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
