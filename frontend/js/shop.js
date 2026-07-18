// ตัวแปรเก็บสินค้าทั้งหมดที่โหลดมาจาก API (เก็บไว้ในหน่วยความจำ เพื่อใช้กรอง/เรียงโดยไม่ต้องยิง API ซ้ำ)
let allProducts = [];
// ตัวแปรเก็บหมวดหมู่ทั้งหมดที่โหลดมาจาก API (ใช้เติม dropdown กรองหมวดหมู่)
let allCategories = [];
// ตัวแปรเก็บรายการ Flash Sale ที่กำลังลดราคาอยู่ตอนนี้ ที่โหลดมาจาก API
let activeFlashSales = [];
// ตัวแปรเก็บไซส์ที่ผู้ใช้เลือกไว้ในหน้าต่าง (modal) เลือกไซส์
let selectedSize = null;
// ตัวแปรเก็บสินค้าที่กำลังถูกเลือกอยู่ตอนเปิด modal (สินค้าที่กำลังจะเพิ่มลงตะกร้า)
let activeProduct = null;
// ตัวแปรเก็บข้อมูล Flash Sale ที่กำลังถูกเลือกอยู่ตอนเปิด modal (เป็น null ถ้าเปิด modal จากการ์ดสินค้าปกติ ไม่ใช่การ์ด Flash Sale)
let activeFlashSale = null;

// อ้างอิง element ที่ใช้แสดงตารางสินค้าทั้งหมด
const productGrid = document.getElementById('productGrid');
// อ้างอิง element ช่องค้นหาสินค้า
const searchInput = document.getElementById('searchInput');
// อ้างอิง element dropdown เลือกกรองตามแบรนด์
const brandFilter = document.getElementById('brandFilter');
// อ้างอิง element dropdown เลือกกรองตามหมวดหมู่ราคา
const categoryFilter = document.getElementById('categoryFilter');
// อ้างอิง element dropdown เลือกการเรียงลำดับ (ราคา น้อย->มาก / มาก->น้อย)
const sortFilter = document.getElementById('sortFilter');
// อ้างอิง element กล่อง modal สำหรับเลือกไซส์
const sizeModal = document.getElementById('sizeModal');
// อ้างอิง element ที่แสดงปุ่มไซส์ทั้งหมดภายใน modal
const sizeGrid = document.getElementById('sizeGrid');
// อ้างอิง element หัวข้อชื่อสินค้าใน modal
const modalProductName = document.getElementById('modalProductName');
// อ้างอิง element ส่วน (section) ของโซน Flash Sale ทั้งหมด (ใช้ซ่อน/แสดงตามว่ามี Flash Sale ที่กำลังลดราคาอยู่หรือไม่)
const flashSaleSection = document.getElementById('flashSaleSection');
// อ้างอิง element กล่อง grid ที่ใช้แสดงการ์ด Flash Sale
const flashSaleGrid = document.getElementById('flashSaleGrid');

// ฟังก์ชัน async สำหรับโหลดรายการสินค้าจาก backend API
async function loadProducts() {
  // ใช้ try/catch ดักจับข้อผิดพลาด เช่น กรณีเซิร์ฟเวอร์ล่มหรือเน็ตหลุด
  try {
    // ยิง HTTP GET ไปที่ /api/products แล้วรอผลลัพธ์ (await หยุดรอจนกว่าจะได้คำตอบ)
    const res = await fetch(`${API_BASE}/products`);
    // แปลง response ที่ได้ (เป็น JSON string) ให้กลายเป็น array ของ object แล้วเก็บลงตัวแปรกลาง
    allProducts = await res.json();
    // เติมตัวเลือกแบรนด์ทั้งหมดลงใน dropdown filter ตามสินค้าที่โหลดมาได้
    populateBrandFilter();
    // แสดงผลสินค้าทั้งหมดลงในหน้าเว็บ
    renderProducts();
  } catch (err) {
    // ถ้าเกิดข้อผิดพลาดระหว่างโหลด ให้แสดงข้อความแจ้งเตือนแทนตารางสินค้า
    productGrid.innerHTML = '<p>ไม่สามารถโหลดสินค้าได้ กรุณาลองใหม่ภายหลัง</p>';
  }
}

// ฟังก์ชันเติมตัวเลือกแบรนด์ทั้งหมด (ไม่ซ้ำกัน) ลงใน dropdown filter แบรนด์
function populateBrandFilter() {
  // ดึงชื่อแบรนด์จากสินค้าทุกชิ้น แล้วใช้ Set() เพื่อกำจัดชื่อที่ซ้ำกันออก จากนั้นกรองค่าว่างออกด้วย filter(Boolean)
  const brands = [...new Set(allProducts.map((p) => p.brand))].filter(Boolean);
  // วนลูปแต่ละแบรนด์ เพื่อสร้าง <option> แล้วเพิ่มเข้าไปใน dropdown
  brands.forEach((b) => {
    // สร้าง element <option> ใหม่
    const opt = document.createElement('option');
    // กำหนดค่า value ของ option เป็นชื่อแบรนด์
    opt.value = b;
    // กำหนดข้อความที่แสดงให้ผู้ใช้เห็นเป็นชื่อแบรนด์เช่นกัน
    opt.textContent = b;
    // เพิ่ม option นี้เข้าไปในตัวเลือกของ dropdown brandFilter
    brandFilter.appendChild(opt);
  });
}

// ฟังก์ชัน async โหลดรายการหมวดหมู่ทั้งหมดจาก backend แล้วเติมลงใน dropdown กรองหมวดหมู่
async function loadCategories() {
  // ใช้ try/catch ดักจับข้อผิดพลาด เผื่อกรณีเซิร์ฟเวอร์ล่มหรือเน็ตหลุด (ไม่ให้หน้าเว็บพังทั้งหน้าถ้าหมวดหมู่โหลดไม่ได้)
  try {
    // ยิง HTTP GET ไปที่ /api/categories แล้วรอผลลัพธ์
    const res = await fetch(`${API_BASE}/categories`);
    // แปลง response เป็น array ของหมวดหมู่ แล้วเก็บลงตัวแปรกลาง
    allCategories = await res.json();
    // วนลูปแต่ละหมวดหมู่ เพื่อสร้าง <option> แล้วเพิ่มเข้าไปใน dropdown
    allCategories.forEach((c) => {
      const opt = document.createElement('option');
      // ใช้ id ของหมวดหมู่เป็นค่า value เพื่อนำไปเทียบกับ categoryId ของสินค้าตอนกรอง
      opt.value = c.id;
      opt.textContent = c.name;
      categoryFilter.appendChild(opt);
    });
  } catch (err) {
    // ถ้าโหลดหมวดหมู่ไม่สำเร็จ ปล่อยให้ dropdown เหลือแค่ตัวเลือก "ทุกหมวดหมู่" ไปก่อน ไม่ต้องหยุดการทำงานของหน้าเว็บ
  }
}

// ฟังก์ชันคำนวณรายการสินค้าที่ผ่านการค้นหา/กรอง/เรียงลำดับ ตามค่าปัจจุบันของ input ต่าง ๆ
function getFilteredProducts() {
  // คัดลอก array สินค้าทั้งหมดมาไว้ในตัวแปรใหม่ (ไม่แก้ของเดิม)
  let list = [...allProducts];
  // ดึงข้อความค้นหาจากช่อง search พร้อมตัดช่องว่างหัวท้ายและแปลงเป็นตัวพิมพ์เล็ก
  const q = searchInput.value.trim().toLowerCase();
  // ถ้ามีการพิมพ์คำค้นหา
  if (q) {
    // กรองสินค้าที่ชื่อหรือแบรนด์ (แปลงเป็นตัวพิมพ์เล็กเช่นกัน) มีคำค้นหานี้อยู่
    list = list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
    );
  }
  // ถ้ามีการเลือกแบรนด์ใน dropdown (ไม่ใช่ค่าว่าง "ทุกแบรนด์")
  if (brandFilter.value) {
    // กรองเฉพาะสินค้าที่แบรนด์ตรงกับที่เลือก
    list = list.filter((p) => p.brand === brandFilter.value);
  }
  // ถ้ามีการเลือกหมวดหมู่ใน dropdown (ไม่ใช่ค่าว่าง "ทุกหมวดหมู่")
  if (categoryFilter.value) {
    // กรองเฉพาะสินค้าที่หมวดหมู่ตรงกับที่เลือก
    list = list.filter((p) => p.categoryId === categoryFilter.value);
  }
  // ถ้าเลือกเรียงลำดับราคาน้อยไปมาก
  if (sortFilter.value === 'price-asc') {
    // เรียง array โดยเปรียบเทียบราคา a ลบ b (ผลลัพธ์ติดลบ = a มาก่อน)
    list.sort((a, b) => a.price - b.price);
  } else if (sortFilter.value === 'price-desc') {
    // เรียงลำดับราคามากไปน้อย (สลับด้าน b ลบ a)
    list.sort((a, b) => b.price - a.price);
  }
  // คืนค่ารายการสินค้าที่ผ่านการกรอง/เรียงแล้ว
  return list;
}

// ฟังก์ชันวาด (render) การ์ดสินค้าทั้งหมดลงในหน้าเว็บ
function renderProducts() {
  // เรียกฟังก์ชันกรองสินค้ามาก่อน เพื่อรู้ว่าจะแสดงสินค้าตัวไหนบ้าง
  const list = getFilteredProducts();
  // ถ้าไม่มีสินค้าที่ตรงกับเงื่อนไขเลย
  if (list.length === 0) {
    // แสดงข้อความแจ้งว่าไม่พบสินค้า แทนตารางการ์ด
    productGrid.innerHTML = '<p>ไม่พบสินค้าที่ค้นหา</p>';
    return; // ออกจากฟังก์ชันทันที ไม่ทำโค้ดด้านล่างต่อ
  }
  // วนลูปสร้าง HTML การ์ดของสินค้าแต่ละชิ้น แล้วรวมเป็นข้อความเดียวด้วย join('')
  productGrid.innerHTML = list
    .map((p) => {
      // ตรวจสอบว่าสินค้าชิ้นนี้กำลังมี Flash Sale ที่ active อยู่ตอนนี้หรือไม่ (เทียบ productId กับรายการที่โหลดมาจาก /api/flash-sales/active)
      const sale = activeFlashSales.find((s) => s.productId === p.id);
      // ถ้ามี Flash Sale ให้เติม class "flash-card" เพิ่ม เพื่อให้การ์ดมีขอบสีเน้นเด่นกว่าปกติ
      const cardClass = sale ? 'product-card flash-card' : 'product-card';
      // สร้างส่วนแสดงราคา: ถ้ามี Flash Sale ให้โชว์ราคาปกติขีดฆ่า + ราคาลด + ป้ายเปอร์เซ็นต์ส่วนลด + ตัวนับถอยหลัง
      // ถ้าไม่มี Flash Sale ให้โชว์ราคาปกติตามเดิม
      const priceBlock = sale
        ? `
        <div class="flash-price-row">
          <span class="price-strike">${formatPrice(p.price)}</span>
          <span class="price flash-price">${formatPrice(sale.salePrice)}</span>
          <span class="discount-badge">-${Math.round((1 - sale.salePrice / p.price) * 100)}%</span>
        </div>
        <span class="flash-countdown" data-end="${sale.endAt}">กำลังคำนวณเวลา...</span>`
        : `<span class="price">${formatPrice(p.price)}</span>`;
      return `
    <div class="${cardClass}">
      <div class="img-wrap"><img src="${p.image}" alt="${p.name}" loading="lazy" /></div>
      <div class="info">
        <span class="brand">${p.brand}</span>
        <span class="name">${p.name}</span>
        <span class="stock">คงเหลือ ${p.stock} คู่</span>
        ${priceBlock}
        <button class="btn btn-block" data-id="${p.id}" ${sale ? `data-flash-id="${sale.id}"` : ''} ${
        p.stock === 0 ? 'disabled' : ''
      }>${p.stock === 0 ? 'สินค้าหมด' : 'เพิ่มลงตะกร้า'}</button>
      </div>
    </div>
  `;
    })
    .join(''); // นำ HTML ที่สร้างเสร็จแล้วทั้งหมดไปแทนที่เนื้อหาเดิมใน productGrid

  // หลังจากวาดปุ่ม "เพิ่มลงตะกร้า" ทุกปุ่มลงในหน้าแล้ว ต้องผูก event การคลิกใหม่ทุกครั้ง (เพราะ HTML ถูกสร้างใหม่)
  productGrid.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      // ถ้าปุ่มนี้มี data-flash-id (สินค้ากำลังลดราคาอยู่) ให้หาข้อมูล Flash Sale มาแนบไปด้วย เพื่อให้ตอนยืนยันใช้ราคาลด
      const sale = btn.dataset.flashId
        ? activeFlashSales.find((s) => s.id === btn.dataset.flashId)
        : null;
      // เปิด modal เลือกไซส์ โดยส่ง id ของสินค้าและข้อมูล Flash Sale (ถ้ามี) ไปด้วย
      openSizeModal(btn.dataset.id, sale);
    });
  });
  // อัปเดตตัวนับถอยหลังทันทีหลังวาดการ์ดเสร็จ (การ์ดที่มี Flash Sale ในตารางสินค้าทั้งหมดก็ต้องเห็นเวลานับถอยหลังทันที ไม่ต้องรอรอบ setInterval แรก)
  updateFlashCountdowns();
}

// ฟังก์ชันเปิดหน้าต่าง (modal) สำหรับเลือกไซส์ของสินค้าที่ต้องการเพิ่มลงตะกร้า
// รับพารามิเตอร์ flashSale เสริม (ค่า default เป็น null) กรณีเปิดจากการ์ด Flash Sale เพื่อให้ตอนยืนยันใช้ราคาลดแทนราคาปกติ
function openSizeModal(productId, flashSale = null) {
  // ค้นหาสินค้าที่ id ตรงกับที่ถูกคลิก แล้วเก็บไว้ในตัวแปรกลาง activeProduct
  activeProduct = allProducts.find((p) => p.id === productId);
  // ถ้าไม่เจอสินค้า (ไม่ควรเกิดขึ้น) ให้หยุดทำงาน
  if (!activeProduct) return;
  // เก็บข้อมูล Flash Sale ที่เกี่ยวข้องไว้ (หรือ null ถ้าเปิดจากการ์ดสินค้าปกติ)
  activeFlashSale = flashSale;
  // รีเซ็ตค่าไซส์ที่เคยเลือกไว้ก่อนหน้า ให้เป็นค่าว่างทุกครั้งที่เปิด modal ใหม่
  selectedSize = null;
  // เปลี่ยนหัวข้อใน modal ให้แสดงชื่อสินค้าที่กำลังเลือก (ใส่ป้าย Flash Sale กำกับถ้าเป็นการซื้อผ่านโซนลดราคา)
  modalProductName.textContent = flashSale
    ? `⚡ เลือกไซส์ - ${activeProduct.name} (Flash Sale)`
    : `เลือกไซส์ - ${activeProduct.name}`;
  // สร้างปุ่มไซส์ทั้งหมดตามข้อมูล sizes ของสินค้าชิ้นนี้
  sizeGrid.innerHTML = activeProduct.sizes
    .map((s) => `<div class="size-option" data-size="${s}">${s}</div>`)
    .join('');
  // ผูก event คลิกให้กับปุ่มไซส์ทุกปุ่มที่เพิ่งสร้าง
  sizeGrid.querySelectorAll('.size-option').forEach((el) => {
    el.addEventListener('click', () => {
      // เอา class "selected" ออกจากทุกปุ่มก่อน (เคลียร์การเลือกเดิม)
      sizeGrid.querySelectorAll('.size-option').forEach((s) => s.classList.remove('selected'));
      // ใส่ class "selected" ให้กับปุ่มที่เพิ่งถูกคลิก (ทำให้มีกรอบไฮไลต์ตาม CSS)
      el.classList.add('selected');
      // เก็บค่าไซส์ที่เลือก (แปลงจาก string เป็นตัวเลขด้วย Number())
      selectedSize = Number(el.dataset.size);
    });
  });
  // เพิ่ม class "open" ให้กับ modal เพื่อให้ CSS แสดงหน้าต่างขึ้นมา
  sizeModal.classList.add('open');
}

// ผูก event ให้กับปุ่มกากบาท (ปิด modal) เมื่อคลิกแล้วเอา class "open" ออก เพื่อซ่อน modal
document.getElementById('closeModal').addEventListener('click', () => {
  sizeModal.classList.remove('open');
});

// ผูก event คลิกที่ตัว overlay (พื้นหลังมืดรอบ modal) ถ้าคลิกตรงพื้นหลัง (ไม่ใช่ในกล่อง modal) ให้ปิดหน้าต่างด้วย
sizeModal.addEventListener('click', (e) => {
  // ตรวจสอบว่าตำแหน่งที่คลิก (e.target) คือตัว overlay เอง ไม่ใช่ลูกข้างในของมัน
  if (e.target === sizeModal) sizeModal.classList.remove('open');
});

// ผูก event ให้กับปุ่ม "เพิ่มลงตะกร้า" ที่อยู่ใน modal
document.getElementById('confirmAddToCart').addEventListener('click', () => {
  // ถ้ายังไม่มีสินค้าที่กำลังเลือกอยู่ (activeProduct ว่าง) ให้หยุดทำงาน
  if (!activeProduct) return;
  // ถ้าผู้ใช้ยังไม่ได้เลือกไซส์ ให้แจ้งเตือนแล้วหยุด ไม่เพิ่มลงตะกร้า
  if (!selectedSize) {
    showToast('กรุณาเลือกไซส์ก่อน');
    return;
  }
  // เรียกฟังก์ชัน addToCart (จาก common.js) เพื่อเพิ่มสินค้าและไซส์ที่เลือก จำนวน 1 ชิ้น ลงตะกร้า
  // ถ้าเป็นการเพิ่มจากโซน Flash Sale ให้ส่งราคาลด+id ของ Flash Sale ไปด้วย เพื่อให้ backend ตรวจสอบสิทธิ์ราคาลดอีกครั้งตอนสั่งซื้อจริง
  if (activeFlashSale) {
    addToCart(activeProduct, selectedSize, 1, {
      price: activeFlashSale.salePrice,
      flashSaleId: activeFlashSale.id,
    });
  } else {
    addToCart(activeProduct, selectedSize, 1);
  }
  // ปิด modal หลังเพิ่มสินค้าสำเร็จ
  sizeModal.classList.remove('open');
  // แสดงข้อความแจ้งเตือนว่าเพิ่มสินค้าลงตะกร้าเรียบร้อยแล้ว พร้อมชื่อสินค้าและไซส์
  showToast(`เพิ่ม ${activeProduct.name} (ไซส์ ${selectedSize}) ลงตะกร้าแล้ว`);
});

// เมื่อผู้ใช้พิมพ์ในช่องค้นหา (ทุกครั้งที่ตัวอักษรเปลี่ยน) ให้วาดรายการสินค้าใหม่ตามคำค้นหา
searchInput.addEventListener('input', renderProducts);
// เมื่อผู้ใช้เปลี่ยนตัวเลือกแบรนด์ ให้วาดรายการสินค้าใหม่ตามแบรนด์ที่เลือก
brandFilter.addEventListener('change', renderProducts);
// เมื่อผู้ใช้เปลี่ยนตัวเลือกหมวดหมู่ ให้วาดรายการสินค้าใหม่ตามหมวดหมู่ที่เลือก
categoryFilter.addEventListener('change', renderProducts);
// เมื่อผู้ใช้เปลี่ยนตัวเลือกการเรียงลำดับ ให้วาดรายการสินค้าใหม่ตามลำดับที่เลือก
sortFilter.addEventListener('change', renderProducts);

// ---------- Flash Sale ----------
// ส่วนโหลดและแสดงผลสินค้าที่กำลังลดราคาแบบ Flash Sale อยู่ตอนนี้ (ตั้งค่าไว้จากหลังบ้าน)

// ฟังก์ชัน async โหลดรายการ Flash Sale ที่กำลัง active อยู่ตอนนี้จาก backend
async function loadFlashSales() {
  // ใช้ try/catch ดักจับข้อผิดพลาด เผื่อกรณีเซิร์ฟเวอร์ล่มหรือเน็ตหลุด
  try {
    // ยิง HTTP GET ไปที่ /api/flash-sales/active ซึ่งจะคืนเฉพาะรายการที่กำลังลดราคาอยู่จริงตอนนี้ (backend กรองเวลาให้แล้ว)
    const res = await fetch(`${API_BASE}/flash-sales/active`);
    // แปลง response เป็น array ของ Flash Sale แล้วเก็บลงตัวแปรกลาง
    activeFlashSales = await res.json();
    // วาดโซน Flash Sale ใหม่ตามข้อมูลที่เพิ่งโหลดมา
    renderFlashSales();
    // วาดตารางสินค้าทั้งหมดใหม่ด้วย เพราะการ์ดในตาราง "สินค้าทั้งหมด" ก็ต้องอัปเดตราคา/ป้ายลดราคาให้ตรงกับ Flash Sale ล่าสุดเช่นกัน
    renderProducts();
  } catch (err) {
    // ถ้าโหลดไม่สำเร็จ ให้ซ่อนโซน Flash Sale ไปเลย ไม่ต้องหยุดการทำงานของหน้าเว็บส่วนอื่น
    flashSaleSection.style.display = 'none';
  }
}

// ฟังก์ชันวาด (render) การ์ด Flash Sale ทั้งหมดลงในหน้าเว็บ
function renderFlashSales() {
  // ถ้าไม่มี Flash Sale ที่กำลังลดราคาอยู่เลย ให้ซ่อนทั้งโซนไปเลย (ไม่แสดงหัวข้อ "Flash Sale" เปล่า ๆ)
  if (activeFlashSales.length === 0) {
    flashSaleSection.style.display = 'none';
    return; // ออกจากฟังก์ชันทันที
  }
  // ถ้ามีอย่างน้อย 1 รายการ ให้แสดงโซนนี้ขึ้นมา
  flashSaleSection.style.display = 'block';
  // วนลูปสร้าง HTML การ์ดของ Flash Sale แต่ละรายการ แล้วรวมเป็นข้อความเดียว
  flashSaleGrid.innerHTML = activeFlashSales
    .map(
      (s) => `
    <div class="product-card flash-card">
      <div class="img-wrap"><img src="${s.productImage}" alt="${s.productName}" loading="lazy" /></div>
      <div class="info">
        <span class="brand">${s.productBrand}</span>
        <span class="name">${s.productName}</span>
        <div class="flash-price-row">
          <span class="price-strike">${formatPrice(s.productPrice)}</span>
          <span class="price flash-price">${formatPrice(s.salePrice)}</span>
        </div>
        <!-- data-end เก็บเวลาสิ้นสุด Flash Sale ไว้ ให้ตัวนับถอยหลัง (updateFlashCountdowns) มาอ่านไปคำนวณเวลาที่เหลือ -->
        <span class="flash-countdown" data-end="${s.endAt}">กำลังคำนวณเวลา...</span>
        <button class="btn btn-block" data-id="${s.productId}" data-flash-id="${s.id}" ${
        s.productStock === 0 ? 'disabled' : ''
      }>${s.productStock === 0 ? 'สินค้าหมด' : 'เพิ่มลงตะกร้า'}</button>
      </div>
    </div>
  `
    )
    .join(''); // รวม HTML ของทุกการ์ดเป็นข้อความเดียว แล้วใส่ลงใน flashSaleGrid

  // ผูก event คลิกให้กับปุ่ม "เพิ่มลงตะกร้า" ทุกปุ่มในโซน Flash Sale ที่เพิ่งวาดใหม่
  flashSaleGrid.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      // หาข้อมูล Flash Sale ที่ตรงกับปุ่มที่ถูกคลิก (ใช้ flashId เผื่อสินค้าตัวเดียวมีหลาย Flash Sale ในอดีต)
      const sale = activeFlashSales.find((s) => s.id === btn.dataset.flashId);
      // เปิด modal เลือกไซส์ พร้อมแนบข้อมูล Flash Sale ไปด้วย เพื่อให้ใช้ราคาลดตอนเพิ่มลงตะกร้า
      openSizeModal(btn.dataset.id, sale);
    });
  });
  // อัปเดตตัวนับถอยหลังทันทีหลังวาดการ์ดเสร็จ (ไม่ต้องรอรอบ setInterval แรก ผู้ใช้จะได้ไม่เห็นข้อความ "กำลังคำนวณเวลา..." ค้างอยู่)
  updateFlashCountdowns();
}

// ฟังก์ชันอัปเดตข้อความนับถอยหลังของ Flash Sale ทุกการ์ดที่แสดงอยู่บนหน้าจอ (เรียกซ้ำทุก 1 วินาทีผ่าน setInterval)
function updateFlashCountdowns() {
  // ตัวแปรบอกว่ามี Flash Sale รายการไหนหมดเวลาไปแล้วระหว่างการอัปเดตรอบนี้หรือไม่
  let anyExpired = false;
  // เลือก element ป้ายนับถอยหลังทั้งหมดที่มี data-end อยู่ในหน้า (จะมีก็ต่อเมื่อโซน Flash Sale กำลังแสดงอยู่)
  document.querySelectorAll('.flash-countdown[data-end]').forEach((el) => {
    // คำนวณเวลาที่เหลือ (มิลลิวินาที) = เวลาสิ้นสุด - เวลาปัจจุบัน
    const remainingMs = new Date(el.dataset.end).getTime() - Date.now();
    // ถ้าเวลาหมดแล้ว (ติดลบหรือเท่ากับ 0)
    if (remainingMs <= 0) {
      // แสดงข้อความว่าหมดเวลาแล้ว และตั้งค่าให้โหลดรายการ Flash Sale ใหม่ (เพื่อเอารายการนี้ออกจากหน้าจอ)
      el.textContent = 'หมดเวลาแล้ว';
      anyExpired = true;
      return;
    }
    // แปลงมิลลิวินาทีที่เหลือเป็นชั่วโมง/นาที/วินาที
    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    // ฟังก์ชันช่วยเติม 0 ข้างหน้าตัวเลขให้ครบ 2 หลัก
    const pad = (n) => String(n).padStart(2, '0');
    // แสดงเวลาที่เหลือในรูปแบบ ชม:นาที:วินาที
    el.textContent = `เหลือเวลา ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  });
  // ถ้ามีรายการที่เพิ่งหมดเวลาไปในรอบนี้ ให้โหลดรายการ Flash Sale ใหม่จาก backend เพื่อเอาการ์ดที่หมดเวลาออกจากหน้าจอ
  if (anyExpired) loadFlashSales();
}

// ตั้งเวลาให้เรียก updateFlashCountdowns() ซ้ำทุก 1 วินาที เพื่ออัปเดตตัวนับถอยหลังแบบเรียลไทม์
setInterval(updateFlashCountdowns, 1000);

// เรียกฟังก์ชันโหลดสินค้าและข้อมูลที่เกี่ยวข้องทันทีที่ไฟล์นี้ถูกโหลด (เริ่มต้นการทำงานของหน้าเว็บ)
loadCategories();
loadProducts();
loadFlashSales();
