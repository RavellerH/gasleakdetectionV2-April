-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "warningThreshold" REAL NOT NULL DEFAULT 50.0,
    "criticalThreshold" REAL NOT NULL DEFAULT 80.0,
    "refreshInterval" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" DATETIME NOT NULL
);
