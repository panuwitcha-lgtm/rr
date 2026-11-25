import { thingsboard } from './thingsboard';

// เว็บนี้ดึงข้อมูลจาก ThingsBoard (ฐานข้อมูลจริง) อย่างเดียว
try { localStorage.removeItem('hc_mode'); } catch { /* ไม่มี storage */ }
export const api = () => thingsboard;
