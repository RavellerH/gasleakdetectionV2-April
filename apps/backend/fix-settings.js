const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
  const count = await prisma.systemSettings.count();
  console.log('Count:', count);
  const settings = await prisma.systemSettings.findMany();
  console.log('Settings:', JSON.stringify(settings, null, 2));
}

fix().catch(e => console.error(e)).finally(() => prisma.$disconnect());
