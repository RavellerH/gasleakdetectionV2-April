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
    "parentId" TEXT,
    "registeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Device_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Device_registeredBy_fkey" FOREIGN KEY ("registeredBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Device" ("batteryStats", "deviceType", "healthScore", "id", "isDummy", "location", "macAddress", "networkStats", "registeredAt", "registeredBy", "ruId", "status") SELECT "batteryStats", "deviceType", "healthScore", "id", "isDummy", "location", "macAddress", "networkStats", "registeredAt", "registeredBy", "ruId", "status" FROM "Device";
DROP TABLE "Device";
ALTER TABLE "new_Device" RENAME TO "Device";
CREATE UNIQUE INDEX "Device_macAddress_key" ON "Device"("macAddress");
CREATE INDEX "Device_ruId_status_idx" ON "Device"("ruId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
