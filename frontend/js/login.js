// หน้า login.html: ให้ลูกค้าเข้าสู่ระบบด้วยเบอร์โทร + รหัสผ่านที่เคยสมัครไว้

const loginForm = document.getElementById('loginForm');

// ผูก event เมื่อผู้ใช้กด submit ฟอร์มเข้าสู่ระบบ
loginForm.addEventListener('submit', async (e) => {
  // ป้องกันเบราว์เซอร์รีโหลดหน้าตามพฤติกรรมปกติของฟอร์ม
  e.preventDefault();
  const payload = {
    phone: document.getElementById('loginPhone').value.trim(),
    password: document.getElementById('loginPassword').value,
  };

  // ใช้ try/catch ดักจับข้อผิดพลาด (เบอร์โทร/รหัสผ่านผิด หรือเซิร์ฟเวอร์ล่ม/เน็ตหลุด)
  try {
    const res = await fetch(`${API_BASE}/auth/customer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
    }
    // เข้าสู่ระบบสำเร็จ: ถ้าถูกพามาจากการกดเพิ่มลงตะกร้า/เปิดหน้าตะกร้า (?next=...) ให้พากลับไปที่เดิม ไม่งั้นไปหน้า "บัญชีของฉัน"
    window.location.href = getSafeNextPage() || 'account.html';
  } catch (err) {
    showToast(err.message);
  }
});

// ถ้าถูกพามาหน้านี้พร้อม ?next=... ให้ส่งต่อไปที่ลิงก์ "สมัครสมาชิก" ด้วย ลูกค้าใหม่ที่ยังไม่มีบัญชีจะได้กลับไปที่รองเท้าคู่เดิมหลังสมัครเสร็จเช่นกัน
if (getSafeNextPage()) {
  document.getElementById('registerLink').href = `register.html?next=${encodeURIComponent(getSafeNextPage())}`;
}
