// อ้างอิง element ที่ใช้แสดงรายการสินค้าในตะกร้าทั้งหมด
const cartItemsEl = document.getElementById('cartItems');
// อ้างอิง element กล่องสรุปยอดรวม (จำนวนสินค้า/ราคารวม)
const cartSummaryEl = document.getElementById('cartSummary');
// อ้างอิง element ส่วนฟอร์มกรอกข้อมูลจัดส่งสำหรับ checkout
const checkoutSection = document.getElementById('checkoutSection');
// อ้างอิง element ข้อความแจ้งสั่งซื้อสำเร็จ (แสดงหลังยืนยันคำสั่งซื้อ)
const successMessage = document.getElementById('successMessage');

// ฟังก์ชันวาด (render) รายการสินค้าทั้งหมดในตะกร้าลงในหน้าเว็บ
function renderCart() {
  // ดึงข้อมูลตะกร้าปัจจุบันจาก localStorage (ฟังก์ชัน getCart มาจาก common.js)
  const cart = getCart();

  // ถ้าตะกร้าว่างเปล่า (ไม่มีสินค้าเลย)
  if (cart.length === 0) {
    // แสดงข้อความแจ้งว่าตะกร้าว่าง พร้อมปุ่มลิงก์กลับไปเลือกซื้อสินค้า
    cartItemsEl.innerHTML = '<div class="empty-state">ตะกร้าของคุณว่างเปล่า<br /><a href="index.html" class="btn" style="margin-top:16px;">ไปเลือกซื้อสินค้า</a></div>';
    // ซ่อนกล่องสรุปยอดรวม เพราะไม่มีสินค้าให้สรุป
    cartSummaryEl.style.display = 'none';
    // ซ่อนฟอร์มกรอกข้อมูลจัดส่ง เพราะยังสั่งซื้อไม่ได้ถ้าตะกร้าว่าง
    checkoutSection.style.display = 'none';
    return; // ออกจากฟังก์ชันทันที ไม่ทำโค้ดด้านล่างต่อ
  }

  // ถ้ามีสินค้าในตะกร้า ให้วนสร้าง HTML ของแต่ละรายการ แล้วรวมเป็นข้อความเดียว
  cartItemsEl.innerHTML = cart
    .map((item) => {
      // ใช้ string ว่างแทน null ตอนใส่ลงใน data-flash attribute (HTML attribute ไม่รองรับค่า null โดยตรง)
      const flashAttr = item.flashSaleId || '';
      return `
    <div class="cart-item">
      <img src="${item.image}" alt="${item.name}" />
      <div class="info">
        <div><strong>${item.brand} ${item.name}</strong> ${
        item.flashSaleId ? '<span class="flash-countdown">⚡ Flash Sale</span>' : ''
      }</div>
        <div class="meta">ไซส์ ${item.size} · ${formatPrice(item.price)}</div>
        <div class="qty-control">
          <button data-action="dec" data-id="${item.productId}" data-size="${item.size}" data-flash="${flashAttr}">−</button>
          <span>${item.qty}</span>
          <button data-action="inc" data-id="${item.productId}" data-size="${item.size}" data-flash="${flashAttr}">+</button>
          <button class="remove-btn" data-action="remove" data-id="${item.productId}" data-size="${item.size}" data-flash="${flashAttr}">ลบ</button>
        </div>
      </div>
      <div><strong>${formatPrice(item.price * item.qty)}</strong></div>
    </div>
  `;
    })
    .join(''); // รวม HTML ของทุกรายการเป็นข้อความเดียว แล้วนำไปแทนที่เนื้อหาเดิมใน cartItemsEl

  // อัปเดตตัวเลขจำนวนสินค้ารวมในกล่องสรุป (เรียกฟังก์ชันจาก common.js)
  document.getElementById('summaryCount').textContent = cartTotalCount();
  // อัปเดตยอดรวมราคาทั้งหมดในกล่องสรุป พร้อมจัดรูปแบบเป็นสกุลเงินบาท
  document.getElementById('summaryTotal').textContent = formatPrice(cartTotalPrice());
  // แสดงกล่องสรุปยอดรวม เพราะตอนนี้มีสินค้าแล้ว
  cartSummaryEl.style.display = 'block';
  // แสดงฟอร์มกรอกข้อมูลจัดส่ง เพื่อให้ผู้ใช้กรอกและกดสั่งซื้อได้
  checkoutSection.style.display = 'block';

  // ผูก event คลิกให้กับปุ่มทั้งหมดที่มี data-action (ปุ่มเพิ่ม/ลด/ลบ) ในทุกรายการที่เพิ่งวาดใหม่
  cartItemsEl.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      // ดึงค่า action, id ของสินค้า, ไซส์, และ flashSaleId ออกมาจาก data attribute ของปุ่มที่ถูกคลิก
      const { action, id, size, flash } = btn.dataset;
      // แปลงค่าไซส์จาก string เป็นตัวเลข (เพราะ data attribute เป็น string เสมอ)
      const numSize = Number(size);
      // แปลง data-flash กลับเป็น null ถ้าเป็นค่าว่าง (ตอนสร้าง HTML เราแทน null ด้วยสตริงว่างไว้)
      const flashSaleId = flash || null;
      // ดึงข้อมูลตะกร้าปัจจุบันมาใหม่อีกครั้ง (เผื่อมีการเปลี่ยนแปลงล่าสุด)
      const cart = getCart();
      // หารายการสินค้าที่ตรงกับ id, ไซส์, และ flashSaleId ของปุ่มที่ถูกคลิก (ต้องเช็คครบทั้ง 3 อย่าง เพราะสินค้าเดียวกันอาจมีทั้งราคาปกติและราคา Flash Sale อยู่ในตะกร้าพร้อมกัน)
      const item = cart.find(
        (i) => i.productId === id && i.size === numSize && i.flashSaleId === flashSaleId
      );
      // ถ้าไม่เจอรายการนั้น (ไม่ควรเกิดขึ้น) ให้หยุดทำงาน
      if (!item) return;

      // ถ้าปุ่มที่กดคือปุ่ม "+" ให้เพิ่มจำนวนสินค้าอีก 1 ชิ้น
      if (action === 'inc') updateCartQty(id, numSize, item.qty + 1, flashSaleId);
      // ถ้าปุ่มที่กดคือปุ่ม "-"
      if (action === 'dec') {
        // ถ้าจำนวนปัจจุบันเหลือ 1 ชิ้น การกดลบอีกคือการลบสินค้าออกจากตะกร้าไปเลย
        if (item.qty <= 1) removeFromCart(id, numSize, flashSaleId);
        // ถ้ามีมากกว่า 1 ชิ้น ให้ลดจำนวนลง 1
        else updateCartQty(id, numSize, item.qty - 1, flashSaleId);
      }
      // ถ้าปุ่มที่กดคือปุ่ม "ลบ" ให้ลบสินค้ารายการนี้ออกจากตะกร้าทันที
      if (action === 'remove') removeFromCart(id, numSize, flashSaleId);
      // วาดหน้าตะกร้าใหม่ทั้งหมด เพื่อให้ตัวเลข/ยอดรวมอัปเดตตามการเปลี่ยนแปลงล่าสุด
      renderCart();
    });
  });
}

// ผูก event เมื่อผู้ใช้กดปุ่ม "ยืนยันสั่งซื้อ" (submit ฟอร์ม checkout)
document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
  // ป้องกันไม่ให้เบราว์เซอร์รีโหลดหน้าเว็บทันทีตามพฤติกรรมปกติของฟอร์ม
  e.preventDefault();
  // ดึงข้อมูลตะกร้าปัจจุบัน
  const cart = getCart();
  // ถ้าตะกร้าว่าง (กรณีผิดปกติ) ให้หยุดทำงานทันที ไม่ส่งคำสั่งซื้อ
  if (cart.length === 0) return;

  // สร้าง object ข้อมูลที่จะส่งไปยัง backend เพื่อสร้างคำสั่งซื้อ
  const payload = {
    // ดึงค่าจากช่องกรอกชื่อ-นามสกุล พร้อมตัดช่องว่างหัวท้าย
    customerName: document.getElementById('customerName').value.trim(),
    // ดึงค่าจากช่องกรอกเบอร์โทรศัพท์
    phone: document.getElementById('phone').value.trim(),
    // ดึงค่าจากช่องกรอกที่อยู่จัดส่ง
    address: document.getElementById('address').value.trim(),
    // แปลงรายการในตะกร้าให้เหลือเฉพาะข้อมูลที่ backend ต้องใช้ (id สินค้า, ไซส์, จำนวน, และ id ของ Flash Sale ถ้ามี)
    // backend จะตรวจสอบ flashSaleId อีกครั้งว่ายังลดราคาอยู่จริงหรือไม่ ก่อนคิดราคาสุดท้าย (ไม่เชื่อราคาจากฝั่งเว็บตรง ๆ)
    items: cart.map((i) => ({ productId: i.productId, size: i.size, qty: i.qty, flashSaleId: i.flashSaleId })),
  };

  // หาปุ่ม submit ภายในฟอร์มที่เพิ่งถูกส่ง เพื่อเปลี่ยนสถานะระหว่างรอผลลัพธ์
  const submitBtn = e.target.querySelector('button[type="submit"]');
  // ปิดการใช้งานปุ่มชั่วคราว ป้องกันผู้ใช้กดซ้ำหลายครั้งระหว่างรอ
  submitBtn.disabled = true;
  // เปลี่ยนข้อความปุ่มเป็น "กำลังสั่งซื้อ..." เพื่อบอกสถานะกำลังทำงาน
  submitBtn.textContent = 'กำลังสั่งซื้อ...';

  // ใช้ try/catch ดักจับข้อผิดพลาดระหว่างเรียก API
  try {
    // ยิง HTTP POST ไปที่ /api/orders พร้อมแนบข้อมูลคำสั่งซื้อเป็น JSON
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // ถ้า response ไม่สำเร็จ (สถานะไม่ใช่ 2xx) ให้โยน error เพื่อให้ตกไปที่ catch
    if (!res.ok) throw new Error('checkout failed');
    // แปลง response เป็น object คำสั่งซื้อที่ backend สร้างให้ (มี id ออเดอร์)
    const order = await res.json();

    // ลบข้อมูลตะกร้าออกจาก localStorage เพราะสั่งซื้อสำเร็จแล้ว ไม่ต้องเก็บไว้อีก
    localStorage.removeItem(CART_KEY);
    // อัปเดตตัวเลขบนไอคอนตะกร้าให้เป็น 0
    updateCartBadge();

    // ซ่อนส่วนแสดงรายการตะกร้า เพราะสั่งซื้อเสร็จแล้ว
    document.getElementById('cartView').style.display = 'none';
    // ซ่อนฟอร์มกรอกข้อมูลจัดส่ง เพราะกรอกและส่งเรียบร้อยแล้ว
    checkoutSection.style.display = 'none';
    // แสดงข้อความ "สั่งซื้อสำเร็จ" แทน
    successMessage.style.display = 'block';
    // แสดงหมายเลขคำสั่งซื้อ (id) ที่ backend ส่งกลับมา ให้ผู้ใช้เก็บไว้อ้างอิง
    document.getElementById('orderRef').textContent = `หมายเลขคำสั่งซื้อ: ${order.id}`;
  } catch (err) {
    // ถ้าเกิดข้อผิดพลาดระหว่างสั่งซื้อ ให้แจ้งเตือนด้วย toast
    showToast('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    // เปิดปุ่ม submit กลับมาให้กดใหม่ได้อีกครั้ง
    submitBtn.disabled = false;
    // เปลี่ยนข้อความปุ่มกลับเป็นข้อความเดิม
    submitBtn.textContent = 'ยืนยันสั่งซื้อ';
  }
});

// เรียกฟังก์ชันวาดตะกร้าทันทีที่ไฟล์นี้ถูกโหลด เพื่อแสดงข้อมูลตะกร้าล่าสุดตั้งแต่เปิดหน้ามา
renderCart();
