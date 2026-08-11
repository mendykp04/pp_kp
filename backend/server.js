// เรียกใช้ไลบรารี Express มาสร้างเว็บเซิร์ฟเวอร์และ API
const express = require('express');
// เรียกใช้ไลบรารี cors เพื่ออนุญาตให้เว็บอื่น (โดเมน/พอร์ตอื่น) เรียก API ของเราได้
const cors = require('cors');
// เรียกใช้โมดูล fs (File System) ของ Node.js เพื่ออ่าน/เขียนไฟล์ JSON
const fs = require('fs');
// เรียกใช้โมดูล crypto (ในตัว Node.js อยู่แล้ว ไม่ต้องติดตั้งเพิ่ม) ใช้แฮชรหัสผ่านลูกค้าตอนสมัครสมาชิก/ล็อกอินหน้าร้านค้า
const crypto = require('crypto');
// เรียกใช้โมดูล path เพื่อสร้าง path ของไฟล์ให้ถูกต้องทุกระบบปฏิบัติการ
const path = require('path');
// เรียกใช้ไลบรารี multer สำหรับรับไฟล์ที่อัปโหลดมาจากฟอร์ม (multipart/form-data) เช่นรูปสินค้า
const multer = require('multer');
// เรียกใช้ไลบรารี express-session เพื่อจดจำว่าใคร "ล็อกอิน" อยู่บ้าง (เก็บสถานะไว้ฝั่งเซิร์ฟเวอร์ ผูกกับ cookie ที่ส่งให้เบราว์เซอร์)
const session = require('express-session');
// เรียกใช้ไลบรารี promptpay-qr เพื่อสร้างข้อความ (payload) ตามมาตรฐาน EMV QR สำหรับพร้อมเพย์
const generatePromptPayPayload = require('promptpay-qr');
// เรียกใช้ไลบรารี qrcode เพื่อแปลงข้อความ payload ให้กลายเป็นรูปภาพ QR code จริง ๆ
const QRCode = require('qrcode');
// เรียกใช้ชั้นฐานข้อมูล SQLite (backend/db.js) แทนการอ่าน/เขียนไฟล์ .json โดยตรง
const db = require('./db');
// เรียกใช้ตัวช่วยเชื่อมต่อ Cloudinary (backend/cloudinary.js) สำหรับอัปโหลดรูปสินค้าให้อยู่ถาวร ไม่หายตอน container รีสตาร์ท
const cloudinaryHelper = require('./cloudinary');

// สร้างแอปพลิเคชัน Express ขึ้นมา 1 ตัว เก็บไว้ในตัวแปร app
const app = express();
// กำหนดพอร์ตที่จะรันเซิร์ฟเวอร์ ถ้ามีค่าจาก environment variable ให้ใช้ค่านั้น ถ้าไม่มีใช้ 3000
const PORT = process.env.PORT || 3000;

// สร้าง path เต็มไปยังโฟลเดอร์เก็บไฟล์รูปภาพสินค้าที่อัปโหลดจากหน้า admin
const UPLOADS_DIR = path.join(__dirname, 'uploads');
// ถ้ายังไม่มีโฟลเดอร์ uploads (เช่นรันครั้งแรก) ให้สร้างขึ้นมาก่อน { recursive: true } กันไม่ให้ error หากมีอยู่แล้ว
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ชื่อผู้ใช้/รหัสผ่านสำหรับล็อกอินหลังบ้าน อ่านจาก environment variable ก่อนเสมอ (ตั้งค่าตอน deploy จริง)
// ถ้าไม่ได้ตั้งค่าไว้ (เช่นตอนรันทดสอบในเครื่อง) จะ fallback ไปใช้ค่าเริ่มต้นด้านล่าง
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';
// ถ้ากำลังใช้รหัสผ่าน default อยู่ (ไม่ได้ตั้งค่า ADMIN_PASSWORD เอง) ให้เตือนไว้ใน console กันลืมเปลี่ยนตอนขึ้นเซิร์ฟเวอร์จริง
if (!process.env.ADMIN_PASSWORD) {
  console.warn(
    '⚠️  กำลังใช้รหัสผ่านแอดมิน default (admin/admin1234) กรุณาตั้งค่า ADMIN_USERNAME และ ADMIN_PASSWORD ผ่าน environment variable ก่อนนำขึ้นใช้งานจริงบนอินเทอร์เน็ต'
  );
}

// ข้อมูลบัญชีสำหรับรับโอนเงิน (โอนธนาคาร / พร้อมเพย์) อ่านจาก environment variable ก่อนเสมอ ถ้าไม่ได้ตั้งค่าไว้จะ fallback ไปใช้ค่าเริ่มต้นด้านล่าง
// ชื่อธนาคารที่ใช้รับโอน
const BANK_NAME = process.env.BANK_NAME || 'ธนาคารกสิกรไทย';
// เลขบัญชีธนาคาร
const BANK_ACCOUNT_NUMBER = process.env.BANK_ACCOUNT_NUMBER || '987-5-43567-8';
// ชื่อบัญชีธนาคาร (เจ้าของบัญชี)
const BANK_ACCOUNT_NAME = process.env.BANK_ACCOUNT_NAME || 'ฒิญฌาณ เหมุทัย';
// หมายเลขที่ผูกกับพร้อมเพย์ (เบอร์โทรศัพท์ หรือเลขบัตรประชาชน) ใช้สร้าง QR code รับเงิน
const PROMPTPAY_ID = process.env.PROMPTPAY_ID || '0827564321';

// เปิดใช้งาน CORS กับทุก request ที่เข้ามา พร้อม credentials: true เพื่อให้เบราว์เซอร์ส่ง cookie ของ session ไปกับ request ข้ามโดเมนได้ (เผื่อ frontend/backend อยู่คนละโดเมนตอน deploy)
app.use(cors({ origin: true, credentials: true }));
// เปิดใช้งานการแปลง body ของ request ที่เป็น JSON ให้กลายเป็น object ใน req.body อัตโนมัติ
app.use(express.json());
// เปิดใช้งานระบบ session: เมื่อผู้ใช้ล็อกอินสำเร็จ เซิร์ฟเวอร์จะส่ง cookie กลับไปเก็บไว้ในเบราว์เซอร์ แล้วใช้ cookie นี้จดจำสถานะล็อกอินในคำขอถัดไป
app.use(
  session({
    // กุญแจลับใช้เข้ารหัส/เซ็นชื่อ cookie กันคนปลอมแปลง ควรตั้งค่าเองผ่าน env ตอน deploy จริง (ไม่งั้นจะสุ่มใหม่ทุกครั้งที่เซิร์ฟเวอร์รีสตาร์ท ทำให้ทุกคนต้องล็อกอินใหม่)
    secret: process.env.SESSION_SECRET || 'sneaker-shop-dev-secret-change-me',
    // ไม่ต้องบันทึก session ซ้ำถ้าข้อมูลไม่ได้เปลี่ยนแปลง (ลดการเขียนข้อมูลโดยไม่จำเป็น)
    resave: false,
    // ไม่สร้าง session ไว้ล่วงหน้าจนกว่าจะมีการเก็บค่าอะไรบางอย่างจริง ๆ (เช่นตอนล็อกอินสำเร็จ)
    saveUninitialized: false,
    cookie: {
      // httpOnly กัน JavaScript ฝั่งเบราว์เซอร์อ่านค่า cookie นี้ได้ (ป้องกันการขโมย session ผ่าน XSS)
      httpOnly: true,
      // อายุ cookie 8 ชั่วโมง หลังจากนั้นต้องล็อกอินใหม่
      maxAge: 8 * 60 * 60 * 1000,
    },
  })
);

// เสิร์ฟหน้าบ้าน (frontend) ที่ path หลัก
// บอก Express ว่าเมื่อมีคนเข้ามาที่ "/" ให้ไปหยิบไฟล์ static (html/css/js) จากโฟลเดอร์ ../frontend มาให้
app.use('/', express.static(path.join(__dirname, '..', 'frontend')));
// เสิร์ฟหลังบ้าน (admin) ที่ /admin
// บอก Express ว่าเมื่อมีคนเข้ามาที่ "/admin" ให้ไปหยิบไฟล์ static จากโฟลเดอร์ ../admin มาให้
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
// เสิร์ฟไฟล์รูปภาพที่อัปโหลดไว้ ที่ path /uploads เพื่อให้เบราว์เซอร์เรียกดูรูปสินค้าที่เพิ่งอัปโหลดได้
app.use('/uploads', express.static(UPLOADS_DIR));

// ตั้งค่า multer ว่าจะเก็บไฟล์ที่อัปโหลดไว้ที่ไหน
// ถ้าตั้งค่า Cloudinary ไว้แล้ว (ดู backend/cloudinary.js) ให้เก็บไฟล์ไว้ในหน่วยความจำก่อน (ไม่เขียนลงดิสก์เลย) แล้วส่งต่อขึ้น Cloudinary ในขั้นตอนถัดไป
// ถ้ายังไม่ได้ตั้งค่า Cloudinary (เช่นตอนรันในเครื่องตัวเอง) ให้ fallback ไปเขียนไฟล์ลงโฟลเดอร์ uploads ในเครื่องแทนเหมือนเดิม
const uploadStorage = cloudinaryHelper.isConfigured
  ? multer.memoryStorage()
  : multer.diskStorage({
      // บอก multer ว่าให้บันทึกไฟล์ทุกไฟล์ที่อัปโหลดไว้ในโฟลเดอร์ uploads ที่เตรียมไว้
      destination: (req, file, cb) => cb(null, UPLOADS_DIR),
      // ตั้งชื่อไฟล์ใหม่ให้ไม่ซ้ำกัน โดยใช้ genId ต่อด้วยนามสกุลไฟล์เดิม (เช่น .jpg, .png)
      filename: (req, file, cb) => cb(null, genId('img-') + path.extname(file.originalname)),
    });
// สร้างตัวจัดการอัปโหลด โดยจำกัดขนาดไฟล์ไม่เกิน 5MB และรับเฉพาะไฟล์รูปภาพเท่านั้น
const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // ตรวจสอบว่า mimetype ของไฟล์ขึ้นต้นด้วย "image/" หรือไม่ (เช่น image/png, image/jpeg)
    if (file.mimetype.startsWith('image/')) cb(null, true);
    // ถ้าไม่ใช่ไฟล์รูปภาพ ให้ปฏิเสธไฟล์นั้น พร้อมข้อความ error
    else cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพเท่านั้น'));
  },
});

// ฟังก์ชันสร้างรหัส (id) แบบสุ่ม โดยรับ prefix (เช่น "p" สำหรับสินค้า, "o" สำหรับออเดอร์) มาต่อหน้า
function genId(prefix) {
  // นำเวลาปัจจุบัน (Date.now) แปลงเป็นเลขฐาน 36 ต่อกับเลขสุ่มอีกชุด เพื่อให้ id ไม่ซ้ำกัน
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ฟังก์ชันตรวจสอบว่า Flash Sale รายการหนึ่ง "กำลังลดราคาอยู่ตอนนี้" หรือไม่
// (เวลาปัจจุบันต้องอยู่ระหว่างเวลาเริ่ม startAt และเวลาสิ้นสุด endAt)
function isFlashSaleActive(sale) {
  // แปลงเวลาปัจจุบันเป็นตัวเลข (มิลลิวินาที) เพื่อใช้เปรียบเทียบ
  const now = Date.now();
  // เงื่อนไข active คือ เวลาปัจจุบันต้อง >= เวลาเริ่ม และ <= เวลาสิ้นสุด
  return now >= new Date(sale.startAt).getTime() && now <= new Date(sale.endAt).getTime();
}

// Middleware ตรวจสอบว่า request นี้มาจากคนที่ "ล็อกอินหลังบ้านแล้ว" หรือไม่ ใช้ครอบ API ที่เป็นของแอดมินเท่านั้น
// ถ้า req.session.isAdmin เป็น true (ตั้งไว้ตอนล็อกอินสำเร็จ) ให้ผ่านไปทำงานต่อ (next()) ถ้าไม่ใช่ ให้ตอบกลับ 401 ทันที
function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' });
}

// Middleware ตรวจสอบว่า request นี้มาจาก "ลูกค้าที่ล็อกอินหน้าร้านค้าแล้ว" หรือไม่ (คนละสถานะกับ requireAuth ด้านบนที่เป็นของแอดมิน)
// ใช้ req.session.customerId แยกต่างหากจาก req.session.isAdmin จึงไม่ชนกัน
function requireCustomerAuth(req, res, next) {
  if (req.session && req.session.customerId) return next();
  res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' });
}

// ฟังก์ชันแฮชรหัสผ่านด้วย scrypt (มีอยู่ในตัว Node.js อยู่แล้ว ไม่ต้องติดตั้งไลบรารีเพิ่ม เช่น bcrypt)
// เก็บผลลัพธ์เป็นข้อความรูปแบบ "salt:hash" (แยกด้วย : ) เพื่อให้ verifyPassword ใช้ salt เดียวกันตรวจสอบภายหลังได้
function hashPassword(password) {
  // สุ่ม salt ใหม่ทุกครั้ง กันคนที่ตั้งรหัสผ่านเหมือนกันมีแฮชออกมาเหมือนกัน (ป้องกัน rainbow table)
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

// ฟังก์ชันตรวจสอบรหัสผ่านที่กรอกมา เทียบกับค่าแฮชที่เก็บไว้ในฐานข้อมูล
function verifyPassword(password, stored) {
  // ถ้าบัญชีนี้ยังไม่เคยตั้งรหัสผ่านไว้เลย (เช่น แอดมินเพิ่มลูกค้าเข้าระบบเองโดยลูกค้ายังไม่เคยสมัครสมาชิก) ให้ถือว่าตรวจสอบไม่ผ่านเสมอ
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  const inputHash = crypto.scryptSync(password, salt, 64).toString('hex');
  // ใช้ crypto.timingSafeEqual แทนการเทียบ string ตรง ๆ (===) เพื่อป้องกัน timing attack
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(inputHash, 'hex'));
}

// ฟังก์ชันตัดฟิลด์ password ออกจากข้อมูลลูกค้าก่อนส่งกลับไปให้ฝั่งหน้าเว็บเสมอ (ป้องกันแฮชรหัสผ่านหลุดออกไปโดยไม่ตั้งใจ แม้จะเป็น response ของแอดมินก็ตาม)
function sanitizeCustomer(customer) {
  const { password, ...rest } = customer;
  return rest;
}

// ---------- Auth API (ระบบล็อกอินเข้าหลังบ้าน) ----------

// เมื่อมีการเรียก POST ที่ /api/auth/login (กรอกฟอร์มล็อกอินแล้วกดเข้าสู่ระบบ)
app.post('/api/auth/login', (req, res) => {
  // ดึงชื่อผู้ใช้และรหัสผ่านที่กรอกมาจาก body
  const { username, password } = req.body;
  // เทียบกับชื่อผู้ใช้/รหัสผ่านที่ตั้งไว้ (จาก environment variable หรือค่า default)
  // หมายเหตุ: เทียบแบบข้อความตรง ๆ เพราะระบบนี้มีผู้ดูแลคนเดียว ไม่ได้เก็บผู้ใช้หลายคนในฐานข้อมูล
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    // ตั้งค่าสถานะล็อกอินไว้ใน session (ผูกกับ cookie ที่ส่งกลับไปให้เบราว์เซอร์อัตโนมัติ)
    req.session.isAdmin = true;
    // เก็บชื่อผู้ใช้ไว้ใน session ด้วย เผื่อต้องการแสดงผลภายหลัง
    req.session.username = username;
    return res.json({ success: true, username });
  }
  // ถ้าชื่อผู้ใช้หรือรหัสผ่านผิด ให้ตอบกลับ 401 พร้อมข้อความทั่วไป (ไม่บอกว่าผิดที่ชื่อผู้ใช้หรือรหัสผ่าน เพื่อความปลอดภัย)
  res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
});

// เมื่อมีการเรียก POST ที่ /api/auth/logout (กดออกจากระบบ)
app.post('/api/auth/logout', (req, res) => {
  // ทำลาย session ทิ้ง (ลบสถานะล็อกอินออกจากฝั่งเซิร์ฟเวอร์)
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// เมื่อมีการเรียก GET ที่ /api/auth/me (เช็คว่าตอนนี้ล็อกอินอยู่หรือไม่ ใช้ตอนเปิดหน้า admin ทุกครั้ง)
app.get('/api/auth/me', (req, res) => {
  // ตอบกลับสถานะการล็อกอินปัจจุบัน อ่านจาก session
  if (req.session && req.session.isAdmin) {
    return res.json({ loggedIn: true, username: req.session.username });
  }
  res.json({ loggedIn: false });
});

// ---------- Customer Auth API (ระบบสมัครสมาชิก/ล็อกอินฝั่งลูกค้า หน้าร้านค้า) ----------
// แยกต่างหากจากระบบล็อกอินแอดมินด้านบนโดยสิ้นเชิง (คนละ session key: customerId ไม่ใช่ isAdmin)
// ให้ลูกค้าเข้ามาดูประวัติ/สถานะคำสั่งซื้อของตัวเองได้ทั้งหมดในที่เดียว โดยไม่ต้องจำหมายเลขคำสั่งซื้อทีละใบเหมือนหน้า "ตรวจสอบคำสั่งซื้อ" (track.html)

// เมื่อมีการเรียก POST ที่ /api/auth/customer/register (ลูกค้าสมัครสมาชิกใหม่)
app.post('/api/auth/customer/register', async (req, res) => {
  const { name, phone, password, address } = req.body;
  // ตรวจสอบข้อมูลขั้นต่ำ: ต้องมีชื่อ, เบอร์โทร, รหัสผ่าน (อย่างน้อย 6 ตัวอักษร กันตั้งรหัสสั้นเกินไป)
  if (!name || !phone || !password) {
    return res.status(400).json({ error: 'กรุณาระบุชื่อ-สกุล, เบอร์โทร, และรหัสผ่าน' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
  }

  const customers = await db.readCustomers();
  const idx = customers.findIndex((c) => c.phone === phone);

  if (idx !== -1 && customers[idx].password) {
    // เบอร์นี้เคยสมัครสมาชิกไว้แล้ว (มีรหัสผ่านอยู่แล้ว) ให้ไปเข้าสู่ระบบแทน
    return res.status(400).json({ error: 'เบอร์โทรนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบแทนการสมัครใหม่' });
  }

  let customer;
  if (idx !== -1) {
    // เบอร์นี้มีอยู่แล้วในฐานข้อมูลลูกค้า แต่ยังไม่เคยตั้งรหัสผ่าน (เช่นแอดมินเคยเพิ่มไว้เอง หรือเคยสั่งซื้อแบบไม่ได้สมัครสมาชิก)
    // ให้ "อัปเกรด" รายการเดิมเป็นบัญชีที่ล็อกอินได้ แทนที่จะสร้างซ้ำ เพื่อให้ประวัติคำสั่งซื้อเดิม (จับคู่ด้วยเบอร์โทร) ยังเชื่อมกับบัญชีนี้เหมือนเดิม
    customers[idx] = {
      ...customers[idx],
      name,
      address: address || customers[idx].address,
      password: hashPassword(password),
    };
    customer = customers[idx];
  } else {
    // เบอร์นี้ไม่เคยมีในระบบมาก่อนเลย ให้สร้างลูกค้าใหม่
    customer = { id: genId('cus-'), name, phone, address: address || '', password: hashPassword(password) };
    customers.push(customer);
  }
  await db.writeCustomers(customers);

  // ล็อกอินให้อัตโนมัติทันทีหลังสมัครสำเร็จ (ไม่ต้องให้กรอกล็อกอินซ้ำอีกรอบ)
  req.session.customerId = customer.id;
  req.session.customerName = customer.name;
  req.session.customerPhone = customer.phone;
  req.session.customerAddress = customer.address;
  res.status(201).json({ success: true, name: customer.name, phone: customer.phone });
});

// เมื่อมีการเรียก POST ที่ /api/auth/customer/login (ลูกค้าเข้าสู่ระบบ)
app.post('/api/auth/customer/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: 'กรุณาระบุเบอร์โทรและรหัสผ่าน' });
  }
  const customers = await db.readCustomers();
  const customer = customers.find((c) => c.phone === phone);
  // ไม่บอกว่าผิดที่เบอร์โทรหรือรหัสผ่าน (ข้อความเดียวกันทั้งสองกรณี) เพื่อความปลอดภัย เหมือนระบบล็อกอินแอดมิน
  if (!customer || !verifyPassword(password, customer.password)) {
    return res.status(401).json({ error: 'เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง' });
  }
  req.session.customerId = customer.id;
  req.session.customerName = customer.name;
  req.session.customerPhone = customer.phone;
  req.session.customerAddress = customer.address;
  res.json({ success: true, name: customer.name, phone: customer.phone });
});

// เมื่อมีการเรียก POST ที่ /api/auth/customer/logout (ลูกค้าออกจากระบบ)
app.post('/api/auth/customer/logout', (req, res) => {
  // ลบเฉพาะสถานะล็อกอินของลูกค้าออกจาก session (ไม่ทำลาย session ทั้งหมด เผื่อมีค่าอื่นของฝั่งแอดมินอยู่ในเบราว์เซอร์เดียวกัน)
  delete req.session.customerId;
  delete req.session.customerName;
  delete req.session.customerPhone;
  delete req.session.customerAddress;
  res.json({ success: true });
});

// เมื่อมีการเรียก GET ที่ /api/auth/customer/me (เช็คว่าตอนนี้ลูกค้าล็อกอินอยู่หรือไม่ ใช้ตอนเปิดทุกหน้าของหน้าร้านค้า)
app.get('/api/auth/customer/me', (req, res) => {
  if (req.session && req.session.customerId) {
    return res.json({
      loggedIn: true,
      name: req.session.customerName,
      phone: req.session.customerPhone,
      address: req.session.customerAddress || '',
    });
  }
  res.json({ loggedIn: false });
});

// เมื่อมีการเรียก GET ที่ /api/customer/orders (ขอประวัติคำสั่งซื้อทั้งหมดของลูกค้าที่ล็อกอินอยู่) — เฉพาะลูกค้าที่ล็อกอินแล้วเท่านั้น
app.get('/api/customer/orders', requireCustomerAuth, async (req, res) => {
  const orders = await db.readOrders();
  // กรองเฉพาะคำสั่งซื้อที่เบอร์โทรตรงกับบัญชีที่ล็อกอินอยู่ (ไม่รับเบอร์โทรจาก query string ของผู้ใช้ ป้องกันดูออเดอร์ของคนอื่น)
  const myOrders = orders
    .filter((o) => o.phone === req.session.customerPhone)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(myOrders);
});

// ---------- Payment API (ข้อมูลบัญชีรับโอนเงิน + สร้าง QR code พร้อมเพย์) ----------
// กลุ่ม API ที่ใช้ในหน้าตะกร้าสินค้า ตอนลูกค้าเลือกวิธีชำระเงินเป็น "โอนธนาคาร" หรือ "พร้อมเพย์"

// เมื่อมีการเรียก GET ที่ /api/payment-info (ขอข้อมูลบัญชีธนาคาร สำหรับแสดงตอนลูกค้าเลือกโอนเงินผ่านธนาคาร)
app.get('/api/payment-info', (req, res) => {
  // ส่งข้อมูลบัญชีธนาคารกลับไปเป็น JSON (ไม่มีข้อมูลอ่อนไหวเกินไป เพราะเป็นข้อมูลที่ร้านค้าตั้งใจเปิดเผยให้ลูกค้าโอนเงินอยู่แล้ว)
  res.json({
    bankName: BANK_NAME,
    accountNumber: BANK_ACCOUNT_NUMBER,
    accountName: BANK_ACCOUNT_NAME,
  });
});

// เมื่อมีการเรียก GET ที่ /api/payment/promptpay-qr (ขอรูป QR code พร้อมเพย์ พร้อมระบุยอดเงินที่ต้องโอน)
app.get('/api/payment/promptpay-qr', async (req, res) => {
  // อ่านยอดเงินจาก query string เช่น /api/payment/promptpay-qr?amount=1590
  const amount = Number(req.query.amount);
  // ตรวจสอบว่ายอดเงินที่ส่งมาต้องเป็นตัวเลขที่มากกว่า 0 เท่านั้น
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'กรุณาระบุยอดเงินที่ถูกต้อง' });
  }
  // ใช้ try/catch ดักจับข้อผิดพลาดระหว่างสร้าง QR code
  try {
    // สร้างข้อความ (payload) ตามมาตรฐาน EMV QR จากหมายเลขพร้อมเพย์และยอดเงินที่ต้องชำระ
    const payload = generatePromptPayPayload(PROMPTPAY_ID, { amount });
    // แปลง payload ให้เป็นรูปภาพ QR code ในรูปแบบ data URL (ฝัง base64 ไว้ในตัวข้อความเลย ไม่ต้องเซฟไฟล์แยก)
    const qrDataUrl = await QRCode.toDataURL(payload, { width: 320, margin: 1 });
    // ตอบกลับ data URL ของรูป QR code ให้ฝั่งหน้าเว็บนำไปแสดงในแท็ก <img> ได้ทันที
    res.json({ qrDataUrl });
  } catch (err) {
    // ถ้าสร้าง QR code ไม่สำเร็จ (เช่นหมายเลขพร้อมเพย์ผิดรูปแบบ) ให้ตอบกลับ error
    res.status(500).json({ error: 'สร้าง QR code ไม่สำเร็จ' });
  }
});

// ---------- Upload API ----------
// API สำหรับรับไฟล์รูปภาพที่อัปโหลดจากหน้า admin แล้วบันทึกไว้ในโฟลเดอร์ uploads

// เมื่อมีการเรียก POST ที่ /api/upload พร้อมแนบไฟล์มาด้วย
// upload.single('image') คือให้ multer ดักรับไฟล์จาก field ชื่อ "image" เพียงไฟล์เดียว แล้วค่อยรันฟังก์ชันต่อท้าย
app.post('/api/upload', requireAuth, upload.single('image'), async (req, res) => {
  // ถ้าไม่มีไฟล์แนบมาเลย (เช่น ผู้ใช้กด submit โดยไม่เลือกไฟล์) ให้ตอบกลับ error 400
  if (!req.file) return res.status(400).json({ error: 'กรุณาเลือกไฟล์รูปภาพ' });

  // ถ้าตั้งค่า Cloudinary ไว้แล้ว ให้ส่งไฟล์ (อยู่ในหน่วยความจำ ไม่ได้เขียนลงดิสก์) ขึ้น Cloudinary แล้วตอบกลับ URL ถาวรจากที่นั่นแทน
  if (cloudinaryHelper.isConfigured) {
    try {
      const result = await cloudinaryHelper.uploadBuffer(req.file.buffer, genId('img-'));
      return res.json({ url: result.secure_url });
    } catch (err) {
      return res.status(500).json({ error: 'อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่' });
    }
  }

  // ถ้ายังไม่ได้ตั้งค่า Cloudinary (เช่นตอนรันในเครื่องตัวเอง) ให้ตอบกลับ path ของรูปที่บันทึกไว้ในเครื่อง (เช่น /uploads/img-xxxxx.jpg) เหมือนเดิม
  res.json({ url: `/uploads/${req.file.filename}` });
});

// เมื่อมีการเรียก POST ที่ /api/upload/slip (ลูกค้าอัปโหลดรูปสลิปโอนเงินตอนสั่งซื้อ/แนบทีหลัง) — เปิดสาธารณะ ไม่ต้องล็อกอิน (คนละสิทธิ์กับ /api/upload ที่สงวนไว้สำหรับแอดมินอัปโหลดรูปสินค้าเท่านั้น)
app.post('/api/upload/slip', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'กรุณาเลือกไฟล์รูปภาพ' });

  if (cloudinaryHelper.isConfigured) {
    try {
      const result = await cloudinaryHelper.uploadBuffer(req.file.buffer, genId('slip-'));
      return res.json({ url: result.secure_url });
    } catch (err) {
      return res.status(500).json({ error: 'อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่' });
    }
  }

  res.json({ url: `/uploads/${req.file.filename}` });
});

// ---------- Products API ----------
// กลุ่ม API ที่เกี่ยวกับ "สินค้า" ทั้งหมด (ดู/เพิ่ม/แก้/ลบ)

// เมื่อมีการเรียก GET ที่ /api/products (ขอรายการสินค้าทั้งหมด)
app.get('/api/products', async (req, res) => {
  // อ่านข้อมูลสินค้าทั้งหมดจากไฟล์ products.json
  const products = await db.readProducts();
  // ส่งข้อมูลสินค้ากลับไปเป็น JSON ให้ผู้ที่เรียกมา
  res.json(products);
});

// เมื่อมีการเรียก GET ที่ /api/products/:id (ขอสินค้าชิ้นเดียวตามรหัส)
app.get('/api/products/:id', async (req, res) => {
  // อ่านข้อมูลสินค้าทั้งหมดจากไฟล์
  const products = await db.readProducts();
  // ค้นหาสินค้าที่มี id ตรงกับค่าที่ส่งมาใน URL (req.params.id)
  const product = products.find((p) => p.id === req.params.id);
  // ถ้าไม่เจอสินค้า ให้ตอบกลับสถานะ 404 (ไม่พบ) พร้อมข้อความแจ้งเตือน
  if (!product) return res.status(404).json({ error: 'ไม่พบสินค้า' });
  // ถ้าเจอ ส่งข้อมูลสินค้านั้นกลับไป
  res.json(product);
});

// เมื่อมีการเรียก POST ที่ /api/products (เพิ่มสินค้าใหม่) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น (requireAuth)
app.post('/api/products', requireAuth, async (req, res) => {
  // ดึงข้อมูลฟิลด์ต่าง ๆ ออกจาก body ของ request ที่ส่งมา (ฝั่ง admin ส่งมาเป็น JSON) — images คือ array ของ path รูปที่อัปโหลดไว้แล้ว (อัปโหลดผ่าน /api/upload มาก่อนหน้านี้)
  const { name, brand, code, price, sizes, images, description, condition, categoryId, type } = req.body;
  // ตรวจสอบข้อมูลขั้นต่ำ: ต้องมีชื่อสินค้าและราคา ถ้าไม่มีให้ตอบกลับ error 400 (ข้อมูลไม่ถูกต้อง)
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'กรุณาระบุชื่อสินค้าและราคา' });
  }
  // อ่านรายการสินค้าปัจจุบันทั้งหมดจากไฟล์ เพื่อนำมาต่อท้ายด้วยสินค้าใหม่
  const products = await db.readProducts();
  // ตัดช่องว่างหัวท้ายของรหัสสินค้าที่ส่งมา (เผื่อพิมพ์เว้นวรรคเกินมาโดยไม่ตั้งใจ)
  const trimmedCode = (code || '').trim();
  // ตรวจสอบว่ารหัสสินค้านี้มีอยู่แล้วในระบบหรือไม่ (เทียบแบบไม่สนตัวพิมพ์ใหญ่/เล็ก เพื่อกัน A1 กับ a1 ซ้ำกัน) — รหัสว่างไม่ต้องเช็คซ้ำเพราะไม่ได้ใช้อ้างอิงตัวไหน
  if (trimmedCode && products.some((p) => (p.code || '').toLowerCase() === trimmedCode.toLowerCase())) {
    return res.status(400).json({ error: `รหัสสินค้า "${trimmedCode}" มีอยู่แล้วในระบบ กรุณาใช้รหัสอื่น` });
  }
  // สร้าง object สินค้าใหม่ โดยกำหนด id อัตโนมัติ และแปลงชนิดข้อมูลให้ถูกต้อง (ราคาเป็นตัวเลข)
  const newProduct = {
    id: genId('p'),
    name,
    brand: brand || '',
    // รหัสรองเท้า ใช้แยกแต่ละคู่ออกจากกัน แม้จะเป็นรุ่นเดียวกัน (สินค้าเป็นของมือสอง แต่ละคู่มีสภาพไม่เหมือนกัน)
    code: trimmedCode,
    price: Number(price),
    // categoryId คือหมวดหมู่ราคาที่ผูกไว้กับสินค้าชิ้นนี้ (เช่น "ราคาถูก") ถ้าไม่ระบุมาให้เป็นค่าว่าง
    categoryId: categoryId || '',
    // สินค้าเป็นของมือสอง แต่ละรายการมีแค่ 1 คู่เสมอ (ไม่มีแนวคิด "จำนวนสต็อก" หลายชิ้นเหมือนสินค้าใหม่) — 1 = ยังไม่ถูกขาย, 0 = ขายไปแล้ว
    stock: 1,
    sizes: Array.isArray(sizes) ? sizes : [],
    // เก็บรูปได้หลายรูป รูปแรกในลิสต์ถือเป็นรูปปก (db.js จะเก็บซ้ำไว้ในคอลัมน์ image ให้ส่วนอื่นที่ยังอ้างอิงรูปเดียวใช้งานได้)
    images: Array.isArray(images) ? images : [],
    description: description || '',
    // สภาพ/ตำหนิสินค้า แยกจากรายละเอียดสินค้าทั่วไป เพราะสินค้ามือสองแต่ละคู่มีสภาพไม่เหมือนกัน
    condition: condition || '',
    // ประเภทรองเท้า เช่น รองเท้าแฟชั่น, รองเท้าวิ่ง ใช้กรอง/ค้นหาทั้งฝั่งแอดมินและหน้าร้านค้า
    type: type || '',
  };
  // เพิ่มสินค้าใหม่เข้าไปท้าย array ของสินค้าทั้งหมด
  products.push(newProduct);
  // บันทึกรายการสินค้าทั้งหมด (รวมของใหม่) กลับลงไฟล์ products.json
  await db.writeProducts(products);
  // ตอบกลับสถานะ 201 (สร้างสำเร็จ) พร้อมข้อมูลสินค้าที่เพิ่งสร้าง
  res.status(201).json(newProduct);
});

// เมื่อมีการเรียก PUT ที่ /api/products/:id (แก้ไขสินค้าตามรหัส) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.put('/api/products/:id', requireAuth, async (req, res) => {
  // อ่านรายการสินค้าทั้งหมดจากไฟล์
  const products = await db.readProducts();
  // หาตำแหน่ง (index) ของสินค้าที่ id ตรงกับที่ส่งมาใน URL
  const idx = products.findIndex((p) => p.id === req.params.id);
  // ถ้าไม่เจอสินค้าที่ตำแหน่งนั้น (idx เป็น -1) ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบสินค้า' });

  // ดึงข้อมูลที่ส่งมาจาก body สำหรับใช้แก้ไข
  const { name, brand, code, price, sizes, images, description, condition, categoryId, type } = req.body;
  // เก็บข้อมูลสินค้าเดิมไว้ในตัวแปร existing เพื่อใช้เป็นค่า default ถ้าไม่ได้ส่งฟิลด์นั้นมาแก้ไข
  const existing = products[idx];
  // ถ้ามีการส่งรหัสสินค้าใหม่มา (ไม่ใช่ undefined) และรหัสนั้นเปลี่ยนไปจากเดิมจริง ๆ ให้ตรวจสอบว่าซ้ำกับสินค้าชิ้นอื่นหรือไม่
  const trimmedCode = code !== undefined ? code.trim() : undefined;
  if (
    trimmedCode &&
    trimmedCode.toLowerCase() !== (existing.code || '').toLowerCase() &&
    products.some((p) => p.id !== existing.id && (p.code || '').toLowerCase() === trimmedCode.toLowerCase())
  ) {
    return res.status(400).json({ error: `รหัสสินค้า "${trimmedCode}" มีอยู่แล้วในระบบ กรุณาใช้รหัสอื่น` });
  }
  // สร้าง object สินค้าใหม่ โดยรวมข้อมูลเดิม (...existing) กับข้อมูลใหม่ที่ส่งมา
  // ใช้ ?? (nullish coalescing) คือถ้าค่าที่ส่งมาเป็น undefined/null จะใช้ค่าเดิมแทน
  // หมายเหตุ: ไม่รับค่า stock จากฟอร์มแก้ไขสินค้าอีกต่อไป (สินค้ามือสองมีแค่ 1 คู่เสมอ สถานะขายแล้ว/ยังไม่ขาย จะถูกอัปเดตจากขั้นตอนสั่งซื้อ/ขายหน้าร้านเท่านั้น) จึงคงค่าเดิมไว้เสมอ
  products[idx] = {
    ...existing,
    name: name ?? existing.name,
    brand: brand ?? existing.brand,
    code: trimmedCode ?? existing.code,
    price: price !== undefined ? Number(price) : existing.price,
    // ถ้าไม่ได้ส่ง categoryId มา ให้คงหมวดหมู่เดิมไว้ (categoryId ที่ส่งมาเป็นสตริงว่าง "" ถือว่าตั้งใจล้างหมวดหมู่ จึงต้องเช็ค undefined เท่านั้น)
    categoryId: categoryId !== undefined ? categoryId : existing.categoryId,
    sizes: Array.isArray(sizes) ? sizes : existing.sizes,
    images: Array.isArray(images) ? images : existing.images,
    description: description ?? existing.description,
    condition: condition ?? existing.condition,
    type: type ?? existing.type,
  };
  // อัปเดตรูปปก (image) ให้ตรงกับรูปแรกใน images เสมอ เผื่อกรณีแก้ไขแล้วส่ง response กลับไปทันทีโดยยังไม่ได้อ่านข้อมูลใหม่จากฐานข้อมูล
  products[idx].image = products[idx].images[0] || '';
  // บันทึกรายการสินค้าทั้งหมด (ที่แก้ไขแล้ว) กลับลงไฟล์
  await db.writeProducts(products);
  // ตอบกลับข้อมูลสินค้าที่แก้ไขเสร็จแล้ว
  res.json(products[idx]);
});

// เมื่อมีการเรียก DELETE ที่ /api/products/:id (ลบสินค้าตามรหัส) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.delete('/api/products/:id', requireAuth, async (req, res) => {
  // อ่านรายการสินค้าทั้งหมดจากไฟล์
  const products = await db.readProducts();
  // หาตำแหน่งของสินค้าที่ต้องการลบ
  const idx = products.findIndex((p) => p.id === req.params.id);
  // ถ้าไม่เจอสินค้า ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบสินค้า' });
  // ลบสินค้าออกจาก array ด้วย splice (เอาตัวที่ถูกลบเก็บไว้ในตัวแปร removed)
  const removed = products.splice(idx, 1);
  // บันทึกรายการสินค้าที่เหลือ (หลังลบ) กลับลงไฟล์
  await db.writeProducts(products);
  // ตอบกลับข้อมูลสินค้าที่ถูกลบไป เพื่อยืนยันว่าลบตัวไหน
  res.json(removed[0]);
});

// ---------- Orders API ----------
// กลุ่ม API ที่เกี่ยวกับ "คำสั่งซื้อ" ทั้งหมด (ดู/สร้าง/อัปเดตสถานะ)

// เมื่อมีการเรียก GET ที่ /api/orders (ขอรายการคำสั่งซื้อทั้งหมด สำหรับหน้า admin) — มีข้อมูลลูกค้า (ชื่อ/เบอร์โทร/ที่อยู่) จึงต้องล็อกอินก่อน
app.get('/api/orders', requireAuth, async (req, res) => {
  // อ่านรายการคำสั่งซื้อทั้งหมดจากไฟล์
  let orders = await db.readOrders();
  // ถ้ามีการระบุ query string "date" มา (เช่น ตอนดูสรุปยอดขายของวันที่เลือกในแท็บ "สรุปยอดขาย")
  if (req.query.date) {
    // กรองเฉพาะคำสั่งซื้อที่ "วันที่" ของ createdAt (ตัดเอาแค่ส่วน YYYY-MM-DD) ตรงกับวันที่ที่ระบุ
    orders = orders.filter((o) => o.createdAt.slice(0, 10) === req.query.date);
  }
  // เรียงลำดับคำสั่งซื้อจากใหม่ไปเก่า (เทียบวันที่สร้าง createdAt) แล้วส่งกลับไป
  res.json(orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// เมื่อมีการเรียก GET ที่ /api/orders/track?orderId=...&phone=... (ลูกค้าตรวจสอบสถานะคำสั่งซื้อของตัวเอง ไม่ต้องล็อกอิน)
// ต้องระบุทั้งหมายเลขคำสั่งซื้อและเบอร์โทรให้ตรงกันทั้งคู่ ถึงจะดูได้ — กันไม่ให้คนอื่นเดาหมายเลขคำสั่งซื้อแล้วเห็นชื่อ/ที่อยู่ของลูกค้าคนอื่น
app.get('/api/orders/track', async (req, res) => {
  const { orderId, phone } = req.query;
  if (!orderId || !phone) {
    return res.status(400).json({ error: 'กรุณาระบุหมายเลขคำสั่งซื้อและเบอร์โทร' });
  }
  const orders = await db.readOrders();
  const order = orders.find((o) => o.id === orderId && o.phone === phone);
  if (!order) {
    return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ กรุณาตรวจสอบหมายเลขคำสั่งซื้อและเบอร์โทรอีกครั้ง' });
  }
  res.json(order);
});

// เมื่อมีการเรียก POST ที่ /api/orders (ลูกค้ากดยืนยันสั่งซื้อจากตะกร้า)
app.post('/api/orders', async (req, res) => {
  // ดึงข้อมูลลูกค้าและรายการสินค้าที่สั่งซื้อจาก body — slipUrl (ไม่บังคับ) คือรูปสลิปโอนเงินที่อัปโหลดไว้แล้ว (ถ้ามีตอนกดสั่งซื้อ)
  const { customerName, phone, address, items, paymentMethod, slipUrl } = req.body;
  // ตรวจสอบว่าข้อมูลครบถ้วนหรือไม่ (ชื่อ, เบอร์โทร, ที่อยู่ และต้องมีรายการสินค้าอย่างน้อย 1 ชิ้น)
  if (!customerName || !phone || !address || !Array.isArray(items) || items.length === 0) {
    // ถ้าข้อมูลไม่ครบ ตอบกลับ error 400
    return res.status(400).json({ error: 'ข้อมูลคำสั่งซื้อไม่ครบถ้วน' });
  }
  // รายการวิธีชำระเงินที่อนุญาต: เก็บเงินปลายทาง, โอนผ่านธนาคาร, พร้อมเพย์
  const allowedPaymentMethods = ['cod', 'bank_transfer', 'promptpay'];
  // ถ้าไม่ได้ระบุมาให้ default เป็น "เก็บเงินปลายทาง" ถ้าระบุมาแต่ไม่ตรงกับตัวเลือกที่มี ให้ตอบกลับ error
  if (paymentMethod && !allowedPaymentMethods.includes(paymentMethod)) {
    return res.status(400).json({ error: 'วิธีชำระเงินไม่ถูกต้อง' });
  }

  // อ่านรายการสินค้าทั้งหมด เพื่อใช้ตรวจสอบราคาและชื่อสินค้าจริงจากฐานข้อมูล (ไม่เชื่อราคาที่ฝั่งลูกค้าส่งมาตรง ๆ)
  const products = await db.readProducts();
  // อ่านรายการ Flash Sale ทั้งหมด เพื่อใช้ตรวจสอบว่าสินค้าชิ้นไหนกำลังลดราคาอยู่จริงหรือไม่
  const flashSales = await db.readFlashSales();
  // ตัวแปรเก็บยอดรวมราคาทั้งออเดอร์ เริ่มต้นที่ 0
  let total = 0;
  // ตัวแปรเก็บรายการสินค้าที่ผ่านการตรวจสอบแล้ว (พร้อมชื่อ/ราคาที่ถูกต้อง)
  const orderItems = [];
  // ตัวแปรนับจำนวนที่ถูกจองไปแล้วในออเดอร์นี้ ต่อสินค้า 1 ชิ้น (กันกรณีลูกค้าใส่สินค้าเดิมซ้ำหลายแถวในตะกร้า)
  const reservedQtyByProductId = {};

  // วนลูปตรวจสอบสินค้าทีละชิ้นที่ลูกค้าส่งมาในตะกร้า
  for (const item of items) {
    // ค้นหาสินค้าจริงในฐานข้อมูลด้วย productId
    const product = products.find((p) => p.id === item.productId);
    // ถ้าไม่พบสินค้า (เช่น ถูกลบไปแล้ว) ให้ตอบกลับ error ทันที
    if (!product) {
      return res.status(400).json({ error: `ไม่พบสินค้ารหัส ${item.productId}` });
    }
    // แปลงจำนวนที่สั่งซื้อเป็นตัวเลข ถ้าไม่มีค่าให้ default เป็น 1
    const qty = Number(item.qty) || 1;
    // สินค้าเป็นของมือสอง แต่ละรายการมีแค่ 1 คู่เสมอ ไม่สามารถขายเกินจำนวนที่มีจริงได้ (stock = 0 คือถูกขายไปแล้ว/มีคนอื่นจองไปก่อน)
    const alreadyReserved = reservedQtyByProductId[product.id] || 0;
    if (alreadyReserved + qty > product.stock) {
      return res.status(400).json({ error: `${product.name} คู่นี้ถูกสั่งซื้อไปแล้ว กรุณาเลือกคู่อื่น` });
    }
    reservedQtyByProductId[product.id] = alreadyReserved + qty;

    // ตั้งราคาเริ่มต้นเป็นราคาปกติของสินค้าไว้ก่อน
    let price = product.price;
    // ถ้าลูกค้าส่ง flashSaleId มาด้วย (กดเพิ่มลงตะกร้าจากโซน Flash Sale) ให้ตรวจสอบสิทธิ์ราคาลดจริง ๆ อีกครั้งฝั่งเซิร์ฟเวอร์
    // (ไม่เชื่อราคาที่ฝั่งลูกค้าส่งมาตรง ๆ เพื่อป้องกันการปลอมแปลงราคา)
    if (item.flashSaleId) {
      // ค้นหา Flash Sale ที่ id ตรงกัน และต้องเป็นของสินค้าชิ้นนี้จริง ๆ เท่านั้น (กันสวมรอยใช้ id ของสินค้าอื่น)
      const sale = flashSales.find((fs) => fs.id === item.flashSaleId && fs.productId === product.id);
      // ใช้ราคา Flash Sale ได้ก็ต่อเมื่อเจอรายการจริง และตอนนี้ยังอยู่ในช่วงเวลาลดราคา (isFlashSaleActive)
      if (sale && isFlashSaleActive(sale)) {
        price = sale.salePrice;
      }
      // ถ้าไม่เจอ หรือหมดเวลาลดราคาไปแล้ว ก็จะใช้ราคาปกติ (price ที่ตั้งไว้ก่อนหน้า) โดยไม่แจ้ง error เพื่อให้ลูกค้ายังสั่งซื้อต่อได้
    }

    // บวกราคาสินค้า (ปกติหรือราคา Flash Sale ที่ตรวจสอบแล้ว) x จำนวน เข้าไปในยอดรวม
    total += price * qty;
    // เก็บรายละเอียดสินค้าชิ้นนี้ (ใช้ชื่อจากฐานข้อมูลจริง และราคาที่ตรวจสอบสิทธิ์แล้ว) ไว้ใน orderItems
    orderItems.push({
      productId: product.id,
      name: product.name,
      price,
      size: item.size || null,
      qty,
    });
  }

  // ตัดสต็อกสินค้าที่ถูกสั่งซื้อออกจากฐานข้อมูลสินค้าจริง (กันไม่ให้ลูกค้าคนอื่นสั่งซื้อคู่เดียวกันซ้ำ)
  Object.keys(reservedQtyByProductId).forEach((productId) => {
    const product = products.find((p) => p.id === productId);
    product.stock -= reservedQtyByProductId[productId];
  });
  await db.writeProducts(products);

  // อ่านรายการคำสั่งซื้อทั้งหมดที่มีอยู่แล้ว เพื่อนำออเดอร์ใหม่ไปต่อท้าย
  const orders = await db.readOrders();
  // สร้าง object คำสั่งซื้อใหม่ พร้อม id, สถานะเริ่มต้น และเวลาที่สร้าง
  const newOrder = {
    id: genId('o'),
    customerName,
    phone,
    address,
    items: orderItems,
    total,
    // เก็บวิธีชำระเงินที่ลูกค้าเลือกไว้ด้วย ให้ default เป็น "เก็บเงินปลายทาง" (cod) ถ้าไม่ได้ระบุมา
    paymentMethod: paymentMethod || 'cod',
    status: 'รอดำเนินการ',
    // เก็บเงินปลายทางไม่ต้องตรวจสอบการโอนเงิน ส่วนโอนธนาคาร/พร้อมเพย์เริ่มต้นเป็น "รอตรวจสอบสลิป" จนกว่าแอดมินจะยืนยัน
    paymentStatus: (paymentMethod || 'cod') === 'cod' ? 'ไม่ต้องชำระล่วงหน้า' : 'รอตรวจสอบสลิป',
    // สลิปโอนเงินที่แนบมาตอนสั่งซื้อ (ถ้ามี) — ไม่มีก็แนบเพิ่มทีหลังได้ผ่านหน้า "ตรวจสอบคำสั่งซื้อ" หรือ "บัญชีของฉัน"
    slipUrl: slipUrl || '',
    createdAt: new Date().toISOString(),
  };
  // เพิ่มออเดอร์ใหม่เข้าไปท้าย array
  orders.push(newOrder);
  // บันทึกรายการคำสั่งซื้อทั้งหมด (รวมของใหม่) กลับลงไฟล์ orders.json
  await db.writeOrders(orders);
  // ตอบกลับสถานะ 201 (สร้างสำเร็จ) พร้อมข้อมูลออเดอร์ที่เพิ่งสร้าง ให้ฝั่งลูกค้าเอาไปแสดงเลขที่ออเดอร์
  res.status(201).json(newOrder);
});

// เมื่อมีการเรียก PUT ที่ /api/orders/:id/status (แอดมินอัปเดตสถานะออเดอร์ เช่น "จัดส่งแล้ว") — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.put('/api/orders/:id/status', requireAuth, async (req, res) => {
  // ดึงค่าสถานะใหม่จาก body
  const { status } = req.body;
  // อ่านรายการคำสั่งซื้อทั้งหมดจากไฟล์
  const orders = await db.readOrders();
  // หาตำแหน่งของออเดอร์ที่ id ตรงกับที่ส่งมาใน URL
  const idx = orders.findIndex((o) => o.id === req.params.id);
  // ถ้าไม่เจอออเดอร์ ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
  // อัปเดตสถานะของออเดอร์นั้น ถ้าไม่ได้ส่ง status มาให้คงค่าเดิมไว้
  orders[idx].status = status || orders[idx].status;
  // บันทึกรายการคำสั่งซื้อทั้งหมด (ที่อัปเดตแล้ว) กลับลงไฟล์
  await db.writeOrders(orders);
  // ตอบกลับข้อมูลออเดอร์ที่อัปเดตสถานะแล้ว
  res.json(orders[idx]);
});

// เมื่อมีการเรียก POST ที่ /api/orders/:id/slip (ลูกค้าแนบ/เปลี่ยนรูปสลิปโอนเงินของคำสั่งซื้อตัวเอง) — ไม่ต้องล็อกอิน แต่ต้องระบุเบอร์โทรให้ตรงกับออเดอร์นั้นเหมือนหน้า "ตรวจสอบคำสั่งซื้อ" กันคนอื่นมาแนบสลิปมั่วใส่ออเดอร์คนอื่น
app.post('/api/orders/:id/slip', async (req, res) => {
  const { phone, slipUrl } = req.body;
  if (!phone || !slipUrl) {
    return res.status(400).json({ error: 'กรุณาระบุเบอร์โทรและแนบรูปสลิป' });
  }
  const orders = await db.readOrders();
  const idx = orders.findIndex((o) => o.id === req.params.id && o.phone === phone);
  if (idx === -1) {
    return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ กรุณาตรวจสอบหมายเลขคำสั่งซื้อและเบอร์โทรอีกครั้ง' });
  }
  // บันทึกสลิปใหม่ และตั้งสถานะการชำระเงินกลับเป็น "รอตรวจสอบสลิป" เสมอ (เผื่อเป็นการแนบสลิปใหม่ทับของเดิมที่เคยถูกปฏิเสธหรือยังไม่ได้ตรวจ)
  orders[idx].slipUrl = slipUrl;
  orders[idx].paymentStatus = 'รอตรวจสอบสลิป';
  await db.writeOrders(orders);
  res.json(orders[idx]);
});

// เมื่อมีการเรียก PUT ที่ /api/orders/:id/payment-status (แอดมินตรวจสลิปแล้วยืนยัน/ปฏิเสธการชำระเงิน) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.put('/api/orders/:id/payment-status', requireAuth, async (req, res) => {
  const { paymentStatus } = req.body;
  if (!paymentStatus) {
    return res.status(400).json({ error: 'กรุณาระบุสถานะการชำระเงิน' });
  }
  const orders = await db.readOrders();
  const idx = orders.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
  orders[idx].paymentStatus = paymentStatus;
  await db.writeOrders(orders);
  res.json(orders[idx]);
});

// เมื่อมีการเรียก DELETE ที่ /api/orders/:id (ลบคำสั่งซื้อตามรหัส) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
// หมายเหตุ: แท็บ "สรุปยอดขาย" คำนวณยอดขายสดจากคำสั่งซื้อโดยตรง จึงไม่ต้องอัปเดตยอดขายแยกต่างหาก — ลบคำสั่งซื้อแล้วยอดขายของวันนั้นจะลดลงตามราคาที่หายไปทันที
app.delete('/api/orders/:id', requireAuth, async (req, res) => {
  // อ่านรายการคำสั่งซื้อทั้งหมดจากไฟล์
  const orders = await db.readOrders();
  // หาตำแหน่งของออเดอร์ที่ต้องการลบ
  const idx = orders.findIndex((o) => o.id === req.params.id);
  // ถ้าไม่เจอออเดอร์ ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
  // ลบออเดอร์ออกจาก array ด้วย splice (เก็บตัวที่ถูกลบไว้ในตัวแปร removed)
  const removed = orders.splice(idx, 1)[0];
  // บันทึกรายการคำสั่งซื้อที่เหลือ (หลังลบ) กลับลงไฟล์
  await db.writeOrders(orders);
  // คืนสต็อกสินค้าที่อยู่ในคำสั่งซื้อนี้กลับเป็น "พร้อมขาย" (สินค้ามือสองแต่ละคู่มีแค่ 1 ชิ้น การลบออเดอร์แปลว่าคู่นั้นยังไม่ถูกขายจริง)
  const products = await db.readProducts();
  let changed = false;
  removed.items.forEach((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (product) {
      product.stock += item.qty;
      changed = true;
    }
  });
  if (changed) await db.writeProducts(products);
  // ตอบกลับข้อมูลคำสั่งซื้อที่ถูกลบไป เพื่อยืนยันว่าลบรายการไหน
  res.json(removed);
});

// ---------- Employees API ----------
// กลุ่ม API ที่เกี่ยวกับ "พนักงาน" ทั้งหมด (ดู/ค้นหา/เพิ่ม/แก้/ลบ)
// ใช้รหัสพนักงาน (id) ที่แอดมินกรอกเองเป็นตัวระบุตัวตน (ไม่ได้สุ่มสร้างให้เหมือนสินค้า/ออเดอร์)

// เมื่อมีการเรียก GET ที่ /api/employees (ขอรายการพนักงาน รองรับค้นหาด้วย query string ?q=) — ข้อมูลพนักงานเป็นข้อมูลภายใน จึงต้องล็อกอินก่อน
app.get('/api/employees', requireAuth, async (req, res) => {
  // อ่านข้อมูลพนักงานทั้งหมดจากไฟล์
  const employees = await db.readEmployees();
  // ดึงคำค้นหาจาก query string เช่น /api/employees?q=สมชาย แล้วแปลงเป็นตัวพิมพ์เล็กเพื่อเทียบแบบไม่สนตัวพิมพ์ใหญ่เล็ก
  const q = (req.query.q || '').trim().toLowerCase();
  // ถ้าไม่มีคำค้นหา ให้ส่งพนักงานทั้งหมดกลับไปเลย
  if (!q) return res.json(employees);
  // ถ้ามีคำค้นหา ให้กรองเฉพาะพนักงานที่ "รหัสพนักงาน" หรือ "ชื่อ-สกุล" มีคำค้นหานี้อยู่
  const filtered = employees.filter(
    (e) => e.id.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
  );
  // ส่งผลลัพธ์ที่กรองแล้วกลับไป
  res.json(filtered);
});

// เมื่อมีการเรียก POST ที่ /api/employees (เพิ่มพนักงานใหม่) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.post('/api/employees', requireAuth, async (req, res) => {
  // ดึงข้อมูลรหัสพนักงาน, ชื่อ-สกุล, เบอร์โทร จาก body ที่ส่งมา
  const { id, name, phone, address } = req.body;
  // ตรวจสอบข้อมูลขั้นต่ำ: ต้องมีรหัสพนักงานและชื่อ ถ้าไม่มีให้ตอบกลับ error 400
  if (!id || !name) {
    return res.status(400).json({ error: 'กรุณาระบุรหัสพนักงานและชื่อ-สกุล' });
  }
  // อ่านรายการพนักงานทั้งหมดที่มีอยู่แล้ว
  const employees = await db.readEmployees();
  // ตรวจสอบว่ารหัสพนักงานนี้มีอยู่แล้วหรือไม่ (ห้ามซ้ำ เพราะใช้เป็นตัวระบุตัวตนหลัก)
  if (employees.some((e) => e.id === id)) {
    return res.status(400).json({ error: `รหัสพนักงาน ${id} มีอยู่แล้วในระบบ` });
  }
  // สร้าง object พนักงานใหม่
  const newEmployee = { id, name, phone: phone || '', address: address || '' };
  // เพิ่มพนักงานใหม่เข้าไปท้าย array
  employees.push(newEmployee);
  // บันทึกรายการพนักงานทั้งหมด (รวมของใหม่) กลับลงไฟล์
  await db.writeEmployees(employees);
  // ตอบกลับสถานะ 201 (สร้างสำเร็จ) พร้อมข้อมูลพนักงานที่เพิ่งสร้าง
  res.status(201).json(newEmployee);
});

// เมื่อมีการเรียก PUT ที่ /api/employees/:id (แก้ไขข้อมูลพนักงานตามรหัส) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.put('/api/employees/:id', requireAuth, async (req, res) => {
  // อ่านรายการพนักงานทั้งหมดจากไฟล์
  const employees = await db.readEmployees();
  // หาตำแหน่งของพนักงานที่รหัสตรงกับที่ส่งมาใน URL
  const idx = employees.findIndex((e) => e.id === req.params.id);
  // ถ้าไม่เจอพนักงาน ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบพนักงาน' });
  // ดึงข้อมูลที่ส่งมาจาก body สำหรับใช้แก้ไข (แก้ได้เฉพาะชื่อ/เบอร์โทร/ที่อยู่ ไม่แก้รหัสพนักงานเพื่อกันข้อมูลสับสน)
  const { name, phone, address } = req.body;
  const existing = employees[idx];
  // อัปเดตข้อมูล โดยถ้าไม่ได้ส่งค่าฟิลด์ไหนมา (undefined/null) ให้คงค่าเดิมไว้
  employees[idx] = {
    ...existing,
    name: name ?? existing.name,
    phone: phone ?? existing.phone,
    address: address ?? existing.address,
  };
  // บันทึกรายการพนักงานทั้งหมด (ที่แก้ไขแล้ว) กลับลงไฟล์
  await db.writeEmployees(employees);
  // ตอบกลับข้อมูลพนักงานที่แก้ไขเสร็จแล้ว
  res.json(employees[idx]);
});

// เมื่อมีการเรียก DELETE ที่ /api/employees/:id (ลบพนักงานตามรหัส) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.delete('/api/employees/:id', requireAuth, async (req, res) => {
  // อ่านรายการพนักงานทั้งหมดจากไฟล์
  const employees = await db.readEmployees();
  // หาตำแหน่งของพนักงานที่ต้องการลบ
  const idx = employees.findIndex((e) => e.id === req.params.id);
  // ถ้าไม่เจอพนักงาน ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบพนักงาน' });
  // ลบพนักงานออกจาก array ด้วย splice (เก็บตัวที่ถูกลบไว้ในตัวแปร removed)
  const removed = employees.splice(idx, 1);
  // บันทึกรายการพนักงานที่เหลือ (หลังลบ) กลับลงไฟล์
  await db.writeEmployees(employees);
  // ตอบกลับข้อมูลพนักงานที่ถูกลบไป เพื่อยืนยันว่าลบคนไหน
  res.json(removed[0]);
});

// ---------- Customers API (ฐานข้อมูลลูกค้า) ----------
// กลุ่ม API ที่เกี่ยวกับ "ลูกค้า" ทั้งหมด (ดู/ค้นหา/เพิ่ม/แก้/ลบ) พร้อมดึงประวัติการสั่งซื้อมาแสดงด้วย

// ฟังก์ชันช่วยแนบ "ประวัติการสั่งซื้อ" ให้กับข้อมูลลูกค้า 1 คน โดยจับคู่ด้วยเบอร์โทรศัพท์กับรายการคำสั่งซื้อทั้งหมด
// (ไม่ได้เก็บประวัติซ้ำซ้อนไว้ในไฟล์ลูกค้าเอง แต่คำนวณสดจากไฟล์ orders.json ทุกครั้งที่ขอข้อมูล เพื่อให้ข้อมูลอัปเดตล่าสุดเสมอ)
function enrichCustomerWithOrders(customer, orders) {
  // กรองเฉพาะคำสั่งซื้อที่เบอร์โทรตรงกับลูกค้าคนนี้ แล้วเรียงจากใหม่ไปเก่า
  const customerOrders = orders
    .filter((o) => o.phone === customer.phone)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  // ส่งคืนข้อมูลลูกค้าเดิม (ตัดฟิลด์ password ออกก่อนเสมอ) รวมกับรายการคำสั่งซื้อที่เจอ (ใช้ดูว่าลูกค้าคนนี้เคยสั่งรองเท้ารุ่นไหนไปบ้าง)
  return { ...sanitizeCustomer(customer), orders: customerOrders };
}

// เมื่อมีการเรียก GET ที่ /api/customers (ขอรายการลูกค้าทั้งหมด รองรับค้นหาด้วย query string ?q=)
app.get('/api/customers', requireAuth, async (req, res) => {
  // อ่านข้อมูลลูกค้าทั้งหมดจากไฟล์
  const customers = await db.readCustomers();
  // อ่านรายการคำสั่งซื้อทั้งหมด เพื่อใช้จับคู่หาประวัติการสั่งซื้อของแต่ละคน
  const orders = await db.readOrders();
  // ดึงคำค้นหาจาก query string เช่น /api/customers?q=สมชาย แล้วแปลงเป็นตัวพิมพ์เล็กเพื่อเทียบแบบไม่สนตัวพิมพ์ใหญ่เล็ก
  const q = (req.query.q || '').trim().toLowerCase();
  // กรองลูกค้าตามคำค้นหา (ถ้ามี) จากชื่อหรือเบอร์โทร ถ้าไม่มีคำค้นหาให้เอาทั้งหมด
  const filtered = q
    ? customers.filter(
        (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
      )
    : customers;
  // แนบประวัติการสั่งซื้อให้ลูกค้าแต่ละคนก่อนส่งกลับไป
  res.json(filtered.map((c) => enrichCustomerWithOrders(c, orders)));
});

// เมื่อมีการเรียก POST ที่ /api/customers (เพิ่มลูกค้าใหม่)
app.post('/api/customers', requireAuth, async (req, res) => {
  // ดึงข้อมูลชื่อ-สกุล, เบอร์โทร, ที่อยู่ จาก body ที่ส่งมา
  const { name, phone, address } = req.body;
  // ตรวจสอบข้อมูลขั้นต่ำ: ต้องมีชื่อและเบอร์โทร ถ้าไม่มีให้ตอบกลับ error 400
  if (!name || !phone) {
    return res.status(400).json({ error: 'กรุณาระบุชื่อ-สกุลและเบอร์โทร' });
  }
  // อ่านรายการลูกค้าทั้งหมดที่มีอยู่แล้ว
  const customers = await db.readCustomers();
  // สร้าง object ลูกค้าใหม่ พร้อม id อัตโนมัติ
  const newCustomer = { id: genId('cus-'), name, phone, address: address || '' };
  // เพิ่มลูกค้าใหม่เข้าไปท้าย array
  customers.push(newCustomer);
  // บันทึกรายการลูกค้าทั้งหมด (รวมของใหม่) กลับลงไฟล์
  await db.writeCustomers(customers);
  // ตอบกลับสถานะ 201 (สร้างสำเร็จ) พร้อมข้อมูลลูกค้าที่เพิ่งสร้าง (แนบประวัติการสั่งซื้อไปด้วย แม้จะยังว่างเปล่าก็ตาม)
  res.status(201).json(enrichCustomerWithOrders(newCustomer, await db.readOrders()));
});

// เมื่อมีการเรียก PUT ที่ /api/customers/:id (แก้ไขข้อมูลลูกค้าตามรหัส)
app.put('/api/customers/:id', requireAuth, async (req, res) => {
  // อ่านรายการลูกค้าทั้งหมดจากไฟล์
  const customers = await db.readCustomers();
  // หาตำแหน่งของลูกค้าที่ id ตรงกับที่ส่งมาใน URL
  const idx = customers.findIndex((c) => c.id === req.params.id);
  // ถ้าไม่เจอลูกค้า ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบลูกค้า' });
  // ดึงข้อมูลที่ส่งมาจาก body สำหรับใช้แก้ไข
  const { name, phone, address } = req.body;
  const existing = customers[idx];
  // อัปเดตข้อมูล โดยถ้าไม่ได้ส่งค่าฟิลด์ไหนมา (undefined/null) ให้คงค่าเดิมไว้
  customers[idx] = {
    ...existing,
    name: name ?? existing.name,
    phone: phone ?? existing.phone,
    address: address ?? existing.address,
  };
  // บันทึกรายการลูกค้าทั้งหมด (ที่แก้ไขแล้ว) กลับลงไฟล์
  await db.writeCustomers(customers);
  // ตอบกลับข้อมูลลูกค้าที่แก้ไขเสร็จแล้ว (แนบประวัติการสั่งซื้อล่าสุดไปด้วย)
  res.json(enrichCustomerWithOrders(customers[idx], await db.readOrders()));
});

// เมื่อมีการเรียก DELETE ที่ /api/customers/:id (ลบลูกค้าตามรหัส)
app.delete('/api/customers/:id', requireAuth, async (req, res) => {
  // อ่านรายการลูกค้าทั้งหมดจากไฟล์
  const customers = await db.readCustomers();
  // หาตำแหน่งของลูกค้าที่ต้องการลบ
  const idx = customers.findIndex((c) => c.id === req.params.id);
  // ถ้าไม่เจอลูกค้า ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบลูกค้า' });
  // ลบลูกค้าออกจาก array ด้วย splice (เก็บตัวที่ถูกลบไว้ในตัวแปร removed) — หมายเหตุ: ไม่ได้ลบคำสั่งซื้อเก่าของลูกค้าคนนี้ไปด้วย เพราะประวัติคำสั่งซื้อยังต้องเก็บไว้เป็นหลักฐาน
  const removed = customers.splice(idx, 1);
  // บันทึกรายการลูกค้าที่เหลือ (หลังลบ) กลับลงไฟล์
  await db.writeCustomers(customers);
  // ตอบกลับข้อมูลลูกค้าที่ถูกลบไป เพื่อยืนยันว่าลบคนไหน
  res.json(removed[0]);
});

// ---------- Flash Sale API ----------
// กลุ่ม API สำหรับตั้งค่า Flash Sale ที่หลังบ้าน แล้วให้ไปแสดงผลที่หน้าร้านค้าออนไลน์

// ฟังก์ชันช่วยแปลง Flash Sale ให้มีข้อมูลสินค้า (ชื่อ, รูป, ราคาปกติ ฯลฯ) แนบมาด้วย เพื่อให้ฝั่งหน้าเว็บใช้แสดงผลได้เลยโดยไม่ต้องไปดึงสินค้าเพิ่มเอง
function enrichFlashSale(sale, products) {
  // ค้นหาข้อมูลสินค้าที่ Flash Sale รายการนี้ผูกไว้
  const product = products.find((p) => p.id === sale.productId);
  // ส่งคืนข้อมูล Flash Sale เดิม รวมกับข้อมูลสินค้าที่เกี่ยวข้อง และสถานะว่ากำลังลดราคาอยู่ตอนนี้หรือไม่ (isActive)
  return {
    ...sale,
    productName: product?.name || '(ไม่พบสินค้า)',
    productBrand: product?.brand || '',
    productImage: product?.image || '',
    productPrice: product?.price || 0,
    productStock: product?.stock ?? 0,
    productSizes: product?.sizes || [],
    isActive: isFlashSaleActive(sale),
  };
}

// เมื่อมีการเรียก GET ที่ /api/flash-sales (ขอรายการ Flash Sale ทั้งหมด สำหรับหน้า admin จัดการ) — รวมรายการที่หมดเวลาไปแล้วด้วย จึงเปิดเฉพาะแอดมิน (หน้าร้านค้าใช้ /active แทน ซึ่งเปิดสาธารณะ)
app.get('/api/flash-sales', requireAuth, async (req, res) => {
  // อ่านรายการ Flash Sale ทั้งหมดจากไฟล์
  const flashSales = await db.readFlashSales();
  // อ่านรายการสินค้าทั้งหมด เพื่อใช้แนบข้อมูลสินค้าประกอบแต่ละ Flash Sale
  const products = await db.readProducts();
  // แนบข้อมูลสินค้า+สถานะ active ให้ทุกรายการ แล้วเรียงจากใหม่ไปเก่า
  const enriched = flashSales
    .map((sale) => enrichFlashSale(sale, products))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(enriched);
});

// เมื่อมีการเรียก GET ที่ /api/flash-sales/active (ขอเฉพาะ Flash Sale ที่ "กำลังลดราคาอยู่ตอนนี้" สำหรับโชว์หน้าร้านค้า)
app.get('/api/flash-sales/active', async (req, res) => {
  // อ่านรายการ Flash Sale ทั้งหมดจากไฟล์
  const flashSales = await db.readFlashSales();
  // อ่านรายการสินค้าทั้งหมด เพื่อใช้แนบข้อมูลสินค้าประกอบแต่ละ Flash Sale
  const products = await db.readProducts();
  // กรองเฉพาะรายการที่กำลัง active อยู่จริง ๆ ตอนนี้ แล้วแนบข้อมูลสินค้าให้แต่ละรายการ
  const active = flashSales
    .filter((sale) => isFlashSaleActive(sale))
    .map((sale) => enrichFlashSale(sale, products));
  res.json(active);
});

// เมื่อมีการเรียก POST ที่ /api/flash-sales (สร้าง Flash Sale ใหม่จากหลังบ้าน) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.post('/api/flash-sales', requireAuth, async (req, res) => {
  // ดึงข้อมูลที่ส่งมา: สินค้าที่จะลดราคา, ราคาที่ลดแล้ว, เวลาเริ่ม, เวลาสิ้นสุด
  const { productId, salePrice, startAt, endAt } = req.body;
  // ตรวจสอบว่าข้อมูลครบถ้วนหรือไม่
  if (!productId || salePrice === undefined || !startAt || !endAt) {
    return res.status(400).json({ error: 'กรุณาระบุสินค้า ราคาลด และช่วงเวลาให้ครบถ้วน' });
  }
  // ตรวจสอบว่าเวลาเริ่มต้นต้องมาก่อนเวลาสิ้นสุด
  if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
    return res.status(400).json({ error: 'เวลาเริ่มต้องอยู่ก่อนเวลาสิ้นสุด' });
  }
  // ตรวจสอบว่าสินค้าที่ระบุมามีอยู่จริงในระบบหรือไม่
  const products = await db.readProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) return res.status(400).json({ error: 'ไม่พบสินค้านี้ในระบบ' });
  // ตรวจสอบว่าราคาลดต้องถูกกว่าราคาปกติจริง ๆ (ไม่งั้นจะไม่ใช่ "ลดราคา")
  if (Number(salePrice) <= 0 || Number(salePrice) >= product.price) {
    return res.status(400).json({ error: 'ราคา Flash Sale ต้องน้อยกว่าราคาปกติของสินค้า' });
  }

  // อ่านรายการ Flash Sale ทั้งหมดที่มีอยู่แล้ว เพื่อนำรายการใหม่ไปต่อท้าย
  const flashSales = await db.readFlashSales();
  // สร้าง object Flash Sale ใหม่
  const newSale = {
    id: genId('fs-'),
    productId,
    salePrice: Number(salePrice),
    startAt,
    endAt,
    createdAt: new Date().toISOString(),
  };
  // เพิ่ม Flash Sale ใหม่เข้าไปท้าย array
  flashSales.push(newSale);
  // บันทึกรายการ Flash Sale ทั้งหมด (รวมของใหม่) กลับลงไฟล์
  await db.writeFlashSales(flashSales);
  // ตอบกลับสถานะ 201 (สร้างสำเร็จ) พร้อมข้อมูล Flash Sale ที่เพิ่งสร้าง (แนบข้อมูลสินค้าไปด้วย)
  res.status(201).json(enrichFlashSale(newSale, products));
});

// เมื่อมีการเรียก PUT ที่ /api/flash-sales/:id (แก้ไข Flash Sale ตามรหัส) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.put('/api/flash-sales/:id', requireAuth, async (req, res) => {
  // อ่านรายการ Flash Sale ทั้งหมดจากไฟล์
  const flashSales = await db.readFlashSales();
  // หาตำแหน่งของ Flash Sale ที่ id ตรงกับที่ส่งมาใน URL
  const idx = flashSales.findIndex((s) => s.id === req.params.id);
  // ถ้าไม่เจอ ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบ Flash Sale นี้' });

  // ดึงข้อมูลที่ส่งมาจาก body สำหรับใช้แก้ไข
  const { productId, salePrice, startAt, endAt } = req.body;
  const existing = flashSales[idx];
  // รวมค่าที่จะใช้จริง (ค่าใหม่ถ้ามีส่งมา ไม่งั้นใช้ค่าเดิม) ไว้ตรวจสอบก่อนบันทึก
  const merged = {
    ...existing,
    productId: productId ?? existing.productId,
    salePrice: salePrice !== undefined ? Number(salePrice) : existing.salePrice,
    startAt: startAt ?? existing.startAt,
    endAt: endAt ?? existing.endAt,
  };
  // ตรวจสอบว่าเวลาเริ่มต้องมาก่อนเวลาสิ้นสุดเสมอ แม้เป็นการแก้ไข
  if (new Date(merged.startAt).getTime() >= new Date(merged.endAt).getTime()) {
    return res.status(400).json({ error: 'เวลาเริ่มต้องอยู่ก่อนเวลาสิ้นสุด' });
  }
  // ตรวจสอบว่าสินค้าที่ระบุมามีอยู่จริง และราคาลดยังคงถูกกว่าราคาปกติ
  const products = await db.readProducts();
  const product = products.find((p) => p.id === merged.productId);
  if (!product) return res.status(400).json({ error: 'ไม่พบสินค้านี้ในระบบ' });
  if (merged.salePrice <= 0 || merged.salePrice >= product.price) {
    return res.status(400).json({ error: 'ราคา Flash Sale ต้องน้อยกว่าราคาปกติของสินค้า' });
  }

  // บันทึกข้อมูลที่ผ่านการตรวจสอบแล้วกลับเข้าไปในตำแหน่งเดิม
  flashSales[idx] = merged;
  // บันทึกรายการ Flash Sale ทั้งหมด (ที่แก้ไขแล้ว) กลับลงไฟล์
  await db.writeFlashSales(flashSales);
  // ตอบกลับข้อมูล Flash Sale ที่แก้ไขเสร็จแล้ว (แนบข้อมูลสินค้าไปด้วย)
  res.json(enrichFlashSale(merged, products));
});

// เมื่อมีการเรียก DELETE ที่ /api/flash-sales/:id (ยกเลิก/ลบ Flash Sale ตามรหัส) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.delete('/api/flash-sales/:id', requireAuth, async (req, res) => {
  // อ่านรายการ Flash Sale ทั้งหมดจากไฟล์
  const flashSales = await db.readFlashSales();
  // หาตำแหน่งของ Flash Sale ที่ต้องการลบ
  const idx = flashSales.findIndex((s) => s.id === req.params.id);
  // ถ้าไม่เจอ ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบ Flash Sale นี้' });
  // ลบออกจาก array ด้วย splice (เก็บตัวที่ถูกลบไว้ในตัวแปร removed)
  const removed = flashSales.splice(idx, 1);
  // บันทึกรายการ Flash Sale ที่เหลือ (หลังลบ) กลับลงไฟล์
  await db.writeFlashSales(flashSales);
  // ตอบกลับข้อมูล Flash Sale ที่ถูกลบไป เพื่อยืนยันว่าลบตัวไหน
  res.json(removed[0]);
});

// ---------- Expenses API (รายจ่าย) ----------
// กลุ่ม API สำหรับบันทึกรายจ่ายของร้าน (เช่น ค่าซื้อรองเท้ามือสอง, ค่าขนส่ง, ค่าเช่า) ใช้คำนวณกำไร/ขาดทุนในหน้ารายงาน

// เมื่อมีการเรียก GET ที่ /api/expenses (ขอรายการรายจ่ายทั้งหมด รองรับกรองตามช่วงวันที่ด้วย query string ?from=YYYY-MM-DD&to=YYYY-MM-DD) — ข้อมูลรายจ่ายเป็นความลับทางธุรกิจ จึงต้องล็อกอินก่อน
app.get('/api/expenses', requireAuth, async (req, res) => {
  // อ่านรายการรายจ่ายทั้งหมดจากฐานข้อมูล
  let expenses = await db.readExpenses();
  // ถ้ามีการระบุ query string "from"/"to" มา ให้กรองเฉพาะรายจ่ายที่อยู่ในช่วงวันที่นั้น
  if (req.query.from) expenses = expenses.filter((e) => e.date >= req.query.from);
  if (req.query.to) expenses = expenses.filter((e) => e.date <= req.query.to);
  // เรียงลำดับรายจ่ายจากวันที่ใหม่ไปเก่า แล้วส่งกลับไป
  res.json(expenses.sort((a, b) => new Date(b.date) - new Date(a.date)));
});

// เมื่อมีการเรียก POST ที่ /api/expenses (เพิ่มรายจ่ายใหม่) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.post('/api/expenses', requireAuth, async (req, res) => {
  // ดึงข้อมูลวันที่, รายการ, จำนวนเงิน จาก body ที่ส่งมา
  const { date, description, amount } = req.body;
  // ตรวจสอบข้อมูลขั้นต่ำ: ต้องมีครบทั้ง 3 ฟิลด์ ถ้าไม่มีให้ตอบกลับ error 400
  if (!date || !description || amount === undefined) {
    return res.status(400).json({ error: 'กรุณาระบุวันที่, รายการ, และจำนวนเงินให้ครบถ้วน' });
  }
  // อ่านรายการรายจ่ายทั้งหมดที่มีอยู่แล้ว เพื่อนำรายการใหม่ไปต่อท้าย
  const expenses = await db.readExpenses();
  // สร้าง object รายจ่ายใหม่ พร้อม id อัตโนมัติ
  const newExpense = {
    id: genId('exp-'),
    date,
    description,
    amount: Number(amount),
    createdAt: new Date().toISOString(),
  };
  // เพิ่มรายจ่ายใหม่เข้าไปท้าย array
  expenses.push(newExpense);
  // บันทึกรายการรายจ่ายทั้งหมด (รวมของใหม่) กลับลงฐานข้อมูล
  await db.writeExpenses(expenses);
  // ตอบกลับสถานะ 201 (สร้างสำเร็จ) พร้อมข้อมูลรายจ่ายที่เพิ่งสร้าง
  res.status(201).json(newExpense);
});

// เมื่อมีการเรียก DELETE ที่ /api/expenses/:id (ลบรายจ่ายตามรหัส) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.delete('/api/expenses/:id', requireAuth, async (req, res) => {
  // อ่านรายการรายจ่ายทั้งหมดจากฐานข้อมูล
  const expenses = await db.readExpenses();
  // หาตำแหน่งของรายจ่ายที่ต้องการลบ
  const idx = expenses.findIndex((e) => e.id === req.params.id);
  // ถ้าไม่เจอ ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบรายการรายจ่ายนี้' });
  // ลบออกจาก array ด้วย splice (เก็บตัวที่ถูกลบไว้ในตัวแปร removed)
  const removed = expenses.splice(idx, 1);
  // บันทึกรายการรายจ่ายที่เหลือ (หลังลบ) กลับลงฐานข้อมูล
  await db.writeExpenses(expenses);
  // ตอบกลับข้อมูลรายจ่ายที่ถูกลบไป เพื่อยืนยันว่าลบรายการไหน
  res.json(removed[0]);
});

// ---------- Reports API (รายงานยอดขาย/กำไร-ขาดทุน/สินค้าขายดี) ----------

// เมื่อมีการเรียก GET ที่ /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD (ขอสรุปรายงานของช่วงวันที่ที่ระบุ) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.get('/api/reports/summary', requireAuth, async (req, res) => {
  // ต้องระบุทั้งวันที่เริ่มต้นและสิ้นสุด ถ้าขาดอย่างใดอย่างหนึ่งให้ตอบกลับ error
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: 'กรุณาระบุช่วงวันที่ (from, to)' });
  }

  // อ่านคำสั่งซื้อ, รายจ่าย, และสินค้าทั้งหมด มาคำนวณสรุปรายงาน
  const orders = await db.readOrders();
  const expenses = await db.readExpenses();
  const products = await db.readProducts();

  // กรองเฉพาะคำสั่งซื้อที่อยู่ในช่วงวันที่ที่ระบุ (เทียบแค่ส่วนวันที่ YYYY-MM-DD ของ createdAt)
  const rangeOrders = orders.filter((o) => {
    const orderDate = o.createdAt.slice(0, 10);
    return orderDate >= from && orderDate <= to;
  });
  // กรองเฉพาะรายจ่ายที่อยู่ในช่วงวันที่ที่ระบุ
  const rangeExpenses = expenses.filter((e) => e.date >= from && e.date <= to);

  // ยอดขายรวม = ผลรวม total ของทุกคำสั่งซื้อในช่วงที่เลือก
  const revenue = rangeOrders.reduce((sum, o) => sum + o.total, 0);
  // รายจ่ายรวม = ผลรวม amount ของทุกรายจ่ายในช่วงที่เลือก
  const totalExpenses = rangeExpenses.reduce((sum, e) => sum + e.amount, 0);
  // กำไร/ขาดทุน = ยอดขาย - รายจ่าย (ถ้าติดลบคือขาดทุน)
  const profit = revenue - totalExpenses;

  // รวบรวมสถิติสินค้าขายดี: นับจำนวนที่ขายได้ (qty) และยอดขายของสินค้าแต่ละชิ้น จากทุกรายการในทุกคำสั่งซื้อ
  const productStats = {};
  rangeOrders.forEach((o) => {
    o.items.forEach((item) => {
      if (!productStats[item.productId]) {
        productStats[item.productId] = { productId: item.productId, name: item.name, count: 0, revenue: 0 };
      }
      productStats[item.productId].count += item.qty;
      productStats[item.productId].revenue += item.price * item.qty;
    });
  });
  // แนบรหัสสินค้า+แบรนด์ให้แต่ละสถิติ โดยค้นจากฐานข้อมูลสินค้าจริง (เผื่อสินค้านั้นถูกลบไปแล้ว ให้ใช้ค่าว่างแทน)
  Object.values(productStats).forEach((stat) => {
    const product = products.find((p) => p.id === stat.productId);
    stat.code = product?.code || '';
    stat.brand = product?.brand || '';
  });

  // รวบรวมสถิติแบรนด์ขายดี โดยรวมยอดจากสถิติสินค้าด้านบนตามแบรนด์ (สินค้าที่ไม่มีแบรนด์ระบุไว้ จัดเป็นกลุ่ม "ไม่ระบุแบรนด์")
  const brandStats = {};
  Object.values(productStats).forEach((stat) => {
    const brand = stat.brand || 'ไม่ระบุแบรนด์';
    if (!brandStats[brand]) brandStats[brand] = { brand, count: 0, revenue: 0 };
    brandStats[brand].count += stat.count;
    brandStats[brand].revenue += stat.revenue;
  });

  // เรียงสินค้า/แบรนด์ขายดีจากจำนวนคำสั่งซื้อมากไปน้อย (ตามที่ตกลงกันไว้ว่าจัดอันดับจากจำนวนคำสั่งซื้อ) แล้วตัดเอาแค่ 10 อันดับแรก
  const topProducts = Object.values(productStats)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const topBrands = Object.values(brandStats)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  res.json({
    revenue,
    orderCount: rangeOrders.length,
    expenses: totalExpenses,
    profit,
    topProducts,
    topBrands,
  });
});

// Middleware ดักจับข้อผิดพลาดทั้งหมดในแอป (ต้องมี 4 พารามิเตอร์ Express ถึงจะรู้ว่าเป็น error handler)
// ใช้ดักข้อผิดพลาดจาก multer เช่น ไฟล์ใหญ่เกินไป หรือไฟล์ไม่ใช่รูปภาพ แล้วตอบกลับเป็น JSON แทนหน้า error ปกติ
app.use((err, req, res, next) => {
  // ถ้ามีข้อผิดพลาดเกิดขึ้น (err ไม่ใช่ null/undefined) ให้ตอบกลับสถานะ 400 พร้อมข้อความอธิบาย
  if (err) return res.status(400).json({ error: err.message });
  // ถ้าไม่มีข้อผิดพลาด ให้ส่งต่อไปยัง middleware ถัดไปตามปกติ
  next();
});

// ต้องสร้างตาราง/รัน migration ในฐานข้อมูลให้เสร็จก่อน ถึงจะเริ่มรับ request ได้ (db.init() เป็น async เพราะเชื่อมต่อฐานข้อมูลผ่านเครือข่ายได้ตอนใช้ Turso)
(async () => {
  await db.init();
  // สั่งให้เซิร์ฟเวอร์เริ่มทำงาน (เปิดรับ request) ที่พอร์ตที่กำหนดไว้
  app.listen(PORT, () => {
    // แสดงข้อความในคอนโซลว่าเซิร์ฟเวอร์รันสำเร็จแล้ว พร้อม URL
    console.log(`Sneaker Shop server running at http://localhost:${PORT}`);
    // แสดง URL ของหน้า admin ให้รู้ว่าเข้าได้ที่ไหน
    console.log(`Admin panel: http://localhost:${PORT}/admin`);
  });
})();
