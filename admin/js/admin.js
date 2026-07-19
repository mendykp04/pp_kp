// ตัวแปรกำหนด path หลักของ API ที่หน้า admin จะเรียกใช้
const API_BASE = '/api';

// ---------- Auth Guard ----------
// ก่อนจะเริ่มโหลดข้อมูลอะไรในหน้า admin ต้องเช็คก่อนว่าผู้ใช้ล็อกอินอยู่จริงหรือไม่
// (ป้องกันกรณีมีคน "เดา" URL เข้ามาที่ /admin/index.html ตรง ๆ โดยไม่ผ่านหน้า login)

// ฟังก์ชัน async เช็คสถานะล็อกอินกับ backend ถ้ายังไม่ได้ล็อกอิน ให้เด้งกลับไปหน้า login ทันที
async function checkAuth() {
  // ใช้ try/catch เผื่อกรณีเรียก API ไม่สำเร็จ (เช่นเซิร์ฟเวอร์ล่ม) จะได้ไม่ปล่อยให้หน้าค้างเงียบ ๆ
  try {
    const res = await fetch(`${API_BASE}/auth/me`);
    const data = await res.json();
    // ถ้ายังไม่ได้ล็อกอิน ให้พาไปหน้า login ทันที แล้วหยุดการทำงานของสคริปต์ส่วนที่เหลือ (โหลดข้อมูล/ผูก event ต่าง ๆ)
    if (!data.loggedIn) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  } catch (err) {
    // ถ้าเช็คสถานะไม่ได้เลย ให้ถือว่าปลอดภัยไว้ก่อน (พาไปหน้า login เช่นกัน)
    window.location.href = 'login.html';
    return false;
  }
}

// ตัวแปรเก็บรายการสินค้าทั้งหมดที่โหลดมาจาก API (ไว้ใช้ตอนแก้ไข/ลบ โดยไม่ต้องยิง API ซ้ำ)
let products = [];
// ตัวแปรเก็บรายการคำสั่งซื้อทั้งหมดที่โหลดมาจาก API
let orders = [];
// ตัวแปรเก็บรายการพนักงานทั้งหมด (หรือผลลัพธ์ที่กรองแล้วจากการค้นหา) ที่โหลดมาจาก API
let employees = [];
// ตัวแปรเก็บรายการสินค้าที่กำลังจะขายในรอบปัจจุบันของหน้า "ขายหน้าร้าน" (ยังไม่บันทึกจนกว่าจะกดปุ่มบันทึก)
let posCart = [];
// ตัวแปรเก็บรายการหมวดหมู่สินค้าทั้งหมดที่โหลดมาจาก API
let categories = [];
// ตัวแปรเก็บรายการ Flash Sale ทั้งหมดที่โหลดมาจาก API
let flashSales = [];

// อ้างอิง element ตาราง (tbody) ที่ใช้แสดงรายการสินค้า
const productTableBody = document.getElementById('productTableBody');
// อ้างอิง element ตาราง (tbody) ที่ใช้แสดงรายการคำสั่งซื้อ
const orderTableBody = document.getElementById('orderTableBody');
// อ้างอิง element กล่อง modal สำหรับเพิ่ม/แก้ไขสินค้า
const productModal = document.getElementById('productModal');
// อ้างอิง element ฟอร์มเพิ่ม/แก้ไขสินค้าภายใน modal
const productForm = document.getElementById('productForm');
// อ้างอิง element หัวข้อของ modal (เปลี่ยนข้อความระหว่าง "เพิ่ม" กับ "แก้ไข")
const productModalTitle = document.getElementById('productModalTitle');

// อ้างอิง element ตาราง (tbody) ที่ใช้แสดงรายการพนักงาน
const employeeTableBody = document.getElementById('employeeTableBody');
// อ้างอิง element ช่องค้นหาพนักงาน (ค้นจากรหัสพนักงานหรือชื่อ-สกุล)
const employeeSearchInput = document.getElementById('employeeSearchInput');
// อ้างอิง element กล่อง modal สำหรับเพิ่ม/แก้ไขพนักงาน
const employeeModal = document.getElementById('employeeModal');
// อ้างอิง element ฟอร์มเพิ่ม/แก้ไขพนักงานภายใน modal
const employeeForm = document.getElementById('employeeForm');
// อ้างอิง element หัวข้อของ modal พนักงาน (เปลี่ยนข้อความระหว่าง "เพิ่ม" กับ "แก้ไข")
const employeeModalTitle = document.getElementById('employeeModalTitle');

// อ้างอิง element ดรอปดาวน์เลือกพนักงานผู้ขาย ในหน้า "ขายหน้าร้าน"
const posEmployeeSelect = document.getElementById('posEmployeeSelect');
// อ้างอิง element ดรอปดาวน์เลือกรองเท้าที่จะขาย
const posProductSelect = document.getElementById('posProductSelect');
// อ้างอิง element ดรอปดาวน์เลือกไซส์ของรองเท้าที่เลือกไว้
const posSizeSelect = document.getElementById('posSizeSelect');
// อ้างอิง element ช่องกรอกจำนวนที่จะขาย
const posQtyInput = document.getElementById('posQtyInput');
// อ้างอิง element ปุ่ม "+ เพิ่มรายการ" เพื่อใส่รองเท้าที่เลือกไว้ลงตะกร้าขาย
const posAddItemBtn = document.getElementById('posAddItemBtn');
// อ้างอิง element ตาราง (tbody) ที่ใช้แสดงรายการที่อยู่ในตะกร้าขายรอบนี้
const posCartBody = document.getElementById('posCartBody');
// อ้างอิง element ที่แสดงยอดชำระรวมทั้งหมด
const posTotal = document.getElementById('posTotal');
// อ้างอิง element ช่องกรอกจำนวนเงินที่ได้รับจากลูกค้า
const posAmountReceived = document.getElementById('posAmountReceived');
// อ้างอิง element ที่แสดงเงินทอน (คำนวณอัตโนมัติ)
const posChange = document.getElementById('posChange');
// อ้างอิง element ปุ่ม "บันทึกการชำระเงิน"
const posSaveBtn = document.getElementById('posSaveBtn');

// อ้างอิง element ช่องเลือกวันที่ในหน้ารายงานสรุปยอดขาย
const reportDateInput = document.getElementById('reportDateInput');
// อ้างอิง element ตาราง (tbody) ที่ใช้แสดงรายการขายของวันที่เลือก
const reportTableBody = document.getElementById('reportTableBody');

// อ้างอิง element ตาราง (tbody) ที่ใช้แสดงรายการหมวดหมู่สินค้า
const categoryTableBody = document.getElementById('categoryTableBody');
// อ้างอิง element กล่อง modal สำหรับเพิ่ม/แก้ไขหมวดหมู่
const categoryModal = document.getElementById('categoryModal');
// อ้างอิง element ฟอร์มเพิ่ม/แก้ไขหมวดหมู่ภายใน modal
const categoryForm = document.getElementById('categoryForm');
// อ้างอิง element หัวข้อของ modal หมวดหมู่ (เปลี่ยนข้อความระหว่าง "เพิ่ม" กับ "แก้ไข")
const categoryModalTitle = document.getElementById('categoryModalTitle');
// อ้างอิง element ดรอปดาวน์เลือกหมวดหมู่ในฟอร์มเพิ่ม/แก้ไขสินค้า
const productCategorySelect = document.getElementById('productCategory');

// อ้างอิง element ตาราง (tbody) ที่ใช้แสดงรายการ Flash Sale
const flashSaleTableBody = document.getElementById('flashSaleTableBody');
// อ้างอิง element กล่อง modal สำหรับตั้งค่า/แก้ไข Flash Sale
const flashSaleModal = document.getElementById('flashSaleModal');
// อ้างอิง element ฟอร์มตั้งค่า/แก้ไข Flash Sale ภายใน modal
const flashSaleForm = document.getElementById('flashSaleForm');
// อ้างอิง element หัวข้อของ modal Flash Sale (เปลี่ยนข้อความระหว่าง "ตั้งค่าใหม่" กับ "แก้ไข")
const flashSaleModalTitle = document.getElementById('flashSaleModalTitle');
// อ้างอิง element ดรอปดาวน์เลือกสินค้าที่จะลดราคาในฟอร์ม Flash Sale
const flashSaleProductSelect = document.getElementById('flashSaleProduct');
// อ้างอิง element ที่แสดงราคาปกติของสินค้าที่เลือกไว้ในฟอร์ม Flash Sale
const flashSaleOriginalPrice = document.getElementById('flashSaleOriginalPrice');

// ฟังก์ชันแสดงข้อความแจ้งเตือนเล็ก ๆ (toast) ที่มุมล่างของหน้าจอ
function showToast(message) {
  // หา element กล่อง toast ในหน้า
  const toast = document.getElementById('toast');
  // ใส่ข้อความที่ต้องการแจ้งเตือน
  toast.textContent = message;
  // เพิ่ม class "show" เพื่อให้ CSS แสดงกล่องขึ้นมา
  toast.classList.add('show');
  // ตั้งเวลา 2.2 วินาที แล้วซ่อนกล่องอีกครั้งโดยเอา class "show" ออก
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// ฟังก์ชันช่วยแปลงตัวเลขราคาให้อยู่ในรูปแบบสกุลเงินไทย พร้อมคำว่า "บาท" ต่อท้าย
function formatPrice(num) {
  // แปลง num ให้เป็นตัวเลขแน่ ๆ ก่อน แล้วจัดรูปแบบด้วยเครื่องหมายคั่นหลักพันแบบไทย
  return Number(num).toLocaleString('th-TH') + ' บาท';
}

// ---------- Tabs ----------
// ส่วนจัดการการสลับแท็บเมนู (จัดการสินค้า / คำสั่งซื้อ / พนักงาน / ขายหน้าร้าน / สรุปยอดขาย) ในแถบด้านซ้าย

// เลือกปุ่มเมนูทั้งหมดที่มี class "nav-btn" แล้ววนลูปผูก event ให้แต่ละปุ่ม
document.querySelectorAll('.nav-btn').forEach((btn) => {
  // เมื่อมีการคลิกปุ่มเมนูตัวใดตัวหนึ่ง (ใช้ async เพราะบางแท็บต้องรอโหลดข้อมูลใหม่จาก API ก่อนแสดงผล)
  btn.addEventListener('click', async () => {
    // เอา class "active" ออกจากปุ่มเมนูทุกตัวก่อน (เคลียร์สถานะเดิม)
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    // เอา class "active" ออกจากทุกแท็บเนื้อหา (ซ่อนเนื้อหาทั้งหมดก่อน)
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    // ใส่ class "active" ให้กับปุ่มที่เพิ่งถูกคลิก (ทำให้ไฮไลต์ว่ากำลังอยู่แท็บนี้)
    btn.classList.add('active');
    // อ่านชื่อแท็บที่ถูกเลือกจาก data-tab
    const tab = btn.dataset.tab;
    // แสดงแท็บเนื้อหาที่ตรงกับปุ่มที่คลิก
    document.getElementById(`tab-${tab}`).classList.add('active');

    // โหลดข้อมูลของแท็บนั้น ๆ ใหม่ทุกครั้งที่สลับเข้ามา เพื่อให้เห็นข้อมูลล่าสุดเสมอ
    // (เช่น สต็อกสินค้าหลังขายของใน POS, พนักงานที่เพิ่งเพิ่ม/แก้ไข)
    if (tab === 'products') loadProducts();
    if (tab === 'categories') loadCategories();
    if (tab === 'flashsales') {
      // ตารางแสดงชื่อสินค้าของแต่ละ Flash Sale จึงต้องรอให้สินค้าโหลดเสร็จก่อนด้วย
      await loadProducts();
      await loadFlashSales();
    }
    if (tab === 'orders') loadOrders();
    if (tab === 'employees') loadEmployees(employeeSearchInput.value.trim());
    if (tab === 'pos') {
      // ต้องรอให้สินค้าและพนักงานโหลดเสร็จก่อน ถึงจะเติมตัวเลือกในดรอปดาวน์ได้ถูกต้อง
      await loadProducts();
      await loadEmployees();
      populatePosProductSelect();
      populatePosEmployeeSelect();
    }
    if (tab === 'report') loadReport(reportDateInput.value);
  });
});

// ---------- Products ----------
// ส่วนจัดการสินค้า: โหลด/แสดง/เพิ่ม/แก้ไข/ลบ

// ฟังก์ชัน async โหลดรายการสินค้าทั้งหมดจาก backend
async function loadProducts() {
  // ยิง HTTP GET ไปที่ /api/products แล้วรอผลลัพธ์
  const res = await fetch(`${API_BASE}/products`);
  // แปลง response เป็น array ของสินค้า แล้วเก็บลงตัวแปรกลาง
  products = await res.json();
  // วาดตารางสินค้าใหม่ตามข้อมูลที่เพิ่งโหลดมา
  renderProductTable();
}

// ฟังก์ชันวาด (render) ตารางแสดงรายการสินค้าทั้งหมด
function renderProductTable() {
  // ถ้าไม่มีสินค้าเลย
  if (products.length === 0) {
    // แสดงข้อความแจ้งว่ายังไม่มีสินค้า (ในแถวเดียว ครอบคลุม 8 คอลัมน์)
    productTableBody.innerHTML = '<tr><td colspan="8">ยังไม่มีสินค้า</td></tr>';
    return; // ออกจากฟังก์ชันทันที
  }
  // วนสร้างแถวตาราง (tr) สำหรับสินค้าแต่ละชิ้น แล้วรวมเป็นข้อความเดียว
  productTableBody.innerHTML = products
    .map((p) => {
      // หาชื่อหมวดหมู่ของสินค้าชิ้นนี้จากรายการหมวดหมู่ทั้งหมด (ถ้าไม่มี categoryId หรือหาไม่เจอ ให้แสดงขีดกลาง)
      const categoryName = categories.find((c) => c.id === p.categoryId)?.name || '-';
      return `
    <tr>
      <td><img src="${p.image}" alt="${p.name}" /></td>
      <td>${p.name}</td>
      <td>${p.brand}</td>
      <td>${categoryName}</td>
      <td>${formatPrice(p.price)}</td>
      <td>${p.stock}</td>
      <td>${p.sizes.join(', ')}</td>
      <td>
        <button class="btn-icon" data-action="edit" data-id="${p.id}">แก้ไข</button>
        <button class="btn-icon danger" data-action="delete" data-id="${p.id}">ลบ</button>
      </td>
    </tr>
  `;
    })
    .join(''); // รวม HTML ทุกแถวเป็นข้อความเดียว แล้วใส่ลงในตาราง

  // ผูก event คลิกให้กับปุ่ม "แก้ไข" และ "ลบ" ทุกปุ่มที่เพิ่งวาดใหม่
  productTableBody.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      // หาข้อมูลสินค้าที่ตรงกับ id ของปุ่มที่ถูกคลิก
      const product = products.find((p) => p.id === btn.dataset.id);
      // ถ้าเป็นปุ่ม "แก้ไข" ให้เปิด modal พร้อมข้อมูลสินค้าเดิม
      if (btn.dataset.action === 'edit') openProductModal(product);
      // ถ้าเป็นปุ่ม "ลบ" ให้เรียกฟังก์ชันลบสินค้า
      if (btn.dataset.action === 'delete') deleteProduct(product);
    });
  });
}

// ฟังก์ชันเปิด modal สำหรับเพิ่มสินค้าใหม่ หรือแก้ไขสินค้าเดิม
// ถ้าไม่ส่ง product มา (ค่า default เป็น null) หมายถึงกำลังจะ "เพิ่มสินค้าใหม่"
function openProductModal(product = null) {
  // ล้างค่าทั้งหมดในฟอร์มก่อน (เคลียร์ข้อมูลเก่าที่อาจค้างอยู่)
  productForm.reset();
  // ใส่ id ของสินค้าลงในช่องซ่อน (hidden input) ถ้าเป็นการแก้ไข ถ้าเพิ่มใหม่ให้เป็นค่าว่าง
  document.getElementById('productId').value = product ? product.id : '';
  // เปลี่ยนหัวข้อ modal ตามโหมด (แก้ไข หรือ เพิ่มใหม่)
  productModalTitle.textContent = product ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่';
  // เติมค่าชื่อสินค้าลงในช่องกรอก (ใช้ ?. ป้องกัน error ถ้า product เป็น null, ถ้าไม่มีค่าให้เป็นสตริงว่าง)
  document.getElementById('productName').value = product?.name || '';
  // เติมค่าแบรนด์ลงในช่องกรอก
  document.getElementById('productBrand').value = product?.brand || '';
  // เติมค่าราคาลงในช่องกรอก (ใช้ ?? เพราะราคาอาจเป็น 0 ซึ่งถือเป็นค่าที่ถูกต้อง ไม่ใช่ค่าว่าง)
  document.getElementById('productPrice').value = product?.price ?? '';
  // เติมค่าจำนวนสต็อกลงในช่องกรอก
  document.getElementById('productStock').value = product?.stock ?? '';
  // เติมค่าไซส์ทั้งหมด โดยแปลง array ของไซส์ให้เป็นข้อความคั่นด้วยจุลภาค เช่น "40,41,42"
  document.getElementById('productSizes').value = product?.sizes?.join(',') || '';
  // เติมตัวเลือกหมวดหมู่ทั้งหมดลงในดรอปดาวน์ก่อน (เผื่อรายการหมวดหมู่เพิ่งถูกโหลด/เปลี่ยนแปลงมา) แล้วเลือกหมวดหมู่ของสินค้านี้ไว้
  populateProductCategorySelect(product?.categoryId || '');
  // เติมค่า path รูปภาพเดิมลงในช่องซ่อน (ถ้าเป็นการแก้ไขและมีรูปอยู่แล้ว)
  document.getElementById('productImage').value = product?.image || '';
  // ถ้าสินค้ามีรูปภาพอยู่แล้ว ให้แสดงรูปตัวอย่าง ถ้าไม่มีให้ซ่อนกล่องรูปตัวอย่างไว้
  const preview = document.getElementById('productImagePreview');
  if (product?.image) {
    preview.src = product.image;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }
  // เติมค่ารายละเอียดสินค้าลงในช่องกรอก
  document.getElementById('productDescription').value = product?.description || '';
  // เพิ่ม class "open" ให้กับ modal เพื่อแสดงหน้าต่างขึ้นมา
  productModal.classList.add('open');
}

// ฟังก์ชัน async อัปโหลดไฟล์รูปภาพ 1 ไฟล์ไปยัง backend แล้วคืนค่า path ของรูปที่บันทึกไว้ (เช่น /uploads/img-xxxx.jpg)
async function uploadProductImage(file) {
  // FormData คือรูปแบบข้อมูลที่ใช้ส่งไฟล์ผ่าน HTTP (multipart/form-data) ต่างจาก JSON ที่ใช้ส่งข้อความ
  const formData = new FormData();
  // ใส่ไฟล์ลงใน FormData โดยใช้ชื่อ field "image" ให้ตรงกับที่ backend กำหนดไว้ (upload.single('image'))
  formData.append('image', file);
  // ยิง HTTP POST ไปที่ /api/upload พร้อมแนบไฟล์ (ไม่ต้องตั้ง Content-Type เอง เบราว์เซอร์จะตั้งให้อัตโนมัติพร้อม boundary)
  const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
  // ถ้าอัปโหลดไม่สำเร็จ (เช่น ไฟล์ใหญ่เกินไป หรือไม่ใช่รูปภาพ) ให้อ่านข้อความ error จาก response แล้วโยน error ออกไป
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'อัปโหลดรูปภาพไม่สำเร็จ');
  }
  // แปลง response เป็น object แล้วคืนค่า path ของรูปที่ backend บันทึกไว้
  const data = await res.json();
  return data.url;
}

// ผูก event เมื่อผู้ใช้เลือกไฟล์รูปภาพใหม่จากช่อง input type="file"
document.getElementById('productImageFile').addEventListener('change', async (e) => {
  // ดึงไฟล์แรกที่ผู้ใช้เลือก (input ตัวนี้เลือกได้ทีละ 1 ไฟล์)
  const file = e.target.files[0];
  // ถ้าผู้ใช้กดยกเลิกตอนเลือกไฟล์ (ไม่มีไฟล์) ให้หยุดทำงาน
  if (!file) return;

  const preview = document.getElementById('productImagePreview');
  // ใช้ try/catch ดักจับข้อผิดพลาดระหว่างอัปโหลด
  try {
    // แจ้งผู้ใช้ว่ากำลังอัปโหลดอยู่ ระหว่างรอผลลัพธ์จาก backend
    showToast('กำลังอัปโหลดรูปภาพ...');
    // เรียกฟังก์ชันอัปโหลดไฟล์ แล้วรอ path ของรูปที่บันทึกสำเร็จ
    const imageUrl = await uploadProductImage(file);
    // เก็บ path ของรูปที่อัปโหลดสำเร็จไว้ในช่องซ่อน เพื่อนำไปส่งพร้อมข้อมูลสินค้าตอนบันทึก
    document.getElementById('productImage').value = imageUrl;
    // แสดงรูปตัวอย่างจาก path ที่เพิ่งอัปโหลดสำเร็จ
    preview.src = imageUrl;
    preview.style.display = 'block';
    // แจ้งผู้ใช้ว่าอัปโหลดสำเร็จแล้ว
    showToast('อัปโหลดรูปภาพสำเร็จ');
  } catch (err) {
    // ถ้าอัปโหลดไม่สำเร็จ ให้แจ้งเตือนผู้ใช้ด้วยข้อความ error ที่ได้จาก backend
    showToast(err.message);
    // เคลียร์ค่าที่เลือกไว้ในช่อง input เพื่อให้ผู้ใช้เลือกไฟล์ใหม่ได้อีกครั้ง
    e.target.value = '';
  }
});

// ผูก event ให้กับปุ่ม "+ เพิ่มสินค้าใหม่" เมื่อคลิกให้เปิด modal แบบไม่ส่งสินค้าเดิม (โหมดเพิ่มใหม่)
document.getElementById('addProductBtn').addEventListener('click', () => openProductModal());
// ผูก event ให้กับปุ่มกากบาทปิด modal
document.getElementById('closeProductModal').addEventListener('click', () => {
  // เอา class "open" ออก เพื่อซ่อน modal
  productModal.classList.remove('open');
});
// ผูก event คลิกที่พื้นหลังมืดรอบ modal ถ้าคลิกตรงพื้นหลัง (ไม่ใช่ในกล่อง) ให้ปิด modal ด้วย
productModal.addEventListener('click', (e) => {
  // ตรวจสอบว่าจุดที่คลิกคือตัว overlay เอง ไม่ใช่ element ลูกข้างใน
  if (e.target === productModal) productModal.classList.remove('open');
});

// ผูก event เมื่อผู้ใช้กดปุ่ม "บันทึกสินค้า" (submit ฟอร์ม)
productForm.addEventListener('submit', async (e) => {
  // ป้องกันเบราว์เซอร์รีโหลดหน้าตามพฤติกรรมปกติของฟอร์ม
  e.preventDefault();
  // อ่านค่า id จากช่องซ่อน เพื่อรู้ว่าเป็นการ "เพิ่มใหม่" (id ว่าง) หรือ "แก้ไข" (มี id)
  const id = document.getElementById('productId').value;
  // รวบรวมค่าจากทุกช่องกรอกในฟอร์ม สร้างเป็น object ที่จะส่งไปให้ backend
  const payload = {
    name: document.getElementById('productName').value.trim(),
    brand: document.getElementById('productBrand').value.trim(),
    price: Number(document.getElementById('productPrice').value),
    stock: Number(document.getElementById('productStock').value),
    // แปลงข้อความไซส์ (คั่นด้วยจุลภาค) เป็น array ของตัวเลข
    sizes: document
      .getElementById('productSizes')
      .value.split(',') // แยกข้อความออกเป็นชิ้น ๆ ตามจุลภาค
      .map((s) => Number(s.trim())) // ตัดช่องว่างแต่ละชิ้นแล้วแปลงเป็นตัวเลข
      .filter((s) => !Number.isNaN(s)), // กรองเอาเฉพาะค่าที่แปลงเป็นตัวเลขได้จริง (ตัดค่าผิดพลาดทิ้ง)
    image: document.getElementById('productImage').value.trim(),
    description: document.getElementById('productDescription').value.trim(),
    // หมวดหมู่ราคาที่เลือกไว้ (ค่าว่างหมายถึงไม่ระบุหมวดหมู่)
    categoryId: productCategorySelect.value,
  };

  // ใช้ try/catch ดักจับข้อผิดพลาดระหว่างเรียก API
  try {
    // ถ้ามี id (โหมดแก้ไข) ให้ยิงไปที่ /api/products/<id> ด้วย method PUT
    // ถ้าไม่มี id (โหมดเพิ่มใหม่) ให้ยิงไปที่ /api/products ด้วย method POST
    const res = await fetch(`${API_BASE}/products${id ? '/' + id : ''}`, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // ถ้า response ไม่สำเร็จ ให้โยน error เพื่อให้ตกไปที่ catch
    if (!res.ok) throw new Error('save failed');
    // ปิด modal เพราะบันทึกสำเร็จแล้ว
    productModal.classList.remove('open');
    // แสดงข้อความแจ้งเตือนความสำเร็จ (ข้อความต่างกันตามว่าเป็นการแก้ไขหรือเพิ่มใหม่)
    showToast(id ? 'แก้ไขสินค้าเรียบร้อย' : 'เพิ่มสินค้าเรียบร้อย');
    // โหลดรายการสินค้าใหม่ทั้งหมด เพื่อให้ตารางแสดงข้อมูลล่าสุด (รวมของที่เพิ่ง เพิ่ม/แก้ไข)
    loadProducts();
  } catch (err) {
    // ถ้าเกิดข้อผิดพลาด ให้แจ้งเตือนผู้ใช้
    showToast('เกิดข้อผิดพลาด กรุณาลองใหม่');
  }
});

// ฟังก์ชัน async สำหรับลบสินค้า รับพารามิเตอร์เป็น object สินค้าที่ต้องการลบ
async function deleteProduct(product) {
  // แสดงกล่องยืนยันก่อนลบจริง ถ้าผู้ใช้กด "ยกเลิก" ให้หยุดทำงานทันที (confirm คืนค่า false)
  if (!confirm(`ต้องการลบสินค้า "${product.name}" ใช่หรือไม่?`)) return;
  // ใช้ try/catch ดักจับข้อผิดพลาดระหว่างเรียก API
  try {
    // ยิง HTTP DELETE ไปที่ /api/products/<id> ของสินค้าที่ต้องการลบ
    const res = await fetch(`${API_BASE}/products/${product.id}`, { method: 'DELETE' });
    // ถ้า response ไม่สำเร็จ ให้โยน error
    if (!res.ok) throw new Error('delete failed');
    // แจ้งเตือนว่าลบสำเร็จ
    showToast('ลบสินค้าเรียบร้อย');
    // โหลดรายการสินค้าใหม่ทั้งหมด เพื่อให้ตารางไม่แสดงสินค้าที่ถูกลบไปแล้ว
    loadProducts();
  } catch (err) {
    // ถ้าเกิดข้อผิดพลาด ให้แจ้งเตือนผู้ใช้
    showToast('เกิดข้อผิดพลาด กรุณาลองใหม่');
  }
}

// ---------- Orders ----------
// ส่วนแสดงรายการคำสั่งซื้อทั้งหมด (สำหรับดูอย่างเดียว ไม่มีการแก้ไขในหน้านี้)

// ฟังก์ชัน async โหลดรายการคำสั่งซื้อทั้งหมดจาก backend
async function loadOrders() {
  // ยิง HTTP GET ไปที่ /api/orders แล้วรอผลลัพธ์
  const res = await fetch(`${API_BASE}/orders`);
  // แปลง response เป็น array ของคำสั่งซื้อ แล้วเก็บลงตัวแปรกลาง
  orders = await res.json();
  // วาดตารางคำสั่งซื้อใหม่ตามข้อมูลที่เพิ่งโหลดมา
  renderOrderTable();
}

// ฟังก์ชันวาด (render) ตารางแสดงรายการคำสั่งซื้อทั้งหมด
// ฟังก์ชันแปลงรหัสวิธีชำระเงิน (ที่เก็บไว้ใน order.paymentMethod) ให้เป็นข้อความภาษาไทยอ่านง่าย
function formatPaymentMethod(method) {
  // ตารางแปลรหัส -> ข้อความภาษาไทย
  const labels = {
    cod: 'เก็บเงินปลายทาง',
    bank_transfer: 'โอนเงินผ่านธนาคาร',
    promptpay: 'พร้อมเพย์',
  };
  // ถ้าไม่พบรหัสในตาราง (เช่นออเดอร์เก่าก่อนมีฟีเจอร์นี้ ไม่มีค่านี้เก็บไว้) ให้ถือว่าเป็นเก็บเงินปลายทางเป็นค่าเริ่มต้น
  return labels[method] || labels.cod;
}

function renderOrderTable() {
  // ถ้าไม่มีคำสั่งซื้อเลย
  if (orders.length === 0) {
    // แสดงข้อความแจ้งว่ายังไม่มีคำสั่งซื้อ (ครอบคลุม 8 คอลัมน์)
    orderTableBody.innerHTML = '<tr><td colspan="8">ยังไม่มีคำสั่งซื้อ</td></tr>';
    return; // ออกจากฟังก์ชันทันที
  }
  // วนสร้างแถวตาราง (tr) สำหรับคำสั่งซื้อแต่ละรายการ แล้วรวมเป็นข้อความเดียว
  orderTableBody.innerHTML = orders
    .map((o) => {
      // รายการสถานะที่เลือกได้ตามปกติ
      const statusOptions = ['รอดำเนินการ', 'จัดส่งแล้ว'];
      // ถ้าออเดอร์นี้มีสถานะเก่าที่ไม่ตรงกับ 2 ตัวเลือกด้านบน (เช่นข้อมูลเก่าก่อนหน้านี้) ให้เติมสถานะเดิมเข้าไปเป็นตัวเลือกเพิ่ม
      // เพื่อไม่ให้ dropdown แสดงค่าผิดไปจากสถานะจริงที่บันทึกไว้
      if (!statusOptions.includes(o.status)) statusOptions.unshift(o.status);
      // สร้างตัวเลือก <option> ทั้งหมด โดยเลือกตัวที่ตรงกับสถานะปัจจุบันของออเดอร์ไว้ก่อน
      const optionsHTML = statusOptions
        .map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`)
        .join('');
      return `
    <tr>
      <td>${o.id}</td>
      <td>${o.customerName}<br /><small>${o.address}</small></td>
      <td>${o.phone}</td>
      <td>${o.items.map((i) => `${i.name} (ไซส์ ${i.size}) x${i.qty}`).join('<br />')}</td>
      <td>${formatPrice(o.total)}</td>
      <td>${formatPaymentMethod(o.paymentMethod)}</td>
      <td>
        <!-- ดรอปดาวน์เปลี่ยนสถานะออเดอร์ เปลี่ยนตัวเลือกแล้วจะยิง API อัปเดตสถานะทันที (ดู event listener ด้านล่าง) -->
        <select class="order-status-select" data-id="${o.id}">${optionsHTML}</select>
      </td>
      <td>${new Date(o.createdAt).toLocaleString('th-TH')}</td>
    </tr>
  `;
    })
    .join(''); // รวม HTML ทุกแถวเป็นข้อความเดียว แล้วใส่ลงในตาราง

  // ผูก event ให้ทุกดรอปดาวน์สถานะที่เพิ่งวาดใหม่ เมื่อเปลี่ยนตัวเลือกให้ยิง API อัปเดตสถานะทันที
  orderTableBody.querySelectorAll('.order-status-select').forEach((select) => {
    select.addEventListener('change', async () => {
      // อ้างอิงรหัสออเดอร์จาก data-id และสถานะใหม่ที่เพิ่งเลือก
      const orderId = select.dataset.id;
      const newStatus = select.value;
      // ใช้ try/catch ดักจับข้อผิดพลาดระหว่างเรียก API
      try {
        // ยิง HTTP PUT ไปที่ /api/orders/<id>/status พร้อมสถานะใหม่
        const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        // ถ้า response ไม่สำเร็จ ให้โยน error
        if (!res.ok) throw new Error('update failed');
        // อัปเดตสถานะในตัวแปร orders ที่เก็บไว้ในหน่วยความจำด้วย ให้ตรงกับที่บันทึกจริง (เผื่อมีการอ้างอิงใช้ที่อื่นต่อ)
        const order = orders.find((o) => o.id === orderId);
        if (order) order.status = newStatus;
        // แจ้งเตือนว่าอัปเดตสำเร็จ
        showToast(`อัปเดตสถานะออเดอร์เป็น "${newStatus}" เรียบร้อย`);
      } catch (err) {
        // ถ้าเกิดข้อผิดพลาด ให้แจ้งเตือนผู้ใช้ และโหลดตารางใหม่เพื่อดึงสถานะจริงกลับมาแสดง (เผื่อ dropdown ค้างค่าที่ยังไม่ถูกบันทึกจริง)
        showToast('เกิดข้อผิดพลาด กรุณาลองใหม่');
        loadOrders();
      }
    });
  });
}

// ---------- Employees ----------
// ส่วนจัดการพนักงาน: โหลด/ค้นหา/แสดง/เพิ่ม/แก้ไข/ลบ

// ฟังก์ชัน async โหลดรายการพนักงานจาก backend รับพารามิเตอร์คำค้นหาได้ (ค่าว่าง = ขอทั้งหมด)
async function loadEmployees(query = '') {
  // ถ้ามีคำค้นหา ให้แนบไปเป็น query string ?q=... (encodeURIComponent กันตัวอักษรพิเศษ/ภาษาไทยพังตอนส่งไปกับ URL)
  const url = query ? `${API_BASE}/employees?q=${encodeURIComponent(query)}` : `${API_BASE}/employees`;
  // ยิง HTTP GET ไปตาม url ที่กำหนด แล้วรอผลลัพธ์
  const res = await fetch(url);
  // แปลง response เป็น array ของพนักงาน แล้วเก็บลงตัวแปรกลาง
  employees = await res.json();
  // วาดตารางพนักงานใหม่ตามข้อมูลที่เพิ่งโหลดมา
  renderEmployeeTable();
}

// ฟังก์ชันวาด (render) ตารางแสดงรายการพนักงาน
function renderEmployeeTable() {
  // ถ้าไม่มีพนักงานที่ตรงกับเงื่อนไข (หรือยังไม่มีพนักงานเลย)
  if (employees.length === 0) {
    // แสดงข้อความแจ้งว่าไม่พบข้อมูล (ครอบคลุม 4 คอลัมน์)
    employeeTableBody.innerHTML = '<tr><td colspan="4">ไม่พบข้อมูลพนักงาน</td></tr>';
    return; // ออกจากฟังก์ชันทันที
  }
  // วนสร้างแถวตาราง (tr) สำหรับพนักงานแต่ละคน แล้วรวมเป็นข้อความเดียว
  employeeTableBody.innerHTML = employees
    .map(
      (emp) => `
    <tr>
      <td>${emp.id}</td>
      <td>${emp.name}</td>
      <td>${emp.phone || '-'}</td>
      <td>
        <button class="btn-icon" data-action="edit" data-id="${emp.id}">แก้ไข</button>
        <button class="btn-icon danger" data-action="delete" data-id="${emp.id}">ลบ</button>
      </td>
    </tr>
  `
    )
    .join(''); // รวม HTML ทุกแถวเป็นข้อความเดียว แล้วใส่ลงในตาราง

  // ผูก event คลิกให้กับปุ่ม "แก้ไข" และ "ลบ" ทุกปุ่มที่เพิ่งวาดใหม่
  employeeTableBody.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      // หาข้อมูลพนักงานที่ตรงกับรหัสของปุ่มที่ถูกคลิก
      const employee = employees.find((e) => e.id === btn.dataset.id);
      // ถ้าเป็นปุ่ม "แก้ไข" ให้เปิด modal พร้อมข้อมูลพนักงานเดิม
      if (btn.dataset.action === 'edit') openEmployeeModal(employee);
      // ถ้าเป็นปุ่ม "ลบ" ให้เรียกฟังก์ชันลบพนักงาน
      if (btn.dataset.action === 'delete') deleteEmployee(employee);
    });
  });
}

// ฟังก์ชันเปิด modal สำหรับเพิ่มพนักงานใหม่ หรือแก้ไขพนักงานเดิม
// ถ้าไม่ส่ง employee มา (ค่า default เป็น null) หมายถึงกำลังจะ "เพิ่มพนักงานใหม่"
function openEmployeeModal(employee = null) {
  // ล้างค่าทั้งหมดในฟอร์มก่อน (เคลียร์ข้อมูลเก่าที่อาจค้างอยู่)
  employeeForm.reset();
  // เปลี่ยนหัวข้อ modal ตามโหมด (แก้ไข หรือ เพิ่มใหม่)
  employeeModalTitle.textContent = employee ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงานใหม่';
  // อ้างอิงช่องกรอกรหัสพนักงาน
  const idInput = document.getElementById('employeeId');
  // เติมค่ารหัสพนักงานเดิม (ถ้าเป็นการแก้ไข) หรือเว้นว่างไว้ (ถ้าเพิ่มใหม่)
  idInput.value = employee?.id || '';
  // ตอนแก้ไขพนักงาน ห้ามเปลี่ยนรหัสพนักงาน เพราะใช้เป็นตัวอ้างอิงหลักของระบบ จึงปิดการแก้ไขช่องนี้ไว้ (disabled)
  // ค่า disabled นี้ยังใช้เป็นตัวบอกภายหลังด้วยว่ากำลังอยู่โหมด "แก้ไข" หรือ "เพิ่มใหม่"
  idInput.disabled = !!employee;
  // เติมค่าชื่อ-สกุลลงในช่องกรอก
  document.getElementById('employeeName').value = employee?.name || '';
  // เติมค่าเบอร์โทรลงในช่องกรอก
  document.getElementById('employeePhone').value = employee?.phone || '';
  // เพิ่ม class "open" ให้กับ modal เพื่อแสดงหน้าต่างขึ้นมา
  employeeModal.classList.add('open');
}

// ผูก event ให้กับปุ่ม "+ เพิ่มพนักงานใหม่" เมื่อคลิกให้เปิด modal แบบไม่ส่งพนักงานเดิม (โหมดเพิ่มใหม่)
document.getElementById('addEmployeeBtn').addEventListener('click', () => openEmployeeModal());
// ผูก event ให้กับปุ่มกากบาทปิด modal พนักงาน
document.getElementById('closeEmployeeModal').addEventListener('click', () => {
  employeeModal.classList.remove('open');
});
// ผูก event คลิกที่พื้นหลังมืดรอบ modal ถ้าคลิกตรงพื้นหลัง (ไม่ใช่ในกล่อง) ให้ปิด modal ด้วย
employeeModal.addEventListener('click', (e) => {
  if (e.target === employeeModal) employeeModal.classList.remove('open');
});

// ผูก event เมื่อผู้ใช้กดปุ่ม "บันทึกข้อมูลพนักงาน" (submit ฟอร์ม)
employeeForm.addEventListener('submit', async (e) => {
  // ป้องกันเบราว์เซอร์รีโหลดหน้าตามพฤติกรรมปกติของฟอร์ม
  e.preventDefault();
  // อ้างอิงช่องกรอกรหัสพนักงานอีกครั้ง
  const idInput = document.getElementById('employeeId');
  // ถ้าช่องรหัสพนักงานถูกปิดการแก้ไขไว้ (disabled) แปลว่ากำลังแก้ไขพนักงานเดิมอยู่ ไม่ใช่เพิ่มใหม่
  const isEdit = idInput.disabled;
  // อ่านค่ารหัสพนักงาน (อ่านค่าได้ปกติแม้ input จะถูก disabled ไว้ก็ตาม)
  const id = idInput.value.trim();
  // รวบรวมค่าจากทุกช่องกรอกในฟอร์ม สร้างเป็น object ที่จะส่งไปให้ backend
  const payload = {
    id,
    name: document.getElementById('employeeName').value.trim(),
    phone: document.getElementById('employeePhone').value.trim(),
  };

  // ใช้ try/catch ดักจับข้อผิดพลาดระหว่างเรียก API
  try {
    // ถ้าเป็นโหมดแก้ไข ให้ยิงไปที่ /api/employees/<id> ด้วย method PUT
    // ถ้าเป็นโหมดเพิ่มใหม่ ให้ยิงไปที่ /api/employees ด้วย method POST
    const res = await fetch(`${API_BASE}/employees${isEdit ? '/' + id : ''}`, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // แปลง response เป็น object ไว้ก่อน เผื่อต้องใช้ข้อความ error จาก backend (เช่น รหัสพนักงานซ้ำ)
    const data = await res.json();
    // ถ้า response ไม่สำเร็จ ให้โยน error พร้อมข้อความจาก backend (หรือข้อความ default ถ้าไม่มี)
    if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
    // ปิด modal เพราะบันทึกสำเร็จแล้ว
    employeeModal.classList.remove('open');
    // แสดงข้อความแจ้งเตือนความสำเร็จ (ข้อความต่างกันตามว่าเป็นการแก้ไขหรือเพิ่มใหม่)
    showToast(isEdit ? 'แก้ไขข้อมูลพนักงานเรียบร้อย' : 'เพิ่มพนักงานเรียบร้อย');
    // โหลดรายการพนักงานใหม่ (คงคำค้นหาเดิมไว้ ถ้ามีการค้นหาอยู่ก่อนหน้า)
    loadEmployees(employeeSearchInput.value.trim());
  } catch (err) {
    // ถ้าเกิดข้อผิดพลาด ให้แจ้งเตือนผู้ใช้ด้วยข้อความ error จริง (เช่น "รหัสพนักงานนี้มีอยู่แล้ว")
    showToast(err.message);
  }
});

// ฟังก์ชัน async สำหรับลบพนักงาน รับพารามิเตอร์เป็น object พนักงานที่ต้องการลบ
async function deleteEmployee(employee) {
  // แสดงกล่องยืนยันก่อนลบจริง ถ้าผู้ใช้กด "ยกเลิก" ให้หยุดทำงานทันที
  if (!confirm(`ต้องการลบพนักงาน "${employee.name}" (${employee.id}) ใช่หรือไม่?`)) return;
  // ใช้ try/catch ดักจับข้อผิดพลาดระหว่างเรียก API
  try {
    // ยิง HTTP DELETE ไปที่ /api/employees/<id> ของพนักงานที่ต้องการลบ
    const res = await fetch(`${API_BASE}/employees/${employee.id}`, { method: 'DELETE' });
    // ถ้า response ไม่สำเร็จ ให้โยน error
    if (!res.ok) throw new Error('delete failed');
    // แจ้งเตือนว่าลบสำเร็จ
    showToast('ลบพนักงานเรียบร้อย');
    // โหลดรายการพนักงานใหม่ (คงคำค้นหาเดิมไว้ ถ้ามี)
    loadEmployees(employeeSearchInput.value.trim());
  } catch (err) {
    // ถ้าเกิดข้อผิดพลาด ให้แจ้งเตือนผู้ใช้
    showToast('เกิดข้อผิดพลาด กรุณาลองใหม่');
  }
}

// ผูก event ให้ค้นหาแบบ real-time ทุกครั้งที่ผู้ใช้พิมพ์ในช่องค้นหาพนักงาน (ค้นจากรหัสพนักงานหรือชื่อ-สกุล)
employeeSearchInput.addEventListener('input', () => {
  loadEmployees(employeeSearchInput.value.trim());
});

// ---------- POS (ขายหน้าร้าน / รับชำระเงิน) ----------
// ส่วนสำหรับพนักงาน: เลือกรองเท้าที่จะขาย คำนวณยอดชำระ+เงินทอน แล้วบันทึกรายการขายจริง

// ฟังก์ชันเติมตัวเลือกพนักงานทั้งหมดลงในดรอปดาวน์ "พนักงานผู้ขาย"
function populatePosEmployeeSelect() {
  // ถ้าไม่มีพนักงานในระบบเลย ให้แสดงข้อความเตือนแทนตัวเลือก
  posEmployeeSelect.innerHTML = employees.length
    ? employees.map((e) => `<option value="${e.id}">${e.id} - ${e.name}</option>`).join('')
    : '<option value="">-- ยังไม่มีพนักงานในระบบ --</option>';
}

// ฟังก์ชันเติมตัวเลือกสินค้าลงในดรอปดาวน์ "รองเท้า" (แสดงเฉพาะสินค้าที่ยังมีสต็อกเหลือ)
function populatePosProductSelect() {
  // กรองเอาเฉพาะสินค้าที่สต็อกมากกว่า 0 เพราะสินค้าหมดแล้วไม่ควรเลือกมาขายซ้ำ
  const available = products.filter((p) => p.stock > 0);
  posProductSelect.innerHTML = available.length
    ? available
        .map((p) => `<option value="${p.id}">${p.brand} ${p.name} (คงเหลือ ${p.stock})</option>`)
        .join('')
    : '<option value="">-- ไม่มีสินค้าคงเหลือ --</option>';
  // เติมตัวเลือกไซส์ให้ตรงกับสินค้าตัวแรกที่ถูกเลือกไว้อัตโนมัติ
  populatePosSizeSelect();
}

// ฟังก์ชันเติมตัวเลือกไซส์ลงในดรอปดาวน์ "ไซส์" ตามสินค้าที่กำลังถูกเลือกอยู่ในดรอปดาวน์ "รองเท้า"
function populatePosSizeSelect() {
  // หาข้อมูลสินค้าที่ตรงกับตัวเลือกปัจจุบันของดรอปดาวน์สินค้า
  const product = products.find((p) => p.id === posProductSelect.value);
  // ถ้าเจอสินค้า ให้เติมไซส์ทั้งหมดของสินค้านั้น ถ้าไม่เจอ (เช่นไม่มีสินค้าเหลือเลย) ให้เว้นว่างไว้
  posSizeSelect.innerHTML = product
    ? product.sizes.map((s) => `<option value="${s}">${s}</option>`).join('')
    : '';
}

// เมื่อผู้ใช้เปลี่ยนสินค้าที่เลือกในดรอปดาวน์ "รองเท้า" ให้เติมไซส์ใหม่ให้ตรงกับสินค้าตัวนั้น
posProductSelect.addEventListener('change', populatePosSizeSelect);

// ผูก event ให้ปุ่ม "+ เพิ่มรายการ" นำสินค้า+ไซส์+จำนวนที่เลือกไว้ ใส่ลงในตะกร้าขายรอบนี้
posAddItemBtn.addEventListener('click', () => {
  // หาข้อมูลสินค้าที่กำลังถูกเลือกอยู่
  const product = products.find((p) => p.id === posProductSelect.value);
  // ถ้าไม่มีสินค้าให้เลือก (เช่นสต็อกหมดทั้งร้าน) ให้แจ้งเตือนแล้วหยุด
  if (!product) {
    showToast('กรุณาเลือกรองเท้าก่อน');
    return;
  }
  // แปลงไซส์ที่เลือกเป็นตัวเลข
  const size = Number(posSizeSelect.value);
  // แปลงจำนวนที่กรอกเป็นตัวเลข ถ้ากรอกไม่ถูกต้องให้ default เป็น 1
  const qty = Number(posQtyInput.value) || 1;
  // ป้องกันการกรอกจำนวนที่น้อยกว่า 1
  if (qty < 1) {
    showToast('กรุณาระบุจำนวนอย่างน้อย 1');
    return;
  }

  // ตรวจสอบว่าสินค้า+ไซส์เดียวกันนี้มีอยู่ในตะกร้าแล้วหรือไม่ (ถ้ามี จะรวมจำนวนเข้าด้วยกันแทนการเพิ่มแถวใหม่)
  const existing = posCart.find((i) => i.productId === product.id && i.size === size);
  // จำนวนที่มีอยู่แล้วในตะกร้า (0 ถ้ายังไม่เคยเพิ่ม)
  const currentQtyInCart = existing ? existing.qty : 0;
  // ตรวจสอบว่าจำนวนรวม (ที่มีอยู่แล้ว + ที่กำลังจะเพิ่ม) เกินสต็อกจริงหรือไม่ ป้องกันขายเกินของที่มี
  if (currentQtyInCart + qty > product.stock) {
    showToast(`สต็อก ${product.name} เหลือเพียง ${product.stock} คู่`);
    return;
  }

  // ถ้ามีรายการเดิมอยู่แล้ว ให้บวกจำนวนเพิ่มเข้าไป
  if (existing) {
    existing.qty += qty;
  } else {
    // ถ้ายังไม่มี ให้เพิ่มเป็นรายการใหม่เข้าไปในตะกร้า
    posCart.push({ productId: product.id, name: product.name, price: product.price, size, qty });
  }
  // วาดตะกร้าขายใหม่ให้แสดงรายการล่าสุด
  renderPosCart();
  // แจ้งเตือนว่าเพิ่มรายการสำเร็จ
  showToast('เพิ่มรายการแล้ว');
});

// ฟังก์ชันวาด (render) ตารางแสดงรายการสินค้าที่อยู่ในตะกร้าขายรอบนี้
function renderPosCart() {
  // ถ้ายังไม่มีรายการในตะกร้าเลย
  if (posCart.length === 0) {
    // แสดงข้อความแจ้งเตือนแทนตาราง (ครอบคลุม 6 คอลัมน์)
    posCartBody.innerHTML =
      '<tr><td colspan="6">ยังไม่มีรายการ กรุณาเลือกรองเท้าด้านบนแล้วกด "+ เพิ่มรายการ"</td></tr>';
  } else {
    // วนสร้างแถวตาราง (tr) สำหรับสินค้าแต่ละชิ้นในตะกร้า พร้อมเลข index (ตำแหน่งใน array) ไว้ใช้ตอนลบ
    posCartBody.innerHTML = posCart
      .map(
        (item, index) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.size}</td>
        <td>${formatPrice(item.price)}</td>
        <td>${item.qty}</td>
        <td>${formatPrice(item.price * item.qty)}</td>
        <td><button class="btn-icon danger" data-index="${index}">ลบ</button></td>
      </tr>
    `
      )
      .join('');
    // ผูก event คลิกให้กับปุ่ม "ลบ" ทุกปุ่มที่เพิ่งวาดใหม่
    posCartBody.querySelectorAll('button[data-index]').forEach((btn) => {
      btn.addEventListener('click', () => {
        // ลบรายการออกจากตะกร้าตามตำแหน่ง (index) ที่เก็บไว้ในปุ่ม
        posCart.splice(Number(btn.dataset.index), 1);
        // วาดตะกร้าใหม่อีกครั้งหลังลบ
        renderPosCart();
      });
    });
  }
  // อัปเดตยอดรวม/เงินทอน ทุกครั้งที่ตะกร้ามีการเปลี่ยนแปลง
  updatePosTotals();
}

// ฟังก์ชันคำนวณยอดรวมราคาสินค้าทั้งหมดในตะกร้าขายรอบนี้
function posCartTotal() {
  // ใช้ reduce วนคูณราคา x จำนวน ของแต่ละรายการ แล้วรวมกัน เริ่มจาก 0
  return posCart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

// ฟังก์ชันอัปเดตยอดชำระรวมและเงินทอนที่แสดงบนหน้าจอ
function updatePosTotals() {
  // คำนวณยอดชำระรวมจากตะกร้าปัจจุบัน
  const total = posCartTotal();
  // แสดงยอดชำระรวมในรูปแบบสกุลเงินบาท
  posTotal.textContent = formatPrice(total);
  // อ่านจำนวนเงินที่พนักงานกรอกว่าได้รับจากลูกค้า (ถ้ายังไม่กรอกหรือกรอกไม่ถูกต้อง ให้ถือเป็น 0)
  const received = Number(posAmountReceived.value) || 0;
  // คำนวณเงินทอน = เงินที่ได้รับ - ยอดชำระรวม
  const change = received - total;
  // แสดงเงินทอน โดยถ้าติดลบ (จ่ายเงินไม่พอ) ให้แสดงเป็น 0 แทนเลขติดลบที่สร้างความสับสน
  posChange.textContent = formatPrice(change < 0 ? 0 : change);
  // ถ้าจ่ายเงินไม่พอ (change ติดลบ) ให้เปลี่ยนสีตัวเลขเงินทอนเป็นสีแดงเพื่อเตือนพนักงาน
  posChange.style.color = change < 0 ? '#e5484d' : '';
}

// เมื่อพนักงานพิมพ์จำนวนเงินที่ได้รับจากลูกค้า ให้คำนวณเงินทอนใหม่ทันที (real-time)
posAmountReceived.addEventListener('input', updatePosTotals);

// ผูก event ให้ปุ่ม "บันทึกการชำระเงิน" ส่งข้อมูลการขายไปบันทึกที่ backend จริง
posSaveBtn.addEventListener('click', async () => {
  // ตรวจสอบว่าเลือกพนักงานผู้ขายแล้วหรือยัง
  if (!posEmployeeSelect.value) {
    showToast('กรุณาเลือกพนักงานผู้ขาย');
    return;
  }
  // ตรวจสอบว่ามีรายการสินค้าในตะกร้าอย่างน้อย 1 ชิ้นแล้วหรือยัง
  if (posCart.length === 0) {
    showToast('กรุณาเพิ่มรายการรองเท้าก่อน');
    return;
  }
  // คำนวณยอดชำระรวมและจำนวนเงินที่ได้รับ เพื่อตรวจสอบก่อนส่งไป backend
  const total = posCartTotal();
  const received = Number(posAmountReceived.value) || 0;
  // ตรวจสอบว่าเงินที่ได้รับต้องไม่น้อยกว่ายอดที่ต้องชำระ
  if (received < total) {
    showToast('จำนวนเงินที่ได้รับน้อยกว่ายอดที่ต้องชำระ');
    return;
  }

  // รวบรวมข้อมูลการขายที่จะส่งไปบันทึกที่ backend
  const payload = {
    employeeId: posEmployeeSelect.value,
    items: posCart.map((i) => ({ productId: i.productId, size: i.size, qty: i.qty })),
    amountReceived: received,
  };

  // ใช้ try/catch ดักจับข้อผิดพลาดระหว่างเรียก API
  try {
    // ยิง HTTP POST ไปที่ /api/sales พร้อมข้อมูลการขาย
    const res = await fetch(`${API_BASE}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // แปลง response เป็น object ไว้ก่อน (ใช้ทั้งตอนสำเร็จเพื่อดูเงินทอน และตอนผิดพลาดเพื่อดูข้อความ error)
    const data = await res.json();
    // ถ้า response ไม่สำเร็จ (เช่น สต็อกไม่พอ) ให้โยน error พร้อมข้อความจาก backend
    if (!res.ok) throw new Error(data.error || 'บันทึกการขายไม่สำเร็จ');
    // แจ้งเตือนว่าบันทึกสำเร็จ พร้อมบอกจำนวนเงินทอนที่ต้องทอนให้ลูกค้า
    showToast(`บันทึกการขายสำเร็จ เงินทอน ${formatPrice(data.change)}`);
    // ล้างตะกร้าและช่องรับเงิน เพื่อเริ่มรายการขายรอบถัดไป
    posCart = [];
    posAmountReceived.value = '';
    renderPosCart();
    // โหลดรายการสินค้าใหม่เพื่ออัปเดตจำนวนสต็อกล่าสุด (ลดลงตามที่เพิ่งขายไป) แล้วเติมดรอปดาวน์สินค้าใน POS ใหม่
    await loadProducts();
    populatePosProductSelect();
  } catch (err) {
    // ถ้าเกิดข้อผิดพลาด ให้แจ้งเตือนผู้ใช้ด้วยข้อความ error จริง (เช่น สต็อกไม่พอ)
    showToast(err.message);
  }
});

// ---------- Report (สรุปยอดขายประจำวัน) ----------
// ส่วนแสดงและพิมพ์สรุปยอดขายของแต่ละวัน

// ฟังก์ชันคืนค่าวันที่ปัจจุบันของเครื่องผู้ใช้ในรูปแบบ YYYY-MM-DD (ตรงกับ format ที่ input type="date" ต้องการ)
function todayDateString() {
  // สร้าง object วันที่ปัจจุบัน
  const now = new Date();
  // ดึงปี ค.ศ. 4 หลัก
  const year = now.getFullYear();
  // ดึงเดือน (getMonth() นับ 0-11 จึงต้อง +1) แล้วเติม 0 ข้างหน้าให้ครบ 2 หลัก เช่น "07"
  const month = String(now.getMonth() + 1).padStart(2, '0');
  // ดึงวันที่ แล้วเติม 0 ข้างหน้าให้ครบ 2 หลักเช่นกัน
  const day = String(now.getDate()).padStart(2, '0');
  // ต่อกันเป็นรูปแบบ YYYY-MM-DD ตามที่ HTML input type="date" ต้องการ
  return `${year}-${month}-${day}`;
}

// ฟังก์ชัน async โหลดรายการขายของวันที่ระบุจาก backend มาแสดงในตารางรายงาน
async function loadReport(date) {
  // ยิง HTTP GET ไปที่ /api/sales พร้อมระบุวันที่ต้องการดูผ่าน query string
  const res = await fetch(`${API_BASE}/sales?date=${date}`);
  // แปลง response เป็น array ของรายการขาย
  const sales = await res.json();
  // วาดตารางรายงานตามข้อมูลที่เพิ่งโหลดมา
  renderReportTable(sales);
  // แสดงวันที่ที่กำลังดูอยู่บนหัวกระดาษของใบสรุป (ใช้ตอนพิมพ์ด้วย)
  document.getElementById('reportDateLabel').textContent = date;
}

// ฟังก์ชันวาด (render) ตารางรายการขาย พร้อมสรุปจำนวนบิลและยอดขายรวมทั้งวัน
function renderReportTable(sales) {
  // ถ้าไม่มีรายการขายเลยในวันที่เลือก
  if (sales.length === 0) {
    // แสดงข้อความแจ้งว่าไม่มีรายการขาย (ครอบคลุม 6 คอลัมน์)
    reportTableBody.innerHTML = '<tr><td colspan="6">ไม่มีรายการขายในวันที่เลือก</td></tr>';
  } else {
    // วนสร้างแถวตาราง (tr) สำหรับรายการขายแต่ละบิล แล้วรวมเป็นข้อความเดียว
    reportTableBody.innerHTML = sales
      .map(
        (s) => `
      <tr>
        <td>${new Date(s.createdAt).toLocaleTimeString('th-TH')}</td>
        <td>${s.employeeName}</td>
        <td>${s.items.map((i) => `${i.name} (ไซส์ ${i.size}) x${i.qty}`).join('<br />')}</td>
        <td>${formatPrice(s.amountReceived)}</td>
        <td>${formatPrice(s.change)}</td>
        <td>${formatPrice(s.total)}</td>
      </tr>
    `
      )
      .join('');
  }
  // คำนวณยอดขายรวมทั้งวัน โดยรวมยอด total ของทุกบิล
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  // แสดงจำนวนบิลทั้งหมดของวันนั้น
  document.getElementById('reportBillCount').textContent = sales.length;
  // แสดงยอดขายรวมทั้งวันในรูปแบบสกุลเงินบาท
  document.getElementById('reportTotalRevenue').textContent = formatPrice(totalRevenue);
}

// ตั้งค่าเริ่มต้นของช่องเลือกวันที่ในหน้ารายงาน ให้เป็นวันที่ปัจจุบันตอนเปิดหน้าเว็บ
reportDateInput.value = todayDateString();
// เมื่อผู้ใช้เปลี่ยนวันที่ที่เลือก ให้โหลดรายงานของวันนั้นใหม่ทันที
reportDateInput.addEventListener('change', () => loadReport(reportDateInput.value));

// ผูก event ให้ปุ่ม "พิมพ์ใบสรุปยอดขาย" เรียกฟังก์ชันสั่งพิมพ์ของเบราว์เซอร์
// เบราว์เซอร์จะเปิดหน้าต่างพิมพ์ โดยใช้กฎ CSS ใน @media print เพื่อซ่อนส่วนที่ไม่ต้องการ (เช่น แถบเมนู, ปุ่มต่าง ๆ)
document.getElementById('printReportBtn').addEventListener('click', () => window.print());

// ---------- Categories (หมวดหมู่ราคาสินค้า) ----------
// ส่วนจัดการหมวดหมู่สินค้า: โหลด/แสดง/เพิ่ม/แก้ไข/ลบ

// ฟังก์ชัน async โหลดรายการหมวดหมู่ทั้งหมดจาก backend
async function loadCategories() {
  // ยิง HTTP GET ไปที่ /api/categories แล้วรอผลลัพธ์
  const res = await fetch(`${API_BASE}/categories`);
  // แปลง response เป็น array ของหมวดหมู่ แล้วเก็บลงตัวแปรกลาง
  categories = await res.json();
  // วาดตารางหมวดหมู่ใหม่ตามข้อมูลที่เพิ่งโหลดมา
  renderCategoryTable();
  // เติมตัวเลือกหมวดหมู่ในฟอร์มเพิ่ม/แก้ไขสินค้าให้ตรงกับข้อมูลล่าสุดเสมอ (คงตัวเลือกเดิมที่เลือกอยู่ไว้ ถ้ามี)
  populateProductCategorySelect(productCategorySelect.value);
}

// ฟังก์ชันวาด (render) ตารางแสดงรายการหมวดหมู่ พร้อมจำนวนสินค้าที่อยู่ในแต่ละหมวดหมู่
function renderCategoryTable() {
  // ถ้ายังไม่มีหมวดหมู่เลย
  if (categories.length === 0) {
    // แสดงข้อความแจ้งว่ายังไม่มีหมวดหมู่ (ครอบคลุม 3 คอลัมน์)
    categoryTableBody.innerHTML = '<tr><td colspan="3">ยังไม่มีหมวดหมู่</td></tr>';
    return; // ออกจากฟังก์ชันทันที
  }
  // วนสร้างแถวตาราง (tr) สำหรับหมวดหมู่แต่ละอัน แล้วรวมเป็นข้อความเดียว
  categoryTableBody.innerHTML = categories
    .map((c) => {
      // นับจำนวนสินค้าที่ผูกอยู่กับหมวดหมู่นี้ (เทียบ categoryId ของสินค้าแต่ละชิ้น)
      const productCount = products.filter((p) => p.categoryId === c.id).length;
      return `
    <tr>
      <td>${c.name}</td>
      <td>${productCount}</td>
      <td>
        <button class="btn-icon" data-action="edit" data-id="${c.id}">แก้ไข</button>
        <button class="btn-icon danger" data-action="delete" data-id="${c.id}">ลบ</button>
      </td>
    </tr>
  `;
    })
    .join(''); // รวม HTML ทุกแถวเป็นข้อความเดียว แล้วใส่ลงในตาราง

  // ผูก event คลิกให้กับปุ่ม "แก้ไข" และ "ลบ" ทุกปุ่มที่เพิ่งวาดใหม่
  categoryTableBody.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      // หาข้อมูลหมวดหมู่ที่ตรงกับ id ของปุ่มที่ถูกคลิก
      const category = categories.find((c) => c.id === btn.dataset.id);
      // ถ้าเป็นปุ่ม "แก้ไข" ให้เปิด modal พร้อมข้อมูลหมวดหมู่เดิม
      if (btn.dataset.action === 'edit') openCategoryModal(category);
      // ถ้าเป็นปุ่ม "ลบ" ให้เรียกฟังก์ชันลบหมวดหมู่
      if (btn.dataset.action === 'delete') deleteCategory(category);
    });
  });
}

// ฟังก์ชันเปิด modal สำหรับเพิ่มหมวดหมู่ใหม่ หรือแก้ไขหมวดหมู่เดิม
function openCategoryModal(category = null) {
  // ล้างค่าทั้งหมดในฟอร์มก่อน
  categoryForm.reset();
  // เปลี่ยนหัวข้อ modal ตามโหมด (แก้ไข หรือ เพิ่มใหม่)
  categoryModalTitle.textContent = category ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่';
  // เติมค่า id ของหมวดหมู่เดิมลงในช่องซ่อน (ถ้าเป็นการแก้ไข) หรือเว้นว่างไว้ (ถ้าเพิ่มใหม่)
  document.getElementById('categoryId').value = category?.id || '';
  // เติมค่าชื่อหมวดหมู่เดิมลงในช่องกรอก
  document.getElementById('categoryName').value = category?.name || '';
  // เพิ่ม class "open" ให้กับ modal เพื่อแสดงหน้าต่างขึ้นมา
  categoryModal.classList.add('open');
}

// ผูก event ให้กับปุ่ม "+ เพิ่มหมวดหมู่ใหม่"
document.getElementById('addCategoryBtn').addEventListener('click', () => openCategoryModal());
// ผูก event ให้กับปุ่มกากบาทปิด modal หมวดหมู่
document.getElementById('closeCategoryModal').addEventListener('click', () => {
  categoryModal.classList.remove('open');
});
// ผูก event คลิกที่พื้นหลังมืดรอบ modal ถ้าคลิกตรงพื้นหลัง ให้ปิด modal ด้วย
categoryModal.addEventListener('click', (e) => {
  if (e.target === categoryModal) categoryModal.classList.remove('open');
});

// ผูก event เมื่อผู้ใช้กดปุ่ม "บันทึกหมวดหมู่" (submit ฟอร์ม)
categoryForm.addEventListener('submit', async (e) => {
  // ป้องกันเบราว์เซอร์รีโหลดหน้าตามพฤติกรรมปกติของฟอร์ม
  e.preventDefault();
  // อ่านค่า id จากช่องซ่อน เพื่อรู้ว่าเป็นการ "เพิ่มใหม่" (id ว่าง) หรือ "แก้ไข" (มี id)
  const id = document.getElementById('categoryId').value;
  // รวบรวมชื่อหมวดหมู่ที่กรอกไว้
  const payload = { name: document.getElementById('categoryName').value.trim() };

  // ใช้ try/catch ดักจับข้อผิดพลาดระหว่างเรียก API
  try {
    // ถ้ามี id (โหมดแก้ไข) ให้ยิงไปที่ /api/categories/<id> ด้วย method PUT
    // ถ้าไม่มี id (โหมดเพิ่มใหม่) ให้ยิงไปที่ /api/categories ด้วย method POST
    const res = await fetch(`${API_BASE}/categories${id ? '/' + id : ''}`, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // ถ้า response ไม่สำเร็จ ให้โยน error
    if (!res.ok) throw new Error('save failed');
    // ปิด modal เพราะบันทึกสำเร็จแล้ว
    categoryModal.classList.remove('open');
    // แสดงข้อความแจ้งเตือนความสำเร็จ
    showToast(id ? 'แก้ไขหมวดหมู่เรียบร้อย' : 'เพิ่มหมวดหมู่เรียบร้อย');
    // โหลดรายการหมวดหมู่ใหม่ทั้งหมด เพื่อให้ตารางแสดงข้อมูลล่าสุด
    loadCategories();
  } catch (err) {
    // ถ้าเกิดข้อผิดพลาด ให้แจ้งเตือนผู้ใช้
    showToast('เกิดข้อผิดพลาด กรุณาลองใหม่');
  }
});

// ฟังก์ชัน async สำหรับลบหมวดหมู่ รับพารามิเตอร์เป็น object หมวดหมู่ที่ต้องการลบ
async function deleteCategory(category) {
  // แสดงกล่องยืนยันก่อนลบจริง พร้อมอธิบายผลกระทบว่าสินค้าในหมวดหมู่นี้จะกลายเป็น "ไม่ระบุหมวดหมู่"
  if (
    !confirm(
      `ต้องการลบหมวดหมู่ "${category.name}" ใช่หรือไม่?\nสินค้าที่อยู่ในหมวดหมู่นี้จะถูกเปลี่ยนเป็น "ไม่ระบุหมวดหมู่"`
    )
  )
    return;
  // ใช้ try/catch ดักจับข้อผิดพลาดระหว่างเรียก API
  try {
    // ยิง HTTP DELETE ไปที่ /api/categories/<id> ของหมวดหมู่ที่ต้องการลบ
    const res = await fetch(`${API_BASE}/categories/${category.id}`, { method: 'DELETE' });
    // ถ้า response ไม่สำเร็จ ให้โยน error
    if (!res.ok) throw new Error('delete failed');
    // แจ้งเตือนว่าลบสำเร็จ
    showToast('ลบหมวดหมู่เรียบร้อย');
    // โหลดรายการสินค้าใหม่ด้วย เพราะ backend อาจล้าง categoryId ของสินค้าบางชิ้นที่เคยผูกกับหมวดหมู่นี้ไปแล้ว
    await loadProducts();
    // โหลดรายการหมวดหมู่ใหม่ทั้งหมด เพื่อให้ตารางไม่แสดงหมวดหมู่ที่ถูกลบไปแล้ว
    loadCategories();
  } catch (err) {
    // ถ้าเกิดข้อผิดพลาด ให้แจ้งเตือนผู้ใช้
    showToast('เกิดข้อผิดพลาด กรุณาลองใหม่');
  }
}

// ฟังก์ชันเติมตัวเลือกหมวดหมู่ทั้งหมดลงในดรอปดาวน์ของฟอร์มเพิ่ม/แก้ไขสินค้า
// รับพารามิเตอร์ selectedId เพื่อเลือกหมวดหมู่ที่ต้องการไว้ล่วงหน้า (ใช้ตอนเปิด modal แก้ไขสินค้า)
function populateProductCategorySelect(selectedId = '') {
  productCategorySelect.innerHTML =
    '<option value="">-- ไม่ระบุหมวดหมู่ --</option>' +
    categories
      .map(
        (c) => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.name}</option>`
      )
      .join('');
}

// ---------- Flash Sale ----------
// ส่วนจัดการ Flash Sale ที่หลังบ้าน: โหลด/แสดง/ตั้งค่าใหม่/แก้ไข/ยกเลิก

// ฟังก์ชัน async โหลดรายการ Flash Sale ทั้งหมดจาก backend (รวมทั้งที่กำลังลดราคาอยู่และที่หมดเวลาไปแล้ว)
async function loadFlashSales() {
  // ยิง HTTP GET ไปที่ /api/flash-sales แล้วรอผลลัพธ์ (backend แนบข้อมูลสินค้า+สถานะ active มาให้พร้อมแล้ว)
  const res = await fetch(`${API_BASE}/flash-sales`);
  // แปลง response เป็น array ของ Flash Sale แล้วเก็บลงตัวแปรกลาง
  flashSales = await res.json();
  // วาดตาราง Flash Sale ใหม่ตามข้อมูลที่เพิ่งโหลดมา
  renderFlashSaleTable();
}

// ฟังก์ชันวาด (render) ตารางแสดงรายการ Flash Sale ทั้งหมด
function renderFlashSaleTable() {
  // ถ้ายังไม่มี Flash Sale เลย
  if (flashSales.length === 0) {
    // แสดงข้อความแจ้งว่ายังไม่มี Flash Sale (ครอบคลุม 7 คอลัมน์)
    flashSaleTableBody.innerHTML = '<tr><td colspan="7">ยังไม่มี Flash Sale</td></tr>';
    return; // ออกจากฟังก์ชันทันที
  }
  // วนสร้างแถวตาราง (tr) สำหรับ Flash Sale แต่ละรายการ แล้วรวมเป็นข้อความเดียว
  flashSaleTableBody.innerHTML = flashSales
    .map(
      (s) => `
    <tr>
      <td>${s.productBrand} ${s.productName}</td>
      <td>${formatPrice(s.productPrice)}</td>
      <td>${formatPrice(s.salePrice)}</td>
      <td>${new Date(s.startAt).toLocaleString('th-TH')}</td>
      <td>${new Date(s.endAt).toLocaleString('th-TH')}</td>
      <td>
        <span class="status-badge"${
          s.isActive ? '' : ' style="background:rgba(161,161,170,0.15);color:var(--text-dim);"'
        }>${s.isActive ? 'กำลังลดราคา' : 'ไม่ได้ใช้งาน'}</span>
      </td>
      <td>
        <button class="btn-icon" data-action="edit" data-id="${s.id}">แก้ไข</button>
        <button class="btn-icon danger" data-action="delete" data-id="${s.id}">ลบ</button>
      </td>
    </tr>
  `
    )
    .join(''); // รวม HTML ทุกแถวเป็นข้อความเดียว แล้วใส่ลงในตาราง

  // ผูก event คลิกให้กับปุ่ม "แก้ไข" และ "ลบ" ทุกปุ่มที่เพิ่งวาดใหม่
  flashSaleTableBody.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      // หาข้อมูล Flash Sale ที่ตรงกับ id ของปุ่มที่ถูกคลิก
      const sale = flashSales.find((s) => s.id === btn.dataset.id);
      // ถ้าเป็นปุ่ม "แก้ไข" ให้เปิด modal พร้อมข้อมูลเดิม
      if (btn.dataset.action === 'edit') openFlashSaleModal(sale);
      // ถ้าเป็นปุ่ม "ลบ" ให้เรียกฟังก์ชันลบ Flash Sale
      if (btn.dataset.action === 'delete') deleteFlashSale(sale);
    });
  });
}

// ฟังก์ชันแปลงวันที่เวลาแบบ ISO (ที่เก็บใน backend) ให้อยู่ในรูปแบบที่ input type="datetime-local" ต้องการ (YYYY-MM-DDTHH:mm)
function toDatetimeLocalValue(isoString) {
  // แปลงข้อความ ISO เป็น object วันที่ (จะถูกแปลงเป็นเวลาท้องถิ่นของเบราว์เซอร์อัตโนมัติ)
  const d = new Date(isoString);
  // ฟังก์ชันช่วยเติม 0 ข้างหน้าตัวเลขให้ครบ 2 หลัก เช่น 7 -> "07"
  const pad = (n) => String(n).padStart(2, '0');
  // ต่อกันเป็นรูปแบบ YYYY-MM-DDTHH:mm ตามที่ HTML ต้องการ
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

// ฟังก์ชันเติมตัวเลือกสินค้าทั้งหมดลงในดรอปดาวน์ของฟอร์ม Flash Sale
// รับพารามิเตอร์ selectedId เพื่อเลือกสินค้าที่ต้องการไว้ล่วงหน้า (ใช้ตอนเปิด modal แก้ไข Flash Sale)
function populateFlashSaleProductSelect(selectedId = '') {
  // เก็บราคาปกติของสินค้าไว้ใน data-price ของแต่ละ option ด้วย เพื่อเอาไปแสดงในป้าย "ราคาปกติ" ตอนเปลี่ยนตัวเลือก
  flashSaleProductSelect.innerHTML = products
    .map(
      (p) =>
        `<option value="${p.id}" data-price="${p.price}" ${
          p.id === selectedId ? 'selected' : ''
        }>${p.brand} ${p.name}</option>`
    )
    .join('');
  // อัปเดตป้ายแสดงราคาปกติให้ตรงกับสินค้าที่ถูกเลือกอยู่ตอนนี้
  updateFlashSaleOriginalPriceLabel();
}

// ฟังก์ชันอัปเดตข้อความแสดงราคาปกติของสินค้าที่กำลังถูกเลือกอยู่ในดรอปดาวน์ของฟอร์ม Flash Sale
function updateFlashSaleOriginalPriceLabel() {
  // หา option ที่กำลังถูกเลือกอยู่ในดรอปดาวน์
  const selectedOption = flashSaleProductSelect.options[flashSaleProductSelect.selectedIndex];
  // ถ้ามี option ที่เลือกอยู่ ให้แสดงราคาที่เก็บไว้ใน data-price ถ้าไม่มี (เช่นไม่มีสินค้าเลย) ให้แสดงขีดกลาง
  flashSaleOriginalPrice.textContent = selectedOption
    ? formatPrice(Number(selectedOption.dataset.price))
    : '-';
}

// เมื่อผู้ใช้เปลี่ยนสินค้าที่เลือกในดรอปดาวน์ ให้อัปเดตป้ายราคาปกติใหม่ทันที
flashSaleProductSelect.addEventListener('change', updateFlashSaleOriginalPriceLabel);

// ฟังก์ชันเปิด modal สำหรับตั้งค่า Flash Sale ใหม่ หรือแก้ไข Flash Sale เดิม
function openFlashSaleModal(sale = null) {
  // ล้างค่าทั้งหมดในฟอร์มก่อน
  flashSaleForm.reset();
  // เปลี่ยนหัวข้อ modal ตามโหมด (แก้ไข หรือ ตั้งค่าใหม่)
  flashSaleModalTitle.textContent = sale ? 'แก้ไข Flash Sale' : 'ตั้งค่า Flash Sale ใหม่';
  // เติมค่า id ของ Flash Sale เดิมลงในช่องซ่อน (ถ้าเป็นการแก้ไข) หรือเว้นว่างไว้ (ถ้าตั้งค่าใหม่)
  document.getElementById('flashSaleId').value = sale?.id || '';
  // เติมตัวเลือกสินค้าทั้งหมดลงในดรอปดาวน์ แล้วเลือกสินค้าของ Flash Sale นี้ไว้ (ถ้าเป็นการแก้ไข)
  populateFlashSaleProductSelect(sale?.productId || '');
  // เติมค่าราคา Flash Sale เดิมลงในช่องกรอก
  document.getElementById('flashSalePrice').value = sale?.salePrice ?? '';
  // เติมค่าเวลาเริ่ม/สิ้นสุดเดิม (แปลงจาก ISO เป็นรูปแบบที่ input ต้องการ) หรือเว้นว่างไว้ถ้าเป็นการตั้งค่าใหม่
  document.getElementById('flashSaleStart').value = sale ? toDatetimeLocalValue(sale.startAt) : '';
  document.getElementById('flashSaleEnd').value = sale ? toDatetimeLocalValue(sale.endAt) : '';
  // เพิ่ม class "open" ให้กับ modal เพื่อแสดงหน้าต่างขึ้นมา
  flashSaleModal.classList.add('open');
}

// ผูก event ให้กับปุ่ม "+ ตั้งค่า Flash Sale"
document.getElementById('addFlashSaleBtn').addEventListener('click', () => openFlashSaleModal());
// ผูก event ให้กับปุ่มกากบาทปิด modal Flash Sale
document.getElementById('closeFlashSaleModal').addEventListener('click', () => {
  flashSaleModal.classList.remove('open');
});
// ผูก event คลิกที่พื้นหลังมืดรอบ modal ถ้าคลิกตรงพื้นหลัง ให้ปิด modal ด้วย
flashSaleModal.addEventListener('click', (e) => {
  if (e.target === flashSaleModal) flashSaleModal.classList.remove('open');
});

// ผูก event เมื่อผู้ใช้กดปุ่ม "บันทึก Flash Sale" (submit ฟอร์ม)
flashSaleForm.addEventListener('submit', async (e) => {
  // ป้องกันเบราว์เซอร์รีโหลดหน้าตามพฤติกรรมปกติของฟอร์ม
  e.preventDefault();
  // อ่านค่า id จากช่องซ่อน เพื่อรู้ว่าเป็นการ "ตั้งค่าใหม่" (id ว่าง) หรือ "แก้ไข" (มี id)
  const id = document.getElementById('flashSaleId').value;
  // รวบรวมค่าจากทุกช่องกรอกในฟอร์ม สร้างเป็น object ที่จะส่งไปให้ backend
  const payload = {
    productId: flashSaleProductSelect.value,
    salePrice: Number(document.getElementById('flashSalePrice').value),
    // input type="datetime-local" ให้ค่าเป็นเวลาท้องถิ่นแบบไม่มี timezone (เช่น "2026-07-20T10:00")
    // new Date(...).toISOString() แปลงให้เป็นรูปแบบ ISO มาตรฐาน (UTC) เพื่อให้ backend เก็บและเทียบเวลาได้ถูกต้องแม่นยำ
    startAt: new Date(document.getElementById('flashSaleStart').value).toISOString(),
    endAt: new Date(document.getElementById('flashSaleEnd').value).toISOString(),
  };

  // ใช้ try/catch ดักจับข้อผิดพลาดระหว่างเรียก API
  try {
    // ถ้ามี id (โหมดแก้ไข) ให้ยิงไปที่ /api/flash-sales/<id> ด้วย method PUT
    // ถ้าไม่มี id (โหมดตั้งค่าใหม่) ให้ยิงไปที่ /api/flash-sales ด้วย method POST
    const res = await fetch(`${API_BASE}/flash-sales${id ? '/' + id : ''}`, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // แปลง response เป็น object ไว้ก่อน เผื่อต้องใช้ข้อความ error จาก backend (เช่น ราคาลดต้องถูกกว่าราคาปกติ)
    const data = await res.json();
    // ถ้า response ไม่สำเร็จ ให้โยน error พร้อมข้อความจาก backend
    if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
    // ปิด modal เพราะบันทึกสำเร็จแล้ว
    flashSaleModal.classList.remove('open');
    // แสดงข้อความแจ้งเตือนความสำเร็จ
    showToast(id ? 'แก้ไข Flash Sale เรียบร้อย' : 'ตั้งค่า Flash Sale เรียบร้อย');
    // โหลดรายการ Flash Sale ใหม่ทั้งหมด เพื่อให้ตารางแสดงข้อมูลล่าสุด
    loadFlashSales();
  } catch (err) {
    // ถ้าเกิดข้อผิดพลาด ให้แจ้งเตือนผู้ใช้ด้วยข้อความ error จริง (เช่น ราคาลดต้องน้อยกว่าราคาปกติ)
    showToast(err.message);
  }
});

// ฟังก์ชัน async สำหรับยกเลิก/ลบ Flash Sale รับพารามิเตอร์เป็น object Flash Sale ที่ต้องการลบ
async function deleteFlashSale(sale) {
  // แสดงกล่องยืนยันก่อนลบจริง
  if (!confirm(`ต้องการยกเลิก Flash Sale ของ "${sale.productName}" ใช่หรือไม่?`)) return;
  // ใช้ try/catch ดักจับข้อผิดพลาดระหว่างเรียก API
  try {
    // ยิง HTTP DELETE ไปที่ /api/flash-sales/<id> ของรายการที่ต้องการลบ
    const res = await fetch(`${API_BASE}/flash-sales/${sale.id}`, { method: 'DELETE' });
    // ถ้า response ไม่สำเร็จ ให้โยน error
    if (!res.ok) throw new Error('delete failed');
    // แจ้งเตือนว่ายกเลิกสำเร็จ
    showToast('ยกเลิก Flash Sale เรียบร้อย');
    // โหลดรายการ Flash Sale ใหม่ทั้งหมด เพื่อให้ตารางไม่แสดงรายการที่ถูกลบไปแล้ว
    loadFlashSales();
  } catch (err) {
    // ถ้าเกิดข้อผิดพลาด ให้แจ้งเตือนผู้ใช้
    showToast('เกิดข้อผิดพลาด กรุณาลองใหม่');
  }
}

// ผูก event ให้ปุ่ม "ออกจากระบบ" ยิงไปทำลาย session ที่ backend แล้วพากลับไปหน้า login
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
  window.location.href = 'login.html';
});

// เรียกโหลดข้อมูลเริ่มต้นทั้งหมดตามลำดับที่เหมาะสมทันทีที่ไฟล์นี้ถูกโหลด
// ใช้ async IIFE (ฟังก์ชันไม่มีชื่อที่ประกาศแล้วเรียกใช้ตัวเองทันที) เพื่อให้ใช้ await เรียงลำดับการโหลดได้
(async () => {
  // เช็คสถานะล็อกอินก่อนเป็นอันดับแรก ถ้ายังไม่ได้ล็อกอิน checkAuth() จะเด้งไปหน้า login และคืนค่า false ให้หยุดทำงานทันที ไม่โหลดข้อมูลใด ๆ ต่อ
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) return;

  // โหลดหมวดหมู่ก่อน เพราะตารางสินค้าต้องใช้ชื่อหมวดหมู่มาแสดงในคอลัมน์ "หมวดหมู่"
  await loadCategories();
  // โหลดสินค้าต่อ เพื่อแสดงตารางสินค้าตั้งแต่เปิดหน้ามา (ตอนนี้มีชื่อหมวดหมู่ให้แสดงแล้ว)
  await loadProducts();
  // โหลดข้อมูลคำสั่งซื้อ เพื่อแสดงตารางคำสั่งซื้อตั้งแต่เปิดหน้ามาเช่นกัน
  loadOrders();
  // โหลดข้อมูลพนักงาน เพื่อให้ตารางพนักงาน (และตัวเลือกใน POS) พร้อมใช้งานตั้งแต่เปิดหน้ามา
  loadEmployees();
  // โหลดสรุปยอดขายของวันปัจจุบัน เพื่อให้แท็บรายงานพร้อมแสดงผลตั้งแต่เปิดหน้ามา
  loadReport(reportDateInput.value);
  // โหลด Flash Sale ทั้งหมด เพื่อให้แท็บ Flash Sale พร้อมแสดงผลตั้งแต่เปิดหน้ามา
  loadFlashSales();
})();
