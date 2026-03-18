# Frontend - DryTech (Next.js)

Frontend của hệ thống DryTech được xây bằng Next.js App Router, phục vụ 3 vai trò:
- Admin
- Manager
- Operator

Code tổ chức theo mô hình `app` (routing) + `features` (nghiệp vụ) + `shared` (dùng chung).

## 1. Công nghệ và điểm nổi bật

- Next.js `16.1.6` + React `19.2.3`
- Ant Design `5.x` + một số component Radix UI
- App Router với route groups:
	- `(auth)`
	- `(admin)`
	- `(manager)`
	- `(operator)`
- Role-based session phía client qua `localStorage` + cookie (`drytechRole`)
- API client tập trung ở `shared/lib/api.ts`

## 2. Cài đặt và chạy

```bash
cd frontend
npm install
```

### Chạy môi trường dev
```bash
npm run dev
```

Lưu ý: script `dev` chạy ở cổng `3001`:
```json
"dev": "next dev -p 3001"
```

Truy cập: `http://localhost:3001`

## 3. Scripts (theo package.json)

```bash
npm run dev        # Next dev server port 3001
npm run build      # next build
npm run start      # next start
npm run lint       # eslint
npm run test       # vitest run
npm run test:watch # vitest
npm run test:cov   # vitest run --coverage
```

## 4. ENV config

Tạo file `frontend/.env.local`:

```env
# Backend API base URL
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Dùng cho module Adafruit IO (operator)
NEXT_PUBLIC_AIO_USERNAME=your_adafruit_username
NEXT_PUBLIC_AIO_KEY=your_adafruit_aio_key
```

Các fallback đang có trong code:
- `NEXT_PUBLIC_API_URL` fallback -> `http://localhost:3000/api`
- `NEXT_PUBLIC_AIO_USERNAME` fallback -> `YOUR_AIO_USERNAME`
- `NEXT_PUBLIC_AIO_KEY` fallback -> `YOUR_AIO_KEY`

## 5. Cách frontend gọi backend

Toàn bộ request HTTP đi qua `shared/lib/api.ts`:
- `BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'`
- Hàm `request<T>()` dùng `fetch()` và ném `ApiError` khi response không thành công.

Các API wrappers chính:
- `authApi.login` -> `POST /auth/login`
- `usersApi` -> `/users`
- `zonesApi` -> `/zones`
- `devicesApi` -> `/devices`
- `recipesApi` -> `/recipes`
- `batchesApi` -> `/batches`
- `alertsApi` -> `/alerts`, `/alerts/:id/acknowledge`, `/alerts/:id/resolve`
- `systemConfigApi` -> `/system-config`
- `sensorDataApi.getRecent` -> `/sensor-data?deviceId=&limit=`

## 6. Route structure thực tế

```text
app/
|-- page.tsx -> redirect('/login')
|-- (auth)/login/page.tsx
|-- (admin)/admin/{users,zones,devices,thresholds,logs}/page.tsx
|-- (manager)/{manager,recipes,batches,reports,ai,ui}/page.tsx
`-- (operator)/operator/{realtime,adafruit,alerts}/page.tsx
```

Layout theo role:
- `(admin)/layout.tsx` -> `features/admin/layouts/AdminShell.tsx`
- `(manager)/layout.tsx` -> `features/manager/layouts/ManagerShell.tsx`
- `(operator)/layout.tsx` -> `features/operator/layouts/OperatorShell.tsx`

## 7. Cấu trúc thư mục chính

```text
frontend/
|-- app/                # Route và layout theo role
|-- features/
|   |-- admin/          # User, zone, devices, logs, thresholds
|   |-- manager/        # Dashboard, recipes, batches, reports, AI
|   |-- operator/       # Dashboard, realtime, alerts, adafruit
|   |-- auth/           # Login
|   `-- notifications/  # Notification center
|-- shared/
|   |-- auth/           # Session utils + role guard
|   |-- lib/            # API client, registry, utilities
|   |-- providers/      # App providers
|   `-- ui/             # Reusable UI components
`-- Dockerfile
```

## 8. Chạy cùng backend

```bash
# Terminal 1
cd backend
npm run start:dev

# Terminal 2
cd frontend
npm run dev
```

Frontend sẽ gọi backend qua `NEXT_PUBLIC_API_URL`.

## 9. TEAM RULE trước khi tạo PR

Bắt buộc pass:
- `npm run build` ✅
- `npm run test` ✅
- `npm run lint` ✅
- `npm run test:cov` ✅

Nếu chưa pass, KHÔNG được tạo PR.
