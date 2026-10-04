// หน้า account.html: แสดงประวัติคำสั่งซื้อทั้งหมดของลูกค้าที่ล็อกอินอยู่ (ล็อกอินครั้งเดียวเห็นทุกออเดอร์ ไม่ต้องจำหมายเลขคำสั่งซื้อทีละใบเอง)

const orderList = document.getElementById('orderList');
// ตัวแปรเก็บเบอร์โทรของบัญชีที่ล็อกอินอยู่ (ใช้ยืนยันตัวตนตอนแนบสลิป)
let accountPhone = '';

// ฟังก์ชันวาด (render) การ์ดคำสั่งซื้อ 1 ใบ
function renderOrderCard(order) {
  const statusClass = STATUS_CLASS_MAP[order.status] || '';
  const paymentStatusClass = PAYMENT_STATUS_CLASS_MAP[order.paymentStatus] || '';
  // ให้แนบ/เปลี่ยนสลิปได้เฉพาะตอนที่ยังต้องโอนเงินอยู่ (ไม่ใช่เก็บเงินปลายทาง) และแอดมินยังไม่ได้ยืนยันว่าจ่ายแล้ว
  const cancelled = order.status === 'ยกเลิก';
  const canUploadSlip = !cancelled && order.paymentMethod !== 'cod' && order.paymentStatus !== 'ชำระเงินแล้ว';
  // ลูกค้ายกเลิกเองได้เฉพาะออเดอร์ที่ร้านยังไม่เริ่มจัดส่ง และยังไม่ได้จ่ายเงิน/แนบสลิป (เงื่อนไขเดียวกับที่ backend ตรวจ — ถ้าโอนมาแล้วต้องติดต่อร้านเพื่อรับเงินคืน)
  const canCancel = order.status === 'รอดำเนินการ' && order.paymentStatus !== 'ชำระเงินแล้ว' && !order.slipUrl;
  return `
    <div class="cart-summary" style="margin-bottom: 16px;" data-order-id="${escapeHtml(order.id)}">
      <div class="row">
        <span>หมายเลขคำสั่งซื้อ</span>
        <span>${escapeHtml(order.id)}</span>
      </div>
      <div class="row">
        <span>สถานะการจัดส่ง</span>
        <span class="status-badge ${statusClass}">${escapeHtml(order.status)}</span>
      </div>
      ${
        // ออเดอร์ที่ยกเลิกแล้วไม่ต้องโชว์สถานะการชำระเงิน (ไม่มีอะไรต้องจ่ายแล้ว)
        cancelled
          ? ''
          : `<div class="row">
        <span>สถานะการชำระเงิน</span>
        <span class="status-badge ${paymentStatusClass}">${escapeHtml(order.paymentStatus || '-')}</span>
      </div>`
      }
      <div class="row">
        <span>วันที่สั่งซื้อ</span>
        <span>${new Date(order.createdAt).toLocaleString('th-TH')}</span>
      </div>
      <div class="row">
        <span>วิธีชำระเงิน</span>
        <span>${formatPaymentMethod(order.paymentMethod)}</span>
      </div>
      ${renderShippingInfoRows(order)}
      <div class="row">
        <span>รายการสินค้า</span>
        <span>${order.items.map((i) => `${escapeHtml(i.name)} (ไซส์ ${escapeHtml(i.size)})`).join(', ')}</span>
      </div>
      ${
        // ออเดอร์เก่าก่อนมีระบบค่าจัดส่งจะไม่มีค่านี้ (null) ไม่ต้องแสดงแถวนี้
        order.shippingFee != null
          ? `<div class="row">
        <span>ค่าจัดส่ง</span>
        <span>${order.shippingFee === 0 ? 'ฟรี' : formatPrice(order.shippingFee)}</span>
      </div>`
          : ''
      }
      <div class="row total">
        <span>ยอดรวม</span>
        <span>${formatPrice(order.total)}</span>
      </div>
    </div>
    ${
      order.slipUrl
        ? `<p style="margin-top:-8px; margin-bottom:16px;">สลิปที่แนบไว้: <a href="${escapeHtml(order.slipUrl)}" target="_blank" rel="noopener" style="color: var(--accent);">ดูรูปสลิป</a></p>`
        : ''
    }
    ${
      canUploadSlip
        ? `
      <div class="field" style="margin-top:-8px; margin-bottom:24px;">
        <label for="slip-${escapeHtml(order.id)}">${order.slipUrl ? 'แนบสลิปใหม่ (ถ้าแนบผิดรูป)' : 'แนบสลิปโอนเงิน'}</label>
        <input type="file" id="slip-${escapeHtml(order.id)}" data-order-id="${escapeHtml(order.id)}" accept="image/*" class="account-slip-input" />
      </div>
    `
        : ''
    }
    ${
      canCancel
        ? `<button type="button" class="btn btn-outline account-cancel-btn" data-order-id="${escapeHtml(order.id)}" style="margin-top:-8px; margin-bottom:24px;">ยกเลิกคำสั่งซื้อนี้</button>`
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

  // ผูก event ให้ปุ่ม "ยกเลิกคำสั่งซื้อนี้" ทุกปุ่มที่เพิ่งวาดใหม่
  document.querySelectorAll('.account-cancel-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      // ยืนยันก่อนเสมอ เพราะยกเลิกแล้วรองเท้าคู่นั้นจะกลับไปขายหน้าร้านทันที อาจมีคนอื่นสั่งไปก่อน
      if (!confirm('ต้องการยกเลิกคำสั่งซื้อนี้ใช่หรือไม่?\n\nยกเลิกแล้วรองเท้าจะกลับไปวางขายหน้าร้านทันที')) return;
      try {
        const res = await fetch(`${API_BASE}/customer/orders/${encodeURIComponent(btn.dataset.orderId)}/cancel`, {
          method: 'POST',
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'ยกเลิกคำสั่งซื้อไม่สำเร็จ');
        }
        showToast('ยกเลิกคำสั่งซื้อเรียบร้อย');
      } catch (err) {
        showToast(err.message);
      }
      // โหลดรายการใหม่ทั้งสองกรณี (ถ้ายกเลิกไม่ได้เพราะร้านเพิ่งเปลี่ยนสถานะ จะได้เห็นสถานะล่าสุด)
      loadOrders();
    });
  });

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
          body: JSON.stringify({ slipUrl: uploadData.url }),
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
    // เติมชื่อ/ที่อยู่ปัจจุบันลงในฟอร์ม "แก้ไขชื่อและที่อยู่"
    document.getElementById('profileName').value = me.name || '';
    document.getElementById('profileAddress').value = me.address || '';

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

// ผูก event ให้ฟอร์ม "เปลี่ยนรหัสผ่าน" ยิงไปที่ backend (ต้องกรอกรหัสผ่านปัจจุบันถูกต้องก่อน จึงจะเปลี่ยนได้)
const changePasswordForm = document.getElementById('changePasswordForm');
changePasswordForm.addEventListener('submit', async (e) => {
  // ป้องกันเบราว์เซอร์รีโหลดหน้าตามพฤติกรรมปกติของฟอร์ม
  e.preventDefault();
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  // เช็คฝั่งหน้าเว็บก่อนว่ากรอกรหัสใหม่ 2 ช่องตรงกัน กันพิมพ์ผิดแล้วล็อกอินไม่ได้อีกรอบ
  if (newPassword !== document.getElementById('confirmNewPassword').value) {
    showToast('รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/customer/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
    }
    changePasswordForm.reset();
    showToast('เปลี่ยนรหัสผ่านเรียบร้อย');
  } catch (err) {
    showToast(err.message);
  }
});

// ผูก event ให้ฟอร์ม "แก้ไขชื่อและที่อยู่" ยิงไปบันทึกที่ backend
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  // ป้องกันเบราว์เซอร์รีโหลดหน้าตามพฤติกรรมปกติของฟอร์ม
  e.preventDefault();
  try {
    const res = await fetch(`${API_BASE}/auth/customer/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: document.getElementById('profileName').value.trim(),
        address: document.getElementById('profileAddress').value.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'บันทึกข้อมูลไม่สำเร็จ');
    // อัปเดตชื่อที่แสดงบนหน้านี้และบนแถบเมนูให้ตรงกับที่เพิ่งบันทึกทันที
    document.getElementById('accountInfo').textContent = `${data.name} · ${data.phone}`;
    updateAuthNav(true);
    showToast('บันทึกข้อมูลเรียบร้อย');
  } catch (err) {
    showToast(err.message);
  }
});
