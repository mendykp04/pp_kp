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
    // เข้าสู่ระบบสำเร็จ พาไปหน้า "บัญชีของฉัน" ทันที
    window.location.href = 'account.html';
  } catch (err) {
    showToast(err.message);
  }
});
