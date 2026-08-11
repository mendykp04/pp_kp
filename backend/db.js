// โมดูลนี้เชื่อมต่อฐานข้อมูล SQLite ผ่าน libSQL (@libsql/client)
// และรวมฟังก์ชันอ่าน/เขียนข้อมูลแต่ละตาราง ให้ server.js เรียกใช้
//
// เหตุผลที่ใช้ libSQL แทน better-sqlite3 ตรง ๆ: libSQL ใช้ตัวเดียวกันได้ทั้ง
// ไฟล์ในเครื่อง (โหมด "file:" เอาไว้ตอนพัฒนา/รันในเครื่องตัวเอง) และฐานข้อมูล
// แบบ hosted อย่าง Turso (โหมด "libsql://") เอาไว้ตอน deploy ขึ้นแพลตฟอร์มที่ไม่มี
// persistent disk (เช่น Render แผน Free) — ถ้าใช้ไฟล์ในเครื่องแบบเดิม ข้อมูลจะหาย
// ทุกครั้งที่ container รีสตาร์ท เพราะดิสก์เป็นพื้นที่ชั่วคราว ส่วนฐานข้อมูลที่ Turso
// จะอยู่ถาวรแยกจากตัวเซิร์ฟเวอร์เว็บโดยสิ้นเชิง
const path = require('path');
const { createClient } = require('@libsql/client');

// path เต็มไปยังไฟล์ฐานข้อมูลสำรอง ใช้เมื่อไม่ได้ตั้งค่า TURSO_DATABASE_URL (เช่น ตอนรันในเครื่องตัวเอง)
const DB_FILE = path.join(__dirname, 'data', 'sneakershop.db');

// ถ้ามีการตั้งค่า TURSO_DATABASE_URL ไว้ (ตอน deploy จริง) ให้ต่อไปยังฐานข้อมูล Turso แบบ hosted
// ถ้าไม่มี (เช่นตอนรันทดสอบในเครื่อง) ให้ fallback ไปใช้ไฟล์ในเครื่องแทนโดยอัตโนมัติ
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${DB_FILE}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ฟังก์ชัน init: สร้างตารางทั้งหมด (ถ้ายังไม่มี) + รัน migration คอลัมน์ที่เพิ่มเข้ามาทีหลัง
// ต้องเรียกและ await ให้เสร็จก่อนเริ่มรับ request ใด ๆ (ดูตอนท้ายไฟล์ server.js)
async function init() {
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        brand TEXT,
        code TEXT,
        price REAL NOT NULL,
        categoryId TEXT,
        stock INTEGER NOT NULL DEFAULT 0,
        sizes TEXT,
        image TEXT,
        images TEXT,
        description TEXT,
        condition TEXT,
        type TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        password TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        customerName TEXT,
        phone TEXT,
        address TEXT,
        items TEXT,
        total REAL,
        paymentMethod TEXT,
        status TEXT,
        paymentStatus TEXT,
        slipUrl TEXT,
        createdAt TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS flashsales (
        id TEXT PRIMARY KEY,
        productId TEXT,
        salePrice REAL,
        startAt TEXT,
        endAt TEXT,
        createdAt TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        date TEXT,
        description TEXT,
        amount REAL,
        createdAt TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone)`,
      `CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone)`,
      `CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)`,
    ],
    'write'
  );

  // Migration: เติมคอลัมน์ code/condition ให้ตาราง products ที่มีอยู่แล้วจากก่อนหน้านี้ (CREATE TABLE IF NOT EXISTS ด้านบนใช้ไม่ได้กับตารางที่มีอยู่แล้ว)
  const columnsResult = await client.execute('PRAGMA table_info(products)');
  const existingProductColumns = columnsResult.rows.map((c) => c.name);
  if (!existingProductColumns.includes('code')) {
    await client.execute('ALTER TABLE products ADD COLUMN code TEXT');
  }
  if (!existingProductColumns.includes('condition')) {
    await client.execute('ALTER TABLE products ADD COLUMN condition TEXT');
  }
  // รูปสินค้าหลายรูป (เก็บเป็น JSON array ของ path ในคอลัมน์เดียว เหมือน sizes/items) — คอลัมน์ "image" เดิมยังเก็บรูปหลัก (ปกคู่แรก) ไว้เพื่อความเข้ากันได้กับส่วนอื่นที่ยังอ้างอิงรูปเดียว (เช่น การ์ดสินค้า/ตะกร้า/Flash Sale)
  if (!existingProductColumns.includes('images')) {
    await client.execute('ALTER TABLE products ADD COLUMN images TEXT');
  }
  // ประเภทรองเท้า (เช่น รองเท้าแฟชั่น, รองเท้าวิ่ง) ใช้กรอง/ค้นหาทั้งฝั่งแอดมินและหน้าร้านค้า
  if (!existingProductColumns.includes('type')) {
    await client.execute('ALTER TABLE products ADD COLUMN type TEXT');
  }

  // Migration: เติมคอลัมน์ password ให้ตาราง customers ที่มีอยู่แล้วจากก่อนหน้านี้ (ใช้ตอนลูกค้าสมัครสมาชิก/ล็อกอินหน้าร้านค้าเอง)
  const customerColumnsResult = await client.execute('PRAGMA table_info(customers)');
  const existingCustomerColumns = customerColumnsResult.rows.map((c) => c.name);
  if (!existingCustomerColumns.includes('password')) {
    await client.execute('ALTER TABLE customers ADD COLUMN password TEXT');
  }

  // Migration: เติมคอลัมน์ paymentStatus/slipUrl ให้ตาราง orders ที่มีอยู่แล้วจากก่อนหน้านี้ (ใช้ตอนลูกค้าแนบสลิปโอนเงิน + แอดมินยืนยันการชำระเงิน)
  const orderColumnsResult = await client.execute('PRAGMA table_info(orders)');
  const existingOrderColumns = orderColumnsResult.rows.map((c) => c.name);
  if (!existingOrderColumns.includes('paymentStatus')) {
    await client.execute('ALTER TABLE orders ADD COLUMN paymentStatus TEXT');
  }
  if (!existingOrderColumns.includes('slipUrl')) {
    await client.execute('ALTER TABLE orders ADD COLUMN slipUrl TEXT');
  }

  // Migration: เติมคอลัมน์ address ให้ตาราง employees ที่มีอยู่แล้วจากก่อนหน้านี้
  const employeeColumnsResult = await client.execute('PRAGMA table_info(employees)');
  const existingEmployeeColumns = employeeColumnsResult.rows.map((c) => c.name);
  if (!existingEmployeeColumns.includes('address')) {
    await client.execute('ALTER TABLE employees ADD COLUMN address TEXT');
  }
}

// ฟิลด์ sizes/items เก็บเป็น JSON text ในคอลัมน์เดียว (โครงสร้างเดิมเป็น array ซ้อนอยู่แล้ว)
// ฟังก์ชันเหล่านี้แปลงกลับเป็น array/object ตอนอ่านออกมาใช้งาน
function rowToProduct(row) {
  // ถ้าแถวนี้ยังไม่มีคอลัมน์ images (สินค้าเก่าก่อนมีฟีเจอร์นี้) ให้ใช้รูปเดียวจากคอลัมน์ image แทน กันรูปหายไปเฉย ๆ
  const images = row.images ? JSON.parse(row.images) : row.image ? [row.image] : [];
  return { ...row, sizes: row.sizes ? JSON.parse(row.sizes) : [], images };
}
function rowToOrder(row) {
  return { ...row, items: row.items ? JSON.parse(row.items) : [] };
}

// ---------- Products ----------
async function readProducts() {
  const rs = await client.execute('SELECT * FROM products');
  return rs.rows.map(rowToProduct);
}
async function writeProducts(products) {
  // เขียนทับตารางทั้งหมดด้วยรายการที่ส่งมา ในชุด batch เดียว โหมด "write" ทำให้เป็น atomic (transaction เดียว)
  // ไม่มีทางเหลือข้อมูลค้างครึ่ง ๆ กลาง ๆ ถ้าเซิร์ฟเวอร์ล่มกลางคัน
  const statements = [{ sql: 'DELETE FROM products', args: [] }];
  products.forEach((p) => {
    // รูปแรกใน images ถือเป็นรูปหลัก/ปก เก็บซ้ำไว้ในคอลัมน์ image ด้วย เพื่อให้ส่วนอื่นที่ยังอ้างอิงรูปเดียว (การ์ดสินค้า/ตะกร้า/Flash Sale) ใช้งานได้ตามปกติ
    const images = Array.isArray(p.images) ? p.images : p.image ? [p.image] : [];
    statements.push({
      sql: `INSERT INTO products (id, name, brand, code, price, categoryId, stock, sizes, image, images, description, condition, type)
            VALUES (@id, @name, @brand, @code, @price, @categoryId, @stock, @sizes, @image, @images, @description, @condition, @type)`,
      args: {
        ...p,
        brand: p.brand ?? '',
        code: p.code ?? '',
        categoryId: p.categoryId ?? '',
        image: images[0] ?? '',
        images: JSON.stringify(images),
        description: p.description ?? '',
        condition: p.condition ?? '',
        type: p.type ?? '',
        sizes: JSON.stringify(p.sizes || []),
      },
    });
  });
  await client.batch(statements, 'write');
}

// ---------- Employees ----------
async function readEmployees() {
  const rs = await client.execute('SELECT * FROM employees');
  return rs.rows.map((r) => ({ ...r }));
}
async function writeEmployees(employees) {
  const statements = [{ sql: 'DELETE FROM employees', args: [] }];
  employees.forEach((e) =>
    statements.push({
      sql: 'INSERT INTO employees (id, name, phone, address) VALUES (@id, @name, @phone, @address)',
      args: { ...e, phone: e.phone ?? '', address: e.address ?? '' },
    })
  );
  await client.batch(statements, 'write');
}

// ---------- Customers ----------
async function readCustomers() {
  const rs = await client.execute('SELECT * FROM customers');
  return rs.rows.map((r) => ({ ...r }));
}
async function writeCustomers(customers) {
  const statements = [{ sql: 'DELETE FROM customers', args: [] }];
  customers.forEach((c) =>
    statements.push({
      sql: 'INSERT INTO customers (id, name, phone, address, password) VALUES (@id, @name, @phone, @address, @password)',
      args: { ...c, phone: c.phone ?? '', address: c.address ?? '', password: c.password ?? null },
    })
  );
  await client.batch(statements, 'write');
}

// ---------- Orders ----------
async function readOrders() {
  const rs = await client.execute('SELECT * FROM orders');
  return rs.rows.map(rowToOrder);
}
async function writeOrders(orders) {
  const statements = [{ sql: 'DELETE FROM orders', args: [] }];
  orders.forEach((o) =>
    statements.push({
      sql: `INSERT INTO orders (id, customerName, phone, address, items, total, paymentMethod, status, paymentStatus, slipUrl, createdAt)
            VALUES (@id, @customerName, @phone, @address, @items, @total, @paymentMethod, @status, @paymentStatus, @slipUrl, @createdAt)`,
      args: {
        ...o,
        items: JSON.stringify(o.items || []),
        paymentMethod: o.paymentMethod ?? 'cod',
        paymentStatus: o.paymentStatus ?? '',
        slipUrl: o.slipUrl ?? '',
      },
    })
  );
  await client.batch(statements, 'write');
}

// ---------- Flash Sales ----------
async function readFlashSales() {
  const rs = await client.execute('SELECT * FROM flashsales');
  return rs.rows.map((r) => ({ ...r }));
}
async function writeFlashSales(flashSales) {
  const statements = [{ sql: 'DELETE FROM flashsales', args: [] }];
  flashSales.forEach((s) =>
    statements.push({
      sql: `INSERT INTO flashsales (id, productId, salePrice, startAt, endAt, createdAt)
            VALUES (@id, @productId, @salePrice, @startAt, @endAt, @createdAt)`,
      args: s,
    })
  );
  await client.batch(statements, 'write');
}

// ---------- Expenses ----------
async function readExpenses() {
  const rs = await client.execute('SELECT * FROM expenses');
  return rs.rows.map((r) => ({ ...r }));
}
async function writeExpenses(expenses) {
  const statements = [{ sql: 'DELETE FROM expenses', args: [] }];
  expenses.forEach((e) =>
    statements.push({
      sql: `INSERT INTO expenses (id, date, description, amount, createdAt)
            VALUES (@id, @date, @description, @amount, @createdAt)`,
      args: e,
    })
  );
  await client.batch(statements, 'write');
}

module.exports = {
  client,
  init,
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
  readExpenses,
  writeExpenses,
};
