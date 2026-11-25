import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ส่งต่อ /api ไปที่ ThingsBoard Cloud เพื่อเลี่ยงปัญหา CORS ตอนรันบนเครื่อง
// ถ้าใช้ ThingsBoard เครื่องอื่น แก้ TB_TARGET ตรงนี้
const TB_TARGET = 'https://thingsboard.cloud';

const proxy = {
  '/api': { target: TB_TARGET, changeOrigin: true, secure: true, ws: true },
};

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, host: true, proxy },
  preview: { port: 4173, proxy },
});
