// ตัวแปรกำหนด path หลักของ API ที่หน้า login จะเรียกใช้
const API_BASE = '/api';

// อ้างอิง element ฟอร์มล็อกอิน
const loginForm = document.getElementById('loginForm');
// อ้างอิง element กล่องแสดงข้อความ error
const loginError = document.getElementById('loginError');
// อ้างอิง element ปุ่มเข้าสู่ระบบ
const loginBtn = document.getElementById('loginBtn');

// ผูก event เมื่อผู้ใช้กดปุ่ม "เข้าสู่ระบบ" (submit ฟอร์ม)
loginForm.addEventListener('submit', async (e) => {
  // ป้องกันเบราว์เซอร์รีโหลดหน้าตามพฤติกรรมปกติของฟอร์ม
  e.preventDefault();
  // ซ่อนข้อความ error เดิม (ถ้ามีค้างจากการล็อกอินผิดครั้งก่อน)
  loginError.style.display = 'none';
  // ปิดปุ่มชั่วคราวระหว่างรอผลลัพธ์ ป้องกันกดซ้ำ
  loginBtn.disabled = true;
  loginBtn.textContent = 'กำลังเข้าสู่ระบบ...';

  // ใช้ try/catch ดักจับข้อผิดพลาดระหว่างเรียก API
  try {
    // ยิง HTTP POST ไปที่ /api/auth/login พร้อมชื่อผู้ใช้และรหัสผ่านที่กรอก
    // credentials: 'include' บังคับให้เบราว์เซอร์ส่ง/รับ cookie ของ session แม้ frontend กับ backend จะอยู่คนละโดเมนกันตอน deploy จริง
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username: document.getElementById('username').value.trim(),
        password: document.getElementById('password').value,
      }),
    });
    // ถ้าล็อกอินไม่สำเร็จ (ชื่อผู้ใช้/รหัสผ่านผิด) ให้อ่านข้อความ error จาก backend แล้วโยน error ออกไป
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
    }
    // ล็อกอินสำเร็จ ให้พาไปหน้าแดชบอร์ดหลังบ้าน (index.html)
    window.location.href = 'index.html';
  } catch (err) {
    // แสดงข้อความ error ให้ผู้ใช้เห็น
    loginError.textContent = err.message;
    loginError.style.display = 'block';
    // เปิดปุ่มกลับมาให้กดใหม่ได้อีกครั้ง
    loginBtn.disabled = false;
    loginBtn.textContent = 'เข้าสู่ระบบ';
  }
});

// ฟังก์ชัน async เช็คตอนเปิดหน้า login ว่าล็อกอินอยู่แล้วหรือไม่ ถ้าล็อกอินอยู่แล้วก็ไม่จำเป็นต้องกรอกฟอร์มซ้ำ ให้พาไปหน้าแดชบอร์ดเลย
async function redirectIfAlreadyLoggedIn() {
  // ใช้ try/catch เผื่อกรณีเรียก API ไม่สำเร็จ (เช่นเซิร์ฟเวอร์ยังไม่พร้อม) จะได้ไม่ทำให้หน้า login ใช้งานไม่ได้
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
    const data = await res.json();
    // ถ้าเช็คแล้วพบว่าล็อกอินอยู่แล้ว ให้ข้ามหน้า login ไปหน้าแดชบอร์ดทันที
    if (data.loggedIn) window.location.href = 'index.html';
  } catch (err) {
    // ถ้าเช็คไม่ได้ ก็ปล่อยให้ผู้ใช้กรอกฟอร์ม login ตามปกติ
  }
}

// เรียกเช็คสถานะล็อกอินทันทีที่เปิดหน้านี้
redirectIfAlreadyLoggedIn();
