// หน้า register.html: ให้ลูกค้าสมัครสมาชิกใหม่ด้วยชื่อ, เบอร์โทร, ที่อยู่ (ไม่บังคับ), และรหัสผ่าน

const registerForm = document.getElementById('registerForm');

// ผูก event เมื่อผู้ใช้กด submit ฟอร์มสมัครสมาชิก
registerForm.addEventListener('submit', async (e) => {
  // ป้องกันเบราว์เซอร์รีโหลดหน้าตามพฤติกรรมปกติของฟอร์ม
  e.preventDefault();
  const payload = {
    name: document.getElementById('registerName').value.trim(),
    phone: document.getElementById('registerPhone').value.trim(),
    address: document.getElementById('registerAddress').value.trim(),
    password: document.getElementById('registerPassword').value,
  };

  // ใช้ try/catch ดักจับข้อผิดพลาด (เบอร์นี้สมัครไปแล้ว, รหัสผ่านสั้นเกินไป, หรือเซิร์ฟเวอร์ล่ม/เน็ตหลุด)
  try {
    const res = await fetch(`${API_BASE}/auth/customer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'สมัครสมาชิกไม่สำเร็จ');
    }
    // สมัครสำเร็จแล้ว backend ล็อกอินให้อัตโนมัติ พาไปหน้า "บัญชีของฉัน" ทันที
    window.location.href = 'account.html';
  } catch (err) {
    showToast(err.message);
  }
});
