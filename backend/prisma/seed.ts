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

  // Reset dev data to keep seed deterministic.
  await prisma.alertResolution.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.batchOperation.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.sensorDataLog.deleteMany();
  await prisma.recipeStep.deleteMany();
  await prisma.recipeModification.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.device.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.systemConfigUpdate.deleteMany();
  await prisma.systemConfig.deleteMany();
  await prisma.user.deleteMany();

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
        zoneDescription: 'Khu vực sấy chính - chỉ vận hành máy A1',
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
    },
    {
      id: 2,
      name: 'Chuối sấy giòn',
      fruits: 'Chuối',
      duration: 360,
      steps: [
        { stepNo: 1, tempGoal: 70, humGoal: 15, duration: 360, fan: 'On' },
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
    },
    {
      id: 4,
      name: 'Táo sấy lát mỏng',
      fruits: 'Táo',
      duration: 420,
      steps: [
        { stepNo: 1, tempGoal: 55, humGoal: 12, duration: 420, fan: 'Low' },
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
    },
    {
      id: 6,
      name: 'Mít sấy khô',
      fruits: 'Mít',
      duration: 720,
      steps: [
        { stepNo: 1, tempGoal: 58, humGoal: 16, duration: 720, fan: 'On' },
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
      },
    });
  }
  console.log(`  ✓ ${recipeData.length} recipes created`);

  // ── 5. Batches ────────────────────────────────────────────────────────────
  const batchData = [
    { id: 1, status: 'Running', result: null, recipeID: 1, deviceID: 1 },
  ];

  const batches = await Promise.all(
    batchData.map((b) =>
      prisma.batch.create({
        data: {
          batchesID: b.id,
          batchStatus: b.status,
          batchResult: b.result ?? undefined,
          operationMode: 'Auto',
          currentStep: 1,
          recipeID: b.recipeID,
          deviceID: b.deviceID,
        },
      }),
    ),
  );
  console.log(`  ✓ ${batches.length} batches created`);

  // ── 6. Alerts ─────────────────────────────────────────────────────────────
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

  // ── 7. System Config (Thresholds) ─────────────────────────────────────────
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
