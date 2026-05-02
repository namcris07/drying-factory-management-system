/**
 * prisma/seed.ts
 * Seed the database with comprehensive production-like data.
 * Run: npx prisma db seed
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import {
  orgData, factoryData, siteData, userData,
  zoneData, deviceData, recipeData, alertData, configData,
} from './seed-data';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Seeding database...');

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 89);
  startDate.setHours(0, 0, 0, 0);

  const addDays = (base: Date, days: number, hours = 0, minutes = 0) => {
    const value = new Date(base);
    value.setDate(value.getDate() + days);
    value.setHours(hours, minutes, 0, 0);
    return value;
  };

  const seededRandom = (seed: number) => {
    const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  };

  const batchCountsByDay = (dayIndex: number) => {
    if (dayIndex === 89) return 10;
    const day = addDays(startDate, dayIndex);
    const weekday = day.getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const base = isWeekend ? 8 : 11;
    const spread = isWeekend ? 5 : 6;
    return base + Math.floor(seededRandom(dayIndex + weekday * 31) * spread);
  };

  // Reset dev data to keep seed deterministic.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AlertResolution",
      "Alerts",
      "BatchOperation",
      "Batches",
      "SensorDataLog",
      "RecipeSteps",
      "RecipeStage",
      "RecipeModification",
      "Recipes",
      "ActuatorChannels",
      "SensorChannels",
      "Devices",
      "Zones",
      "SystemConfigUpdate",
      "SystemConfig",
      "User",
      "Sites",
      "Factories",
      "Organizations"
    RESTART IDENTITY CASCADE;
  `);

  // ── 1. Organizations ────────────────────────────────────────────────────────
  for (const o of orgData) {
    await prisma.organization.create({
      data: { organizationID: o.id, organizationName: o.name, organizationCode: o.code, status: o.status },
    });
  }
  console.log(`  ✓ ${orgData.length} organizations created`);

  // ── 2. Factories ────────────────────────────────────────────────────────────
  for (const f of factoryData) {
    await prisma.factory.create({
      data: { factoryID: f.id, factoryName: f.name, factoryCode: f.code, organizationID: f.orgID, status: f.status },
    });
  }
  console.log(`  ✓ ${factoryData.length} factories created`);

  // ── 3. Sites ────────────────────────────────────────────────────────────────
  for (const s of siteData) {
    await prisma.site.create({
      data: { siteID: s.id, siteName: s.name, siteCode: s.code, factoryID: s.factoryID, status: s.status },
    });
  }
  console.log(`  ✓ ${siteData.length} sites created`);

  // ── 4. Users ────────────────────────────────────────────────────────────────
  for (const u of userData) {
    await prisma.user.create({
      data: {
        userID: u.id, firstName: u.first, lastName: u.last,
        email: u.email, password: await bcrypt.hash(u.pass, 10),
        role: u.role, status: 'Active', createdAt: new Date(u.created),
        organizationID: u.orgID, factoryID: u.factID, siteID: u.siteID,
      },
    });
  }
  console.log(`  ✓ ${userData.length} users created`);

  // ── 5. Zones ────────────────────────────────────────────────────────────────
  for (const z of zoneData) {
    await prisma.zone.create({
      data: {
        zoneID: z.id, zoneName: z.name, zoneDescription: z.desc,
        userID: z.userID, organizationID: z.orgID, factoryID: z.factID, siteID: z.siteID,
      },
    });
  }
  console.log(`  ✓ ${zoneData.length} zones created`);

  // ── 6. Devices + SensorChannels + ActuatorChannels ──────────────────────────
  let sensorChannelID = 1;
  let actuatorChannelID = 1;
  for (const d of deviceData) {
    const sensorTopics = d.sensors.map(s => s.feedKey).join(',');
    const actuatorTopics = d.actuators.map(a => a.feedKey).join(',');
    await prisma.device.create({
      data: {
        deviceID: d.id, deviceName: d.name, deviceType: d.type,
        deviceStatus: d.status, zoneID: d.zoneID,
        organizationID: d.orgID, factoryID: d.factID, siteID: d.siteID,
        mqttTopicSensor: sensorTopics,
        mqttTopicCmd: actuatorTopics,
        metaData: { firmware: 'v2.4.0', chamberDescription: d.name },
      },
    });
    // Sensor Channels
    for (let i = 0; i < d.sensors.length; i++) {
      const s = d.sensors[i];
      await prisma.sensorChannel.create({
        data: {
          sensorChannelID: sensorChannelID++,
          deviceID: d.id, sensorName: s.sensorName, sensorType: s.sensorType,
          feedKey: s.feedKey, status: s.status, unit: s.unit ?? null, sortOrder: i + 1,
        },
      });
    }
    // Actuator Channels
    for (let i = 0; i < d.actuators.length; i++) {
      const a = d.actuators[i];
      await prisma.actuatorChannel.create({
        data: {
          actuatorChannelID: actuatorChannelID++,
          deviceID: d.id, actuatorName: a.actuatorName, actuatorType: a.actuatorType,
          feedKey: a.feedKey, status: a.status, controlMode: 'Toggle',
          onValue: a.onVal, offValue: a.offVal, sortOrder: i + 1,
        },
      });
    }
  }
  console.log(`  ✓ ${deviceData.length} devices, ${sensorChannelID - 1} sensor channels, ${actuatorChannelID - 1} actuator channels created`);

  // ── 7. Recipes + Stages + Steps ─────────────────────────────────────────────
  for (const r of recipeData) {
    await prisma.recipe.upsert({
      where: { recipeID: r.id },
      update: {},
      create: {
        recipeID: r.id, recipeName: r.name, recipeFruits: r.fruits,
        timeDurationEst: r.duration, userID: r.userID,
        organizationID: r.orgID, factoryID: r.factID, siteID: r.siteID,
        isActive: r.active,
        steps: {
          create: r.stages.map((s, i) => ({
            stepNo: i + 1, temperatureGoal: s.temp, humidityGoal: s.hum,
            durationMinutes: s.duration, fanStatus: 'On', stepStatus: 'Active',
          })),
        },
        stages: {
          create: r.stages.map(s => ({
            stageOrder: s.stageOrder, durationMinutes: s.duration,
            temperatureSetpoint: s.temp, humiditySetpoint: s.hum,
          })),
        },
      },
    });
  }
  console.log(`  ✓ ${recipeData.length} recipes created`);

  // ── 8. Recipe Modifications ─────────────────────────────────────────────────
  const rmData = [
    { userID: 2, recipeID: 1, daysAgo: 60 }, { userID: 2, recipeID: 1, daysAgo: 30 },
    { userID: 2, recipeID: 2, daysAgo: 45 }, { userID: 2, recipeID: 3, daysAgo: 40 },
    { userID: 6, recipeID: 7, daysAgo: 35 }, { userID: 6, recipeID: 8, daysAgo: 25 },
    { userID: 6, recipeID: 9, daysAgo: 20 }, { userID: 2, recipeID: 6, daysAgo: 15 },
    { userID: 2, recipeID: 11, daysAgo: 10 }, { userID: 6, recipeID: 10, daysAgo: 5 },
    { userID: 2, recipeID: 4, daysAgo: 3 }, { userID: 2, recipeID: 12, daysAgo: 50 },
  ];
  for (const rm of rmData) {
    const modDate = new Date(now);
    modDate.setDate(modDate.getDate() - rm.daysAgo);
    await prisma.recipeModification.create({
      data: { userID: rm.userID, recipeID: rm.recipeID, modifiedAt: modDate },
    });
  }
  console.log(`  ✓ ${rmData.length} recipe modifications created`);

  // ── 9. Batches ──────────────────────────────────────────────────────────────
  // Active devices for batch assignment (exclude Inactive/Maintenance for recent batches)
  const activeDeviceIDs = deviceData.filter(d => d.status === 'Active').map(d => d.id);

  const batchDataArr = [] as Array<{
    id: number; status: 'Completed' | 'Stopped' | 'Error' | 'Running';
    result: string | null; recipeID: number; deviceID: number; startedAt: Date;
    orgID: number; factID: number; siteID: number; currentStage: number;
  }>;

  let batchID = 1;
  for (let dayIndex = 0; dayIndex < 90; dayIndex += 1) {
    const count = batchCountsByDay(dayIndex);
    const dayBase = addDays(startDate, dayIndex);

    for (let slot = 0; slot < count; slot += 1) {
      const recipeID = ((dayIndex + slot) % recipeData.length) + 1;
      const deviceID = activeDeviceIDs[(slot + dayIndex) % activeDeviceIDs.length];
      const device = deviceData.find(d => d.id === deviceID)!;
      const startHour = 6 + ((slot * 2 + dayIndex) % 12);
      const startMinute = (slot % 4) * 15;
      const timeStamp = addDays(dayBase, 0, startHour, startMinute);

      let status: 'Completed' | 'Stopped' | 'Error' | 'Running' = 'Completed';
      let result: string | null = 'CompletedBySchedule';
      let currentStage = 1;

      const pattern = (dayIndex * 17 + slot * 5) % 20;
      if (pattern === 0 || pattern === 11) {
        status = 'Error';
        result = slot % 2 === 0 ? 'ManualFail' : 'SensorFault';
      } else if (pattern === 4 || pattern === 15) {
        status = 'Stopped';
        result = slot % 3 === 0 ? 'HumidityOutOfRange' : 'SystemThresholdExceeded';
      } else if (dayIndex === 89 && slot >= count - 3) {
        status = 'Running';
        result = null;
        currentStage = (slot % 3) + 1;
      } else if (pattern === 8) {
        status = 'Completed';
        result = 'CompletedBySchedule';
      }

      batchDataArr.push({
        id: batchID, status, result, recipeID, deviceID, startedAt: timeStamp,
        orgID: device.orgID, factID: device.factID, siteID: device.siteID,
        currentStage,
      });
      batchID += 1;
    }
  }

  // Create in chunks of 200 for performance
  const CHUNK = 200;
  for (let i = 0; i < batchDataArr.length; i += CHUNK) {
    const chunk = batchDataArr.slice(i, i + CHUNK);
    await prisma.batch.createMany({
      data: chunk.map(b => ({
        batchesID: b.id, batchStatus: b.status, batchResult: b.result,
        operationMode: b.id % 5 === 0 ? 'Manual' : 'Auto',
        currentStep: 1, currentStage: b.currentStage,
        startedAt: b.startedAt, stageStartedAt: b.startedAt,
        recipeID: b.recipeID, deviceID: b.deviceID,
        organizationID: b.orgID, factoryID: b.factID, siteID: b.siteID,
      })),
    });
  }
  console.log(`  ✓ ${batchDataArr.length} batches created`);

  // ── 10. Batch Operations ────────────────────────────────────────────────────
  const opUsers = userData.filter(u => u.role === 'Operator').map(u => u.id);
  const boData = batchDataArr.map((b, i) => ({
    userID: opUsers[i % opUsers.length],
    batchesID: b.id,
    startedAt: b.startedAt,
    endedAt: b.status === 'Running' ? null : new Date(b.startedAt.getTime() + (b.status === 'Completed' ? 6 : 3) * 3600_000),
  }));

  for (let i = 0; i < boData.length; i += CHUNK) {
    await prisma.batchOperation.createMany({
      data: boData.slice(i, i + CHUNK).map(bo => ({
        userID: bo.userID, batchesID: bo.batchesID,
        startedAt: bo.startedAt, endedAt: bo.endedAt,
      })),
    });
  }
  console.log(`  ✓ ${boData.length} batch operations created`);

  // ── 11. Sensor Logs ─────────────────────────────────────────────────────────
  const sensorLogData: Array<{ timestamp: Date; temperature: number; humidity: number; deviceID: number }> = [];

  for (let index = 0; index < batchDataArr.length; index += 1) {
    const batch = batchDataArr[index];
    const tempShift = (batch.deviceID % 3) * 0.8;
    const humShift = (batch.deviceID % 4) * -0.5;

    for (const hour of [0, 4, 8, 12, 16, 20]) {
      const timePoint = new Date(batch.startedAt);
      timePoint.setHours(hour, (index % 6) * 8, 0, 0);
      const cycle = (index % 8) * 0.75;
      const tempBase = 53 + (batch.startedAt.getDate() % 10) * 0.8 + cycle + tempShift + (hour >= 12 ? 2.0 : 0);
      const humBase = 33 - (batch.startedAt.getDate() % 7) * 0.6 + humShift - (hour >= 18 ? 2.0 : 0);

      sensorLogData.push({
        timestamp: timePoint,
        temperature: Number((tempBase + (hour % 5) * 0.25).toFixed(1)),
        humidity: Number((humBase - (hour % 3) * 0.35).toFixed(1)),
        deviceID: batch.deviceID,
      });
    }
  }

  for (let i = 0; i < sensorLogData.length; i += 500) {
    await prisma.sensorDataLog.createMany({
      data: sensorLogData.slice(i, i + 500).map(row => ({
        logTimestamp: row.timestamp,
        deviceID: row.deviceID,
        measurements: {
          temperature: row.temperature,
          humidity: row.humidity,
          sensorType: 'environment',
          feed: 'temperature',
        },
      })),
    });
  }
  console.log(`  ✓ ${sensorLogData.length} sensor logs created`);

  // ── 12. Alerts ──────────────────────────────────────────────────────────────
  for (let i = 0; i < alertData.length; i++) {
    const a = alertData[i];
    const alertTime = new Date(now);
    alertTime.setDate(alertTime.getDate() - a.daysAgo);
    alertTime.setHours(8 + (i % 10), (i * 13) % 60, 0, 0);

    // Find a batch for this device
    const matchBatch = batchDataArr.find(b => b.deviceID === a.deviceID);

    await prisma.alert.create({
      data: {
        alertType: a.type, alertMessage: a.msg, alertStatus: a.status,
        alertTime, deviceID: a.deviceID,
        batchesID: matchBatch?.id ?? 1,
        organizationID: 1, factoryID: deviceData.find(d => d.id === a.deviceID)!.factID,
        siteID: deviceData.find(d => d.id === a.deviceID)!.siteID,
      },
    });
  }
  console.log(`  ✓ ${alertData.length} alerts created`);

  // ── 13. Alert Resolutions ───────────────────────────────────────────────────
  const resolvedAlerts = alertData.filter(a => a.status === 'resolved');
  for (let i = 0; i < resolvedAlerts.length; i++) {
    const a = resolvedAlerts[i];
    const resolveTime = new Date(now);
    resolveTime.setDate(resolveTime.getDate() - a.daysAgo + 1);

    const notes = [
      'Đã hiệu chỉnh cảm biến và khởi động lại buồng',
      'Đã thay thế linh kiện hỏng, kiểm tra OK',
      'Đã reset hệ thống, hoạt động bình thường',
      'Đã cập nhật firmware và kiểm tra kết nối',
      'Bảo trì xong, đưa trở lại sản xuất',
      'Đã kiểm tra và hiệu chuẩn lại thiết bị',
    ];

    await prisma.alertResolution.create({
      data: {
        userID: opUsers[i % opUsers.length],
        alertID: i + 1,
        resolveTime,
        resolveStatus: 'resolved',
        resolveNote: notes[i % notes.length],
      },
    });
  }
  console.log(`  ✓ ${resolvedAlerts.length} alert resolutions created`);

  // ── 14. System Config ─────────────────────────────────────────────────────
  for (const [key, value] of Object.entries(configData)) {
    await prisma.systemConfig.upsert({
      where: { configKey: key },
      update: {},
      create: { configKey: key, configValue: value },
    });
  }
  console.log(`  ✓ ${Object.keys(configData).length} system config keys seeded`);

  // ── 15. System Config Updates (audit trail) ─────────────────────────────────
  const scuData = [
    { userID: 1, key: 'maxTempSafe', daysAgo: 60 },
    { userID: 1, key: 'autoStopEnabled', daysAgo: 55 },
    { userID: 2, key: 'alertDelaySeconds', daysAgo: 40 },
    { userID: 1, key: 'lightSensorThreshold', daysAgo: 30 },
    { userID: 2, key: 'maxConcurrentBatches', daysAgo: 15 },
    { userID: 1, key: 'maintenanceIntervalDays', daysAgo: 10 },
  ];
  for (const scu of scuData) {
    const updatedAt = new Date(now);
    updatedAt.setDate(updatedAt.getDate() - scu.daysAgo);
    await prisma.systemConfigUpdate.create({
      data: { userID: scu.userID, configKey: scu.key, updatedAt },
    });
  }
  console.log(`  ✓ ${scuData.length} system config updates created`);

  console.log('');
  console.log('✅ Seeding complete!');
  console.log('');
  console.log('📊 Summary:');
  console.log(`   ${orgData.length} organization, ${factoryData.length} factories, ${siteData.length} sites`);
  console.log(`   ${userData.length} users (2 Admin, 2 Manager, 4 Operator)`);
  console.log(`   ${zoneData.length} zones, ${deviceData.length} chambers`);
  console.log(`   ${recipeData.length} recipes`);
  console.log(`   ${batchDataArr.length} batches with operations`);
  console.log(`   ${sensorLogData.length} sensor logs`);
  console.log(`   ${alertData.length} alerts with ${resolvedAlerts.length} resolutions`);
  console.log('');
  console.log('📋 Login accounts (email / password):');
  console.log('   admin@drytech.io    / admin123  (Admin)');
  console.log('   manager@drytech.io  / 123456    (Manager – Bình Dương)');
  console.log('   manager2@drytech.io / 123456    (Manager – Long An)');
  console.log('   op_a@drytech.io     / op123     (Operator – Zone A)');
  console.log('   op_b@drytech.io     / op123     (Operator – Zone B)');
  console.log('   op_c@drytech.io     / op123     (Operator – Zone D)');
  console.log('   op_d@drytech.io     / op123     (Operator – Zone E)');
  console.log('   op_e@drytech.io     / op123     (Operator – Zone F)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
