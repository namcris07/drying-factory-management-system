-- CreateTable
CREATE TABLE "User" (
    "userID" SERIAL NOT NULL,
    "password" TEXT,
    "email" TEXT,
    "PhoneNumber" TEXT,
    "dateOfBirth" DATE,
    "gender" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMPTZ,
    "Role" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("userID")
);

-- CreateTable
CREATE TABLE "Zones" (
    "ZoneID" SERIAL NOT NULL,
    "ZoneName" TEXT,
    "ZoneDescription" TEXT,
    "userID" INTEGER,

    CONSTRAINT "Zones_pkey" PRIMARY KEY ("ZoneID")
);

-- CreateTable
CREATE TABLE "Devices" (
    "DeviceID" SERIAL NOT NULL,
    "DeviceName" TEXT,
    "DeviceStatus" TEXT,
    "MQTTTopicSensor" TEXT,
    "MQTTTopicCmd" TEXT,
    "DeviceType" TEXT,
    "MetaData" JSONB,
    "ZoneID" INTEGER,

    CONSTRAINT "Devices_pkey" PRIMARY KEY ("DeviceID")
);

-- CreateTable
CREATE TABLE "Recipes" (
    "RecipeID" SERIAL NOT NULL,
    "RecipeName" TEXT,
    "RecipeFruits" TEXT,
    "TimeDurationEst" INTEGER,
    "userID" INTEGER,

    CONSTRAINT "Recipes_pkey" PRIMARY KEY ("RecipeID")
);

-- CreateTable
CREATE TABLE "RecipeSteps" (
    "StepID" SERIAL NOT NULL,
    "RecipeID" INTEGER,
    "StepNo" INTEGER,
    "TemperatureGoal" DOUBLE PRECISION,
    "HumidityGoal" DOUBLE PRECISION,
    "DurationMinutes" INTEGER,
    "FanStatus" TEXT,
    "StepStatus" TEXT,

    CONSTRAINT "RecipeSteps_pkey" PRIMARY KEY ("StepID")
);

-- CreateTable
CREATE TABLE "RecipeModification" (
    "RM_ID" SERIAL NOT NULL,
    "userID" INTEGER,
    "RecipeID" INTEGER,
    "ModifiedAt" TIMESTAMPTZ,

    CONSTRAINT "RecipeModification_pkey" PRIMARY KEY ("RM_ID")
);

-- CreateTable
CREATE TABLE "Batches" (
    "BatchesID" SERIAL NOT NULL,
    "BatchStatus" TEXT,
    "BatchResult" TEXT,
    "OperationMode" TEXT,
    "CurrentStep" INTEGER,
    "RecipeID" INTEGER,
    "DeviceID" INTEGER,

    CONSTRAINT "Batches_pkey" PRIMARY KEY ("BatchesID")
);

-- CreateTable
CREATE TABLE "BatchOperation" (
    "BO_ID" SERIAL NOT NULL,
    "userID" INTEGER,
    "BatchesID" INTEGER,
    "StartedAt" TIMESTAMPTZ,
    "EndedAt" TIMESTAMPTZ,

    CONSTRAINT "BatchOperation_pkey" PRIMARY KEY ("BO_ID")
);

-- CreateTable
CREATE TABLE "SensorDataLog" (
    "LogID" SERIAL NOT NULL,
    "Measurements" JSONB,
    "LogTimestamp" TIMESTAMPTZ,
    "DeviceID" INTEGER,

    CONSTRAINT "SensorDataLog_pkey" PRIMARY KEY ("LogID")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "ConfigKey" TEXT NOT NULL,
    "ConfigValue" TEXT,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("ConfigKey")
);

-- CreateTable
CREATE TABLE "SystemConfigUpdate" (
    "SCU_ID" SERIAL NOT NULL,
    "userID" INTEGER,
    "ConfigKey" TEXT,
    "UpdatedAt" TIMESTAMPTZ,

    CONSTRAINT "SystemConfigUpdate_pkey" PRIMARY KEY ("SCU_ID")
);

-- CreateTable
CREATE TABLE "Alerts" (
    "AlertID" SERIAL NOT NULL,
    "AlertType" TEXT,
    "AlertMessage" TEXT,
    "AlertTime" TIMESTAMPTZ,
    "AlertStatus" TEXT,
    "DeviceID" INTEGER,
    "BatchesID" INTEGER,

    CONSTRAINT "Alerts_pkey" PRIMARY KEY ("AlertID")
);

-- CreateTable
CREATE TABLE "AlertResolution" (
    "AR_ID" SERIAL NOT NULL,
    "userID" INTEGER,
    "AlertID" INTEGER,
    "ResolveTime" TIMESTAMPTZ,
    "ResolveStatus" TEXT,
    "ResolveNote" TEXT,

    CONSTRAINT "AlertResolution_pkey" PRIMARY KEY ("AR_ID")
);

-- AddForeignKey
ALTER TABLE "Zones" ADD CONSTRAINT "Zones_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devices" ADD CONSTRAINT "Devices_ZoneID_fkey" FOREIGN KEY ("ZoneID") REFERENCES "Zones"("ZoneID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipes" ADD CONSTRAINT "Recipes_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeSteps" ADD CONSTRAINT "RecipeSteps_RecipeID_fkey" FOREIGN KEY ("RecipeID") REFERENCES "Recipes"("RecipeID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeModification" ADD CONSTRAINT "RecipeModification_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeModification" ADD CONSTRAINT "RecipeModification_RecipeID_fkey" FOREIGN KEY ("RecipeID") REFERENCES "Recipes"("RecipeID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batches" ADD CONSTRAINT "Batches_RecipeID_fkey" FOREIGN KEY ("RecipeID") REFERENCES "Recipes"("RecipeID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batches" ADD CONSTRAINT "Batches_DeviceID_fkey" FOREIGN KEY ("DeviceID") REFERENCES "Devices"("DeviceID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchOperation" ADD CONSTRAINT "BatchOperation_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchOperation" ADD CONSTRAINT "BatchOperation_BatchesID_fkey" FOREIGN KEY ("BatchesID") REFERENCES "Batches"("BatchesID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorDataLog" ADD CONSTRAINT "SensorDataLog_DeviceID_fkey" FOREIGN KEY ("DeviceID") REFERENCES "Devices"("DeviceID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemConfigUpdate" ADD CONSTRAINT "SystemConfigUpdate_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemConfigUpdate" ADD CONSTRAINT "SystemConfigUpdate_ConfigKey_fkey" FOREIGN KEY ("ConfigKey") REFERENCES "SystemConfig"("ConfigKey") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerts" ADD CONSTRAINT "Alerts_DeviceID_fkey" FOREIGN KEY ("DeviceID") REFERENCES "Devices"("DeviceID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerts" ADD CONSTRAINT "Alerts_BatchesID_fkey" FOREIGN KEY ("BatchesID") REFERENCES "Batches"("BatchesID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertResolution" ADD CONSTRAINT "AlertResolution_userID_fkey" FOREIGN KEY ("userID") REFERENCES "User"("userID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertResolution" ADD CONSTRAINT "AlertResolution_AlertID_fkey" FOREIGN KEY ("AlertID") REFERENCES "Alerts"("AlertID") ON DELETE SET NULL ON UPDATE CASCADE;
