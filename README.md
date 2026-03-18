# DryTech - Drying Factory Management System

Hệ thống quản lý vận hành nhà máy sấy công nghiệp, gồm:
- Frontend: Next.js App Router cho các vai trò Admin, Manager, Operator.
- Backend: NestJS + Prisma + PostgreSQL, có tích hợp MQTT (Adafruit IO) để nhận dữ liệu cảm biến.

Mục tiêu chính của dự án:
- Quản lý người dùng, khu vực, thiết bị IoT.
- Quản lý công thức sấy, mẻ sấy, cảnh báo.
- Giám sát dữ liệu cảm biến và cấu hình ngưỡng hệ thống.

## 1. Kiến trúc hệ thống

### Thành phần chính
- `frontend` chạy mặc định tại `http://localhost:3001` (`npm run dev` dùng cổng 3001).
- `backend` chạy mặc định tại `http://localhost:3000`.
- Backend set global prefix `api` => base API là `http://localhost:3000/api`.

Frontend gọi backend qua biến môi trường:
- `NEXT_PUBLIC_API_URL` (mặc định fallback: `http://localhost:3000/api` trong `frontend/shared/lib/api.ts`).

Backend cho phép CORS từ:
- `FRONTEND_URL` (mặc định fallback: `http://localhost:3001` trong `backend/src/main.ts`).

### Luồng request (text diagram)
```text
[Browser]
   |
   | 1) User thao tác UI
   v
[Next.js Frontend (localhost:3001)]
   |
   | 2) fetch() qua shared/lib/api.ts
   |    BASE_URL = NEXT_PUBLIC_API_URL || http://localhost:3000/api
   v
[NestJS Backend (localhost:3000/api)]
   |
   | 3) Controller -> Service -> PrismaService
   v
[PostgreSQL]

Song song (nếu bật MQTT):
[Adafruit IO MQTT] -> [NestJS MqttController] -> [SensorService] -> [SensorDataLog]
```

## 2. Cấu trúc project

```text
drying-factory-management-system/
|-- backend/
|   |-- prisma/
|   |   |-- migrations/
|   |   |-- schema.prisma
|   |   `-- seed.ts
|   |-- src/
|   |   |-- auth/ users/ zones/ devices/ recipes/
|   |   |-- batches/ alerts/ sensor-data/ system-config/
|   |   |-- mqtt/ sensor/ prisma/
|   |   `-- main.ts
|   |-- .env.example
|   |-- Dockerfile
|   `-- package.json
|-- frontend/
|   |-- app/
|   |   |-- (auth)/login
|   |   |-- (admin)/admin/{users,zones,devices,thresholds,logs}
|   |   |-- (manager)/{manager,recipes,batches,reports,ai,ui}
|   |   `-- (operator)/operator/{realtime,adafruit,alerts}
|   |-- features/
|   |   |-- admin/ manager/ operator/ auth/ notifications/
|   |-- shared/
|   |   |-- lib/api.ts
|   |   |-- auth/session.ts
|   |   `-- ui/
|   |-- Dockerfile
|   `-- package.json
`-- README.md
```

### Giải thích các folder chính
- `backend/src/*`: mô-đun nghiệp vụ theo domain (users, devices, recipes, batches, alerts...).
- `backend/prisma/*`: schema DB, migrations, seed data.
- `frontend/app/*`: route theo App Router + route group theo vai trò.
- `frontend/features/*`: UI/business logic theo tính năng.
- `frontend/shared/*`: API client, auth session, providers, UI dùng chung.

## 3. Biến môi trường quan trọng

### Backend (`backend/.env`)
Từ `backend/.env.example` và code `backend/src/main.ts`, `backend/src/prisma/prisma.service.ts`:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/dadn_db

ADAFRUIT_IO_USERNAME=your_adafruit_username
ADAFRUIT_IO_KEY=your_adafruit_aio_key

# Khuyến nghị thêm (được code hỗ trợ fallback nếu thiếu)
FRONTEND_URL=http://localhost:3001
```

Lưu ý:
- Nếu `ADAFRUIT_IO_USERNAME`/`ADAFRUIT_IO_KEY` vẫn để placeholder thì MQTT bị tắt.

### Frontend (`frontend/.env.local`)
Từ `frontend/shared/lib/api.ts` và `frontend/features/operator/adafruit/config/adafruit-config.ts`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_AIO_USERNAME=your_adafruit_username
NEXT_PUBLIC_AIO_KEY=your_adafruit_aio_key
```

## 4. Setup full project

Yêu cầu:
- Node.js 20+ (Dockerfile đang dùng `node:20-alpine`).
- PostgreSQL chạy sẵn và tạo DB (ví dụ `dadn_db`).

### Bước 1: Cài dependencies
```bash
# Terminal 1
cd backend
npm install

# Terminal 2
cd frontend
npm install
```

### Bước 2: Cấu hình môi trường
- Backend: tạo `backend/.env` từ `backend/.env.example`, cập nhật `DATABASE_URL`.
- Frontend: tạo `frontend/.env.local` với `NEXT_PUBLIC_API_URL`.

### Bước 3: Khởi tạo database (Prisma)
```bash
cd backend

# Generate Prisma client
npm run prisma:generate

# Chạy migration dev (nếu môi trường local)
npx prisma migrate dev

# Seed dữ liệu mẫu
npx prisma db seed
```

### Bước 4: Chạy đồng thời backend + frontend
```bash
# Terminal backend
cd backend
npm run start:dev

# Terminal frontend
cd frontend
npm run dev
```

Truy cập:
- Frontend: `http://localhost:3001`
- Backend API base: `http://localhost:3000/api`

## 5. Tài khoản mẫu (seed)

Trong `backend/prisma/seed.ts` có sẵn demo account:
- `admin@drytech.io / admin123` (Admin)
- `manager@drytech.io / 123456` (Manager)
- `op_a@drytech.io / op123` (Operator)
- `op_b@drytech.io / op123` (Operator)
- `op_c@drytech.io / op123` (Operator)

## 6. TEAM RULE (BẮT BUỘC)

Trước khi tạo Pull Request, bắt buộc pass toàn bộ:

- `npm run build` ✅
- `npm run test` ✅
- `npm run lint` ✅
- `npm run test:cov` ✅

Nếu chưa pass đầy đủ, KHÔNG được tạo PR.

Gợi ý chạy cho cả 2 phần:
```bash
# Backend
cd backend
npm run build && npm run test && npm run lint && npm run test:cov

# Frontend
cd frontend
npm run build && npm run test && npm run lint && npm run test:cov
```

## 7. Tài liệu chi tiết từng phần
- Frontend chi tiết: xem `frontend/README.md`
- Backend chi tiết: xem `backend/README.md`
