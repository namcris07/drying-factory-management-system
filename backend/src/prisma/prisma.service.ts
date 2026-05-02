import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    await this.ensureCompatibilitySchema();
  }

  private async ensureCompatibilitySchema() {
    await this.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Organizations" (
        "OrganizationID" SERIAL PRIMARY KEY,
        "OrganizationName" TEXT,
        "OrganizationCode" TEXT UNIQUE,
        "Status" TEXT
      );

      CREATE TABLE IF NOT EXISTS "Factories" (
        "FactoryID" SERIAL PRIMARY KEY,
        "OrganizationID" INTEGER REFERENCES "Organizations"("OrganizationID") ON DELETE SET NULL,
        "FactoryName" TEXT,
        "FactoryCode" TEXT UNIQUE,
        "Status" TEXT
      );

      CREATE TABLE IF NOT EXISTS "Sites" (
        "SiteID" SERIAL PRIMARY KEY,
        "FactoryID" INTEGER REFERENCES "Factories"("FactoryID") ON DELETE SET NULL,
        "SiteName" TEXT,
        "SiteCode" TEXT UNIQUE,
        "Status" TEXT
      );

      CREATE TABLE IF NOT EXISTS "SensorChannels" (
        "SensorChannelID" SERIAL PRIMARY KEY,
        "DeviceID" INTEGER REFERENCES "Devices"("DeviceID") ON DELETE CASCADE,
        "SensorName" TEXT,
        "SensorType" TEXT,
        "FeedKey" TEXT UNIQUE NOT NULL,
        "Status" TEXT,
        "Unit" TEXT,
        "SortOrder" INTEGER,
        "MetaData" JSONB
      );

      CREATE TABLE IF NOT EXISTS "ActuatorChannels" (
        "ActuatorChannelID" SERIAL PRIMARY KEY,
        "DeviceID" INTEGER REFERENCES "Devices"("DeviceID") ON DELETE CASCADE,
        "ActuatorName" TEXT,
        "ActuatorType" TEXT,
        "FeedKey" TEXT UNIQUE NOT NULL,
        "Status" TEXT,
        "ControlMode" TEXT,
        "OnValue" TEXT,
        "OffValue" TEXT,
        "SortOrder" INTEGER,
        "MetaData" JSONB
      );

      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "OrganizationID" INTEGER;
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "FactoryID" INTEGER;
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "SiteID" INTEGER;

      ALTER TABLE "Zones" ADD COLUMN IF NOT EXISTS "OrganizationID" INTEGER;
      ALTER TABLE "Zones" ADD COLUMN IF NOT EXISTS "FactoryID" INTEGER;
      ALTER TABLE "Zones" ADD COLUMN IF NOT EXISTS "SiteID" INTEGER;

      ALTER TABLE "Devices" ADD COLUMN IF NOT EXISTS "OrganizationID" INTEGER;
      ALTER TABLE "Devices" ADD COLUMN IF NOT EXISTS "FactoryID" INTEGER;
      ALTER TABLE "Devices" ADD COLUMN IF NOT EXISTS "SiteID" INTEGER;

      ALTER TABLE "Recipes" ADD COLUMN IF NOT EXISTS "OrganizationID" INTEGER;
      ALTER TABLE "Recipes" ADD COLUMN IF NOT EXISTS "FactoryID" INTEGER;
      ALTER TABLE "Recipes" ADD COLUMN IF NOT EXISTS "SiteID" INTEGER;

      ALTER TABLE "Batches" ADD COLUMN IF NOT EXISTS "OrganizationID" INTEGER;
      ALTER TABLE "Batches" ADD COLUMN IF NOT EXISTS "FactoryID" INTEGER;
      ALTER TABLE "Batches" ADD COLUMN IF NOT EXISTS "SiteID" INTEGER;

      ALTER TABLE "Alerts" ADD COLUMN IF NOT EXISTS "OrganizationID" INTEGER;
      ALTER TABLE "Alerts" ADD COLUMN IF NOT EXISTS "FactoryID" INTEGER;
      ALTER TABLE "Alerts" ADD COLUMN IF NOT EXISTS "SiteID" INTEGER;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'User_OrganizationID_fkey'
        ) THEN
          ALTER TABLE "User"
          ADD CONSTRAINT "User_OrganizationID_fkey"
          FOREIGN KEY ("OrganizationID") REFERENCES "Organizations"("OrganizationID") ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'User_FactoryID_fkey'
        ) THEN
          ALTER TABLE "User"
          ADD CONSTRAINT "User_FactoryID_fkey"
          FOREIGN KEY ("FactoryID") REFERENCES "Factories"("FactoryID") ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'User_SiteID_fkey'
        ) THEN
          ALTER TABLE "User"
          ADD CONSTRAINT "User_SiteID_fkey"
          FOREIGN KEY ("SiteID") REFERENCES "Sites"("SiteID") ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Zones_OrganizationID_fkey'
        ) THEN
          ALTER TABLE "Zones"
          ADD CONSTRAINT "Zones_OrganizationID_fkey"
          FOREIGN KEY ("OrganizationID") REFERENCES "Organizations"("OrganizationID") ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Zones_FactoryID_fkey'
        ) THEN
          ALTER TABLE "Zones"
          ADD CONSTRAINT "Zones_FactoryID_fkey"
          FOREIGN KEY ("FactoryID") REFERENCES "Factories"("FactoryID") ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Zones_SiteID_fkey'
        ) THEN
          ALTER TABLE "Zones"
          ADD CONSTRAINT "Zones_SiteID_fkey"
          FOREIGN KEY ("SiteID") REFERENCES "Sites"("SiteID") ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Devices_OrganizationID_fkey'
        ) THEN
          ALTER TABLE "Devices"
          ADD CONSTRAINT "Devices_OrganizationID_fkey"
          FOREIGN KEY ("OrganizationID") REFERENCES "Organizations"("OrganizationID") ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Devices_FactoryID_fkey'
        ) THEN
          ALTER TABLE "Devices"
          ADD CONSTRAINT "Devices_FactoryID_fkey"
          FOREIGN KEY ("FactoryID") REFERENCES "Factories"("FactoryID") ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Devices_SiteID_fkey'
        ) THEN
          ALTER TABLE "Devices"
          ADD CONSTRAINT "Devices_SiteID_fkey"
          FOREIGN KEY ("SiteID") REFERENCES "Sites"("SiteID") ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Recipes_OrganizationID_fkey'
        ) THEN
          ALTER TABLE "Recipes"
          ADD CONSTRAINT "Recipes_OrganizationID_fkey"
          FOREIGN KEY ("OrganizationID") REFERENCES "Organizations"("OrganizationID") ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Recipes_FactoryID_fkey'
        ) THEN
          ALTER TABLE "Recipes"
          ADD CONSTRAINT "Recipes_FactoryID_fkey"
          FOREIGN KEY ("FactoryID") REFERENCES "Factories"("FactoryID") ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Recipes_SiteID_fkey'
        ) THEN
          ALTER TABLE "Recipes"
          ADD CONSTRAINT "Recipes_SiteID_fkey"
          FOREIGN KEY ("SiteID") REFERENCES "Sites"("SiteID") ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Batches_OrganizationID_fkey'
        ) THEN
          ALTER TABLE "Batches"
          ADD CONSTRAINT "Batches_OrganizationID_fkey"
          FOREIGN KEY ("OrganizationID") REFERENCES "Organizations"("OrganizationID") ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Batches_FactoryID_fkey'
        ) THEN
          ALTER TABLE "Batches"
          ADD CONSTRAINT "Batches_FactoryID_fkey"
          FOREIGN KEY ("FactoryID") REFERENCES "Factories"("FactoryID") ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Batches_SiteID_fkey'
        ) THEN
          ALTER TABLE "Batches"
          ADD CONSTRAINT "Batches_SiteID_fkey"
          FOREIGN KEY ("SiteID") REFERENCES "Sites"("SiteID") ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Alerts_OrganizationID_fkey'
        ) THEN
          ALTER TABLE "Alerts"
          ADD CONSTRAINT "Alerts_OrganizationID_fkey"
          FOREIGN KEY ("OrganizationID") REFERENCES "Organizations"("OrganizationID") ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Alerts_FactoryID_fkey'
        ) THEN
          ALTER TABLE "Alerts"
          ADD CONSTRAINT "Alerts_FactoryID_fkey"
          FOREIGN KEY ("FactoryID") REFERENCES "Factories"("FactoryID") ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'Alerts_SiteID_fkey'
        ) THEN
          ALTER TABLE "Alerts"
          ADD CONSTRAINT "Alerts_SiteID_fkey"
          FOREIGN KEY ("SiteID") REFERENCES "Sites"("SiteID") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
