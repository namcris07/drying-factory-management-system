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
        zoneDescription: 'Khu sấy chính - chứa các buồng sấy A/B/C',
        userID: 3,
      },
    }),
    prisma.zone.create({
      data: {
        zoneID: 2,
        zoneName: 'Zone B',
        zoneDescription: 'Khu sấy dự phòng / tăng cường công suất',
        userID: null,
      },
    }),
    prisma.zone.create({
      data: {
        zoneID: 3,
        zoneName: 'Zone C',
        zoneDescription: 'Khu sấy thử nghiệm / mẻ đặc biệt',
        userID: null,
      },
    }),
  ]);
  console.log(`  ✓ ${zones.length} zones created`);

  // ── 3. Devices ────────────────────────────────────────────────────────────
  const deviceData = [
    {
      id: 1,
      name: 'Buồng sấy A',
      type: 'DryingChamber',
      zoneID: 1,
      sensor: 'drytech.m-a1-temp-in,drytech.m-a1-humidity-core,drytech.m-a1-light-door,drytech.m-a1-fan-1,drytech.m-a1-led,drytech.m-a1-lcd',
      cmd: 'drytech.m-a1-fan-1,drytech.m-a1-led,drytech.m-a1-lcd',
      status: 'Active',
      sensors: [
        { sensorName: 'Nhiệt độ vào', sensorType: 'TemperatureSensor', feedKey: 'drytech.m-a1-temp-in', status: 'Active' },
        { sensorName: 'Độ ẩm lõi', sensorType: 'HumiditySensor', feedKey: 'drytech.m-a1-humidity-core', status: 'Active' },
        { sensorName: 'Ánh sáng cửa', sensorType: 'LightSensor', feedKey: 'drytech.m-a1-light-door', status: 'Active' },
        { sensorName: 'Quạt chính', sensorType: 'Fan', feedKey: 'drytech.m-a1-fan-1', status: 'Active' },
        { sensorName: 'LED trạng thái', sensorType: 'Custom', feedKey: 'drytech.m-a1-led', status: 'Active' },
        { sensorName: 'LCD buồng', sensorType: 'Lcd', feedKey: 'drytech.m-a1-lcd', status: 'Active' },
      ],
    },
    {
      id: 2,
      name: 'Buồng sấy B',
      type: 'DryingChamber',
      zoneID: 1,
      sensor: 'drytech.m-a2-temp-in,drytech.m-a2-temp-core,drytech.m-a2-humidity-core,drytech.m-a2-fan-1,drytech.m-a2-fan-2,drytech.m-a2-led,drytech.m-a2-lcd',
      cmd: 'drytech.m-a2-fan-1,drytech.m-a2-fan-2,drytech.m-a2-led,drytech.m-a2-lcd',
      status: 'Active',
      sensors: [
        { sensorName: 'Nhiệt độ vào', sensorType: 'TemperatureSensor', feedKey: 'drytech.m-a2-temp-in', status: 'Active' },
        { sensorName: 'Nhiệt độ lõi', sensorType: 'TemperatureSensor', feedKey: 'drytech.m-a2-temp-core', status: 'Active' },
        { sensorName: 'Độ ẩm lõi', sensorType: 'HumiditySensor', feedKey: 'drytech.m-a2-humidity-core', status: 'Active' },
        { sensorName: 'Quạt chính', sensorType: 'Fan', feedKey: 'drytech.m-a2-fan-1', status: 'Active' },
        { sensorName: 'Quạt phụ', sensorType: 'Fan', feedKey: 'drytech.m-a2-fan-2', status: 'Active' },
        { sensorName: 'LED trạng thái', sensorType: 'Custom', feedKey: 'drytech.m-a2-led', status: 'Active' },
        { sensorName: 'LCD buồng', sensorType: 'Lcd', feedKey: 'drytech.m-a2-lcd', status: 'Active' },
      ],
    },
    {
      id: 3,
      name: 'Buồng sấy C',
      type: 'DryingChamber',
      zoneID: 1,
      sensor: 'drytech.m-a3-temp-in,drytech.m-a3-temp-core,drytech.m-a3-humidity-core,drytech.m-a3-light-door,drytech.m-a3-fan-1,drytech.m-a3-led,drytech.m-a3-lcd',
      cmd: 'drytech.m-a3-fan-1,drytech.m-a3-led,drytech.m-a3-lcd',
      status: 'Active',
      sensors: [
        { sensorName: 'Nhiệt độ vào', sensorType: 'TemperatureSensor', feedKey: 'drytech.m-a3-temp-in', status: 'Active' },
        { sensorName: 'Nhiệt độ lõi', sensorType: 'TemperatureSensor', feedKey: 'drytech.m-a3-temp-core', status: 'Active' },
        { sensorName: 'Độ ẩm lõi', sensorType: 'HumiditySensor', feedKey: 'drytech.m-a3-humidity-core', status: 'Active' },
        { sensorName: 'Ánh sáng cửa', sensorType: 'LightSensor', feedKey: 'drytech.m-a3-light-door', status: 'Active' },
        { sensorName: 'Quạt chính', sensorType: 'Fan', feedKey: 'drytech.m-a3-fan-1', status: 'Active' },
        { sensorName: 'LED trạng thái', sensorType: 'Custom', feedKey: 'drytech.m-a3-led', status: 'Active' },
        { sensorName: 'LCD buồng', sensorType: 'Lcd', feedKey: 'drytech.m-a3-lcd', status: 'Active' },
      ],
    },
    {
      id: 4,
      name: 'Buồng sấy B1',
      type: 'DryingChamber',
      zoneID: 2,
      sensor: 'drytech.m-b1-temp-top,drytech.m-b1-humidity-top,drytech.m-b1-co2,drytech.m-b1-fan-1,drytech.m-b1-led,drytech.m-b1-lcd',
      cmd: 'drytech.m-b1-fan-1,drytech.m-b1-led,drytech.m-b1-lcd',
      status: 'Maintenance',
      sensors: [
        { sensorName: 'Nhiệt độ trên', sensorType: 'TemperatureSensor', feedKey: 'drytech.m-b1-temp-top', status: 'Active' },
        { sensorName: 'Độ ẩm trên', sensorType: 'HumiditySensor', feedKey: 'drytech.m-b1-humidity-top', status: 'Active' },
        { sensorName: 'CO2', sensorType: 'Custom', feedKey: 'drytech.m-b1-co2', status: 'Maintenance' },
        { sensorName: 'Quạt chính', sensorType: 'Fan', feedKey: 'drytech.m-b1-fan-1', status: 'Active' },
        { sensorName: 'LED trạng thái', sensorType: 'Custom', feedKey: 'drytech.m-b1-led', status: 'Active' },
        { sensorName: 'LCD buồng', sensorType: 'Lcd', feedKey: 'drytech.m-b1-lcd', status: 'Active' },
      ],
    },
    {
      id: 5,
      name: 'Buồng sấy B2',
      type: 'DryingChamber',
      zoneID: 2,
      sensor: 'drytech.m-b2-temp-bottom,drytech.m-b2-humidity-core,drytech.m-b2-fan-1,drytech.m-b2-led,drytech.m-b2-lcd',
      cmd: 'drytech.m-b2-fan-1,drytech.m-b2-led,drytech.m-b2-lcd',
      status: 'Active',
      sensors: [
        { sensorName: 'Nhiệt độ đáy', sensorType: 'TemperatureSensor', feedKey: 'drytech.m-b2-temp-bottom', status: 'Active' },
        { sensorName: 'Độ ẩm lõi', sensorType: 'HumiditySensor', feedKey: 'drytech.m-b2-humidity-core', status: 'Active' },
        { sensorName: 'Quạt chính', sensorType: 'Fan', feedKey: 'drytech.m-b2-fan-1', status: 'Active' },
        { sensorName: 'LED trạng thái', sensorType: 'Custom', feedKey: 'drytech.m-b2-led', status: 'Active' },
        { sensorName: 'LCD buồng', sensorType: 'Lcd', feedKey: 'drytech.m-b2-lcd', status: 'Active' },
      ],
    },
    {
      id: 6,
      name: 'Buồng sấy C1',
      type: 'DryingChamber',
      zoneID: 3,
      sensor: 'drytech.m-c1-temp-core,drytech.m-c1-humidity-core,drytech.m-c1-light-door,drytech.m-c1-fan-1,drytech.m-c1-led,drytech.m-c1-lcd',
      cmd: 'drytech.m-c1-fan-1,drytech.m-c1-led,drytech.m-c1-lcd',
      status: 'Active',
      sensors: [
        { sensorName: 'Nhiệt độ lõi', sensorType: 'TemperatureSensor', feedKey: 'drytech.m-c1-temp-core', status: 'Active' },
        { sensorName: 'Độ ẩm lõi', sensorType: 'HumiditySensor', feedKey: 'drytech.m-c1-humidity-core', status: 'Active' },
        { sensorName: 'Ánh sáng cửa', sensorType: 'LightSensor', feedKey: 'drytech.m-c1-light-door', status: 'Active' },
        { sensorName: 'Quạt chính', sensorType: 'Fan', feedKey: 'drytech.m-c1-fan-1', status: 'Active' },
        { sensorName: 'LED trạng thái', sensorType: 'Custom', feedKey: 'drytech.m-c1-led', status: 'Active' },
        { sensorName: 'LCD buồng', sensorType: 'Lcd', feedKey: 'drytech.m-c1-lcd', status: 'Active' },
      ],
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
          metaData: { firmware: 'v2.3.1', chamberDescription: d.name, sensors: d.sensors },
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
      const deviceID = (slot + dayIndex) % deviceData.length + 1;
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
