// ===== ตั้งค่าแอป Health Chair =====
// ตอนรัน npm run dev (บนคอมหรือใน Codespaces) ใช้ '' = ผ่าน proxy ใน vite.config.js
// ตอน build ขึ้น GitHub Pages เรียก ThingsBoard Cloud ตรง ๆ
// ถ้าใช้ ThingsBoard เครื่องอื่น ตั้ง VITE_TB_URL ตอน build หรือแก้บรรทัดนี้
export const TB_URL = import.meta.env.VITE_TB_URL ?? (import.meta.env.DEV ? '' : 'https://thingsboard.cloud');

// Device ID ของเก้าอี้ใน ThingsBoard (Entities → Devices → คลิกเครื่อง → Copy device Id)
// ปล่อยว่างได้ แอปจะหาเครื่องแรกในบัญชีให้ หรือกรอกเองที่หน้า "เชื่อมเก้าอี้"
export const DEFAULT_DEVICE_ID = '';

// ค่าเริ่มต้นตรงกับ include/config.h ของเฟิร์มแวร์
export const DEFAULTS = {
  muted: false,
  sit_limit_min: 45,
  bad_posture_alert_sec: 10,
  rest_min: 5,
  app_notify: true,
};

// ถือว่าเก้าอี้ออฟไลน์ถ้าไม่มีข้อมูลเข้ามานานเกินกี่นาที (ตอนไม่มีคนนั่งเฟิร์มแวร์ส่งทุก 30 นาที)
export const OFFLINE_AFTER_MIN = 35;
