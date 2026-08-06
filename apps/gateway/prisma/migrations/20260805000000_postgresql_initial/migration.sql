CREATE TABLE "RuSource" (
    "id" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RuSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GatewayUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GatewayUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "macAddress" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "ruId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "batteryStats" TEXT NOT NULL,
    "networkStats" TEXT NOT NULL,
    "healthScore" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "registeredBy" TEXT NOT NULL,
    "isDummy" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GasReading" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "ruId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "aiClass" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "isDummy" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GasReading_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "deviceId" TEXT,
    "ruId" TEXT,
    "operatorId" TEXT,
    "operatorEmail" TEXT,
    "message" TEXT NOT NULL,
    "details" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "ackNote" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "warningThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.70,
    "criticalThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.80,
    "refreshInterval" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GatewayUser_email_key" ON "GatewayUser"("email");
CREATE UNIQUE INDEX "Device_ruId_sourceId_key" ON "Device"("ruId", "sourceId");
CREATE UNIQUE INDEX "Device_ruId_macAddress_key" ON "Device"("ruId", "macAddress");
CREATE INDEX "Device_ruId_status_idx" ON "Device"("ruId", "status");
CREATE UNIQUE INDEX "GasReading_ruId_sourceId_key" ON "GasReading"("ruId", "sourceId");
CREATE INDEX "GasReading_deviceId_timestamp_idx" ON "GasReading"("deviceId", "timestamp");
CREATE INDEX "GasReading_ruId_timestamp_idx" ON "GasReading"("ruId", "timestamp");
CREATE UNIQUE INDEX "EventLog_ruId_sourceId_key" ON "EventLog"("ruId", "sourceId");
CREATE INDEX "EventLog_timestamp_idx" ON "EventLog"("timestamp");
CREATE INDEX "EventLog_ruId_timestamp_idx" ON "EventLog"("ruId", "timestamp");
CREATE INDEX "EventLog_acknowledged_idx" ON "EventLog"("acknowledged");

ALTER TABLE "GasReading"
ADD CONSTRAINT "GasReading_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
