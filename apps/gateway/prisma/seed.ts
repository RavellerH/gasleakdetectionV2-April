import { PrismaClient } from '../generated/prisma-client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

// Which RU(s) this gateway deployment aggregates. Comma-separated.
const RU_IDS = (process.env.GATEWAY_RU_IDS ?? 'RU2,RU3,RU4,RU5,RU6,RU7')
  .split(',').map(s => s.trim()).filter(Boolean);

// Shared values are a local-development fallback. Production should set
// GATEWAY_RU2_BASE_URL/GATEWAY_RU2_SYNC_KEY through RU7 independently.
const SHARED_BASE_URL = process.env.GATEWAY_RU_BASE_URL;
const SHARED_API_KEY = process.env.GATEWAY_SYNC_KEY;

const ADMIN_EMAIL = process.env.GATEWAY_ADMIN_EMAIL ?? 'admin@gld.com';
const ADMIN_NAME = process.env.GATEWAY_ADMIN_NAME ?? 'System Admin';
const ADMIN_PASSWORD = process.env.GATEWAY_ADMIN_PASSWORD ?? 'admin';

async function main() {
  if (ADMIN_PASSWORD.length < 12 || ADMIN_PASSWORD === 'admin') {
    throw new Error('GATEWAY_ADMIN_PASSWORD must be a non-default password of at least 12 characters');
  }
  for (const ruId of RU_IDS) {
    if (!/^RU[2-7]$/.test(ruId)) throw new Error(`Unsupported RU id: ${ruId}`);
    const baseUrl = process.env[`GATEWAY_${ruId}_BASE_URL`] ?? SHARED_BASE_URL;
    const apiKey = process.env[`GATEWAY_${ruId}_SYNC_KEY`] ?? SHARED_API_KEY;
    if (!baseUrl || !apiKey || apiKey === 'change-me' || apiKey === 'change-me-per-ru-site') {
      throw new Error(`Missing production-safe URL/key configuration for ${ruId}`);
    }
    await prisma.ruSource.upsert({
      where: { id: ruId },
      update: { baseUrl, apiKey },
      create: { id: ruId, baseUrl, apiKey },
    });
  }

  await prisma.gatewayUser.upsert({
    where: { email: ADMIN_EMAIL },
    update: { name: ADMIN_NAME, role: 'ADMIN' },
    create: { email: ADMIN_EMAIL, name: ADMIN_NAME, role: 'ADMIN', password: await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS) },
  });

  const sources = await prisma.ruSource.findMany();
  const users = await prisma.gatewayUser.findMany();
  console.log(`Seeded ${sources.length} RuSource(s):`);
  for (const s of sources) console.log(`  ${s.id} -> ${s.baseUrl}`);
  console.log(`Seeded ${users.length} GatewayUser(s):`);
  for (const u of users) console.log(`  ${u.email} (${u.role})`);
}

main()
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
