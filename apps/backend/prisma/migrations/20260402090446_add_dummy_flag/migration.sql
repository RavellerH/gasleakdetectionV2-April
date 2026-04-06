-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Device" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "macAddress" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "ruId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "batteryStats" TEXT NOT NULL,
    "networkStats" TEXT NOT NULL,
    "healthScore" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "registeredBy" TEXT NOT NULL,
    "isDummy" BOOLEAN NOT NULL DEFAULT false,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Device" ("batteryStats", "deviceType", "healthScore", "id", "location", "macAddress", "networkStats", "registeredAt", "registeredBy", "ruId", "status") SELECT "batteryStats", "deviceType", "healthScore", "id", "location", "macAddress", "networkStats", "registeredAt", "registeredBy", "ruId", "status" FROM "Device";
DROP TABLE "Device";
ALTER TABLE "new_Device" RENAME TO "Device";
CREATE UNIQUE INDEX "Device_macAddress_key" ON "Device"("macAddress");
CREATE INDEX "Device_ruId_status_idx" ON "Device"("ruId", "status");
CREATE TABLE "new_GasReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "ppm" REAL NOT NULL,
    "isDummy" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GasReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GasReading" ("deviceId", "id", "ppm", "timestamp") SELECT "deviceId", "id", "ppm", "timestamp" FROM "GasReading";
DROP TABLE "GasReading";
ALTER TABLE "new_GasReading" RENAME TO "GasReading";
CREATE INDEX "GasReading_deviceId_timestamp_idx" ON "GasReading"("deviceId", "timestamp");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
