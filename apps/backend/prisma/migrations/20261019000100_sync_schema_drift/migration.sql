-- Brings migration history in line with schema.prisma. Earlier changes (EventLog,
-- GasReading confidence/aiClass/riskLevel, SystemSettings.updatedAt) were applied
-- with 'prisma db push' only, so 'prisma migrate deploy' produced an unusable DB.

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
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "macAddress" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "ruId" TEXT NOT NULL,
    "area" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL,
    "batteryStats" TEXT NOT NULL,
    "networkStats" TEXT NOT NULL,
    "healthScore" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "registeredBy" TEXT NOT NULL,
    "isDummy" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Device_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Device_registeredBy_fkey" FOREIGN KEY ("registeredBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Device" ("area", "batteryStats", "deviceType", "healthScore", "id", "isDummy", "location", "macAddress", "networkStats", "parentId", "registeredAt", "registeredBy", "ruId", "status", "updatedAt") SELECT "area", "batteryStats", "deviceType", "healthScore", "id", "isDummy", "location", "macAddress", "networkStats", "parentId", "registeredAt", "registeredBy", "ruId", "status", "updatedAt" FROM "Device";
DROP TABLE "Device";
ALTER TABLE "new_Device" RENAME TO "Device";
CREATE UNIQUE INDEX "Device_macAddress_key" ON "Device"("macAddress");
CREATE INDEX "Device_ruId_status_idx" ON "Device"("ruId", "status");
CREATE TABLE "new_GasReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "aiClass" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "isDummy" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GasReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GasReading" ("confidence", "deviceId", "id", "isDummy", "timestamp") SELECT 0, "deviceId", "id", "isDummy", "timestamp" FROM "GasReading";
DROP TABLE "GasReading";
ALTER TABLE "new_GasReading" RENAME TO "GasReading";
CREATE INDEX "GasReading_deviceId_timestamp_idx" ON "GasReading"("deviceId", "timestamp");
CREATE TABLE "new_SystemSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "warningThreshold" REAL NOT NULL DEFAULT 0.70,
    "criticalThreshold" REAL NOT NULL DEFAULT 0.80,
    "refreshInterval" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SystemSettings" ("criticalThreshold", "id", "refreshInterval", "updatedAt", "warningThreshold") SELECT "criticalThreshold", "id", "refreshInterval", "updatedAt", "warningThreshold" FROM "SystemSettings";
DROP TABLE "SystemSettings";
ALTER TABLE "new_SystemSettings" RENAME TO "SystemSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EventLog_timestamp_idx" ON "EventLog"("timestamp");

-- CreateIndex
CREATE INDEX "EventLog_acknowledged_idx" ON "EventLog"("acknowledged");

