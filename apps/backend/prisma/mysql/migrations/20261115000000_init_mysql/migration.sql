-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `password` VARCHAR(191) NOT NULL DEFAULT 'admin',
    `ruId` VARCHAR(191) NOT NULL DEFAULT 'ALL',
    `role` VARCHAR(191) NOT NULL DEFAULT 'ADMIN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Device` (
    `id` VARCHAR(191) NOT NULL,
    `macAddress` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `deviceType` VARCHAR(191) NOT NULL,
    `ruId` VARCHAR(191) NOT NULL,
    `area` VARCHAR(191) NOT NULL DEFAULT '',
    `location` TEXT NOT NULL,
    `batteryStats` TEXT NOT NULL,
    `networkStats` TEXT NOT NULL,
    `healthScore` INTEGER NOT NULL DEFAULT 100,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ONLINE',
    `registeredBy` VARCHAR(191) NOT NULL,
    `isDummy` BOOLEAN NOT NULL DEFAULT false,
    `lastSeenAt` DATETIME(3) NULL,
    `parentId` VARCHAR(191) NULL,
    `registeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Device_macAddress_key`(`macAddress`),
    INDEX `Device_ruId_status_idx`(`ruId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GasReading` (
    `id` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NOT NULL,
    `confidence` DOUBLE NOT NULL,
    `aiClass` INTEGER NOT NULL DEFAULT 0,
    `riskLevel` VARCHAR(191) NOT NULL DEFAULT 'LOW',
    `isDummy` BOOLEAN NOT NULL DEFAULT false,
    `sourceKey` VARCHAR(191) NULL,
    `seq` INTEGER NULL,
    `alarm` BOOLEAN NOT NULL DEFAULT false,
    `batteryMv` INTEGER NULL,
    `externalPower` BOOLEAN NULL,
    `gatewayId` VARCHAR(191) NULL,
    `clusterHeadId` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GasReading_sourceKey_key`(`sourceKey`),
    INDEX `GasReading_deviceId_timestamp_idx`(`deviceId`, `timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemSettings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `warningThreshold` DOUBLE NOT NULL DEFAULT 0.70,
    `criticalThreshold` DOUBLE NOT NULL DEFAULT 0.80,
    `refreshInterval` INTEGER NOT NULL DEFAULT 10,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventLog` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL DEFAULT 'INFO',
    `deviceId` VARCHAR(191) NULL,
    `ruId` VARCHAR(191) NULL,
    `operatorId` VARCHAR(191) NULL,
    `operatorEmail` VARCHAR(191) NULL,
    `message` TEXT NOT NULL,
    `details` TEXT NULL,
    `acknowledged` BOOLEAN NOT NULL DEFAULT false,
    `acknowledgedBy` VARCHAR(191) NULL,
    `acknowledgedAt` DATETIME(3) NULL,
    `ackNote` TEXT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EventLog_timestamp_idx`(`timestamp`),
    INDEX `EventLog_acknowledged_idx`(`acknowledged`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Device` ADD CONSTRAINT `Device_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Device`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Device` ADD CONSTRAINT `Device_registeredBy_fkey` FOREIGN KEY (`registeredBy`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GasReading` ADD CONSTRAINT `GasReading_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

