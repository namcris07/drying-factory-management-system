/**
 * prisma/seed.ts
 * Seed the database with realistic sample data matching the frontend mock data.
 * Run: npx prisma db seed
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Seeding database...');

  // ── 1. Users ──────────────────────────────────────────────────────────────
  const users = await Promise.all([
    prisma.user.upsert({
      where: { userID: 1 },
      update: {},
      create: {
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
    prisma.user.upsert({
      where: { userID: 2 },
      update: {},
      create: {
        userID: 2,
        firstName: 'Alex',
        lastName: 'Morgan',
        email: 'manager@drytech.io',
        password: await bcrypt.hash('123456', 10),
        role: 'Manager',
        status: 'Active',
        createdAt: new Date('2024-01-10'),
      },
    }),
    prisma.user.upsert({
      where: { userID: 3 },
      update: {},
      create: {
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
    prisma.user.upsert({
      where: { userID: 4 },
      update: {},
      create: {
        userID: 4,
        firstName: 'Trần Thị',
        lastName: 'Bình',
        email: 'op_b@drytech.io',
        password: await bcrypt.hash('op123', 10),
        role: 'Operator',
        status: 'Active',
        createdAt: new Date('2024-02-14'),
      },
    }),
    prisma.user.upsert({
      where: { userID: 5 },
      update: {},
      create: {
        userID: 5,
        firstName: 'Lê Văn',
        lastName: 'Cường',
        email: 'op_c@drytech.io',
        password: await bcrypt.hash('op123', 10),
        role: 'Operator',
        status: 'Active',
        createdAt: new Date('2024-03-01'),
      },
    }),
    prisma.user.upsert({
      where: { userID: 6 },
      update: {},
      create: {
        userID: 6,
        firstName: 'Phạm Thị',
        lastName: 'Dung',
        email: 'dung@drytech.io',
        password: await bcrypt.hash('op123', 10),
        role: 'Manager',
        status: 'Active',
        createdAt: new Date('2024-03-15'),
      },
    }),
    prisma.user.upsert({
      where: { userID: 7 },
      update: {},
      create: {
        userID: 7,
        firstName: 'Hoàng Minh',
        lastName: 'Đức',
        email: 'duc@drytech.io',
        password: await bcrypt.hash('op123', 10),
        role: 'Operator',
        status: 'Inactive',
        createdAt: new Date('2024-04-01'),
      },
    }),
  ]);
  console.log(`  ✓ ${users.length} users created`);

  // ── 2. Zones ──────────────────────────────────────────────────────────────
  const zones = await Promise.all([
    prisma.zone.upsert({ where: { zoneID: 1 }, update: {}, create: { zoneID: 1, zoneName: 'Zone A', zoneDescription: 'Khu vực sấy trái cây nhiệt đới – 4 máy', userID: 3 } }),
    prisma.zone.upsert({ where: { zoneID: 2 }, update: {}, create: { zoneID: 2, zoneName: 'Zone B', zoneDescription: 'Khu vực sấy nông sản – 3 máy', userID: 4 } }),
    prisma.zone.upsert({ where: { zoneID: 3 }, update: {}, create: { zoneID: 3, zoneName: 'Zone C', zoneDescription: 'Khu vực sấy rau củ – 2 máy', userID: 5 } }),
    prisma.zone.upsert({ where: { zoneID: 4 }, update: {}, create: { zoneID: 4, zoneName: 'Zone D', zoneDescription: 'Khu vực sấy thực phẩm khô – 3 máy', userID: 6 } }),
    prisma.zone.upsert({ where: { zoneID: 5 }, update: {}, create: { zoneID: 5, zoneName: 'Zone E', zoneDescription: 'Khu vực dự phòng – chưa kích hoạt' } }),
  ]);
  console.log(`  ✓ ${zones.length} zones created`);

  // ── 3. Devices ────────────────────────────────────────────────────────────
  const deviceData = [
    { id: 1,  name: 'Máy sấy A1', type: 'Dryer', zoneID: 1, sensor: 'drytech/zone-a/m-a1/sensor', cmd: 'drytech/zone-a/m-a1/cmd', status: 'Active' },
    { id: 2,  name: 'Máy sấy A2', type: 'Dryer', zoneID: 1, sensor: 'drytech/zone-a/m-a2/sensor', cmd: 'drytech/zone-a/m-a2/cmd', status: 'Active' },
    { id: 3,  name: 'Máy sấy A3', type: 'Dryer', zoneID: 1, sensor: 'drytech/zone-a/m-a3/sensor', cmd: 'drytech/zone-a/m-a3/cmd', status: 'Active' },
    { id: 4,  name: 'Máy sấy A4', type: 'Dryer', zoneID: 1, sensor: 'drytech/zone-a/m-a4/sensor', cmd: 'drytech/zone-a/m-a4/cmd', status: 'Inactive' },
    { id: 5,  name: 'Máy sấy B1', type: 'Dryer', zoneID: 2, sensor: 'drytech/zone-b/m-b1/sensor', cmd: 'drytech/zone-b/m-b1/cmd', status: 'Active' },
    { id: 6,  name: 'Máy sấy B2', type: 'Dryer', zoneID: 2, sensor: 'drytech/zone-b/m-b2/sensor', cmd: 'drytech/zone-b/m-b2/cmd', status: 'Active' },
    { id: 7,  name: 'Máy sấy B3', type: 'Dryer', zoneID: 2, sensor: 'drytech/zone-b/m-b3/sensor', cmd: 'drytech/zone-b/m-b3/cmd', status: 'Active' },
    { id: 8,  name: 'Máy sấy C1', type: 'Dryer', zoneID: 3, sensor: 'drytech/zone-c/m-c1/sensor', cmd: 'drytech/zone-c/m-c1/cmd', status: 'Active' },
    { id: 9,  name: 'Máy sấy C2', type: 'Dryer', zoneID: 3, sensor: 'drytech/zone-c/m-c2/sensor', cmd: 'drytech/zone-c/m-c2/cmd', status: 'Active' },
    { id: 10, name: 'Máy sấy D1', type: 'Dryer', zoneID: 4, sensor: 'drytech/zone-d/m-d1/sensor', cmd: 'drytech/zone-d/m-d1/cmd', status: 'Active' },
    { id: 11, name: 'Máy sấy D2', type: 'Dryer', zoneID: 4, sensor: 'drytech/zone-d/m-d2/sensor', cmd: 'drytech/zone-d/m-d2/cmd', status: 'Active' },
    { id: 12, name: 'Máy sấy D3', type: 'Dryer', zoneID: 4, sensor: 'drytech/zone-d/m-d3/sensor', cmd: 'drytech/zone-d/m-d3/cmd', status: 'Active' },
  ];

  const devices = await Promise.all(
    deviceData.map((d) =>
      prisma.device.upsert({
        where: { deviceID: d.id },
        update: {},
        create: {
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
    { id: 1, name: 'Xoài sấy dẻo',      fruits: 'Xoài',       duration: 480,  steps: [{ stepNo: 1, tempGoal: 65, humGoal: 18, duration: 480, fan: 'On' }] },
    { id: 2, name: 'Chuối sấy giòn',     fruits: 'Chuối',      duration: 360,  steps: [{ stepNo: 1, tempGoal: 70, humGoal: 15, duration: 360, fan: 'On' }] },
    { id: 3, name: 'Dứa sấy dẻo',        fruits: 'Dứa',        duration: 600,  steps: [{ stepNo: 1, tempGoal: 60, humGoal: 20, duration: 600, fan: 'On' }] },
    { id: 4, name: 'Táo sấy lát mỏng',   fruits: 'Táo',        duration: 420,  steps: [{ stepNo: 1, tempGoal: 55, humGoal: 12, duration: 420, fan: 'Low' }] },
    { id: 5, name: 'Khoai lang sấy',     fruits: 'Khoai lang', duration: 300,  steps: [{ stepNo: 1, tempGoal: 75, humGoal: 10, duration: 300, fan: 'High' }] },
    { id: 6, name: 'Mít sấy khô',        fruits: 'Mít',        duration: 720,  steps: [{ stepNo: 1, tempGoal: 58, humGoal: 16, duration: 720, fan: 'On' }] },
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
    { id: 1, status: 'Completed', result: 'A', recipeID: 1, deviceID: 1 },
    { id: 2, status: 'Completed', result: 'A', recipeID: 2, deviceID: 2 },
    { id: 3, status: 'Running',   result: null, recipeID: 1, deviceID: 5 },
    { id: 4, status: 'Error',     result: null, recipeID: 3, deviceID: 3 },
    { id: 5, status: 'Completed', result: 'B', recipeID: 4, deviceID: 8 },
    { id: 6, status: 'Running',   result: null, recipeID: 6, deviceID: 9 },
  ];

  const batches = await Promise.all(
    batchData.map((b) =>
      prisma.batch.upsert({
        where: { batchesID: b.id },
        update: {},
        create: {
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
    { id: 1, type: 'error',   msg: 'Quá nhiệt – Vượt ngưỡng 85°C', deviceID: 6,  batchID: 4, status: 'pending' },
    { id: 2, type: 'warning', msg: 'Độ ẩm thấp bất thường',         deviceID: 1,  batchID: 3, status: 'acknowledged' },
    { id: 3, type: 'info',    msg: 'Mẻ sấy hoàn thành',             deviceID: 2,  batchID: 2, status: 'resolved' },
  ];

  const alerts = await Promise.all(
    alertData.map((a) =>
      prisma.alert.upsert({
        where: { alertID: a.id },
        update: {},
        create: {
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
  };

  for (const [key, value] of Object.entries(configData)) {
    await prisma.systemConfig.upsert({
      where: { configKey: key },
      update: {},
      create: { configKey: key, configValue: value },
    });
  }
  console.log(`  ✓ ${Object.keys(configData).length} system config keys seeded`);

  console.log('✅ Seeding complete!');
  console.log('');
  console.log('📋 Demo login accounts (email / password):');
  console.log('   admin@drytech.io   / admin123  (Admin)');
  console.log('   manager@drytech.io / 123456    (Manager)');
  console.log('   op_a@drytech.io    / op123     (Operator – Zone A)');
  console.log('   op_b@drytech.io    / op123     (Operator – Zone B)');
  console.log('   op_c@drytech.io    / op123     (Operator – Zone C)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
