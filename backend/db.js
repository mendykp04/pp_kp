// โมดูลนี้เชื่อมต่อฐานข้อมูล SQLite (ไฟล์เดียว เก็บไว้ที่ backend/data/sneakershop.db)
// และรวมฟังก์ชันอ่าน/เขียนข้อมูลแต่ละตาราง ให้ server.js เรียกใช้แทนการอ่าน/เขียนไฟล์ .json แบบเดิม
const path = require('path');
const Database = require('better-sqlite3');

// path เต็มไปยังไฟล์ฐานข้อมูล
const DB_FILE = path.join(__dirname, 'data', 'sneakershop.db');
// เปิด (หรือสร้างใหม่ถ้ายังไม่มี) ไฟล์ฐานข้อมูล
const db = new Database(DB_FILE);
// เปิดโหมด WAL (Write-Ahead Logging) ให้อ่าน/เขียนพร้อมกันได้ลื่นขึ้นและปลอดภัยกว่าถ้าเซิร์ฟเวอร์ล่มกลางคัน
db.pragma('journal_mode = WAL');

// สร้างตารางทั้งหมด (ถ้ายังไม่มี) — โครงสร้างตรงกับข้อมูลที่เคยเก็บในไฟล์ .json เดิมทุกฟิลด์
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT,
    code TEXT,
    price REAL NOT NULL,
    categoryId TEXT,
    stock INTEGER NOT NULL DEFAULT 0,
    sizes TEXT,
    image TEXT,
    description TEXT,
    condition TEXT
  );
  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT
  );
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customerName TEXT,
    phone TEXT,
    address TEXT,
    items TEXT,
    total REAL,
    paymentMethod TEXT,
    status TEXT,
    createdAt TEXT
  );
  CREATE TABLE IF NOT EXISTS flashsales (
    id TEXT PRIMARY KEY,
    productId TEXT,
    salePrice REAL,
    startAt TEXT,
    endAt TEXT,
    createdAt TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
  CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
`);

// Migration: เติมคอลัมน์ code/condition ให้ตาราง products ที่มีอยู่แล้วจากก่อนหน้านี้ (CREATE TABLE IF NOT EXISTS ด้านบนใช้ไม่ได้กับตารางที่มีอยู่แล้ว)
// ครอบด้วย try/catch เพราะ ALTER TABLE ... ADD COLUMN จะ error ถ้าคอลัมน์นั้นมีอยู่แล้ว (รันซ้ำได้อย่างปลอดภัย)
const existingProductColumns = db.prepare('PRAGMA table_info(products)').all().map((c) => c.name);
if (!existingProductColumns.includes('code')) {
  db.exec('ALTER TABLE products ADD COLUMN code TEXT');
}
if (!existingProductColumns.includes('condition')) {
  db.exec('ALTER TABLE products ADD COLUMN condition TEXT');
}

// ฟิลด์ sizes/items เก็บเป็น JSON text ในคอลัมน์เดียว (โครงสร้างเดิมเป็น array ซ้อนอยู่แล้ว)
// ฟังก์ชันเหล่านี้แปลงกลับเป็น array/object ตอนอ่านออกมาใช้งาน
function rowToProduct(row) {
  return { ...row, sizes: row.sizes ? JSON.parse(row.sizes) : [] };
}
function rowToOrder(row) {
  return { ...row, items: row.items ? JSON.parse(row.items) : [] };
}

// ---------- Products ----------
function readProducts() {
  return db.prepare('SELECT * FROM products').all().map(rowToProduct);
}
const writeProducts = db.transaction((products) => {
  db.prepare('DELETE FROM products').run();
  const insert = db.prepare(`
    INSERT INTO products (id, name, brand, code, price, categoryId, stock, sizes, image, description, condition)
    VALUES (@id, @name, @brand, @code, @price, @categoryId, @stock, @sizes, @image, @description, @condition)
  `);
  products.forEach((p) =>
    insert.run({
      ...p,
      brand: p.brand ?? '',
      code: p.code ?? '',
      categoryId: p.categoryId ?? '',
      image: p.image ?? '',
      description: p.description ?? '',
      condition: p.condition ?? '',
      sizes: JSON.stringify(p.sizes || []),
    })
  );
});

// ---------- Employees ----------
function readEmployees() {
  return db.prepare('SELECT * FROM employees').all();
}
const writeEmployees = db.transaction((employees) => {
  db.prepare('DELETE FROM employees').run();
  const insert = db.prepare('INSERT INTO employees (id, name, phone) VALUES (@id, @name, @phone)');
  employees.forEach((e) => insert.run({ ...e, phone: e.phone ?? '' }));
});

// ---------- Customers ----------
function readCustomers() {
  return db.prepare('SELECT * FROM customers').all();
}
const writeCustomers = db.transaction((customers) => {
  db.prepare('DELETE FROM customers').run();
  const insert = db.prepare('INSERT INTO customers (id, name, phone, address) VALUES (@id, @name, @phone, @address)');
  customers.forEach((c) => insert.run({ ...c, phone: c.phone ?? '', address: c.address ?? '' }));
});

// ---------- Orders ----------
function readOrders() {
  return db.prepare('SELECT * FROM orders').all().map(rowToOrder);
}
const writeOrders = db.transaction((orders) => {
  db.prepare('DELETE FROM orders').run();
  const insert = db.prepare(`
    INSERT INTO orders (id, customerName, phone, address, items, total, paymentMethod, status, createdAt)
    VALUES (@id, @customerName, @phone, @address, @items, @total, @paymentMethod, @status, @createdAt)
  `);
  orders.forEach((o) =>
    insert.run({
      ...o,
      items: JSON.stringify(o.items || []),
      paymentMethod: o.paymentMethod ?? 'cod',
    })
  );
});

// ---------- Flash Sales ----------
function readFlashSales() {
  return db.prepare('SELECT * FROM flashsales').all();
}
const writeFlashSales = db.transaction((flashSales) => {
  db.prepare('DELETE FROM flashsales').run();
  const insert = db.prepare(`
    INSERT INTO flashsales (id, productId, salePrice, startAt, endAt, createdAt)
    VALUES (@id, @productId, @salePrice, @startAt, @endAt, @createdAt)
  `);
  flashSales.forEach((s) => insert.run(s));
});

module.exports = {
  db,
  readProducts,
  writeProducts,
  readEmployees,
  writeEmployees,
  readCustomers,
  writeCustomers,
  readOrders,
  writeOrders,
  readFlashSales,
  writeFlashSales,
};
