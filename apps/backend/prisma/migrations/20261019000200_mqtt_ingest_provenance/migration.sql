-- MQTT ingest from PertaminaGLD Node-RED: device last-seen + reading provenance
ALTER TABLE "Device" ADD COLUMN "lastSeenAt" DATETIME;

ALTER TABLE "GasReading" ADD COLUMN "sourceKey" TEXT;
ALTER TABLE "GasReading" ADD COLUMN "seq" INTEGER;
ALTER TABLE "GasReading" ADD COLUMN "alarm" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GasReading" ADD COLUMN "batteryMv" INTEGER;
ALTER TABLE "GasReading" ADD COLUMN "externalPower" BOOLEAN;
ALTER TABLE "GasReading" ADD COLUMN "gatewayId" TEXT;
ALTER TABLE "GasReading" ADD COLUMN "clusterHeadId" TEXT;

CREATE UNIQUE INDEX "GasReading_sourceKey_key" ON "GasReading"("sourceKey");
