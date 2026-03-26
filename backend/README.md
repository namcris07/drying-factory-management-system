# Backend - DryTech API (NestJS + Prisma)

Backend cung cấp REST API cho frontend và xử lý dữ liệu cảm biến từ MQTT.

Stack chính:
- NestJS 11
- Prisma + PostgreSQL (`@prisma/adapter-pg`)
- MQTT client trực tiếp qua thư viện `mqtt`

## 1. Chạy dự án

```bash
cd backend
npm install
```

### Dev mode
```bash
npm run start:dev
```

API base mặc định:
- `http://localhost:3000/api`

Lý do có `/api`: trong `main.ts` có `app.setGlobalPrefix('api')`.

## 2. Scripts (theo package.json)

```bash
npm run prisma:generate  # prisma generate
npm run build            # nest build
npm run start            # nest start
npm run start:dev        # nest start --watch
npm run start:debug      # nest start --debug --watch
npm run start:prod       # node dist/main
npm run lint             # eslint --fix
npm run test             # jest --runInBand
npm run test:watch       # jest --watch
npm run test:cov         # jest --coverage --runInBand
npm run test:e2e         # jest --config ./test/jest-e2e.json
```

## 3. ENV config

Tạo `backend/.env` từ `backend/.env.example`:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/dadn_db

ADAFRUIT_IO_USERNAME=your_adafruit_username
ADAFRUIT_IO_KEY=your_adafruit_aio_key
ADAFRUIT_IO_BROKER_URL=mqtt://io.adafruit.com:1883
ADAFRUIT_IO_SUBSCRIBE_FEEDS=temperature,humidity,light,fan_level,BBC_LED,lcd_text,device_status,mode_state

# Khuyến nghị thêm (được code hỗ trợ fallback)
FRONTEND_URL=http://localhost:3001
```

Ý nghĩa:
- `PORT`: cổng HTTP API.
- `DATABASE_URL`: chuỗi kết nối Postgres dùng bởi Prisma adapter.
- `FRONTEND_URL`: origin CORS cho frontend.
- `ADAFRUIT_IO_USERNAME` + `ADAFRUIT_IO_KEY`: tài khoản Adafruit IO để kết nối MQTT.
- `ADAFRUIT_IO_BROKER_URL`: broker MQTT (mặc định Adafruit là `mqtt://io.adafruit.com:1883`).
- `ADAFRUIT_IO_SUBSCRIBE_FEEDS`: các feed backend sẽ tự subscribe khi start.

Lưu ý:
- Nếu 2 biến Adafruit để placeholder thì backend sẽ log cảnh báo và không kết nối MQTT.

## 4. Database setup (Prisma)

### Prisma schema
- File: `prisma/schema.prisma`
- Provider: PostgreSQL.
- Model chính: `User`, `Zone`, `Device`, `Recipe`, `RecipeStep`, `Batch`, `SensorDataLog`, `Alert`, `SystemConfig`, ...

### Migrate + Generate + Seed
```bash
cd backend

npm run prisma:generate
npx prisma migrate dev
npx prisma db seed
```

Thông tin seed:
- Seed script: `prisma/seed.ts`
- Có sẵn users/zones/devices/recipes/batches/alerts/system-config.
- Seed account:
  - `admin@drytech.io / admin123`
  - `manager@drytech.io / 123456`
  - `op_a@drytech.io / op123`

## 5. Cấu trúc API (theo controller)

Do global prefix là `/api`, endpoint đầy đủ bắt đầu bằng `/api/...`.

### Health/App
- `GET /api` -> `AppController.getHello()`

### Auth
- `POST /api/auth/login`

### Users
- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`

### Zones
- `GET /api/zones`
- `GET /api/zones/:id`
- `POST /api/zones`
- `PATCH /api/zones/:id`
- `DELETE /api/zones/:id`

### Devices
- `GET /api/devices`
- `GET /api/devices/:id`
- `POST /api/devices`
- `PATCH /api/devices/:id`
- `DELETE /api/devices/:id`

### Recipes
- `GET /api/recipes`
- `GET /api/recipes/:id`
- `POST /api/recipes`
- `PATCH /api/recipes/:id`
- `DELETE /api/recipes/:id`

### Batches
- `GET /api/batches`
- `GET /api/batches/:id`
- `POST /api/batches`
- `PATCH /api/batches/:id`
- `DELETE /api/batches/:id`

### Alerts
- `GET /api/alerts?status=`
- `GET /api/alerts/:id`
- `POST /api/alerts`
- `PATCH /api/alerts/:id/acknowledge`
- `PATCH /api/alerts/:id/resolve`

### Sensor data
- `GET /api/sensor-data?deviceId=&limit=`

### MQTT control/test (quan trọng cho demo IoT)
- `GET /api/mqtt/status` -> kiểm tra trạng thái kết nối broker + feed đã subscribe.
- `GET /api/mqtt/state` -> đọc trạng thái feed gần nhất (dùng để đồng bộ UI nhanh).
- `POST /api/mqtt/subscribe` -> đổi danh sách feed lắng nghe runtime.
- `POST /api/mqtt/command` -> publish lệnh điều khiển thiết bị (fan_level/led/lcd...).
- `POST /api/mqtt/simulate/incoming` -> giả lập dữ liệu từ thiết bị/cloud gửi về.

### System config
- `GET /api/system-config`
- `PATCH /api/system-config`

## 6. Luồng MQTT -> DB

Khi MQTT bật:
- `MqttService` kết nối trực tiếp tới Adafruit IO bằng `ADAFRUIT_IO_USERNAME` + `ADAFRUIT_IO_KEY`.
- Service tự subscribe các feed trong `ADAFRUIT_IO_SUBSCRIBE_FEEDS`.
- Mỗi incoming message được parse và ghi vào bảng `SensorDataLog` (JSON `measurements`).
- Mỗi command publish từ server cũng được lưu log để audit/debug.
- State gần nhất từng feed được lưu memory + `SystemConfig` (`mqtt:last:<feed>`) để app đọc lại nhanh.

Ví dụ test nhanh (PowerShell):

```powershell
# (a) Bat quat level 60 va bat LED tu server -> app doc /api/mqtt/state se thay doi ngay
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/mqtt/command -ContentType "application/json" -Body '{"feed":"fan_level","value":60}'
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/mqtt/command -ContentType "application/json" -Body '{"feed":"BBC_LED","value":1}'

# (b) Gia lap nhiet do tang/giam tu thiet bi -> app va sensor-data thay doi
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/mqtt/simulate/incoming -ContentType "application/json" -Body '{"feed":"temperature","value":35.2}'
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/mqtt/simulate/incoming -ContentType "application/json" -Body '{"feed":"temperature","value":22.1}'

# Xem state moi nhat
Invoke-RestMethod -Method GET -Uri http://localhost:3000/api/mqtt/state
```

## 7. Cấu trúc thư mục chính

```text
backend/
|-- src/
|   |-- auth/ users/ zones/ devices/
|   |-- recipes/ batches/ alerts/
|   |-- sensor-data/ system-config/
|   |-- mqtt/ sensor/ prisma/
|   `-- main.ts
|-- prisma/
|   |-- schema.prisma
|   |-- migrations/
|   `-- seed.ts
|-- .env.example
|-- Dockerfile
`-- package.json
```

## 8. TEAM RULE trước khi tạo PR

Bắt buộc pass đầy đủ:
- `npm run build` ✅
- `npm run test` ✅
- `npm run lint` ✅
- `npm run test:cov` ✅

Nếu chưa pass, KHÔNG được tạo PR.
