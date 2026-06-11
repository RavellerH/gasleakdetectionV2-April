const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- REFRESHING DATABASE WITH v2.1 HARDWARE DISTRIBUTION ---');

  await prisma.gasReading.deleteMany({});
  await prisma.eventLog.deleteMany({});
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
    'RU2': { ch: 3, gw: 1, sns: 10, center: { lat:  1.6785, lng: 101.4725 } }, // Dumai, Riau
    'RU3': { ch: 3, gw: 1, sns: 4,  center: { lat: -2.9782, lng: 104.7994 } }, // Plaju, Palembang, South Sumatra
    'RU4': { ch: 2, gw: 1, sns: 3,  center: { lat: -7.7196, lng: 108.9887 } }, // Cilacap, Central Java
    'RU5': { ch: 1, gw: 1, sns: 2,  center: { lat: -1.2627, lng: 116.8162 } }, // Balikpapan, East Kalimantan
    'RU6': { ch: 2, gw: 2, sns: 4,  center: { lat: -6.3717, lng: 108.3881 } }, // Balongan, Indramayu, West Java
    'RU7': { ch: 11, gw: 1, sns: 5, center: { lat: -1.3157, lng: 131.0332 } }  // Kasim, Sorong Regency, West Papua
  };

  const allSensors = [];

  for (const [ru, config] of Object.entries(RU_DISTRIBUTION)) {
    const { lat, lng } = config.center;
    const gateways = [];

    // 1. GATEWAYS
    for (let i = 1; i <= config.gw; i++) {
      const gw = await prisma.device.create({
        data: {
          macAddress: `${ru}-GW-0${i}`,
          name: `${ru} Gateway ${i}`,
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
          name: `${ru} Cluster Head ${i}`,
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
      const sensor = await prisma.device.create({
        data: {
          macAddress: `${ru}-SNS-0${i < 10 ? '0' + i : i}`,
          name: `${ru} Sensor ${i}`,
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
      allSensors.push({ ...sensor, ruId: ru, sensorIndex: i });
    }
  }

  // ─── GAS READINGS: 24h hourly per sensor ───────────────────────────────────
  const now = Date.now();
  // Profiles: normal=no gas, elevated=MIDDLE risk, spiking=HIGH risk
  for (const sensor of allSensors) {
    const rand = Math.random();
    let profile;
    if (rand < 0.55)      profile = 'normal';    // 55% — class 0, conf < 0.70
    else if (rand < 0.80) profile = 'elevated';  // 25% — class ≠ 0, conf 0.70–0.79
    else                  profile = 'spiking';   // 20% — class ≠ 0, conf 0.80–1.00

    for (let h = 167; h >= 0; h--) {
      const ts = new Date(now - h * 60 * 60 * 1000);
      const hour = ts.getHours();
      let confidence, aiClass;

      if (profile === 'normal') {
        // No gas — class 0, confidence low (noise floor 0.0–0.55)
        aiClass = 0;
        confidence = Math.random() * 0.55;
      } else if (profile === 'elevated') {
        // MIDDLE risk during working hours, normal otherwise
        if (hour >= 6 && hour <= 18) {
          aiClass = Math.ceil(Math.random() * 4); // gas class 1–4
          confidence = 0.70 + Math.random() * 0.09; // 0.70–0.79
        } else {
          aiClass = 0;
          confidence = Math.random() * 0.50;
        }
      } else {
        // HIGH risk at peak hours (startup / mid-shift / cool-down), MIDDLE other hours
        const isPeak = hour === 9 || hour === 14 || hour === 20;
        if (isPeak) {
          aiClass = Math.ceil(Math.random() * 8); // gas class 1–8
          confidence = 0.80 + Math.random() * 0.19; // 0.80–0.99
        } else {
          aiClass = Math.ceil(Math.random() * 3); // gas class 1–3
          confidence = 0.60 + Math.random() * 0.15; // 0.60–0.75
        }
      }

      confidence = Math.min(1, Math.max(0, Math.round(confidence * 10000) / 10000));
      const riskLevel = (aiClass !== 0 && confidence >= 0.80) ? 'HIGH'
        : (aiClass !== 0 && confidence >= 0.70) ? 'MIDDLE'
        : 'LOW';

      await prisma.gasReading.create({
        data: { deviceId: sensor.id, confidence, aiClass, riskLevel, isDummy: true, timestamp: ts }
      });
    }
  }

  // ─── EVENT LOG: sample historical events ───────────────────────────────────
  const ru2Sensors  = allSensors.filter(s => s.ruId === 'RU2');
  const ru5Sensors  = allSensors.filter(s => s.ruId === 'RU5');
  const ru7Sensors  = allSensors.filter(s => s.ruId === 'RU7');

  const hoursAgo = (h) => new Date(now - h * 60 * 60 * 1000);

  const sampleEvents = [
    // Logins
    { type: 'LOGIN', severity: 'INFO', operatorId: admin.id, operatorEmail: 'admin@gld.com', message: 'Operator admin@gld.com signed in', timestamp: hoursAgo(47) },
    { type: 'LOGIN', severity: 'INFO', operatorId: admin.id, operatorEmail: 'admin@gld.com', message: 'Operator admin@gld.com signed in', timestamp: hoursAgo(22) },
    { type: 'LOGIN', severity: 'INFO', operatorId: admin.id, operatorEmail: 'admin@gld.com', message: 'Operator admin@gld.com signed in', timestamp: hoursAgo(3) },

    // Device offline/online events
    {
      type: 'DEVICE_OFFLINE', severity: 'WARNING',
      deviceId: ru5Sensors[0]?.id,  ruId: 'RU5',
      message: `RU5 Sensor 1 (RU5) changed status: ONLINE → OFFLINE`,
      timestamp: hoursAgo(18)
    },
    {
      type: 'DEVICE_ONLINE', severity: 'INFO',
      deviceId: ru5Sensors[0]?.id, ruId: 'RU5',
      message: `RU5 Sensor 1 (RU5) changed status: OFFLINE → ONLINE`,
      timestamp: hoursAgo(16)
    },
    {
      type: 'DEVICE_OFFLINE', severity: 'WARNING',
      deviceId: ru7Sensors[0]?.id, ruId: 'RU7',
      message: `RU7 Sensor 1 (RU7) changed status: ONLINE → OFFLINE`,
      timestamp: hoursAgo(6),
    },

    // Threshold breach events
    {
      type: 'THRESHOLD_BREACH', severity: 'WARNING',
      deviceId: ru2Sensors[0]?.id, ruId: 'RU2',
      message: `${ru2Sensors[0]?.name || 'RU2 Sensor 1'} — MIDDLE risk detected (class 2, confidence 0.74)`,
      details: JSON.stringify({ confidence: 0.74, aiClass: 2, riskLevel: 'MIDDLE', macAddress: 'RU2-SNS-01' }),
      timestamp: hoursAgo(20)
    },
    {
      type: 'THRESHOLD_BREACH', severity: 'CRITICAL',
      deviceId: ru2Sensors[1]?.id, ruId: 'RU2',
      message: `${ru2Sensors[1]?.name || 'RU2 Sensor 2'} — HIGH risk detected (class 5, confidence 0.87)`,
      details: JSON.stringify({ confidence: 0.87, aiClass: 5, riskLevel: 'HIGH', macAddress: 'RU2-SNS-02' }),
      timestamp: hoursAgo(14)
    },
    {
      type: 'THRESHOLD_BREACH', severity: 'WARNING',
      deviceId: ru2Sensors[2]?.id, ruId: 'RU2',
      message: `${ru2Sensors[2]?.name || 'RU2 Sensor 3'} — MIDDLE risk detected (class 1, confidence 0.72)`,
      details: JSON.stringify({ confidence: 0.72, aiClass: 1, riskLevel: 'MIDDLE', macAddress: 'RU2-SNS-03' }),
      timestamp: hoursAgo(9)
    },
    {
      type: 'THRESHOLD_BREACH', severity: 'WARNING',
      deviceId: ru7Sensors[1]?.id, ruId: 'RU7',
      message: `${ru7Sensors[1]?.name || 'RU7 Sensor 2'} — MIDDLE risk detected (class 3, confidence 0.76)`,
      details: JSON.stringify({ confidence: 0.76, aiClass: 3, riskLevel: 'MIDDLE', macAddress: 'RU7-SNS-02' }),
      timestamp: hoursAgo(5)
    },
    {
      type: 'THRESHOLD_BREACH', severity: 'CRITICAL',
      deviceId: ru7Sensors[2]?.id, ruId: 'RU7',
      message: `${ru7Sensors[2]?.name || 'RU7 Sensor 3'} — HIGH risk detected (class 7, confidence 0.93)`,
      details: JSON.stringify({ confidence: 0.93, aiClass: 7, riskLevel: 'HIGH', macAddress: 'RU7-SNS-03' }),
      timestamp: hoursAgo(2)
    },

    // Acknowledged events (older ones resolved)
    {
      type: 'THRESHOLD_BREACH', severity: 'WARNING',
      deviceId: ru2Sensors[0]?.id, ruId: 'RU2',
      message: `${ru2Sensors[0]?.name || 'RU2 Sensor 1'} — MIDDLE risk detected (class 2, confidence 0.71)`,
      details: JSON.stringify({ confidence: 0.71, aiClass: 2, riskLevel: 'MIDDLE', macAddress: 'RU2-SNS-01' }),
      timestamp: hoursAgo(44),
      acknowledged: true,
      acknowledgedBy: 'admin@gld.com',
      acknowledgedAt: hoursAgo(43),
      ackNote: 'Scheduled maintenance in adjacent pipeline caused temporary pressure fluctuation. Normalised after valve adjustment.'
    },
    {
      type: 'DEVICE_OFFLINE', severity: 'WARNING',
      deviceId: ru5Sensors[0]?.id, ruId: 'RU5',
      message: `RU5 Sensor 2 (RU5) changed status: ONLINE → OFFLINE`,
      timestamp: hoursAgo(38),
      acknowledged: true,
      acknowledgedBy: 'admin@gld.com',
      acknowledgedAt: hoursAgo(36),
      ackNote: 'Battery replaced on site. Device back online.'
    },

    // ACK audit entries
    {
      type: 'ACK', severity: 'INFO',
      ruId: 'RU2', operatorId: admin.id, operatorEmail: 'admin@gld.com',
      message: 'Event acknowledged by admin@gld.com: "RU2 Sensor 1 — MIDDLE risk detected (class 2, confidence 0.71)"',
      details: JSON.stringify({ ackNote: 'Scheduled maintenance in adjacent pipeline caused temporary pressure fluctuation. Normalised after valve adjustment.' }),
      timestamp: hoursAgo(43)
    },
    {
      type: 'ACK', severity: 'INFO',
      ruId: 'RU5', operatorId: admin.id, operatorEmail: 'admin@gld.com',
      message: 'Event acknowledged by admin@gld.com: "RU5 Sensor 2 (RU5) changed status: ONLINE → OFFLINE"',
      details: JSON.stringify({ ackNote: 'Battery replaced on site. Device back online.' }),
      timestamp: hoursAgo(36)
    },
  ];

  for (const ev of sampleEvents) {
    if (!ev) continue;
    await prisma.eventLog.create({
      data: {
        type: ev.type,
        severity: ev.severity || 'INFO',
        deviceId: ev.deviceId || null,
        ruId: ev.ruId || null,
        operatorId: ev.operatorId || null,
        operatorEmail: ev.operatorEmail || null,
        message: ev.message,
        details: ev.details || null,
        acknowledged: ev.acknowledged || false,
        acknowledgedBy: ev.acknowledgedBy || null,
        acknowledgedAt: ev.acknowledgedAt || null,
        ackNote: ev.ackNote || null,
        timestamp: ev.timestamp
      }
    });
  }

  console.log(`Seeded ${allSensors.length} sensors × 168h = ${allSensors.length * 168} gas readings`);
  console.log(`Seeded ${sampleEvents.length} sample event log entries`);
  console.log('Database Refreshed with v2.1 Hardware Distribution!');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
