# SNEAK'R Shop

เว็บขายรองเท้า Sneaker แยกเป็นหน้าบ้าน (frontend), หลังบ้าน (admin), และ backend API

## โครงสร้างโปรเจกต์

```
sneaker-shop/
├── backend/            Express API server (Node.js)
│   ├── server.js
│   ├── package.json
│   └── data/
│       ├── products.json   ฐานข้อมูลสินค้า (ไฟล์ JSON)
│       └── orders.json     ฐานข้อมูลคำสั่งซื้อ (ไฟล์ JSON)
├── frontend/           หน้าบ้าน (ร้านค้า)
│   ├── index.html      หน้ารายการสินค้า
│   ├── cart.html        หน้าตะกร้า + สั่งซื้อ
│   ├── css/style.css
│   └── js/
│       ├── common.js   ฟังก์ชันจัดการตะกร้า (ใช้ร่วมกัน)
│       ├── shop.js     โหลด/แสดงสินค้า, เพิ่มลงตะกร้า
│       └── cart.js     แสดงตะกร้า, ฟอร์มสั่งซื้อ
└── admin/              หลังบ้าน (จัดการร้าน)
    ├── index.html
    ├── css/admin.css
    └── js/admin.js     จัดการสินค้า (CRUD) + ดูคำสั่งซื้อ
```

## วิธีติดตั้งและรัน

ต้องมี [Node.js](https://nodejs.org) (แนะนำ v18 ขึ้นไป) ติดตั้งในเครื่อง

```bash
cd sneaker-shop/backend
npm install
npm start
```

เปิดเบราว์เซอร์ไปที่:

- หน้าร้านค้า (frontend): http://localhost:3000
- หลังบ้าน (admin): http://localhost:3000/admin

เซิร์ฟเวอร์ตัวเดียวทำหน้าที่เสิร์ฟทั้งไฟล์ static (frontend/admin) และ API พร้อมกัน จึงไม่ต้องตั้งค่า CORS หรือรันหลายพอร์ต

## API หลัก

| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET    | `/api/products` | รายการสินค้าทั้งหมด |
| POST   | `/api/products` | เพิ่มสินค้าใหม่ |
| PUT    | `/api/products/:id` | แก้ไขสินค้า |
| DELETE | `/api/products/:id` | ลบสินค้า |
| GET    | `/api/orders` | รายการคำสั่งซื้อทั้งหมด |
| POST   | `/api/orders` | สร้างคำสั่งซื้อใหม่ (จากตะกร้า) |
| PUT    | `/api/orders/:id/status` | อัปเดตสถานะคำสั่งซื้อ |

ข้อมูลสินค้า/คำสั่งซื้อถูกเก็บในไฟล์ `backend/data/*.json` — เหมาะสำหรับเริ่มต้น/เดโม หากต้องใช้งานจริงระยะยาวควรย้ายไปใช้ฐานข้อมูล เช่น PostgreSQL/MongoDB

## หมายเหตุ

- ตะกร้าสินค้าฝั่งลูกค้าเก็บไว้ใน `localStorage` ของเบราว์เซอร์ (ยังไม่มีระบบสมาชิก/login)
- หน้า admin ยังไม่มีระบบล็อกอิน — หากนำไปใช้งานจริงควรเพิ่มการยืนยันตัวตนก่อนเข้าถึง `/admin`
