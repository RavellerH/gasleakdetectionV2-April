const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- REFRESHING DATABASE WITH v2.1 HARDWARE DISTRIBUTION ---');

  await prisma.gasReading.deleteMany({});
  await prisma.device.deleteMany({});
  await prisma.user.deleteMany({});

  const admin = await prisma.user.create({
    data: {
      email: 'admin@gld.com',
      name: 'System Admin',
      password: 'admin',
      role: 'ADMIN',
      ruId: 'ALL'
    }
  });

  const RU_DISTRIBUTION = {
    'RU2': { ch: 3, gw: 1, sns: 10, center: { lat: -0.8602, lng: 131.2510 } },
    'RU3': { ch: 3, gw: 1, sns: 4, center: { lat: -0.8500, lng: 131.2750 } },
    'RU4': { ch: 2, gw: 1, sns: 3, center: { lat: -0.8700, lng: 131.2400 } },
    'RU5': { ch: 1, gw: 1, sns: 2, center: { lat: -0.8400, lng: 131.2900 } },
    'RU6': { ch: 2, gw: 2, sns: 4, center: { lat: -0.8800, lng: 131.2600 } },
    'RU7': { ch: 11, gw: 1, sns: 5, center: { lat: -0.8300, lng: 131.2650 } }
  };

  for (const [ru, config] of Object.entries(RU_DISTRIBUTION)) {
    const { lat, lng } = config.center;
    const gateways = [];

    // 1. GATEWAYS
    for (let i = 1; i <= config.gw; i++) {
      const gw = await prisma.device.create({
        data: {
          macAddress: `${ru}-GW-0${i}`,
          deviceType: 'GATEWAY',
          ruId: ru,
          isDummy: true,
          location: JSON.stringify({ lat: lat + (i * 0.001), lng: lng + (i * 0.001) }),
          batteryStats: JSON.stringify({ voltage: 12.0, soc: 100 }),
          networkStats: JSON.stringify({ rssi: -30, qualityScore: 'A', role: 'MESH_ROOT' }),
          registeredBy: admin.id
        }
      });
      gateways.push(gw);
    }

    const clusterHeads = [];
    // 2. CLUSTER HEADS
    for (let i = 1; i <= config.ch; i++) {
      const parentGw = gateways[(i - 1) % gateways.length];
      const ch = await prisma.device.create({
        data: {
          macAddress: `${ru}-CH-0${i < 10 ? '0' + i : i}`,
          deviceType: 'CLUSTER',
          ruId: ru,
          parentId: parentGw.id,
          isDummy: true,
          location: JSON.stringify({ 
            lat: lat + (Math.cos(i) * 0.005), 
            lng: lng + (Math.sin(i) * 0.005) 
          }),
          batteryStats: JSON.stringify({ voltage: 4.2, soc: Math.floor(85 + Math.random() * 10) }),
          networkStats: JSON.stringify({ 
            rssiMesh: Math.floor(-50 - Math.random() * 20),
            rssiStar: -45,
            qualityScore: 'A', 
            parentMac: parentGw.macAddress 
          }),
          registeredBy: admin.id
        }
      });
      clusterHeads.push(ch);
    }

    // 3. NODE SENSORS
    for (let i = 1; i <= config.sns; i++) {
      const parentCh = clusterHeads[(i - 1) % clusterHeads.length];
      await prisma.device.create({
        data: {
          macAddress: `${ru}-SNS-0${i < 10 ? '0' + i : i}`,
          deviceType: 'SENSOR',
          ruId: ru,
          parentId: parentCh.id,
          isDummy: true,
          location: JSON.stringify({ 
            lat: JSON.parse(parentCh.location).lat + (Math.random() - 0.5) * 0.002, 
            lng: JSON.parse(parentCh.location).lng + (Math.random() - 0.5) * 0.002 
          }),
          batteryStats: JSON.stringify({ voltage: 3.7, soc: Math.floor(60 + Math.random() * 30) }),
          networkStats: JSON.stringify({ 
            rssi: Math.floor(-70 - Math.random() * 15), 
            qualityScore: 'B', 
            role: 'STAR_NODE', 
            parentMac: parentCh.macAddress 
          }),
          registeredBy: admin.id
        }
      });
    }

    // Add some readings for sensors
    const sensors = await prisma.device.findMany({ where: { ruId: ru, deviceType: 'SENSOR' } });
    for (const sensor of sensors) {
        await prisma.gasReading.create({
            data: {
                deviceId: sensor.id,
                ppm: Math.random() * 45, // Some below threshold
                isDummy: true
            }
        });
    }
  }

  // Add one ALERT case for testing
  const ru2Sensors = await prisma.device.findMany({ where: { ruId: 'RU2', deviceType: 'SENSOR' } });
  if (ru2Sensors.length > 0) {
      await prisma.gasReading.create({
          data: {
              deviceId: ru2Sensors[0].id,
              ppm: 85.5, // Critical alert
              isDummy: true
          }
      });
  }

  console.log('Database Refreshed with v2.1 Hardware Distribution!');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
