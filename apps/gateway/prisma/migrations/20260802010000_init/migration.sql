-- CreateTable
CREATE TABLE "RuSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "lastSyncAt" DATETIME,
    "lastError" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GatewayUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "registeredAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GasReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "aiClass" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "isDummy" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" DATETIME NOT NULL,
    CONSTRAINT "GasReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "acknowledgedAt" DATETIME,
    "ackNote" TEXT,
    "timestamp" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "warningThreshold" REAL NOT NULL DEFAULT 0.70,
    "criticalThreshold" REAL NOT NULL DEFAULT 0.80,
    "refreshInterval" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "GatewayUser_email_key" ON "GatewayUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Device_macAddress_key" ON "Device"("macAddress");

-- CreateIndex
CREATE INDEX "Device_ruId_status_idx" ON "Device"("ruId", "status");

-- CreateIndex
CREATE INDEX "GasReading_deviceId_timestamp_idx" ON "GasReading"("deviceId", "timestamp");

-- CreateIndex
CREATE INDEX "EventLog_timestamp_idx" ON "EventLog"("timestamp");

-- CreateIndex
CREATE INDEX "EventLog_acknowledged_idx" ON "EventLog"("acknowledged");

