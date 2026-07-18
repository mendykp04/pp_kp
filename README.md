# SNEAK'R Shop

เว็บขายรองเท้า Sneaker แยกเป็นหน้าบ้าน (frontend), หลังบ้าน (admin), และ backend API

## โครงสร้างโปรเจกต์

```
sneaker-shop/
├── backend/                 Express API server (Node.js)
│   ├── server.js
│   ├── package.json
│   ├── uploads/             รูปภาพสินค้าที่อัปโหลดจากหน้า admin
│   └── data/                ฐานข้อมูล (ไฟล์ JSON)
│       ├── products.json
│       ├── categories.json
│       ├── flashsales.json
│       ├── orders.json
│       ├── employees.json
│       └── sales.json
├── frontend/                หน้าบ้าน (ร้านค้า)
│   ├── index.html           รายการสินค้า + Flash Sale + กรองหมวดหมู่
│   ├── cart.html            ตะกร้า + สั่งซื้อ
│   ├── css/style.css
│   └── js/{common,shop,cart}.js
└── admin/                   หลังบ้าน (จัดการร้าน) — ต้องล็อกอินก่อนใช้งาน
    ├── login.html           หน้าเข้าสู่ระบบ
    ├── index.html           แดชบอร์ด (สินค้า/หมวดหมู่/Flash Sale/ออเดอร์/พนักงาน/POS/รายงาน)
    ├── css/admin.css
    └── js/{login,admin}.js
```

## วิธีติดตั้งและรัน (เครื่องตัวเอง)

ต้องมี [Node.js](https://nodejs.org) (แนะนำ v18 ขึ้นไป) ติดตั้งในเครื่อง

```bash
cd sneaker-shop/backend
npm install
npm start
```

เปิดเบราว์เซอร์ไปที่:

- หน้าร้านค้า (frontend): http://localhost:3000
- หลังบ้าน (admin): http://localhost:3000/admin — ต้องล็อกอินก่อน (ดูรหัสผ่าน default ด้านล่าง)

เซิร์ฟเวอร์ตัวเดียวทำหน้าที่เสิร์ฟทั้งไฟล์ static (frontend/admin) และ API พร้อมกัน จึงไม่ต้องตั้งค่า CORS หรือรันหลายพอร์ต

## ระบบล็อกอินหลังบ้าน

หน้า `/admin` ทั้งหมดถูกป้องกันด้วยระบบล็อกอิน (session + cookie) — ทุก API ที่แก้ไขข้อมูล (สินค้า, หมวดหมู่, Flash Sale, พนักงาน, คำสั่งซื้อ, POS) ต้องล็อกอินก่อนถึงจะเรียกใช้ได้ ส่วน API ที่หน้าร้านค้าใช้ (ดูสินค้า, ดู Flash Sale ที่ active, สั่งซื้อ) ยังเปิดสาธารณะตามปกติ

**ตั้งค่าชื่อผู้ใช้/รหัสผ่านผ่าน environment variable:**

| ตัวแปร | ค่า default (ถ้าไม่ตั้งค่า) | คำอธิบาย |
|--------|------------------------------|----------|
| `ADMIN_USERNAME` | `admin` | ชื่อผู้ใช้สำหรับล็อกอินหลังบ้าน |
| `ADMIN_PASSWORD` | `admin1234` | รหัสผ่านสำหรับล็อกอินหลังบ้าน |
| `SESSION_SECRET` | ค่าคงที่ในโค้ด (ไม่ปลอดภัยสำหรับ production) | กุญแจลับใช้เซ็นชื่อ cookie ของ session |

⚠️ **ค่า default ใช้ได้แค่ตอนทดสอบในเครื่องเท่านั้น** ก่อนขึ้นใช้งานจริงบนอินเทอร์เน็ต **ต้องตั้งค่าทั้ง 3 ตัวแปรนี้เอง** (ห้ามใช้ค่า default) ไม่งั้นใครก็เดารหัสผ่านเข้าหลังบ้านได้ ตัวอย่างการรันพร้อมตั้งค่า:

```bash
ADMIN_USERNAME=myshop ADMIN_PASSWORD="รหัสผ่านที่คาดเดายาก" SESSION_SECRET="สุ่มยาว ๆ ไม่ซ้ำใคร" npm start
```

หรือถ้า deploy บนแพลตฟอร์มคลาวด์ (Render, Railway, Fly.io ฯลฯ) ให้ตั้งค่าตัวแปรเหล่านี้ในหน้า **Environment Variables** ของแพลตฟอร์มนั้นแทน

## ก่อนขึ้นออนไลน์ (deploy จริง)

โปรเจกต์นี้เป็น Express server ตัวเดียวที่เสิร์ฟทั้งหน้าบ้าน+หลังบ้าน+API ในตัวเดียวกัน (monolithic) วิธีที่ง่ายที่สุดคือ **deploy backend ตัวเดียว** แล้วให้มันเสิร์ฟทุกอย่าง ไม่ต้องแยก deploy frontend/backend คนละที่ก็ได้

**เช็คลิสต์ก่อน deploy:**

1. **ตั้งค่า `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`** ผ่าน environment variable ของแพลตฟอร์ม deploy (ห้ามใช้ค่า default)
2. **ต้องใช้ HTTPS** เสมอ (แพลตฟอร์มคลาวด์ส่วนใหญ่ทำให้อัตโนมัติ) เพราะข้อมูลล็อกอิน/คำสั่งซื้อส่งผ่านเครือข่ายจริง
3. **ข้อมูลเก็บเป็นไฟล์ JSON ในเครื่อง (`backend/data/*.json`)** — แพลตฟอร์ม serverless/container บางแห่ง (เช่น Render free tier, Vercel) จะ**ล้างไฟล์ทุกครั้งที่ deploy ใหม่หรือรีสตาร์ท** เพราะไม่มี persistent disk ให้ ถ้าจะใช้งานจริงระยะยาวควร:
   - เลือกแพลตฟอร์มที่มี persistent disk/volume (เช่น Render พร้อม Persistent Disk, Railway, VPS ธรรมดาอย่าง DigitalOcean/Linode) หรือ
   - ย้ายไปใช้ฐานข้อมูลจริง เช่น PostgreSQL/MongoDB (ต้องแก้โค้ดเพิ่ม ไม่ได้ทำไว้ในโปรเจกต์นี้)
4. โฟลเดอร์ `backend/uploads/` (รูปสินค้าที่อัปโหลด) ก็มีปัญหาเดียวกันกับข้อ 3 — ถ้า deploy บนแพลตฟอร์มที่ไม่มี persistent disk รูปที่อัปโหลดจะหายเมื่อรีสตาร์ท ทางแก้คือใช้ persistent disk เดียวกับข้อ 3 หรือย้ายไปเก็บบน cloud storage (เช่น Cloudinary, S3) ในอนาคต
5. รัน `npm install` (ไม่ใช่ `npm ci` ถ้าไม่มี lockfile ตรงกัน) บนเซิร์ฟเวอร์ปลายทาง แล้วสั่ง `npm start`
6. ตรวจสอบว่าพอร์ตที่แพลตฟอร์มกำหนดมาให้ถูกอ่านจาก `process.env.PORT` (โค้ดรองรับอยู่แล้ว)

**แพลตฟอร์มที่แนะนำสำหรับโปรเจกต์นี้** (Node.js + persistent disk, ตั้งค่าง่าย): Render (Web Service + Persistent Disk), Railway, หรือ VPS ธรรมดา ก็อป repo ขึ้นไปแล้วรัน `npm start` ตรง ๆ

## API หลัก

| Method | Endpoint | คำอธิบาย | ต้องล็อกอิน |
|--------|----------|----------|:---:|
| GET | `/api/products` | รายการสินค้าทั้งหมด | - |
| POST/PUT/DELETE | `/api/products` | จัดการสินค้า | ✅ |
| GET | `/api/categories` | รายการหมวดหมู่ | - |
| POST/PUT/DELETE | `/api/categories` | จัดการหมวดหมู่ | ✅ |
| GET | `/api/flash-sales/active` | Flash Sale ที่กำลังลดราคาอยู่ (หน้าร้าน) | - |
| GET/POST/PUT/DELETE | `/api/flash-sales` | จัดการ Flash Sale ทั้งหมด | ✅ |
| POST | `/api/orders` | ลูกค้าสั่งซื้อจากตะกร้า | - |
| GET | `/api/orders` | ดูคำสั่งซื้อทั้งหมด | ✅ |
| PUT | `/api/orders/:id/status` | อัปเดตสถานะคำสั่งซื้อ | ✅ |
| GET/POST/PUT/DELETE | `/api/employees` | จัดการพนักงาน | ✅ |
| GET/POST | `/api/sales` | ระบบขายหน้าร้าน (POS) | ✅ |
| POST | `/api/upload` | อัปโหลดรูปสินค้า | ✅ |
| POST | `/api/auth/login` | เข้าสู่ระบบหลังบ้าน | - |
| POST | `/api/auth/logout` | ออกจากระบบ | - |
| GET | `/api/auth/me` | เช็คสถานะล็อกอินปัจจุบัน | - |

ข้อมูลทั้งหมดถูกเก็บในไฟล์ `backend/data/*.json` — เหมาะสำหรับเริ่มต้น/เดโม ดูข้อควรระวังเรื่องนี้ในหัวข้อ "ก่อนขึ้นออนไลน์" ด้านบน

## หมายเหตุ

- ตะกร้าสินค้าฝั่งลูกค้าเก็บไว้ใน `localStorage` ของเบราว์เซอร์ (ยังไม่มีระบบสมาชิก/login ฝั่งลูกค้า)
- ระบบล็อกอินหลังบ้านรองรับผู้ดูแลระบบคนเดียว (ชื่อผู้ใช้/รหัสผ่านชุดเดียวจาก environment variable) ไม่ได้ออกแบบมาสำหรับผู้ใช้หลายคนที่มีสิทธิ์ต่างกัน
