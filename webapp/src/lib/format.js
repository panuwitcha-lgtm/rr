export const pad = (n) => String(n).padStart(2, '0');

export function fmtDuration(min) {
  if (min == null || isNaN(min)) return '-';
  const m = Math.round(min);
  if (m < 60) return `${m} นาที`;
  return `${Math.floor(m / 60)} ชม. ${pad(m % 60)} นาที`;
}

export function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  return h ? `${h}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export const fmtDate = (d) => `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
export const fmtDateLong = (d) => `วัน${TH_DAYS[d.getDay()]}ที่ ${fmtDate(d)}`;
export const fmtTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const fmtDateTime = (ts) => { const d = new Date(ts); return `${fmtDate(d)} ${fmtTime(d)}`; };
export const fmtShortDate = (d) => `${d.getDate()} ${TH_MONTHS[d.getMonth()]}`;

export function timeAgo(ts) {
  if (!ts) return '-';
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'เมื่อสักครู่';
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชั่วโมงที่แล้ว`;
  return `${Math.floor(s / 86400)} วันที่แล้ว`;
}

export const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const toInputDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
