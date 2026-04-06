const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log('--- STARTING CLEANUP OF DUMMY DATA ---');

  try {
    const deletedReadings = await prisma.gasReading.deleteMany({
      where: { isDummy: true }
    });
    console.log(`Deleted ${deletedReadings.count} dummy gas readings.`);

    const deletedDevices = await prisma.device.deleteMany({
      where: { isDummy: true }
    });
    console.log(`Deleted ${deletedDevices.count} dummy devices.`);

    console.log('--- CLEANUP FINISHED ---');
  } catch (e) {
    console.error('Error during cleanup:', e);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
