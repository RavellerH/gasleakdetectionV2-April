-- AlterTable
ALTER TABLE "Device" ADD COLUMN "updatedAt" DATETIME;

UPDATE "Device" SET "updatedAt" = "registeredAt" WHERE "updatedAt" IS NULL;
