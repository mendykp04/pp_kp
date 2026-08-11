// หน้า account.html: แสดงประวัติคำสั่งซื้อทั้งหมดของลูกค้าที่ล็อกอินอยู่ (ไม่ต้องกรอกหมายเลขคำสั่งซื้อทีละใบเหมือน track.html)

const orderList = document.getElementById('orderList');

// ฟังก์ชันวาด (render) การ์ดคำสั่งซื้อ 1 ใบ
function renderOrderCard(order) {
  const statusClass = STATUS_CLASS_MAP[order.status] || '';
  return `
    <div class="cart-summary" style="margin-bottom: 16px;">
      <div class="row">
        <span>หมายเลขคำสั่งซื้อ</span>
        <span>${order.id}</span>
      </div>
      <div class="row">
        <span>สถานะ</span>
        <span class="status-badge ${statusClass}">${order.status}</span>
      </div>
      <div class="row">
        <span>วันที่สั่งซื้อ</span>
        <span>${new Date(order.createdAt).toLocaleString('th-TH')}</span>
      </div>
      <div class="row">
        <span>วิธีชำระเงิน</span>
        <span>${formatPaymentMethod(order.paymentMethod)}</span>
      </div>
      <div class="row">
        <span>รายการสินค้า</span>
        <span>${order.items.map((i) => `${i.name} (ไซส์ ${i.size})`).join(', ')}</span>
      </div>
      <div class="row total">
        <span>ยอดรวม</span>
        <span>${formatPrice(order.total)}</span>
      </div>
    </div>
  `;
}

// ฟังก์ชัน async หลัก: เช็คสถานะล็อกอินก่อน ถ้าไม่ได้ล็อกอินให้เด้งไปหน้า login.html ทันที ถ้าล็อกอินอยู่ให้โหลดประวัติคำสั่งซื้อมาแสดง
(async () => {
  // ใช้ try/catch ดักจับข้อผิดพลาด เผื่อกรณีเซิร์ฟเวอร์ล่มหรือเน็ตหลุด
  try {
    const meRes = await fetch(`${API_BASE}/auth/customer/me`);
    const me = await meRes.json();
    if (!me.loggedIn) {
      window.location.href = 'login.html';
      return;
    }
    // แสดงชื่อ/เบอร์โทรของบัญชีที่ล็อกอินอยู่
    document.getElementById('accountInfo').textContent = `${me.name} · ${me.phone}`;

    const ordersRes = await fetch(`${API_BASE}/customer/orders`);
    const orders = await ordersRes.json();
    orderList.innerHTML = orders.length
      ? orders.map(renderOrderCard).join('')
      : '<p style="color: var(--text-dim);">ยังไม่มีประวัติคำสั่งซื้อ</p>';
  } catch (err) {
    orderList.innerHTML = '<p>โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่ภายหลัง</p>';
  }
})();

// ผูก event ให้ปุ่ม "ออกจากระบบ" ยิงไปทำลาย session ที่ backend แล้วพากลับไปหน้าแรก
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch(`${API_BASE}/auth/customer/logout`, { method: 'POST' });
  window.location.href = 'index.html';
});
