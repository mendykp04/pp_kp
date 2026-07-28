// สคริปต์ย้ายข้อมูลเดิมจากไฟล์ .json ใน backend/data/ เข้าไปเก็บในฐานข้อมูล SQLite (sneakershop.db)
// รันครั้งเดียวด้วยคำสั่ง: node migrate.js (หรือ npm run migrate)
// รันซ้ำได้อย่างปลอดภัย เพราะแต่ละตารางจะถูกลบข้อมูลเก่าทิ้งแล้วนำเข้าจากไฟล์ .json ใหม่ทุกครั้ง
const fs = require('fs');
const path = require('path');
const db = require('./db');

const DATA_DIR = path.join(__dirname, 'data');

// อ่านไฟล์ .json แล้วแปลงเป็น object/array ถ้าไฟล์ไม่มีอยู่ ให้ถือว่าเป็น array ว่าง
function readJSON(filename) {
  const file = path.join(DATA_DIR, filename);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

const categories = readJSON('categories.json');
const products = readJSON('products.json');
const employees = readJSON('employees.json');
const customers = readJSON('customers.json');
const orders = readJSON('orders.json');
const sales = readJSON('sales.json');
const flashSales = readJSON('flashsales.json');

db.writeCategories(categories);
db.writeProducts(products);
db.writeEmployees(employees);
db.writeCustomers(customers);
db.writeOrders(orders);
db.writeSales(sales);
db.writeFlashSales(flashSales);

console.log('ย้ายข้อมูลเข้า SQLite สำเร็จ:');
console.log(`  categories:  ${categories.length}`);
console.log(`  products:    ${products.length}`);
console.log(`  employees:   ${employees.length}`);
console.log(`  customers:   ${customers.length}`);
console.log(`  orders:      ${orders.length}`);
console.log(`  sales:       ${sales.length}`);
console.log(`  flashsales:  ${flashSales.length}`);
