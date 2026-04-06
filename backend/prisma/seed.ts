/**
 * prisma/seed.ts
 * Seed the database with baseline production-like data.
 * Run: npx prisma db seed
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

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
      "Devices",
      "Zones",
      "SystemConfigUpdate",
      "SystemConfig",
      "User"
    RESTART IDENTITY CASCADE;
  `);

  // ── 1. Users ──────────────────────────────────────────────────────────────
  const users = await Promise.all([
    prisma.user.create({
      data: {
        userID: 1,
        firstName: 'Super',
        lastName: 'Admin',
        email: 'admin@drytech.io',
        password: await bcrypt.hash('admin123', 10),
        role: 'Admin',
        status: 'Active',
        createdAt: new Date('2024-01-01'),
      },
    }),
    prisma.user.create({
      data: {
        userID: 2,
        firstName: 'Nguyễn Chu Hải',
        lastName: 'Nam',
        email: 'manager@drytech.io',
        password: await bcrypt.hash('123456', 10),
        role: 'Manager',
        status: 'Active',
        createdAt: new Date('2024-01-10'),
      },
    }),
    prisma.user.create({
      data: {
        userID: 3,
        firstName: 'Nguyễn Văn',
        lastName: 'An',
        email: 'op_a@drytech.io',
        password: await bcrypt.hash('op123', 10),
        role: 'Operator',
        status: 'Active',
        createdAt: new Date('2024-02-14'),
      },
    }),
  ]);
  console.log(`  ✓ ${users.length} users created`);

  // ── 2. Zones ──────────────────────────────────────────────────────────────
  const zones = await Promise.all([
    prisma.zone.create({
      data: {
        zoneID: 1,
        zoneName: 'Zone A',
        zoneDescription: 'Khu vực sấy chính - cụm máy A1/A2/A3',
        userID: 3,
      },
    }),
  ]);
  console.log(`  ✓ ${zones.length} zones created`);

  // ── 3. Devices ────────────────────────────────────────────────────────────
  const deviceData = [
    {
      id: 1,
      name: 'Máy sấy A1',
      type: 'Dryer',
      zoneID: 1,
      sensor: 'drytech/zone-a/m-a1/sensor',
      cmd: 'drytech/zone-a/m-a1/cmd',
      status: 'Active',
    },
    {
      id: 2,
      name: 'Máy sấy A2',
      type: 'Dryer',
      zoneID: 1,
      sensor: 'drytech/zone-a/m-a2/sensor',
      cmd: 'drytech/zone-a/m-a2/cmd',
      status: 'Active',
    },
    {
      id: 3,
      name: 'Máy sấy A3',
      type: 'Dryer',
      zoneID: 1,
      sensor: 'drytech/zone-a/m-a3/sensor',
      cmd: 'drytech/zone-a/m-a3/cmd',
      status: 'Maintenance',
    },
  ];

  const devices = await Promise.all(
    deviceData.map((d) =>
      prisma.device.create({
        data: {
          deviceID: d.id,
          deviceName: d.name,
          deviceType: d.type,
          deviceStatus: d.status,
          zoneID: d.zoneID,
          mqttTopicSensor: d.sensor,
          mqttTopicCmd: d.cmd,
          metaData: { firmware: 'v2.3.1' },
        },
      }),
    ),
  );
  console.log(`  ✓ ${devices.length} devices created`);

  // ── 4. Recipes ────────────────────────────────────────────────────────────
  const recipeData = [
    {
      id: 1,
      name: 'Xoài sấy dẻo',
      fruits: 'Xoài',
      duration: 480,
      steps: [
        { stepNo: 1, tempGoal: 65, humGoal: 18, duration: 480, fan: 'On' },
      ],
      stages: [
        { stageOrder: 1, duration: 120, tempSetpoint: 58, humSetpoint: 28 },
        { stageOrder: 2, duration: 360, tempSetpoint: 65, humSetpoint: 18 },
      ],
    },
    {
      id: 2,
      name: 'Chuối sấy giòn',
      fruits: 'Chuối',
      duration: 360,
      steps: [
        { stepNo: 1, tempGoal: 70, humGoal: 15, duration: 360, fan: 'On' },
      ],
      stages: [
        { stageOrder: 1, duration: 90, tempSetpoint: 64, humSetpoint: 25 },
        { stageOrder: 2, duration: 270, tempSetpoint: 70, humSetpoint: 15 },
      ],
    },
    {
      id: 3,
      name: 'Dứa sấy dẻo',
      fruits: 'Dứa',
      duration: 600,
      steps: [
        { stepNo: 1, tempGoal: 60, humGoal: 20, duration: 600, fan: 'On' },
      ],
      stages: [
        { stageOrder: 1, duration: 180, tempSetpoint: 54, humSetpoint: 30 },
        { stageOrder: 2, duration: 420, tempSetpoint: 60, humSetpoint: 20 },
      ],
    },
    {
      id: 4,
      name: 'Táo sấy lát mỏng',
      fruits: 'Táo',
      duration: 420,
      steps: [
        { stepNo: 1, tempGoal: 55, humGoal: 12, duration: 420, fan: 'Low' },
      ],
      stages: [
        { stageOrder: 1, duration: 120, tempSetpoint: 50, humSetpoint: 20 },
        { stageOrder: 2, duration: 300, tempSetpoint: 55, humSetpoint: 12 },
      ],
    },
    {
      id: 5,
      name: 'Khoai lang sấy',
      fruits: 'Khoai lang',
      duration: 300,
      steps: [
        { stepNo: 1, tempGoal: 75, humGoal: 10, duration: 300, fan: 'High' },
      ],
      stages: [
        { stageOrder: 1, duration: 80, tempSetpoint: 68, humSetpoint: 20 },
        { stageOrder: 2, duration: 220, tempSetpoint: 75, humSetpoint: 10 },
      ],
    },
    {
      id: 6,
      name: 'Mít sấy khô',
      fruits: 'Mít',
      duration: 720,
      steps: [
        { stepNo: 1, tempGoal: 58, humGoal: 16, duration: 720, fan: 'On' },
      ],
      stages: [
        { stageOrder: 1, duration: 180, tempSetpoint: 53, humSetpoint: 26 },
        { stageOrder: 2, duration: 540, tempSetpoint: 58, humSetpoint: 16 },
      ],
    },
  ];

  for (const r of recipeData) {
    await prisma.recipe.upsert({
      where: { recipeID: r.id },
      update: {},
      create: {
        recipeID: r.id,
        recipeName: r.name,
        recipeFruits: r.fruits,
        timeDurationEst: r.duration,
        userID: 2,
        steps: {
          create: r.steps.map((s) => ({
            stepNo: s.stepNo,
            temperatureGoal: s.tempGoal,
            humidityGoal: s.humGoal,
            durationMinutes: s.duration,
            fanStatus: s.fan,
            stepStatus: 'Active',
          })),
        },
        stages: {
          create: r.stages.map((stage) => ({
            stageOrder: stage.stageOrder,
            durationMinutes: stage.duration,
            temperatureSetpoint: stage.tempSetpoint,
            humiditySetpoint: stage.humSetpoint,
          })),
        },
      },
    });
  }
  console.log(`  ✓ ${recipeData.length} recipes created`);

  // ── 5. Batches ────────────────────────────────────────────────────────────
  const batchData = [] as Array<{
    id: number;
    status: 'Completed' | 'Stopped' | 'Error' | 'Running';
    result: string | null;
    recipeID: number;
    deviceID: number;
    startedAt: Date;
  }>;

  let batchID = 1;
  for (let dayIndex = 0; dayIndex < 90; dayIndex += 1) {
    const count = batchCountsByDay(dayIndex);
    const dayBase = addDays(startDate, dayIndex);

    for (let slot = 0; slot < count; slot += 1) {
      const recipeID = ((dayIndex + slot) % recipeData.length) + 1;
      const deviceID = slot % 7 === 6 ? 3 : slot % 3 === 2 ? 2 : 1;
      const startHour = 6 + ((slot * 2 + dayIndex) % 12);
      const startMinute = (slot % 4) * 15;
      const timeStamp = addDays(dayBase, 0, startHour, startMinute);

      let status: 'Completed' | 'Stopped' | 'Error' | 'Running' = 'Completed';
      let result: string | null = 'CompletedBySchedule';

      const pattern = (dayIndex * 17 + slot * 5) % 20;
      if (pattern === 0 || pattern === 11) {
        status = 'Error';
        result = slot % 2 === 0 ? 'ManualFail' : 'SensorFault';
      } else if (pattern === 4 || pattern === 15) {
        status = 'Stopped';
        if (deviceID === 3) {
          result = 'HumidityOutOfRange';
        } else {
          result = 'SystemThresholdExceeded';
        }
      } else if (dayIndex === 89 && slot >= count - 1) {
        status = 'Running';
        result = null;
      } else if (pattern === 8) {
        status = 'Completed';
        result = 'CompletedBySchedule';
      }

      batchData.push({
        id: batchID,
        status,
        result,
        recipeID,
        deviceID,
        startedAt: timeStamp,
      });

      batchID += 1;
    }
  }

  const batches = await Promise.all(
    batchData.map((b) =>
      prisma.batch.create({
        data: {
          batchesID: b.id,
          batchStatus: b.status,
          batchResult: b.result ?? undefined,
          operationMode: 'Auto',
          currentStep: 1,
          currentStage: 1,
          startedAt: b.startedAt,
          stageStartedAt: b.startedAt,
          recipeID: b.recipeID,
          deviceID: b.deviceID,
        },
      }),
    ),
  );
  console.log(`  ✓ ${batches.length} batches created`);

  // ── 6. Sensor Logs ───────────────────────────────────────────────────────
  const sensorLogData: Array<{
    timestamp: Date;
    temperature: number;
    humidity: number;
    deviceID: number;
  }> = [];

  for (let index = 0; index < batchData.length; index += 1) {
    const batch = batchData[index];
    const tempShift = batch.deviceID === 2 ? 1.6 : 0;
    const humShift = batch.deviceID === 2 ? -1.1 : 0;
    const maintenanceShift = batch.deviceID === 3 ? 2.1 : 0;

    for (const hour of [0, 6, 12, 18]) {
      const timePoint = new Date(batch.startedAt);
      timePoint.setHours(hour, (index % 4) * 10, 0, 0);
      const cycle = (index % 8) * 0.75;
      const tempBase =
        53 +
        (batch.startedAt.getDate() % 10) * 0.8 +
        cycle +
        tempShift +
        maintenanceShift +
        (hour >= 12 ? 2.0 : 0);
      const humBase =
        33 -
        (batch.startedAt.getDate() % 7) * 0.6 +
        humShift -
        maintenanceShift * 0.35 -
        (hour >= 18 ? 2.0 : 0);

      sensorLogData.push({
        timestamp: timePoint,
        temperature: Number((tempBase + (hour % 5) * 0.25).toFixed(1)),
        humidity: Number((humBase - (hour % 3) * 0.35).toFixed(1)),
        deviceID: batch.deviceID,
      });
    }
  }

  await prisma.sensorDataLog.createMany({
    data: sensorLogData.map((row) => ({
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
  console.log(`  ✓ ${sensorLogData.length} sensor logs created`);

  // ── 7. Alerts ─────────────────────────────────────────────────────────────
  const alertData = [
    {
      id: 1,
      type: 'info',
      msg: 'Hệ thống A1 đã sẵn sàng vận hành',
      deviceID: 1,
      batchID: 1,
      status: 'resolved',
    },
  ];

  const alerts = await Promise.all(
    alertData.map((a) =>
      prisma.alert.create({
        data: {
          alertID: a.id,
          alertType: a.type,
          alertMessage: a.msg,
          alertStatus: a.status,
          alertTime: new Date(),
          deviceID: a.deviceID,
          batchesID: a.batchID,
        },
      }),
    ),
  );
  console.log(`  ✓ ${alerts.length} alerts created`);

  // ── 8. System Config (Thresholds) ─────────────────────────────────────────
  const configData: Record<string, string> = {
    maxTempSafe: '90',
    minHumidity: '8',
    maxHumidity: '85',
    autoStopEnabled: 'true',
    alertDelaySeconds: '15',
    mqttBrokerHost: 'mqtt.drytech.internal',
    mqttBrokerPort: '1883',
    mqttKeepAlive: '60',
    dataRetentionDays: '365',
    batchAutoArchiveDays: '90',
    lightSensorThreshold: '500',
    doorOpenTimeout: '5',
    operatingMode: 'auto',
    operatingModeFeed: 'mode_state',
  };

  for (const [key, value] of Object.entries(configData)) {
    await prisma.systemConfig.upsert({
      where: { configKey: key },
      update: {},
      create: { configKey: key, configValue: value },
    });
  }
  console.log(
    `  ✓ ${Object.keys(configData).length} system config keys seeded`,
  );

  console.log('✅ Seeding complete!');
  console.log('');
  console.log('📋 Seed login accounts (email / password):');
  console.log('   admin@drytech.io   / admin123  (Admin)');
  console.log('   manager@drytech.io / 123456    (Manager)');
  console.log('   op_a@drytech.io    / op123     (Operator – Zone A)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
