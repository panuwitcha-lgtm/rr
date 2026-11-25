// 7 ท่าจาก Edge Impulse + unknown
export const POSTURES = {
  empty:        { th: 'ไม่มีคนนั่ง',       good: null,  color: 'var(--c-empty)',   tip: 'เก้าอี้ว่างอยู่' },
  upright:      { th: 'นั่งตัวตรง',        good: true,  color: 'var(--c-good)',    tip: 'ดีมาก หลังพิงพนัก เท้าวางราบ' },
  lean_forward: { th: 'โน้มตัวไปข้างหน้า', good: false, color: 'var(--c-forward)', tip: 'ถอยสะโพกชิดพนักพิง แล้วยกจอให้สูงระดับสายตา' },
  lean_back:    { th: 'เอนหลังมากไป',     good: false, color: 'var(--c-back)',    tip: 'ปรับพนักพิงให้ตั้งขึ้นเล็กน้อย' },
  lean_left:    { th: 'เอียงซ้าย',         good: false, color: 'var(--c-left)',    tip: 'ถ่ายน้ำหนักให้เท่ากันทั้งสองข้าง' },
  lean_right:   { th: 'เอียงขวา',          good: false, color: 'var(--c-right)',   tip: 'ถ่ายน้ำหนักให้เท่ากันทั้งสองข้าง' },
  perch:        { th: 'นั่งขอบเก้าอี้',     good: false, color: 'var(--c-perch)',   tip: 'เลื่อนก้นเข้าไปให้เต็มเบาะ' },
  unknown:      { th: 'กำลังวิเคราะห์',     good: null,  color: 'var(--c-empty)',   tip: 'AI ยังไม่แน่ใจ รอสักครู่' },
};

export const SITTING_POSTURES = ['upright', 'lean_forward', 'lean_back', 'lean_left', 'lean_right', 'perch'];

export const postureInfo = (p) => POSTURES[p] || POSTURES.unknown;

// สีจริงสำหรับ Chart.js (canvas อ่าน CSS variable ไม่ได้)
export function postureColor(p) {
  const v = postureInfo(p).color.match(/--[\w-]+/)[0];
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#999';
}
export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
