# Frontend - DryTech (Next.js App Router)

Trang giao diện chính của hệ thống quản lý nhà máy sấy công nghiệp DryTech, phục vụ 3 vai trò:
- **Admin**: Quản lý tài nguyên hệ thống (User, Zone, Chamber, Device, Threshold, Logs).
- **Manager**: Thiết lập công thức sấy (Recipe), theo dõi mẻ sấy (Batch), xem báo cáo và dashboard tổng quan.
- **Operator**: Trực tiếp vận hành mẻ sấy, giám sát dữ liệu cảm biến thời gian thực, điều khiển thiết bị thông qua MQTT và phản hồi cảnh báo.

---

## 1. Công nghệ & Thư viện sử dụng

- **Core**: Next.js `16.1.6` (App Router) + React `19.2.3` + TypeScript.
- **UI & CSS**: Ant Design `5.x` (tối ưu React 19 thông qua `@ant-design/v5-patch-for-react-19`) kết hợp một số Component Radix UI và CSS Vanilla (Tailwind v4 hỗ trợ tối ưu build).
- **Biểu đồ**: Recharts `2.15.0`.
- **State & Session**: Lưu trữ thông tin đăng nhập trong `localStorage` (`drytechUser`) và Cookie (`drytechRole`) để áp dụng Role Guard khi định tuyến.
- **API Client**: Fetch API tùy biến tập trung tại `shared/lib/api.ts`.

---

## 2. Biến môi trường (`.env.local`)

Tạo file `frontend/.env.local` tại thư mục `frontend/`:

```env
# URL API Backend (mặc định fallback http://localhost:4001/api)
NEXT_PUBLIC_API_URL=http://localhost:4001/api

# Tài khoản Adafruit IO để kết nối và kiểm tra (nếu client gọi trực tiếp)
NEXT_PUBLIC_AIO_USERNAME=your_username
NEXT_PUBLIC_AIO_KEY=your_active_aio_key
```

*Lưu ý:* Cổng mặc định của Frontend chạy ở cổng **4000** (cấu hình trong `package.json` qua script `"dev": "next dev -p 4000"`).

---

## 3. Cấu trúc thư mục mã nguồn

Hệ thống được tổ chức theo mô hình Modular Features:

```text
frontend/
|-- app/                    # Định tuyến (Routing) theo cấu trúc App Router
|   |-- (auth)/             # Route Group cho phân hệ xác thực
|   |   `-- login/          # Trang đăng nhập
|   |-- (admin)/            # Route Group cho Admin
|   |   `-- admin/          # /admin/...
|   |-- (manager)/          # Route Group cho Manager
|   |   |-- manager/        # /manager (Manager Dashboard)
|   |   |-- recipes/        # /recipes (Quản lý công thức)
|   |   `-- batches/        # /batches (Quản lý mẻ sấy)
|   `-- (operator)/         # Route Group cho Operator
|       `-- operator/       # /operator/...
|-- features/               # Các module nghiệp vụ theo chức năng
|   |-- admin/              # User, Zone, Chambers, Devices, Thresholds, Logs, Tenants
|   |-- manager/            # Dashboard, Recipes, Batches
|   |-- operator/           # Dashboard, Realtime, Alerts, Adafruit, Model
|   |-- auth/               # Module xác thực người dùng
|   `-- notifications/      # Module thông báo hệ thống
|-- shared/                 # Thành phần dùng chung
|   |-- auth/               # Session management & Role-based Guards
|   |-- lib/                # API Client và các tiện ích dùng chung
|   |-- providers/          # React context providers (Ant Design registry)
|   `-- ui/                 # Các component UI nguyên tử tái sử dụng
`-- package.json
```

---

## 4. Danh sách các Route thực tế và Feature Component tương ứng

### Phân hệ Đăng nhập
- `GET /login` -> Hiển thị trang Login (`features/auth`)

### Phân hệ Quản trị (Admin)
Mọi trang trong group này sử dụng Layout chung `AdminShell` (`features/admin/layouts/AdminShell.tsx`):
- `/admin/users` -> Quản lý tài khoản vận hành (`ChamberManagementPage` / `UserManagementPage`)
- `/admin/zones` -> Quản lý khu vực sản xuất (`ZoneManagementPage`)
- `/admin/chambers` -> Quản lý buồng sấy (`ChamberManagementPage`)
- `/admin/devices` -> Quản lý thiết bị IoT (`DeviceManagementPage`)
- `/admin/thresholds` -> Cấu hình ngưỡng nhiệt độ/độ ẩm cảnh báo (`SystemThresholdsPage`)
- `/admin/logs` -> Xem lịch sử tác vụ hệ thống (`AuditLogsPage`)
- `/admin/tenants` -> (Thư mục trống - dành cho mở rộng mô hình Multi-tenant)

### Phân hệ Quản lý (Manager)
Mọi trang trong group này sử dụng Layout chung `ManagerShell` (`features/manager/layouts/ManagerShell.tsx`):
- `/manager` -> Dashboard quản lý sản xuất (`ManagerDashboardPage`)
- `/recipes` -> Quản lý danh sách & cấu hình công thức sấy (`RecipesPage`)
- `/batches` -> Tạo mới & theo dõi trạng thái các mẻ sấy (`BatchesPage`)
- `/reports` & `/ui` -> (Thư mục trống - dành cho báo cáo mở rộng)

### Phân hệ Vận hành (Operator)
Mọi trang trong group này sử dụng Layout chung `OperatorShell` (`features/operator/layouts/OperatorShell.tsx`):
- `/operator` -> Trung tâm vận hành nhanh (`OperatorHubPage`)
- `/operator/realtime` -> Biểu đồ giám sát cảm biến thời gian thực (`RealtimeMonitoringPage`)
- `/operator/machine/[id]` -> Bảng điều khiển chi tiết thiết bị buồng sấy (`machine/[id]/page.tsx`). Hỗ trợ:
  - Xem thông số nhiệt độ, độ ẩm, độ sáng thời gian thực.
  - Chuyển chế độ vận hành (Auto / Manual).
  - Điều khiển thiết bị thủ công (Bật/tắt quạt, mức quạt, đèn LED, màn hình LCD).
  - Nhập dữ liệu mô phỏng cảm biến gửi về Broker.
- `/operator/alerts` -> Giao diện xử lý và xác nhận sự cố cảnh báo (`AlertHandlingPage`)

---

## 5. Tích hợp API Client (`shared/lib/api.ts`)

Mọi yêu cầu HTTP đi qua client tập trung, tự động chèn thông tin tài khoản đang đăng nhập thông qua header:
- `x-user-id`
- `x-user-role`

Tài liệu API Client hỗ trợ:
- **authApi**: Đăng nhập.
- **usersApi**: CRUD tài khoản.
- **zonesApi**: CRUD khu vực.
- **chambersApi**: CRUD buồng sấy.
- **devicesApi**: CRUD thiết bị & Kiểm tra tính duy nhất của feed Adafruit.
- **recipesApi**: CRUD công thức sấy, phân trang, bộ lọc.
- **batchesApi**: CRUD mẻ sấy, bộ lọc trạng thái.
- **alertsApi**: Xác nhận (`acknowledge`) và giải quyết (`resolve`) cảnh báo.
- **systemConfigApi**: Đọc & ghi thông số ngưỡng.
- **sensorDataApi**: Xem lịch sử cảm biến gần nhất.
- **mqttApi**: Kiểm tra trạng thái broker, lấy state feed mới nhất, gửi lệnh điều khiển và giả lập dữ liệu.
- **analyticsApi**: Thống kê hiệu suất, MTBF và xu hướng hoạt động của máy.

---

## 6. Lệnh chạy dự án

```bash
# Cài đặt thư viện
npm install

# Chạy dev server ở cổng 4000
npm run dev

# Kiểm tra cú pháp (Linting)
npm run lint

# Chạy Unit Tests
npm run test

# Chạy đo lường độ bao phủ kiểm thử (Coverage)
npm run test:cov

# Build dự án cho sản xuất (Production Build)
npm run build
```
