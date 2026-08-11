// ฟังก์ชันจัดการตะกร้าสินค้า (ใช้ร่วมกันทุกหน้า) เก็บข้อมูลไว้ใน localStorage

// ตัวแปรกำหนด path หลักของ API (ทุกไฟล์เรียก fetch(`${API_BASE}/...`) ผ่านตัวแปรนี้)
const API_BASE = '/api';
// ตัวแปรกำหนดชื่อ key ที่ใช้เก็บข้อมูลตะกร้าใน localStorage ของเบราว์เซอร์
const CART_KEY = 'sneaker_cart';

// ฟังก์ชันดึงข้อมูลตะกร้าปัจจุบันออกจาก localStorage
function getCart() {
  // ใช้ try/catch เผื่อกรณีข้อมูลใน localStorage เสียหายหรือไม่ใช่ JSON ที่ถูกต้อง
  try {
    // อ่านข้อความจาก localStorage ด้วย key ที่กำหนด แล้วแปลงจาก JSON string เป็น array
    // ถ้าไม่มีข้อมูล (เป็น null) ให้คืนค่าเป็น array ว่างแทน
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    // ถ้าแปลง JSON ไม่สำเร็จ (error) ให้คืนค่าเป็น array ว่างเพื่อไม่ให้เว็บพัง
    return [];
  }
}

// ฟังก์ชันบันทึกตะกร้า (array) ลงใน localStorage
function saveCart(cart) {
  // แปลง array ของตะกร้าเป็น JSON string แล้วเก็บลง localStorage
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  // อัปเดตตัวเลขจำนวนสินค้าที่แสดงบนไอคอนตะกร้า (มุมขวาบน) ให้ตรงกับข้อมูลล่าสุด
  updateCartBadge();
}

// ฟังก์ชันเพิ่มสินค้าลงตะกร้า รับพารามิเตอร์: ข้อมูลสินค้า, ไซส์ที่เลือก, จำนวน (default = 1)
// และ options เสริม { price, flashSaleId } สำหรับกรณีเพิ่มสินค้าจากโซน Flash Sale (ใช้ราคาลดแทนราคาปกติ)
function addToCart(product, size, qty = 1, options = {}) {
  // ดึงตะกร้าปัจจุบันออกมาก่อน
  const cart = getCart();
  // ตรวจสอบว่าตะกร้ามีสินค้าตัวนี้ (id เดียวกัน), ไซส์เดียวกัน, และเป็น Flash Sale เดียวกันอยู่แล้วหรือไม่
  // (ต้องเช็ค flashSaleId ด้วย เพราะสินค้าชิ้นเดียวกันแต่ราคาปกติกับราคา Flash Sale ต้องแยกเป็นคนละรายการในตะกร้า)
  const existing = cart.find(
    (i) => i.productId === product.id && i.size === size && i.flashSaleId === (options.flashSaleId || null)
  );
  if (existing) {
    // สินค้าเป็นของมือสอง แต่ละคู่มีแค่ 1 ชิ้นเสมอ ถ้ากดเพิ่มซ้ำ (คู่นี้อยู่ในตะกร้าอยู่แล้ว) ก็ไม่ต้องทำอะไรเพิ่ม ไม่บวกจำนวนขึ้น
  } else {
    // ถ้ายังไม่มี ให้เพิ่มเป็นรายการใหม่เข้าไปในตะกร้า พร้อมข้อมูลที่จำเป็นสำหรับแสดงผลภายหลัง
    cart.push({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      // ใช้ราคาจาก options ถ้ามีการระบุมา (เช่นราคา Flash Sale) ไม่งั้นใช้ราคาปกติของสินค้า
      price: options.price ?? product.price,
      image: product.image,
      size,
      qty,
      // เก็บ id ของ Flash Sale ไว้ด้วย (เป็น null ถ้าไม่ใช่การซื้อผ่าน Flash Sale) เพื่อให้ backend ตรวจสอบสิทธิ์ราคาลดอีกครั้งตอนสั่งซื้อจริง
      flashSaleId: options.flashSaleId || null,
    });
  }
  // บันทึกตะกร้าที่อัปเดตแล้วกลับลง localStorage
  saveCart(cart);
}

// ฟังก์ชันลบสินค้าออกจากตะกร้า (ระบุด้วย productId, size, และ flashSaleId เพราะสินค้าเดียวกันคนละไซส์ หรือคนละราคา Flash Sale ถือเป็นคนละรายการ)
function removeFromCart(productId, size, flashSaleId = null) {
  // สร้างตะกร้าใหม่โดยกรอง (filter) เอาเฉพาะรายการที่ "ไม่ตรง" กับ productId+size+flashSaleId ที่ต้องการลบออก
  const cart = getCart().filter(
    (i) => !(i.productId === productId && i.size === size && i.flashSaleId === flashSaleId)
  );
  // บันทึกตะกร้าที่ลบแล้วกลับลง localStorage
  saveCart(cart);
}

// ฟังก์ชันคำนวณจำนวนสินค้ารวมทั้งหมดในตะกร้า (ใช้แสดงตัวเลขบนไอคอนตะกร้า)
function cartTotalCount() {
  // ใช้ reduce วนรวมค่า qty ของทุกรายการในตะกร้า เริ่มจาก 0
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}

// ฟังก์ชันคำนวณราคารวมทั้งหมดในตะกร้า (ใช้แสดงยอดรวมก่อนสั่งซื้อ)
function cartTotalPrice() {
  // ใช้ reduce วนคูณราคา x จำนวน ของแต่ละรายการ แล้วรวมกัน เริ่มจาก 0
  return getCart().reduce((sum, i) => sum + i.qty * i.price, 0);
}

// ฟังก์ชันอัปเดตตัวเลขบนไอคอนตะกร้า (badge) ที่แสดงอยู่บน navbar
function updateCartBadge() {
  // หา element ที่มี id="cartCount" ในหน้าเว็บปัจจุบัน
  const el = document.getElementById('cartCount');
  // ถ้าหน้านั้นไม่มี element นี้ (เช่นบางหน้าไม่มีตะกร้า) ให้หยุดทำงานทันที ไม่ error
  if (!el) return;
  // เปลี่ยนข้อความในตัว badge ให้เป็นจำนวนสินค้ารวมล่าสุด
  el.textContent = cartTotalCount();
}

// ฟังก์ชันช่วยแปลงตัวเลขราคาให้อยู่ในรูปแบบสกุลเงินไทย พร้อมคำว่า "บาท" ต่อท้าย
function formatPrice(num) {
  // toLocaleString('th-TH') จะใส่เครื่องหมายจุลภาคคั่นหลักพัน เช่น 3590 -> "3,590"
  return num.toLocaleString('th-TH') + ' บาท';
}

// ตารางแปลสถานะคำสั่งซื้อ (ข้อความไทย) ให้เป็น class สี highlight — ใช้ชุดสีเดียวกับหลังบ้าน (ดู admin.css .order-status-select.status-*)
// เพื่อให้ความหมายของสีตรงกันทั้งฝั่งแอดมินและลูกค้า ใช้ร่วมกันทั้งหน้า track.html และ account.html
const STATUS_CLASS_MAP = {
  รอดำเนินการ: 'status-pending',
  กำลังจัดส่ง: 'status-shipping',
  จัดส่งแล้ว: 'status-delivered',
  จัดส่งไม่สำเร็จ: 'status-failed',
};

// ฟังก์ชันแปลงรหัสวิธีชำระเงินให้เป็นข้อความภาษาไทยอ่านง่าย (ใช้ร่วมกันทั้งหน้า track.html, account.html และหลังบ้าน)
function formatPaymentMethod(method) {
  const labels = {
    cod: 'เก็บเงินปลายทาง',
    bank_transfer: 'โอนเงินผ่านธนาคาร',
    promptpay: 'พร้อมเพย์',
  };
  return labels[method] || labels.cod;
}

// ฟังก์ชันแสดงข้อความแจ้งเตือนเล็ก ๆ (toast) ที่มุมล่างของหน้าจอ เช่น "เพิ่มลงตะกร้าแล้ว"
function showToast(message) {
  // หา element ของกล่อง toast ในหน้านั้น
  const toast = document.getElementById('toast');
  // ถ้าหน้านั้นไม่มีกล่อง toast ให้หยุดทำงาน
  if (!toast) return;
  // ใส่ข้อความที่ต้องการแจ้งเตือนลงในกล่อง
  toast.textContent = message;
  // เพิ่ม class "show" เพื่อให้ CSS แสดงกล่อง toast ขึ้นมา (แบบมี animation)
  toast.classList.add('show');
  // ตั้งเวลา 2.2 วินาที แล้วเอา class "show" ออก เพื่อให้ toast ค่อย ๆ จางหายไป
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// ฟังก์ชัน async อัปเดตลิงก์ในแถบเมนู (navbar) ให้ตรงกับสถานะล็อกอินของลูกค้าปัจจุบัน
// ถ้าล็อกอินอยู่ → โชว์ชื่อ + ลิงก์ไปหน้า "บัญชีของฉัน" ถ้ายังไม่ล็อกอิน → โชว์ลิงก์ "เข้าสู่ระบบ"
// ทุกหน้าที่มี <span id="authNav"></span> ในแถบเมนูจะถูกอัปเดตอัตโนมัติ (หน้าไหนไม่มีก็แค่ไม่ทำอะไร ไม่ error)
async function updateAuthNav() {
  const el = document.getElementById('authNav');
  if (!el) return;
  try {
    const res = await fetch(`${API_BASE}/auth/customer/me`);
    const data = await res.json();
    el.innerHTML = data.loggedIn
      ? `<a href="account.html">👤 ${data.name}</a>`
      : `<a href="login.html">เข้าสู่ระบบ</a>`;
  } catch {
    // ถ้าเช็คสถานะไม่ได้ (เช่นเน็ตหลุด) ให้แสดงลิงก์เข้าสู่ระบบไว้ก่อนเป็นค่าเริ่มต้น ไม่ปล่อยให้ช่องว่างเปล่า
    el.innerHTML = `<a href="login.html">เข้าสู่ระบบ</a>`;
  }
}

// เมื่อโหลดหน้าเว็บเสร็จ (DOM พร้อมใช้งานแล้ว) ให้เรียกอัปเดตตัวเลขบนไอคอนตะกร้าทันที
// เพื่อให้ตัวเลขตรงกับข้อมูลที่เก็บไว้ใน localStorage ตั้งแต่เปิดหน้ามา
document.addEventListener('DOMContentLoaded', updateCartBadge);
// เรียกอัปเดตแถบเมนูให้ตรงกับสถานะล็อกอินทันทีที่เปิดหน้าเว็บเช่นกัน
document.addEventListener('DOMContentLoaded', updateAuthNav);
