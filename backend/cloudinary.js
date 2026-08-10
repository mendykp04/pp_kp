// โมดูลนี้ห่อการเชื่อมต่อ Cloudinary (บริการเก็บรูปภาพแบบ hosted ฟรี) ไว้ให้ server.js เรียกใช้ตอนอัปโหลดรูปสินค้า
//
// เหตุผลที่ต้องใช้: Render แผน Free ไม่มี persistent disk เหมือนกับที่เคยเจอปัญหาฐานข้อมูลหาย —
// ไฟล์รูปที่อัปโหลดเก็บไว้ในโฟลเดอร์ backend/uploads/ ก็จะหายไปทุกครั้งที่ container รีสตาร์ทเช่นกัน
// (deploy ใหม่ หรือเครื่อง "หลับ" แล้วตื่นขึ้นมาใหม่) Cloudinary เก็บไฟล์แยกออกจากตัวเซิร์ฟเวอร์เว็บ
// โดยสิ้นเชิง จึงไม่หายไปพร้อมกับ container
const cloudinary = require('cloudinary').v2;

// ถือว่า "ตั้งค่าไว้แล้ว" ก็ต่อเมื่อมีครบทั้ง 3 ตัวแปรนี้ ถ้าขาดตัวใดตัวหนึ่ง (เช่นตอนรันในเครื่องตัวเอง) จะถือว่ายังไม่ได้ตั้งค่า แล้วให้ server.js ไป fallback ใช้ดิสก์ในเครื่องแทน
const isConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// ฟังก์ชันอัปโหลดไฟล์รูปภาพ (เป็น Buffer ในหน่วยความจำ ไม่ได้เขียนลงดิสก์ก่อน) ขึ้น Cloudinary
// คืนค่าเป็น Promise ที่ resolve เป็นผลลัพธ์จาก Cloudinary (มี secure_url เป็น URL ถาวรของรูปที่อัปโหลดสำเร็จ)
function uploadBuffer(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      // เก็บรวมไว้ในโฟลเดอร์ "sneaker-shop" บน Cloudinary ให้แยกจากรูปของโปรเจกต์อื่นที่อาจใช้ account เดียวกัน
      { folder: 'sneaker-shop', public_id: publicId, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

module.exports = { isConfigured, uploadBuffer };
