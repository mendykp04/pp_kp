// หน้า track.html: ให้ลูกค้าตรวจสอบสถานะคำสั่งซื้อของตัวเองได้ ด้วยหมายเลขคำสั่งซื้อ + เบอร์โทรที่ใช้ตอนสั่งซื้อ
// (ต้องกรอกให้ตรงกันทั้งคู่ backend ถึงจะยอมให้ดู กันคนอื่นเดาหมายเลขคำสั่งซื้อแล้วเห็นชื่อ/ที่อยู่ของคนอื่น)

// อ้างอิง element ต่าง ๆ ของหน้านี้
const trackForm = document.getElementById('trackForm');
const trackOrderIdInput = document.getElementById('trackOrderId');
const trackPhoneInput = document.getElementById('trackPhone');
const trackResult = document.getElementById('trackResult');

// ฟังก์ชันวาด (render) ผลลัพธ์คำสั่งซื้อที่ค้นพบ ลงในกล่อง trackResult
// (STATUS_CLASS_MAP, PAYMENT_STATUS_CLASS_MAP, formatPaymentMethod มาจาก common.js ใช้ร่วมกับหน้า account.html)
function renderTrackResult(order, phone) {
  const statusClass = STATUS_CLASS_MAP[order.status] || '';
  const paymentStatusClass = PAYMENT_STATUS_CLASS_MAP[order.paymentStatus] || '';
  // ให้แนบ/เปลี่ยนสลิปได้เฉพาะตอนที่ยังต้องโอนเงินอยู่ (ไม่ใช่เก็บเงินปลายทาง) และแอดมินยังไม่ได้ยืนยันว่าจ่ายแล้ว
  const canUploadSlip = order.paymentMethod !== 'cod' && order.paymentStatus !== 'ชำระเงินแล้ว';
  trackResult.innerHTML = `
    <div class="cart-summary">
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
        ? `<p style="margin-top:16px;">สลิปที่แนบไว้: <a href="${order.slipUrl}" target="_blank" rel="noopener" style="color: var(--accent);">ดูรูปสลิป</a></p>`
        : ''
    }
    ${
      canUploadSlip
        ? `
      <div class="field" style="margin-top:16px;">
        <label for="trackSlipFile">${order.slipUrl ? 'แนบสลิปใหม่ (ถ้าแนบผิดรูป)' : 'แนบสลิปโอนเงิน'}</label>
        <input type="file" id="trackSlipFile" accept="image/*" />
      </div>
    `
        : ''
    }
  `;
  trackResult.style.display = 'block';

  // ผูก event ให้ช่องแนบสลิป (ถ้ามีอยู่ในหน้านี้) — อัปโหลดรูปแล้วส่ง URL ไปผูกกับออเดอร์นี้ทันที
  const slipInput = document.getElementById('trackSlipFile');
  if (slipInput) {
    slipInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        showToast('กำลังอัปโหลดสลิป...');
        const formData = new FormData();
        formData.append('image', file);
        const uploadRes = await fetch(`${API_BASE}/upload/slip`, { method: 'POST', body: formData });
        if (!uploadRes.ok) throw new Error('อัปโหลดสลิปไม่สำเร็จ');
        const uploadData = await uploadRes.json();

        // ผูกสลิปที่เพิ่งอัปโหลดเข้ากับออเดอร์นี้ (ต้องส่งเบอร์โทรไปยืนยันตัวตนซ้ำ เหมือนตอนค้นหา)
        const attachRes = await fetch(`${API_BASE}/orders/${order.id}/slip`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, slipUrl: uploadData.url }),
        });
        if (!attachRes.ok) throw new Error('บันทึกสลิปไม่สำเร็จ');
        const updatedOrder = await attachRes.json();
        showToast('แนบสลิปสำเร็จ');
        // วาดผลลัพธ์ใหม่ให้เห็นสลิปที่เพิ่งแนบทันที
        renderTrackResult(updatedOrder, phone);
      } catch (err) {
        showToast(err.message);
      }
    });
  }
}

// ผูก event เมื่อผู้ใช้กด submit ฟอร์มค้นหา
trackForm.addEventListener('submit', async (e) => {
  // ป้องกันเบราว์เซอร์รีโหลดหน้าตามพฤติกรรมปกติของฟอร์ม
  e.preventDefault();
  const orderId = trackOrderIdInput.value.trim();
  const phone = trackPhoneInput.value.trim();

  // ใช้ try/catch ดักจับข้อผิดพลาด (ทั้งค้นหาไม่พบ และเซิร์ฟเวอร์ล่ม/เน็ตหลุด)
  try {
    const res = await fetch(
      `${API_BASE}/orders/track?orderId=${encodeURIComponent(orderId)}&phone=${encodeURIComponent(phone)}`
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'ไม่พบคำสั่งซื้อ');
    }
    const order = await res.json();
    renderTrackResult(order, phone);
  } catch (err) {
    // ซ่อนผลลัพธ์เดิม (ถ้ามี) แล้วแจ้งเตือนด้วยข้อความ error จริงจาก backend
    trackResult.style.display = 'none';
    showToast(err.message);
  }
});

// ถ้าเปิดหน้านี้มาพร้อม query string ?orderId=... (เช่นกดลิงก์มาจากหน้า "สั่งซื้อสำเร็จ") ให้เติมหมายเลขคำสั่งซื้อในช่องให้อัตโนมัติ เหลือแค่กรอกเบอร์โทรยืนยัน
const prefillOrderId = new URLSearchParams(window.location.search).get('orderId');
if (prefillOrderId) {
  trackOrderIdInput.value = prefillOrderId;
  trackPhoneInput.focus();
}
