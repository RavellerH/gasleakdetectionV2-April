import { PrismaClient } from '../generated/prisma-client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

// Which RU(s) this gateway deployment aggregates. Comma-separated.
const RU_IDS = (process.env.GATEWAY_RU_IDS ?? 'RU4')
  .split(',').map(s => s.trim()).filter(Boolean);

// Local RU backend(s). In dev every RU points at the single backend on :4000.
const BASE_URL = process.env.GATEWAY_RU_BASE_URL ?? 'http://localhost:4000/graphql';

// Must match the RU backend's GATEWAY_SYNC_KEY (sent as x-gateway-key).
const API_KEY = process.env.GATEWAY_SYNC_KEY ?? 'change-me-per-ru-site';

const ADMIN_EMAIL = process.env.GATEWAY_ADMIN_EMAIL ?? 'admin@gld.com';
const ADMIN_NAME = process.env.GATEWAY_ADMIN_NAME ?? 'System Admin';
const ADMIN_PASSWORD = process.env.GATEWAY_ADMIN_PASSWORD ?? 'admin';

async function main() {
  for (const ruId of RU_IDS) {
    await prisma.ruSource.upsert({
      where: { id: ruId },
      update: { baseUrl: BASE_URL, apiKey: API_KEY },
      create: { id: ruId, baseUrl: BASE_URL, apiKey: API_KEY },
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
