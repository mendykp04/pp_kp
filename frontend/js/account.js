// หน้า account.html: แสดงประวัติคำสั่งซื้อทั้งหมดของลูกค้าที่ล็อกอินอยู่ (ไม่ต้องกรอกหมายเลขคำสั่งซื้อทีละใบเหมือน track.html)

const orderList = document.getElementById('orderList');
// ตัวแปรเก็บเบอร์โทรของบัญชีที่ล็อกอินอยู่ (ใช้ยืนยันตัวตนตอนแนบสลิป เหมือนหน้า track.html)
let accountPhone = '';

// ฟังก์ชันวาด (render) การ์ดคำสั่งซื้อ 1 ใบ
function renderOrderCard(order) {
  const statusClass = STATUS_CLASS_MAP[order.status] || '';
  const paymentStatusClass = PAYMENT_STATUS_CLASS_MAP[order.paymentStatus] || '';
  // ให้แนบ/เปลี่ยนสลิปได้เฉพาะตอนที่ยังต้องโอนเงินอยู่ (ไม่ใช่เก็บเงินปลายทาง) และแอดมินยังไม่ได้ยืนยันว่าจ่ายแล้ว
  const canUploadSlip = order.paymentMethod !== 'cod' && order.paymentStatus !== 'ชำระเงินแล้ว';
  return `
    <div class="cart-summary" style="margin-bottom: 16px;" data-order-id="${order.id}">
      <div class="row">
        <span>หมายเลขคำสั่งซื้อ</span>
        <span>${order.id}</span>
      </div>
      <div class="row">
        <span>สถานะการจัดส่ง</span>
        <span class="status-badge ${statusClass}">${order.status}</span>
      </div>
      <div class="row">
        <span>สถานะการชำระเงิน</span>
        <span class="status-badge ${paymentStatusClass}">${order.paymentStatus || '-'}</span>
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
    ${
      order.slipUrl
        ? `<p style="margin-top:-8px; margin-bottom:16px;">สลิปที่แนบไว้: <a href="${order.slipUrl}" target="_blank" rel="noopener" style="color: var(--accent);">ดูรูปสลิป</a></p>`
        : ''
    }
    ${
      canUploadSlip
        ? `
      <div class="field" style="margin-top:-8px; margin-bottom:24px;">
        <label for="slip-${order.id}">${order.slipUrl ? 'แนบสลิปใหม่ (ถ้าแนบผิดรูป)' : 'แนบสลิปโอนเงิน'}</label>
        <input type="file" id="slip-${order.id}" data-order-id="${order.id}" accept="image/*" class="account-slip-input" />
      </div>
    `
        : ''
    }
  `;
}

// ฟังก์ชัน async โหลดประวัติคำสั่งซื้อใหม่ทั้งหมด แล้ววาดลงในหน้าเว็บ (แยกออกมาต่างหาก เพื่อเรียกซ้ำได้ทันทีหลังแนบสลิปสำเร็จ ไม่ต้องรีเฟรชทั้งหน้า)
async function loadOrders() {
  const ordersRes = await fetch(`${API_BASE}/customer/orders`);
  const orders = await ordersRes.json();
  orderList.innerHTML = orders.length
    ? orders.map(renderOrderCard).join('')
    : '<p style="color: var(--text-dim);">ยังไม่มีประวัติคำสั่งซื้อ</p>';

  // ผูก event ให้ช่องแนบสลิปทุกช่องที่เพิ่งวาดใหม่
  document.querySelectorAll('.account-slip-input').forEach((input) => {
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const orderId = input.dataset.orderId;
      try {
        showToast('กำลังอัปโหลดสลิป...');
        const formData = new FormData();
        formData.append('image', file);
        const uploadRes = await fetch(`${API_BASE}/upload/slip`, { method: 'POST', body: formData });
        if (!uploadRes.ok) throw new Error('อัปโหลดสลิปไม่สำเร็จ');
        const uploadData = await uploadRes.json();

        const attachRes = await fetch(`${API_BASE}/orders/${orderId}/slip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: accountPhone, slipUrl: uploadData.url }),
        });
        if (!attachRes.ok) throw new Error('บันทึกสลิปไม่สำเร็จ');
        showToast('แนบสลิปสำเร็จ');
        // โหลดรายการใหม่ทั้งหมด ให้เห็นสลิปที่เพิ่งแนบทันที
        loadOrders();
      } catch (err) {
        showToast(err.message);
      }
    });
  });
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
    // แสดงชื่อ/เบอร์โทรของบัญชีที่ล็อกอินอยู่ และเก็บเบอร์โทรไว้ใช้ยืนยันตัวตนตอนแนบสลิป
    document.getElementById('accountInfo').textContent = `${me.name} · ${me.phone}`;
    accountPhone = me.phone;

    await loadOrders();
  } catch (err) {
    orderList.innerHTML = '<p>โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่ภายหลัง</p>';
  }
})();

// ผูก event ให้ปุ่ม "ออกจากระบบ" ยิงไปทำลาย session ที่ backend แล้วพากลับไปหน้าแรก
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch(`${API_BASE}/auth/customer/logout`, { method: 'POST' });
  window.location.href = 'index.html';
});
