# Backend - DryTech API (NestJS + Prisma)

Cung cấp hệ thống REST API cho frontend Next.js và xử lý đồng bộ dữ liệu cảm biến thời gian thực, điều khiển thiết bị thông qua giao thức MQTT kết nối với Adafruit IO.

---

## 1. Công nghệ & Thư viện sử dụng

- **Core Framework**: NestJS `11`
- **ORM**: Prisma Client với PostgreSQL adapter (`@prisma/adapter-pg` sử dụng pg pool).
- **MQTT Client**: Kết nối trực tiếp với Broker thông qua thư viện `mqtt`.
- **Validation**: `class-validator` + `class-transformer` làm việc qua NestJS `ValidationPipe` toàn cục.

---

## 2. Cấu hình Cổng chạy và Biến môi trường (`.env`)

Tạo tệp `backend/.env` từ tệp mẫu `backend/.env.example`:

```env
# Cổng chạy ứng dụng
PORT=4001

# Cho phép CORS từ Frontend
FRONTEND_URL=http://localhost:4000

# PostgreSQL Connection String (Prisma sử dụng)
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/dadn_db?schema=public"

# Kết nối MQTT Broker (Adafruit IO)
ADAFRUIT_IO_USERNAME=your_username
ADAFRUIT_IO_KEY=your_active_aio_key
ADAFRUIT_IO_BROKER_URL=mqtt://io.adafruit.com:1883
ADAFRUIT_IO_LCD_FEED=drytech.m-a1-lcd

# Danh sách feed backend sẽ tự động lắng nghe khi khởi động (phân tách bằng dấu phẩy)
ADAFRUIT_IO_SUBSCRIBE_FEEDS=BBC_LED,BBC_TEMP,Lux,fan_level,Humidity,lcd_text,mode_state
```

*Lưu ý:* Nếu các thông tin Adafruit IO bị để trống hoặc dùng giá trị giả lập, module MQTT sẽ log cảnh báo và ngắt kết nối tạm thời để hệ thống REST API chạy bình thường mà không bị lỗi.

---

## 3. Khởi tạo Cơ sở dữ liệu (Prisma & Compatibility Layer)

### Cấu trúc bảng (Models)
Các thực thể chính trong file `prisma/schema.prisma`:
- **User**: Người dùng hệ thống phân quyền vai trò (Admin, Manager, Operator).
- **Zone**: Khu vực làm việc trong nhà máy.
- **Chamber**: Buồng sấy nằm trong một Zone, liên kết với các kênh cảm biến và cơ cấu chấp hành.
- **Device**: Thiết bị/Máy sấy chính liên kết với các Feed của Adafruit IO.
- **SensorChannel & ActuatorChannel**: Các kênh truyền thông tin cảm biến (Temp, Humid, Lux...) và điều khiển (Fan, LED, LCD...) tương ứng của từng máy.
- **Recipe, RecipeStage, RecipeStep**: Định nghĩa các giai đoạn và bước sấy cho các loại trái cây khác nhau.
- **Batch, BatchOperation**: Lịch sử chạy mẻ sấy sấy tự động/thủ công.
- **SensorDataLog**: Nhật ký ghi nhận dữ liệu đo được từ cảm biến dạng JSON.
- **Alert, AlertResolution**: Lịch sử cảnh báo vượt ngưỡng và phản hồi từ Operator.
- **SystemConfig**: Cấu hình ngưỡng cảnh báo chung của hệ thống.

### Lớp tương thích tự động (Compatibility Layer)
Để hỗ trợ việc chuyển đổi và mở rộng cấu trúc bảng động, `PrismaService` (`src/prisma/prisma.service.ts`) được lập trình sẵn một cơ chế kiểm tra và bổ sung bảng tự động khi khởi chạy ứng dụng (`onModuleInit` -> `ensureCompatibilitySchema`):
- Tự động tạo các bảng mở rộng: `Organizations`, `Factories`, `Sites`, `SensorChannels`, `ActuatorChannels` nếu chưa tồn tại.
- Tự động bổ sung các cột tổ chức phân cấp (`OrganizationID`, `FactoryID`, `SiteID`) vào các bảng hiện tại.

### Lệnh thiết lập DB
```bash
# Khởi chạy Prisma Client
npm run prisma:generate

# Migrate cơ sở dữ liệu
npx prisma migrate dev

# Tạo dữ liệu Seed (Tạo sẵn các vai trò, cấu hình và máy demo)
npx prisma db seed
```

---

## 4. Danh sách API Endpoint (Global Prefix: `/api`)

### Xác thực (Auth)
- `POST /api/auth/login` -> Đăng nhập & trả về thông tin user + vai trò.

### Quản lý Người dùng (Users)
- `GET /api/users` -> Lấy danh sách người dùng.
- `GET /api/users/:id` -> Chi tiết người dùng.
- `POST /api/users` -> Tạo người dùng.
- `PATCH /api/users/:id` -> Cập nhật thông tin.
- `DELETE /api/users/:id` -> Xóa người dùng.

### Quản lý Khu vực (Zones)
- `GET /api/zones` | `GET /api/zones/:id`
- `POST /api/zones` | `PATCH /api/zones/:id` | `DELETE /api/zones/:id`

### Quản lý Buồng sấy (Chambers)
- `GET /api/chambers` | `GET /api/chambers/:id`
- `POST /api/chambers` | `PATCH /api/chambers/:id` | `DELETE /api/chambers/:id`

### Quản lý Thiết bị (Devices)
- `GET /api/devices` | `GET /api/devices/:id`
- `POST /api/devices` | `PATCH /api/devices/:id` | `DELETE /api/devices/:id`
- `POST /api/devices/validate-feeds` -> Kiểm tra trùng lặp feed key.

### Công thức sấy (Recipes)
- `GET /api/recipes` -> Lấy tất cả công thức.
- `GET /api/recipes?page=&pageSize=&search=&status=` -> Phân trang và tìm kiếm.
- `GET /api/recipes/:id`
- `POST /api/recipes` | `PATCH /api/recipes/:id` | `DELETE /api/recipes/:id`

### Mẻ sấy (Batches)
- `GET /api/batches?status=&page=&pageSize=` -> Phân trang & lọc trạng thái (running, completed, fail).
- `GET /api/batches/:id`
- `POST /api/batches` | `PATCH /api/batches/:id` | `DELETE /api/batches/:id`

### Quản lý Cảnh báo (Alerts)
- `GET /api/alerts?status=`
- `GET /api/alerts/:id`
- `PATCH /api/alerts/:id/acknowledge` -> Vận hành viên xác nhận đã thấy cảnh báo.
- `PATCH /api/alerts/:id/resolve` -> Vận hành viên đóng cảnh báo kèm ghi chú.

### Nhật ký cảm biến (Sensor Data)
- `GET /api/sensor-data?deviceId=&limit=` -> Truy vấn log cảm biến thô phục vụ biểu đồ realtime.

### Cấu hình hệ thống (System Config)
- `GET /api/system-config` -> Đọc cấu hình ngưỡng.
- `PATCH /api/system-config` -> Ghi đè cấu hình ngưỡng toàn hệ thống.

### Module Phân tích (Analytics)
- `GET /api/analytics/summary?from=&to=&zoneId=` -> Thống kê hiệu suất chung.
- `GET /api/analytics/trend?from=&to=&zoneId=&period=&status=&page=&pageSize=` -> Biểu đồ xu hướng.
- `GET /api/analytics/hourly-avg?from=&to=&zoneId=&metric=` -> Giá trị trung bình hàng giờ (Nhiệt độ/Độ ẩm).
- `GET /api/analytics/mtbf?from=&to=&zoneId=` -> Chỉ số MTBF của các thiết bị.

### Module MQTT & IoT điều khiển
- `GET /api/mqtt/status` -> Kiểm tra trạng thái kết nối tới Adafruit IO.
- `GET /api/mqtt/state` -> Trạng thái feed mới nhất lưu ở memory.
- `GET /api/mqtt/device/:id/state` -> Mape trạng thái feed cụ thể theo kênh của thiết bị.
- `POST /api/mqtt/subscribe` -> Thay đổi feed lắng nghe tại runtime.
- `POST /api/mqtt/command` -> Gửi tín hiệu điều khiển cơ cấu chấp hành (Fan, LED, LCD...).
- `POST /api/mqtt/simulate/incoming` -> Giả lập tín hiệu cảm biến gửi về server (phục vụ kiểm thử).

---

## 5. Hướng dẫn Giả lập & Kiểm thử điều khiển thiết bị (MQTT)

Sử dụng PowerShell để gửi REST request kiểm tra tính năng điều khiển IoT thông qua Backend:

```powershell
# 1. Gửi lệnh bật quạt mức 2 (fan_level = 2) từ Server lên Adafruit IO
Invoke-RestMethod -Method POST -Uri http://localhost:4001/api/mqtt/command -ContentType "application/json" -Body '{"feed":"fan_level","value":2}'

# 2. Giả lập tín hiệu nhiệt độ gửi từ cảm biến buồng sấy về Server (để lưu DB và kiểm tra ngưỡng cảnh báo)
Invoke-RestMethod -Method POST -Uri http://localhost:4001/api/mqtt/simulate/incoming -ContentType "application/json" -Body '{"feed":"BBC_TEMP","value":35.2}'

# 3. Lấy trạng thái lưu trữ cảm biến hiện tại của máy để kiểm tra kết quả đồng bộ
Invoke-RestMethod -Method GET -Uri http://localhost:4001/api/mqtt/state
```

---

## 6. Lệnh chạy và Kiểm thử code

```bash
# Chạy ứng dụng dev mode (port 4001)
npm run start:dev

# Kiểm tra lint
npm run lint

# Chạy kiểm thử Unit test
npm run test

# Chạy đo độ bao phủ test (Coverage)
npm run test:cov

# Chạy kiểm thử E2E (End-to-End)
npm run test:e2e

# Build ứng dụng cho sản xuất
npm run build
```
