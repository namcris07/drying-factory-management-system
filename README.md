# DryTech - Drying Factory Management System

Hệ thống quản lý vận hành nhà máy sấy công nghiệp, gồm:
- **Frontend**: Next.js App Router (React 19, Ant Design v5, Radix UI) cho các vai trò Admin, Manager, Operator.
- **Backend**: NestJS 11 + Prisma + PostgreSQL, tích hợp MQTT (Adafruit IO) để kết nối và nhận dữ liệu từ cảm biến thực tế/mô phỏng.

Mục tiêu chính của dự án:
- Quản lý người dùng (Users), khu vực (Zones), buồng sấy (Chambers), thiết bị (Devices) và khách thuê (Tenants).
- Quản lý công thức sấy (Recipes), mẻ sấy (Batches), lịch sử vận hành và cảnh báo (Alerts).
- Giám sát dữ liệu cảm biến thời gian thực, điều khiển thiết bị (quạt, đèn, màn hình LCD) và cấu hình ngưỡng hệ thống.
- Báo cáo thống kê, phân tích dữ liệu hiệu suất thiết bị (MTBF, xu hướng hoạt động).

---

## 1. Kiến trúc hệ thống và Cổng kết nối

### Thành phần chính
- **Frontend**: Chạy tại [http://localhost:4000](http://localhost:4000) (cấu hình trong `frontend/package.json` với script `"dev": "next dev -p 4000"`).
- **Backend**: Chạy tại [http://localhost:4001](http://localhost:4001) (cấu hình trong `backend/.env` với `PORT=4001`).
- Backend thiết lập Global Prefix là `api` => API endpoint cơ sở là `http://localhost:4001/api`.

### Luồng gọi API & Dữ liệu
```text
[Trình duyệt Người dùng]
       |
       | 1) Thao tác UI (Admin, Manager, Operator)
       v
[Next.js Frontend (localhost:4000)]
       |
       | 2) Gọi request qua shared/lib/api.ts
       |    BASE_URL = NEXT_PUBLIC_API_URL || http://localhost:4001/api
       v
[NestJS Backend (localhost:4001/api)]
       |
       | 3) Controller -> Service -> PrismaService (PostgreSQL)
       v
[PostgreSQL Database]

Song song (kết nối IoT):
[Adafruit IO MQTT Broker] <---> [NestJS MqttService] <---> [PostgreSQL (SensorDataLog / Alerts)]
```

---

## 2. Cấu trúc thư mục dự án

```text
drying-factory-management-system/
|-- backend/
|   |-- prisma/
|   |   |-- schema.prisma        # Schema cơ sở dữ liệu (PostgreSQL)
|   |   `-- seed.ts              # Script khởi tạo dữ liệu mẫu (Users, Zones, Chambers, v.v.)
|   |-- src/
|   |   |-- auth/                # Xác thực & Phân quyền (Login)
|   |   |-- users/               # Quản lý người dùng
|   |   |-- zones/               # Quản lý khu vực nhà máy
|   |   |-- chambers/            # Quản lý buồng sấy (Chambers)
|   |   |-- devices/             # Quản lý thiết bị (cảm biến, cơ cấu chấp hành)
|   |   |-- recipes/             # Quản lý công thức sấy (nhiệt độ/độ ẩm setpoint)
|   |   |-- batches/             # Quản lý mẻ sấy (trạng thái, chế độ điều khiển)
|   |   |-- alerts/              # Quản lý cảnh báo lỗi & xác nhận sự cố
|   |   |-- sensor-data/         # API truy vấn nhật ký đo đạc của cảm biến
|   |   |-- system-config/       # API quản lý cấu hình hệ thống
|   |   |-- analytics/           # API phân tích (tỷ lệ thành công mẻ sấy, MTBF)
|   |   |-- mqtt/                # Module MQTT kết nối Adafruit IO
|   |   `-- main.ts              # Khởi động ứng dụng NestJS
|   |-- .env.example
|   `-- package.json
|-- frontend/
|   |-- app/
|   |   |-- (auth)/login/        # Trang đăng nhập
|   |   |-- (admin)/admin/       # Quản lý Users, Zones, Chambers, Devices, Thresholds, Logs
|   |   |-- (manager)/           # Trang Manager (Dashboard, Recipes, Batches)
|   |   `-- (operator)/operator/ # Trang Operator (Dashboard điều khiển, Realtime, Alerts)
|   |-- features/
|   |   |-- admin/               # Feature-based logic của Admin
|   |   |-- manager/             # Feature-based logic của Manager
|   |   |-- operator/            # Feature-based logic của Operator (điều khiển thiết bị, IoT)
|   |   |-- auth/                # Login state
|   |   `-- notifications/       # Trung tâm thông báo đẩy
|   |-- shared/
|   |   |-- lib/api.ts           # Axios/Fetch client gọi Backend
|   |   `-- auth/                # Session guard & vai trò người dùng
|   |-- Dockerfile
|   `-- package.json
`-- README.md
```

---

## 3. Cấu hình Biến môi trường (Environment Variables)

### Backend (`backend/.env`)
Tạo từ tệp mẫu `backend/.env.example` và tùy chỉnh:
```env
PORT=4001
FRONTEND_URL=http://localhost:4000

# PostgreSQL Connection String
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/dadn_db?schema=public"

# Cấu hình Adafruit IO MQTT (Nếu để trống hoặc placeholder sẽ tạm tắt kết nối MQTT và log cảnh báo)
ADAFRUIT_IO_USERNAME=your_username
ADAFRUIT_IO_KEY=your_active_aio_key
ADAFRUIT_IO_BROKER_URL=mqtt://io.adafruit.com:1883
ADAFRUIT_IO_SUBSCRIBE_FEEDS=BBC_LED,BBC_TEMP,Lux,fan_level,Humidity,lcd_text,mode_state
```

### Frontend (`frontend/.env.local`)
Tạo tại thư mục `frontend/` để định cấu hình cho ứng dụng Next.js:
```env
NEXT_PUBLIC_API_URL=http://localhost:4001/api

# Cấu hình Adafruit IO phục vụ tính năng điều khiển phía Client (nếu cần thiết)
NEXT_PUBLIC_AIO_USERNAME=your_username
NEXT_PUBLIC_AIO_KEY=your_active_aio_key
```

---

## 4. Hướng dẫn thiết lập & Chạy dự án từ đầu

### Yêu cầu hệ thống
- **Node.js** phiên bản 20 trở lên.
- **PostgreSQL** đang hoạt động (ví dụ qua Docker hoặc chạy trực tiếp trên máy).

### Bước 1: Cài đặt thư viện (Dependencies)
Mở 2 cửa sổ Terminal song song:
```bash
# Terminal 1: Cài đặt Backend
cd backend
npm install

# Terminal 2: Cài đặt Frontend
cd frontend
npm install
```

### Bước 2: Thiết lập Database & Dữ liệu mẫu (Prisma)
Tại Terminal của Backend, chạy các lệnh sau để khởi chạy cấu trúc bảng và nạp dữ liệu:
```bash
cd backend

# Khởi tạo Prisma Client
npm run prisma:generate

# Tiến hành migrate cấu trúc bảng vào PostgreSQL (yêu cầu tạo sẵn DB ví dụ `dadn_db` trước)
npx prisma migrate dev

# Nạp dữ liệu ban đầu (Seed data)
npx prisma db seed
```

### Bước 3: Chạy ứng dụng ở chế độ Phát triển (Dev Mode)
Chạy đồng thời cả 2 dịch vụ để bắt đầu làm việc:
```bash
# Ở Terminal Backend
cd backend
npm run start:dev

# Ở Terminal Frontend
cd frontend
npm run dev
```

Truy cập hệ thống:
- **Giao diện người dùng**: [http://localhost:4000](http://localhost:4000)
- **API Endpoint**: [http://localhost:4001/api](http://localhost:4001/api)

---

## 5. Tài khoản dùng thử (Seed Accounts)

Mật khẩu mặc định sau khi chạy seed là:
- **Quản trị viên (Admin)**: `admin@drytech.io` / mật khẩu: `admin123`
- **Quản lý nhà máy (Manager)**: `manager@drytech.io` / mật khẩu: `123456`
- **Vận hành viên (Operator)**: `op_a@drytech.io` / mật khẩu: `op123`

---

## 6. Quy định chất lượng mã nguồn (Team Rule)

Trước khi tạo Pull Request (PR) hoặc đẩy mã nguồn lên nhánh chính, bạn **bắt buộc** phải chạy thử và đảm bảo vượt qua (pass) các bài kiểm tra sau:

```bash
# Kiểm tra phía Backend
cd backend
npm run build && npm run test && npm run lint

# Kiểm tra phía Frontend
cd frontend
npm run build && npm run test && npm run lint
```

---

## 7. Tài liệu chi tiết của từng phần
- **Frontend chi tiết**: Xem [frontend/README.md](file:///d:/Assignment/DADN-HTTT/drying-factory-management-system/frontend/README.md)
- **Backend chi tiết**: Xem [backend/README.md](file:///d:/Assignment/DADN-HTTT/drying-factory-management-system/backend/README.md)
