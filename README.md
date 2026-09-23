# Dormitory Parcel Management System (DPMS)

ระบบจัดการพัสดุประจำหอพัก แทนที่ workflow เดิมที่ใช้ Google Forms + Google Sheets สำหรับเจ้าหน้าที่หอพัก
รองรับพัสดุเข้า/ออกประมาณ 418 ชิ้น/วัน และสูงสุดถึง ~1,024 ชิ้น/วันช่วง Flash Sale

สถาปัตยกรรม 3 ชั้น: **React (Vite)** ↔ **Go/Gin REST API** ↔ **PostgreSQL** — รันทั้งหมดผ่าน Docker

## สถานะปัจจุบัน

Backend (Go/Gin) และฐานข้อมูล (PostgreSQL) ใช้งานได้จริงแล้ว ไม่ใช่ demo ที่เก็บข้อมูลใน browser อีกต่อไป
Frontend เรียก API จริงทุกจุด (`docs/02-design/prototype/src/api/client.js`) มี test suite ของตัวเอง (Vitest + Testing
Library + MSW) และมีฟีเจอร์เสริม **เช็คสถานะพัสดุผ่าน LINE** (ดู `backend/README.md` หัวข้อ "LINE integration")

เอกสารหลักที่เป็นแหล่งอ้างอิง:
- `CLAUDE.md` — ขอบเขต, ข้อจำกัดที่ต้องยึดตาม, คำสั่งที่ใช้บ่อย
- `docs/02-design/design-spec.md` — การตัดสินใจด้าน design ที่ **LOCKED** ไว้แล้ว
- `PROJECT_STRUCTURE.md` — แผนผังโครงสร้างไฟล์ทั้งหมด

## เทคโนโลยีที่ใช้

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React + Tailwind CSS (Vite) |
| Backend | Go + Gin |
| Database | PostgreSQL |
| Deployment (dev) | Docker / docker-compose |

## ความต้องการของระบบ

- **Docker Desktop** (ต้องเปิดไว้ตลอดตอนรัน backend + database)
- **Node.js 18+** และ **npm** (สำหรับ frontend)
- Go (ไม่บังคับ — ใช้เฉพาะตอนแก้ไข/build backend เอง เพราะปกติรันผ่าน Docker)

## การติดตั้งและรัน

### 1. ตั้งค่า secret (ครั้งแรกครั้งเดียว)

```bash
cd docker
cp .env.example .env
```

แก้ไฟล์ `docker/.env` ที่ได้ (ไฟล์นี้ถูก gitignore ไว้ ไม่ถูก commit):
- `POSTGRES_PASSWORD` — ตั้งอะไรก็ได้
- `SESSION_SECRET` — ต้องยาว ≥ 32 ตัวอักษร สร้างได้ด้วย `openssl rand -hex 32`
- `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` — **ไม่บังคับ** ใส่เฉพาะถ้าจะทดสอบฟีเจอร์ LINE

### 2. รัน backend + database

```bash
cd docker
docker compose up -d --build
```

Migration ฐานข้อมูลรันอัตโนมัติตอน backend เริ่มทำงาน ตรวจสอบได้ที่ `http://localhost:8080/healthz`

### 3. ใส่ข้อมูลตัวอย่าง (ครั้งแรก หรือเมื่ออยากรีเซ็ตข้อมูล)

```bash
docker compose exec backend /app/seed -parcels 1000 -reset
```

> Git Bash บน Windows: ใส่ `MSYS_NO_PATHCONV=1` นำหน้าคำสั่งนี้ ไม่งั้น path `/app/seed` จะถูกแปลงเป็น path ของ Windows ผิดๆ

สร้างบัญชีเจ้าหน้าที่ไว้ทดสอบ (dev เท่านั้น) — username `admin` / `somsri` / `prasert`, password `parcel1234`

### 4. รัน frontend

```bash
cd docs/02-design/prototype
npm install        # ครั้งแรกครั้งเดียว
npm run dev
```

เปิด `http://localhost:5173` — คำขอ `/api/*` ถูก proxy ไปที่ backend อัตโนมัติ (ดู `vite.config.js`)

### 5. (ไม่บังคับ) ทดสอบฟีเจอร์เช็คพัสดุผ่าน LINE

ต้องมี public HTTPS tunnel (เช่น ngrok, cloudflared) ชี้เข้า `localhost:8080` แล้วนำ URL ไปตั้งเป็น Webhook ใน
LINE Official Account Manager — รายละเอียดครบทุกขั้นตอนอยู่ใน `backend/README.md` หัวข้อ "LINE integration"

## การทดสอบ

```bash
# Backend — ต้องมี TEST_DATABASE_URL ชี้ไปที่ Postgres (เช่นตัวเดียวกับใน docker) ไม่งั้น test จะถูกข้าม
cd backend
export TEST_DATABASE_URL='postgres://dpms:<password>@127.0.0.1:5432/dpms?sslmode=disable'
go test ./...

# Frontend — mock network ด้วย MSW ไม่ต้องมี backend รันอยู่
cd docs/02-design/prototype
npm test
```

## ฟีเจอร์หลัก (ตามขอบเขตที่ล็อกไว้ใน CLAUDE.md)

1. **บันทึกพัสดุเข้า (Check-In)** — สแกน/พิมพ์เลขพัสดุ แล้วเลือกห้องจากทะเบียนผู้พักเท่านั้น (ไม่รับพิมพ์ห้องอิสระ)
2. **บันทึกพัสดุออก (Check-Out)** — ค้นหาด้วยเลขห้อง นำออกทีละชิ้นหรือทั้งหมดในครั้งเดียว
3. **ค้นหา (Search & Lookup)** — ค้นด้วยเลขห้อง, เลขพัสดุ หรือชื่อผู้พัก
4. **Dashboard** — สรุปจำนวนรับเข้า/นำออก/รอรับของแต่ละวัน พร้อมคิวพัสดุมีปัญหา (ระบุห้องไม่ได้)

พร้อมทะเบียนผู้พัก (read-only) และ audit trail ทุกการรับเข้า/นำออก — ดูรายละเอียด endpoint ทั้งหมดใน `backend/README.md`

## โครงสร้างไฟล์

ดูแผนผังฉบับเต็มที่ `PROJECT_STRUCTURE.md` — สรุปคร่าวๆ:

```text
backend/            Go + Gin API (cmd/server, cmd/seed, internal/...)
db/migrations/      Schema PostgreSQL เรียงตามลำดับไฟล์
docker/             docker-compose.yml, Dockerfile, .env.example
docs/
├── 01-requirements/  Backlog และ spec รายข้อ
├── 02-design/
│   ├── design-spec.md      การตัดสินใจ design ที่ LOCKED แล้ว
│   └── prototype/           React + Vite client (เรียก backend API จริง)
└── 05-log/           บันทึกงานประจำวัน/รายงานตรวจสอบ
```

## ข้อจำกัดที่ยังไม่ได้ทำ (Known gaps)

- ยังไม่มี rate limiting การ login
- Session เป็น signed cookie ไร้สถานะ — logout ล้าง cookie ได้ แต่เพิกถอน token ที่ถูกขโมยก่อนหมดอายุไม่ได้
- ยังไม่มี job ย้ายพัสดุเก่าไปสถานะ `archived` อัตโนมัติ
- ยังไม่มีหน้าจอให้ผู้พัก access/correct/ลบข้อมูลตัวเองผ่านแอป (ช่องทางอีเมลถึง PO ยังใช้งานได้ตามที่ระบุใน `rule.md`)
- ยังไม่เคย load test ที่ 1,024 พัสดุ/วันจริง มีแค่ correctness test

รายละเอียดเพิ่มเติมทั้งหมดอยู่ใน `backend/README.md`
