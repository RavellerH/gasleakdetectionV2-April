const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const devices = await prisma.device.count();
  const readings = await prisma.gasReading.count();
  const users = await prisma.user.count();
  console.log('Devices:', devices);
  console.log('Readings:', readings);
  console.log('Users:', users);
}

main().finally(() => prisma.$disconnect());
