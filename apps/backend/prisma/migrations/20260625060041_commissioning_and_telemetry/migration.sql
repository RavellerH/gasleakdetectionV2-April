/*
  Warnings:

  - You are about to drop the column `ppm` on the `GasReading` table. All the data in the column will be lost.
  - Added the required column `name` to the `Device` table without a default value. This is not possible if the table is not empty.
  - Added the required column `confidence` to the `GasReading` table without a default value. This is not possible if the table is not empty.

*/
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
    "location" TEXT NOT NULL,
    "batteryStats" TEXT NOT NULL,
    "networkStats" TEXT NOT NULL,
    "healthScore" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "registeredBy" TEXT NOT NULL,
    "isDummy" BOOLEAN NOT NULL DEFAULT false,
    "batteryMv" INTEGER,
    "lastSeenAt" DATETIME,
    "clusterId" INTEGER,
    "rssi" INTEGER,
    "snr" REAL,
    "commissioningStatus" TEXT NOT NULL DEFAULT 'DISCOVERED',
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commissionedAt" DATETIME,
    "commissionedBy" TEXT,
    "parentId" TEXT,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Device_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Device_registeredBy_fkey" FOREIGN KEY ("registeredBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Device" ("batteryStats", "deviceType", "healthScore", "id", "isDummy", "location", "macAddress", "networkStats", "parentId", "registeredAt", "registeredBy", "ruId", "status") SELECT "batteryStats", "deviceType", "healthScore", "id", "isDummy", "location", "macAddress", "networkStats", "parentId", "registeredAt", "registeredBy", "ruId", "status" FROM "Device";
DROP TABLE "Device";
ALTER TABLE "new_Device" RENAME TO "Device";
CREATE UNIQUE INDEX "Device_macAddress_key" ON "Device"("macAddress");
CREATE INDEX "Device_ruId_status_idx" ON "Device"("ruId", "status");
CREATE INDEX "Device_ruId_commissioningStatus_idx" ON "Device"("ruId", "commissioningStatus");
CREATE TABLE "new_GasReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "aiClass" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "powerMode" TEXT,
    "isDummy" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GasReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GasReading" ("deviceId", "id", "isDummy", "timestamp") SELECT "deviceId", "id", "isDummy", "timestamp" FROM "GasReading";
DROP TABLE "GasReading";
ALTER TABLE "new_GasReading" RENAME TO "GasReading";
CREATE INDEX "GasReading_deviceId_timestamp_idx" ON "GasReading"("deviceId", "timestamp");
CREATE TABLE "new_SystemSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "warningThreshold" REAL NOT NULL DEFAULT 0.70,
    "criticalThreshold" REAL NOT NULL DEFAULT 0.80,
    "refreshInterval" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" DATETIME NOT NULL,
    "siteSetupComplete" BOOLEAN NOT NULL DEFAULT false,
    "ruName" TEXT,
    "ruLat" REAL,
    "ruLng" REAL,
    "mqttBrokerHost" TEXT,
    "mqttBrokerPort" INTEGER DEFAULT 1884,
    "aesKeyId" INTEGER
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
