const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const count = await prisma.device.count();
  const online = await prisma.device.count({ where: { status: 'ONLINE' } });
  const sample = await prisma.device.findFirst();
  console.log('--- DATABASE CHECK ---');
  console.log('Total Devices:', count);
  console.log('Online Devices:', online);
  console.log('Sample Device:', sample);
  await prisma.$disconnect();
}
check();
