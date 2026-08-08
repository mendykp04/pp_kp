// เรียกใช้ไลบรารี Express มาสร้างเว็บเซิร์ฟเวอร์และ API
const express = require('express');
// เรียกใช้ไลบรารี cors เพื่ออนุญาตให้เว็บอื่น (โดเมน/พอร์ตอื่น) เรียก API ของเราได้
const cors = require('cors');
// เรียกใช้โมดูล fs (File System) ของ Node.js เพื่ออ่าน/เขียนไฟล์ JSON
const fs = require('fs');
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

// ตั้งค่า multer ว่าจะเก็บไฟล์ที่อัปโหลดไว้ที่ไหน และตั้งชื่อไฟล์อย่างไร
const uploadStorage = multer.diskStorage({
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
app.post('/api/upload', requireAuth, upload.single('image'), (req, res) => {
  // ถ้าไม่มีไฟล์แนบมาเลย (เช่น ผู้ใช้กด submit โดยไม่เลือกไฟล์) ให้ตอบกลับ error 400
  if (!req.file) return res.status(400).json({ error: 'กรุณาเลือกไฟล์รูปภาพ' });
  // ตอบกลับ path ของรูปที่บันทึกไว้ (เช่น /uploads/img-xxxxx.jpg) ให้ฝั่ง admin นำไปใช้เป็นค่า image ของสินค้า
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ---------- Products API ----------
// กลุ่ม API ที่เกี่ยวกับ "สินค้า" ทั้งหมด (ดู/เพิ่ม/แก้/ลบ)

// เมื่อมีการเรียก GET ที่ /api/products (ขอรายการสินค้าทั้งหมด)
app.get('/api/products', (req, res) => {
  // อ่านข้อมูลสินค้าทั้งหมดจากไฟล์ products.json
  const products = db.readProducts();
  // ส่งข้อมูลสินค้ากลับไปเป็น JSON ให้ผู้ที่เรียกมา
  res.json(products);
});

// เมื่อมีการเรียก GET ที่ /api/products/:id (ขอสินค้าชิ้นเดียวตามรหัส)
app.get('/api/products/:id', (req, res) => {
  // อ่านข้อมูลสินค้าทั้งหมดจากไฟล์
  const products = db.readProducts();
  // ค้นหาสินค้าที่มี id ตรงกับค่าที่ส่งมาใน URL (req.params.id)
  const product = products.find((p) => p.id === req.params.id);
  // ถ้าไม่เจอสินค้า ให้ตอบกลับสถานะ 404 (ไม่พบ) พร้อมข้อความแจ้งเตือน
  if (!product) return res.status(404).json({ error: 'ไม่พบสินค้า' });
  // ถ้าเจอ ส่งข้อมูลสินค้านั้นกลับไป
  res.json(product);
});

// เมื่อมีการเรียก POST ที่ /api/products (เพิ่มสินค้าใหม่) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น (requireAuth)
app.post('/api/products', requireAuth, (req, res) => {
  // ดึงข้อมูลฟิลด์ต่าง ๆ ออกจาก body ของ request ที่ส่งมา (ฝั่ง admin ส่งมาเป็น JSON)
  const { name, brand, code, price, sizes, image, description, condition, categoryId } = req.body;
  // ตรวจสอบข้อมูลขั้นต่ำ: ต้องมีชื่อสินค้าและราคา ถ้าไม่มีให้ตอบกลับ error 400 (ข้อมูลไม่ถูกต้อง)
  if (!name || price === undefined) {
    return res.status(400).json({ error: 'กรุณาระบุชื่อสินค้าและราคา' });
  }
  // อ่านรายการสินค้าปัจจุบันทั้งหมดจากไฟล์ เพื่อนำมาต่อท้ายด้วยสินค้าใหม่
  const products = db.readProducts();
  // สร้าง object สินค้าใหม่ โดยกำหนด id อัตโนมัติ และแปลงชนิดข้อมูลให้ถูกต้อง (ราคาเป็นตัวเลข)
  const newProduct = {
    id: genId('p'),
    name,
    brand: brand || '',
    // รหัสรองเท้า ใช้แยกแต่ละคู่ออกจากกัน แม้จะเป็นรุ่นเดียวกัน (สินค้าเป็นของมือสอง แต่ละคู่มีสภาพไม่เหมือนกัน)
    code: code || '',
    price: Number(price),
    // categoryId คือหมวดหมู่ราคาที่ผูกไว้กับสินค้าชิ้นนี้ (เช่น "ราคาถูก") ถ้าไม่ระบุมาให้เป็นค่าว่าง
    categoryId: categoryId || '',
    // สินค้าเป็นของมือสอง แต่ละรายการมีแค่ 1 คู่เสมอ (ไม่มีแนวคิด "จำนวนสต็อก" หลายชิ้นเหมือนสินค้าใหม่) — 1 = ยังไม่ถูกขาย, 0 = ขายไปแล้ว
    stock: 1,
    sizes: Array.isArray(sizes) ? sizes : [],
    image: image || '',
    description: description || '',
    // สภาพ/ตำหนิสินค้า แยกจากรายละเอียดสินค้าทั่วไป เพราะสินค้ามือสองแต่ละคู่มีสภาพไม่เหมือนกัน
    condition: condition || '',
  };
  // เพิ่มสินค้าใหม่เข้าไปท้าย array ของสินค้าทั้งหมด
  products.push(newProduct);
  // บันทึกรายการสินค้าทั้งหมด (รวมของใหม่) กลับลงไฟล์ products.json
  db.writeProducts(products);
  // ตอบกลับสถานะ 201 (สร้างสำเร็จ) พร้อมข้อมูลสินค้าที่เพิ่งสร้าง
  res.status(201).json(newProduct);
});

// เมื่อมีการเรียก PUT ที่ /api/products/:id (แก้ไขสินค้าตามรหัส) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.put('/api/products/:id', requireAuth, (req, res) => {
  // อ่านรายการสินค้าทั้งหมดจากไฟล์
  const products = db.readProducts();
  // หาตำแหน่ง (index) ของสินค้าที่ id ตรงกับที่ส่งมาใน URL
  const idx = products.findIndex((p) => p.id === req.params.id);
  // ถ้าไม่เจอสินค้าที่ตำแหน่งนั้น (idx เป็น -1) ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบสินค้า' });

  // ดึงข้อมูลที่ส่งมาจาก body สำหรับใช้แก้ไข
  const { name, brand, code, price, sizes, image, description, condition, categoryId } = req.body;
  // เก็บข้อมูลสินค้าเดิมไว้ในตัวแปร existing เพื่อใช้เป็นค่า default ถ้าไม่ได้ส่งฟิลด์นั้นมาแก้ไข
  const existing = products[idx];
  // สร้าง object สินค้าใหม่ โดยรวมข้อมูลเดิม (...existing) กับข้อมูลใหม่ที่ส่งมา
  // ใช้ ?? (nullish coalescing) คือถ้าค่าที่ส่งมาเป็น undefined/null จะใช้ค่าเดิมแทน
  // หมายเหตุ: ไม่รับค่า stock จากฟอร์มแก้ไขสินค้าอีกต่อไป (สินค้ามือสองมีแค่ 1 คู่เสมอ สถานะขายแล้ว/ยังไม่ขาย จะถูกอัปเดตจากขั้นตอนสั่งซื้อ/ขายหน้าร้านเท่านั้น) จึงคงค่าเดิมไว้เสมอ
  products[idx] = {
    ...existing,
    name: name ?? existing.name,
    brand: brand ?? existing.brand,
    code: code ?? existing.code,
    price: price !== undefined ? Number(price) : existing.price,
    // ถ้าไม่ได้ส่ง categoryId มา ให้คงหมวดหมู่เดิมไว้ (categoryId ที่ส่งมาเป็นสตริงว่าง "" ถือว่าตั้งใจล้างหมวดหมู่ จึงต้องเช็ค undefined เท่านั้น)
    categoryId: categoryId !== undefined ? categoryId : existing.categoryId,
    sizes: Array.isArray(sizes) ? sizes : existing.sizes,
    image: image ?? existing.image,
    description: description ?? existing.description,
    condition: condition ?? existing.condition,
  };
  // บันทึกรายการสินค้าทั้งหมด (ที่แก้ไขแล้ว) กลับลงไฟล์
  db.writeProducts(products);
  // ตอบกลับข้อมูลสินค้าที่แก้ไขเสร็จแล้ว
  res.json(products[idx]);
});

// เมื่อมีการเรียก DELETE ที่ /api/products/:id (ลบสินค้าตามรหัส) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.delete('/api/products/:id', requireAuth, (req, res) => {
  // อ่านรายการสินค้าทั้งหมดจากไฟล์
  const products = db.readProducts();
  // หาตำแหน่งของสินค้าที่ต้องการลบ
  const idx = products.findIndex((p) => p.id === req.params.id);
  // ถ้าไม่เจอสินค้า ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบสินค้า' });
  // ลบสินค้าออกจาก array ด้วย splice (เอาตัวที่ถูกลบเก็บไว้ในตัวแปร removed)
  const removed = products.splice(idx, 1);
  // บันทึกรายการสินค้าที่เหลือ (หลังลบ) กลับลงไฟล์
  db.writeProducts(products);
  // ตอบกลับข้อมูลสินค้าที่ถูกลบไป เพื่อยืนยันว่าลบตัวไหน
  res.json(removed[0]);
});

// ---------- Orders API ----------
// กลุ่ม API ที่เกี่ยวกับ "คำสั่งซื้อ" ทั้งหมด (ดู/สร้าง/อัปเดตสถานะ)

// เมื่อมีการเรียก GET ที่ /api/orders (ขอรายการคำสั่งซื้อทั้งหมด สำหรับหน้า admin) — มีข้อมูลลูกค้า (ชื่อ/เบอร์โทร/ที่อยู่) จึงต้องล็อกอินก่อน
app.get('/api/orders', requireAuth, (req, res) => {
  // อ่านรายการคำสั่งซื้อทั้งหมดจากไฟล์
  let orders = db.readOrders();
  // ถ้ามีการระบุ query string "date" มา (เช่น ตอนดูสรุปยอดขายของวันที่เลือกในแท็บ "สรุปยอดขาย")
  if (req.query.date) {
    // กรองเฉพาะคำสั่งซื้อที่ "วันที่" ของ createdAt (ตัดเอาแค่ส่วน YYYY-MM-DD) ตรงกับวันที่ที่ระบุ
    orders = orders.filter((o) => o.createdAt.slice(0, 10) === req.query.date);
  }
  // เรียงลำดับคำสั่งซื้อจากใหม่ไปเก่า (เทียบวันที่สร้าง createdAt) แล้วส่งกลับไป
  res.json(orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// เมื่อมีการเรียก POST ที่ /api/orders (ลูกค้ากดยืนยันสั่งซื้อจากตะกร้า)
app.post('/api/orders', (req, res) => {
  // ดึงข้อมูลลูกค้าและรายการสินค้าที่สั่งซื้อจาก body
  const { customerName, phone, address, items, paymentMethod } = req.body;
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
  const products = db.readProducts();
  // อ่านรายการ Flash Sale ทั้งหมด เพื่อใช้ตรวจสอบว่าสินค้าชิ้นไหนกำลังลดราคาอยู่จริงหรือไม่
  const flashSales = db.readFlashSales();
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
  db.writeProducts(products);

  // อ่านรายการคำสั่งซื้อทั้งหมดที่มีอยู่แล้ว เพื่อนำออเดอร์ใหม่ไปต่อท้าย
  const orders = db.readOrders();
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
    createdAt: new Date().toISOString(),
  };
  // เพิ่มออเดอร์ใหม่เข้าไปท้าย array
  orders.push(newOrder);
  // บันทึกรายการคำสั่งซื้อทั้งหมด (รวมของใหม่) กลับลงไฟล์ orders.json
  db.writeOrders(orders);
  // ตอบกลับสถานะ 201 (สร้างสำเร็จ) พร้อมข้อมูลออเดอร์ที่เพิ่งสร้าง ให้ฝั่งลูกค้าเอาไปแสดงเลขที่ออเดอร์
  res.status(201).json(newOrder);
});

// เมื่อมีการเรียก PUT ที่ /api/orders/:id/status (แอดมินอัปเดตสถานะออเดอร์ เช่น "จัดส่งแล้ว") — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.put('/api/orders/:id/status', requireAuth, (req, res) => {
  // ดึงค่าสถานะใหม่จาก body
  const { status } = req.body;
  // อ่านรายการคำสั่งซื้อทั้งหมดจากไฟล์
  const orders = db.readOrders();
  // หาตำแหน่งของออเดอร์ที่ id ตรงกับที่ส่งมาใน URL
  const idx = orders.findIndex((o) => o.id === req.params.id);
  // ถ้าไม่เจอออเดอร์ ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
  // อัปเดตสถานะของออเดอร์นั้น ถ้าไม่ได้ส่ง status มาให้คงค่าเดิมไว้
  orders[idx].status = status || orders[idx].status;
  // บันทึกรายการคำสั่งซื้อทั้งหมด (ที่อัปเดตแล้ว) กลับลงไฟล์
  db.writeOrders(orders);
  // ตอบกลับข้อมูลออเดอร์ที่อัปเดตสถานะแล้ว
  res.json(orders[idx]);
});

// เมื่อมีการเรียก DELETE ที่ /api/orders/:id (ลบคำสั่งซื้อตามรหัส) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
// หมายเหตุ: แท็บ "สรุปยอดขาย" คำนวณยอดขายสดจากคำสั่งซื้อโดยตรง จึงไม่ต้องอัปเดตยอดขายแยกต่างหาก — ลบคำสั่งซื้อแล้วยอดขายของวันนั้นจะลดลงตามราคาที่หายไปทันที
app.delete('/api/orders/:id', requireAuth, (req, res) => {
  // อ่านรายการคำสั่งซื้อทั้งหมดจากไฟล์
  const orders = db.readOrders();
  // หาตำแหน่งของออเดอร์ที่ต้องการลบ
  const idx = orders.findIndex((o) => o.id === req.params.id);
  // ถ้าไม่เจอออเดอร์ ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
  // ลบออเดอร์ออกจาก array ด้วย splice (เก็บตัวที่ถูกลบไว้ในตัวแปร removed)
  const removed = orders.splice(idx, 1)[0];
  // บันทึกรายการคำสั่งซื้อที่เหลือ (หลังลบ) กลับลงไฟล์
  db.writeOrders(orders);
  // คืนสต็อกสินค้าที่อยู่ในคำสั่งซื้อนี้กลับเป็น "พร้อมขาย" (สินค้ามือสองแต่ละคู่มีแค่ 1 ชิ้น การลบออเดอร์แปลว่าคู่นั้นยังไม่ถูกขายจริง)
  const products = db.readProducts();
  let changed = false;
  removed.items.forEach((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (product) {
      product.stock += item.qty;
      changed = true;
    }
  });
  if (changed) db.writeProducts(products);
  // ตอบกลับข้อมูลคำสั่งซื้อที่ถูกลบไป เพื่อยืนยันว่าลบรายการไหน
  res.json(removed);
});

// ---------- Employees API ----------
// กลุ่ม API ที่เกี่ยวกับ "พนักงาน" ทั้งหมด (ดู/ค้นหา/เพิ่ม/แก้/ลบ)
// ใช้รหัสพนักงาน (id) ที่แอดมินกรอกเองเป็นตัวระบุตัวตน (ไม่ได้สุ่มสร้างให้เหมือนสินค้า/ออเดอร์)

// เมื่อมีการเรียก GET ที่ /api/employees (ขอรายการพนักงาน รองรับค้นหาด้วย query string ?q=) — ข้อมูลพนักงานเป็นข้อมูลภายใน จึงต้องล็อกอินก่อน
app.get('/api/employees', requireAuth, (req, res) => {
  // อ่านข้อมูลพนักงานทั้งหมดจากไฟล์
  const employees = db.readEmployees();
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
app.post('/api/employees', requireAuth, (req, res) => {
  // ดึงข้อมูลรหัสพนักงาน, ชื่อ-สกุล, เบอร์โทร จาก body ที่ส่งมา
  const { id, name, phone } = req.body;
  // ตรวจสอบข้อมูลขั้นต่ำ: ต้องมีรหัสพนักงานและชื่อ ถ้าไม่มีให้ตอบกลับ error 400
  if (!id || !name) {
    return res.status(400).json({ error: 'กรุณาระบุรหัสพนักงานและชื่อ-สกุล' });
  }
  // อ่านรายการพนักงานทั้งหมดที่มีอยู่แล้ว
  const employees = db.readEmployees();
  // ตรวจสอบว่ารหัสพนักงานนี้มีอยู่แล้วหรือไม่ (ห้ามซ้ำ เพราะใช้เป็นตัวระบุตัวตนหลัก)
  if (employees.some((e) => e.id === id)) {
    return res.status(400).json({ error: `รหัสพนักงาน ${id} มีอยู่แล้วในระบบ` });
  }
  // สร้าง object พนักงานใหม่
  const newEmployee = { id, name, phone: phone || '' };
  // เพิ่มพนักงานใหม่เข้าไปท้าย array
  employees.push(newEmployee);
  // บันทึกรายการพนักงานทั้งหมด (รวมของใหม่) กลับลงไฟล์
  db.writeEmployees(employees);
  // ตอบกลับสถานะ 201 (สร้างสำเร็จ) พร้อมข้อมูลพนักงานที่เพิ่งสร้าง
  res.status(201).json(newEmployee);
});

// เมื่อมีการเรียก PUT ที่ /api/employees/:id (แก้ไขข้อมูลพนักงานตามรหัส) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.put('/api/employees/:id', requireAuth, (req, res) => {
  // อ่านรายการพนักงานทั้งหมดจากไฟล์
  const employees = db.readEmployees();
  // หาตำแหน่งของพนักงานที่รหัสตรงกับที่ส่งมาใน URL
  const idx = employees.findIndex((e) => e.id === req.params.id);
  // ถ้าไม่เจอพนักงาน ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบพนักงาน' });
  // ดึงข้อมูลที่ส่งมาจาก body สำหรับใช้แก้ไข (แก้ได้เฉพาะชื่อกับเบอร์โทร ไม่แก้รหัสพนักงานเพื่อกันข้อมูลสับสน)
  const { name, phone } = req.body;
  const existing = employees[idx];
  // อัปเดตข้อมูล โดยถ้าไม่ได้ส่งค่าฟิลด์ไหนมา (undefined/null) ให้คงค่าเดิมไว้
  employees[idx] = {
    ...existing,
    name: name ?? existing.name,
    phone: phone ?? existing.phone,
  };
  // บันทึกรายการพนักงานทั้งหมด (ที่แก้ไขแล้ว) กลับลงไฟล์
  db.writeEmployees(employees);
  // ตอบกลับข้อมูลพนักงานที่แก้ไขเสร็จแล้ว
  res.json(employees[idx]);
});

// เมื่อมีการเรียก DELETE ที่ /api/employees/:id (ลบพนักงานตามรหัส) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.delete('/api/employees/:id', requireAuth, (req, res) => {
  // อ่านรายการพนักงานทั้งหมดจากไฟล์
  const employees = db.readEmployees();
  // หาตำแหน่งของพนักงานที่ต้องการลบ
  const idx = employees.findIndex((e) => e.id === req.params.id);
  // ถ้าไม่เจอพนักงาน ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบพนักงาน' });
  // ลบพนักงานออกจาก array ด้วย splice (เก็บตัวที่ถูกลบไว้ในตัวแปร removed)
  const removed = employees.splice(idx, 1);
  // บันทึกรายการพนักงานที่เหลือ (หลังลบ) กลับลงไฟล์
  db.writeEmployees(employees);
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
  // ส่งคืนข้อมูลลูกค้าเดิม รวมกับรายการคำสั่งซื้อที่เจอ (ใช้ดูว่าลูกค้าคนนี้เคยสั่งรองเท้ารุ่นไหนไปบ้าง)
  return { ...customer, orders: customerOrders };
}

// เมื่อมีการเรียก GET ที่ /api/customers (ขอรายการลูกค้าทั้งหมด รองรับค้นหาด้วย query string ?q=)
app.get('/api/customers', requireAuth, (req, res) => {
  // อ่านข้อมูลลูกค้าทั้งหมดจากไฟล์
  const customers = db.readCustomers();
  // อ่านรายการคำสั่งซื้อทั้งหมด เพื่อใช้จับคู่หาประวัติการสั่งซื้อของแต่ละคน
  const orders = db.readOrders();
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
app.post('/api/customers', requireAuth, (req, res) => {
  // ดึงข้อมูลชื่อ-สกุล, เบอร์โทร, ที่อยู่ จาก body ที่ส่งมา
  const { name, phone, address } = req.body;
  // ตรวจสอบข้อมูลขั้นต่ำ: ต้องมีชื่อและเบอร์โทร ถ้าไม่มีให้ตอบกลับ error 400
  if (!name || !phone) {
    return res.status(400).json({ error: 'กรุณาระบุชื่อ-สกุลและเบอร์โทร' });
  }
  // อ่านรายการลูกค้าทั้งหมดที่มีอยู่แล้ว
  const customers = db.readCustomers();
  // สร้าง object ลูกค้าใหม่ พร้อม id อัตโนมัติ
  const newCustomer = { id: genId('cus-'), name, phone, address: address || '' };
  // เพิ่มลูกค้าใหม่เข้าไปท้าย array
  customers.push(newCustomer);
  // บันทึกรายการลูกค้าทั้งหมด (รวมของใหม่) กลับลงไฟล์
  db.writeCustomers(customers);
  // ตอบกลับสถานะ 201 (สร้างสำเร็จ) พร้อมข้อมูลลูกค้าที่เพิ่งสร้าง (แนบประวัติการสั่งซื้อไปด้วย แม้จะยังว่างเปล่าก็ตาม)
  res.status(201).json(enrichCustomerWithOrders(newCustomer, db.readOrders()));
});

// เมื่อมีการเรียก PUT ที่ /api/customers/:id (แก้ไขข้อมูลลูกค้าตามรหัส)
app.put('/api/customers/:id', requireAuth, (req, res) => {
  // อ่านรายการลูกค้าทั้งหมดจากไฟล์
  const customers = db.readCustomers();
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
  db.writeCustomers(customers);
  // ตอบกลับข้อมูลลูกค้าที่แก้ไขเสร็จแล้ว (แนบประวัติการสั่งซื้อล่าสุดไปด้วย)
  res.json(enrichCustomerWithOrders(customers[idx], db.readOrders()));
});

// เมื่อมีการเรียก DELETE ที่ /api/customers/:id (ลบลูกค้าตามรหัส)
app.delete('/api/customers/:id', requireAuth, (req, res) => {
  // อ่านรายการลูกค้าทั้งหมดจากไฟล์
  const customers = db.readCustomers();
  // หาตำแหน่งของลูกค้าที่ต้องการลบ
  const idx = customers.findIndex((c) => c.id === req.params.id);
  // ถ้าไม่เจอลูกค้า ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบลูกค้า' });
  // ลบลูกค้าออกจาก array ด้วย splice (เก็บตัวที่ถูกลบไว้ในตัวแปร removed) — หมายเหตุ: ไม่ได้ลบคำสั่งซื้อเก่าของลูกค้าคนนี้ไปด้วย เพราะประวัติคำสั่งซื้อยังต้องเก็บไว้เป็นหลักฐาน
  const removed = customers.splice(idx, 1);
  // บันทึกรายการลูกค้าที่เหลือ (หลังลบ) กลับลงไฟล์
  db.writeCustomers(customers);
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
app.get('/api/flash-sales', requireAuth, (req, res) => {
  // อ่านรายการ Flash Sale ทั้งหมดจากไฟล์
  const flashSales = db.readFlashSales();
  // อ่านรายการสินค้าทั้งหมด เพื่อใช้แนบข้อมูลสินค้าประกอบแต่ละ Flash Sale
  const products = db.readProducts();
  // แนบข้อมูลสินค้า+สถานะ active ให้ทุกรายการ แล้วเรียงจากใหม่ไปเก่า
  const enriched = flashSales
    .map((sale) => enrichFlashSale(sale, products))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(enriched);
});

// เมื่อมีการเรียก GET ที่ /api/flash-sales/active (ขอเฉพาะ Flash Sale ที่ "กำลังลดราคาอยู่ตอนนี้" สำหรับโชว์หน้าร้านค้า)
app.get('/api/flash-sales/active', (req, res) => {
  // อ่านรายการ Flash Sale ทั้งหมดจากไฟล์
  const flashSales = db.readFlashSales();
  // อ่านรายการสินค้าทั้งหมด เพื่อใช้แนบข้อมูลสินค้าประกอบแต่ละ Flash Sale
  const products = db.readProducts();
  // กรองเฉพาะรายการที่กำลัง active อยู่จริง ๆ ตอนนี้ แล้วแนบข้อมูลสินค้าให้แต่ละรายการ
  const active = flashSales
    .filter((sale) => isFlashSaleActive(sale))
    .map((sale) => enrichFlashSale(sale, products));
  res.json(active);
});

// เมื่อมีการเรียก POST ที่ /api/flash-sales (สร้าง Flash Sale ใหม่จากหลังบ้าน) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.post('/api/flash-sales', requireAuth, (req, res) => {
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
  const products = db.readProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) return res.status(400).json({ error: 'ไม่พบสินค้านี้ในระบบ' });
  // ตรวจสอบว่าราคาลดต้องถูกกว่าราคาปกติจริง ๆ (ไม่งั้นจะไม่ใช่ "ลดราคา")
  if (Number(salePrice) <= 0 || Number(salePrice) >= product.price) {
    return res.status(400).json({ error: 'ราคา Flash Sale ต้องน้อยกว่าราคาปกติของสินค้า' });
  }

  // อ่านรายการ Flash Sale ทั้งหมดที่มีอยู่แล้ว เพื่อนำรายการใหม่ไปต่อท้าย
  const flashSales = db.readFlashSales();
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
  db.writeFlashSales(flashSales);
  // ตอบกลับสถานะ 201 (สร้างสำเร็จ) พร้อมข้อมูล Flash Sale ที่เพิ่งสร้าง (แนบข้อมูลสินค้าไปด้วย)
  res.status(201).json(enrichFlashSale(newSale, products));
});

// เมื่อมีการเรียก PUT ที่ /api/flash-sales/:id (แก้ไข Flash Sale ตามรหัส) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.put('/api/flash-sales/:id', requireAuth, (req, res) => {
  // อ่านรายการ Flash Sale ทั้งหมดจากไฟล์
  const flashSales = db.readFlashSales();
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
  const products = db.readProducts();
  const product = products.find((p) => p.id === merged.productId);
  if (!product) return res.status(400).json({ error: 'ไม่พบสินค้านี้ในระบบ' });
  if (merged.salePrice <= 0 || merged.salePrice >= product.price) {
    return res.status(400).json({ error: 'ราคา Flash Sale ต้องน้อยกว่าราคาปกติของสินค้า' });
  }

  // บันทึกข้อมูลที่ผ่านการตรวจสอบแล้วกลับเข้าไปในตำแหน่งเดิม
  flashSales[idx] = merged;
  // บันทึกรายการ Flash Sale ทั้งหมด (ที่แก้ไขแล้ว) กลับลงไฟล์
  db.writeFlashSales(flashSales);
  // ตอบกลับข้อมูล Flash Sale ที่แก้ไขเสร็จแล้ว (แนบข้อมูลสินค้าไปด้วย)
  res.json(enrichFlashSale(merged, products));
});

// เมื่อมีการเรียก DELETE ที่ /api/flash-sales/:id (ยกเลิก/ลบ Flash Sale ตามรหัส) — เฉพาะแอดมินที่ล็อกอินแล้วเท่านั้น
app.delete('/api/flash-sales/:id', requireAuth, (req, res) => {
  // อ่านรายการ Flash Sale ทั้งหมดจากไฟล์
  const flashSales = db.readFlashSales();
  // หาตำแหน่งของ Flash Sale ที่ต้องการลบ
  const idx = flashSales.findIndex((s) => s.id === req.params.id);
  // ถ้าไม่เจอ ให้ตอบกลับ 404
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบ Flash Sale นี้' });
  // ลบออกจาก array ด้วย splice (เก็บตัวที่ถูกลบไว้ในตัวแปร removed)
  const removed = flashSales.splice(idx, 1);
  // บันทึกรายการ Flash Sale ที่เหลือ (หลังลบ) กลับลงไฟล์
  db.writeFlashSales(flashSales);
  // ตอบกลับข้อมูล Flash Sale ที่ถูกลบไป เพื่อยืนยันว่าลบตัวไหน
  res.json(removed[0]);
});

// Middleware ดักจับข้อผิดพลาดทั้งหมดในแอป (ต้องมี 4 พารามิเตอร์ Express ถึงจะรู้ว่าเป็น error handler)
// ใช้ดักข้อผิดพลาดจาก multer เช่น ไฟล์ใหญ่เกินไป หรือไฟล์ไม่ใช่รูปภาพ แล้วตอบกลับเป็น JSON แทนหน้า error ปกติ
app.use((err, req, res, next) => {
  // ถ้ามีข้อผิดพลาดเกิดขึ้น (err ไม่ใช่ null/undefined) ให้ตอบกลับสถานะ 400 พร้อมข้อความอธิบาย
  if (err) return res.status(400).json({ error: err.message });
  // ถ้าไม่มีข้อผิดพลาด ให้ส่งต่อไปยัง middleware ถัดไปตามปกติ
  next();
});

// สั่งให้เซิร์ฟเวอร์เริ่มทำงาน (เปิดรับ request) ที่พอร์ตที่กำหนดไว้
app.listen(PORT, () => {
  // แสดงข้อความในคอนโซลว่าเซิร์ฟเวอร์รันสำเร็จแล้ว พร้อม URL
  console.log(`Sneaker Shop server running at http://localhost:${PORT}`);
  // แสดง URL ของหน้า admin ให้รู้ว่าเข้าได้ที่ไหน
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});
