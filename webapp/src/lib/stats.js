import { SITTING_POSTURES, postureInfo } from './postures';

// เฟิร์มแวร์ส่ง posture เมื่อเปลี่ยนท่า และส่งซ้ำทุก 60 วินาที
// ถ้าเว้นช่วงนานกว่านี้ถือว่าข้อมูลขาด (เช่น เน็ตหลุด) ไม่นับเวลา
const MAX_GAP_MS = 90 * 1000;
// ลุกไม่ถึง 60 วินาทีถือว่ายังนั่งรอบเดิม (ตรงกับ STAND_RESET_SEC ในเฟิร์มแวร์)
const STAND_RESET_MS = 60 * 1000;

// แปลงจุด posture เป็นช่วงเวลา [{start, end, posture}]
export function toSegments(points, endTs = Date.now()) {
  const pts = [...points].sort((a, b) => a.ts - b.ts);
  const segs = [];
  for (let i = 0; i < pts.length; i++) {
    const start = pts[i].ts;
    const next = i + 1 < pts.length ? pts[i + 1].ts : endTs;
    const end = Math.min(next, start + MAX_GAP_MS);
    if (end <= start) continue;
    const last = segs[segs.length - 1];
    if (last && last.posture === pts[i].v && last.end === start) last.end = end;
    else segs.push({ start, end, posture: pts[i].v });
  }
  return segs;
}

const isSit = (p) => SITTING_POSTURES.includes(p) || p === 'unknown';

// รอบการนั่ง (ลุกสั้นกว่า 60 วินาทีถือว่ารอบเดียวกัน)
export function toSessions(segs) {
  const out = [];
  for (const s of segs) {
    if (!isSit(s.posture)) continue;
    const last = out[out.length - 1];
    if (last && s.start - last.end < STAND_RESET_MS) last.end = s.end;
    else out.push({ start: s.start, end: s.end });
  }
  return out.map((s) => ({ ...s, minutes: (s.end - s.start) / 60000 }));
}

// สรุปช่วงเวลาหนึ่ง (เช่น 1 วัน)
export function summarize(segs, sitLimitMin = 45) {
  const byPosture = {};
  let sitMs = 0;
  for (const s of segs) {
    const ms = s.end - s.start;
    byPosture[s.posture] = (byPosture[s.posture] || 0) + ms;
    if (isSit(s.posture)) sitMs += ms;
  }
  const known = SITTING_POSTURES.reduce((a, p) => a + (byPosture[p] || 0), 0);
  const goodPct = known ? Math.round(((byPosture.upright || 0) / known) * 100) : 0;
  const sessions = toSessions(segs);
  const longSessions = sessions.filter((s) => s.minutes >= sitLimitMin).length;
  const longest = sessions.reduce((a, s) => Math.max(a, s.minutes), 0);
  const score = sitScore(goodPct, longSessions, sitMs);
  const minutes = {};
  for (const k in byPosture) minutes[k] = byPosture[k] / 60000;
  return {
    sitMin: sitMs / 60000, goodPct, sessions, longSessions, longest, score, minutes,
    badMin: SITTING_POSTURES.filter((p) => p !== 'upright').reduce((a, p) => a + (minutes[p] || 0), 0),
  };
}

// คะแนนการนั่ง 0-100: ท่าถูก 70% + การลุกพักตามเวลา 30%
export function sitScore(goodPct, longSessions, sitMs) {
  if (!sitMs) return null;
  const breakScore = Math.max(0, 100 - longSessions * 25);
  return Math.round(goodPct * 0.7 + breakScore * 0.3);
}

export function scoreLevel(score) {
  if (score == null) return { th: 'ยังไม่มีข้อมูล', tone: 'muted' };
  if (score >= 80) return { th: 'ดีมาก', tone: 'good' };
  if (score >= 60) return { th: 'ดี', tone: 'good' };
  if (score >= 40) return { th: 'พอใช้', tone: 'warn' };
  return { th: 'ควรปรับปรุง', tone: 'bad' };
}

// นาทีที่นั่งในแต่ละชั่วโมงของวัน แยกท่าถูก/ผิด
export function hourly(segs, dayStart) {
  const good = Array(24).fill(0), bad = Array(24).fill(0);
  for (const s of segs) {
    if (!isSit(s.posture)) continue;
    let t = s.start;
    while (t < s.end) {
      const h = Math.floor((t - dayStart) / 3600000);
      const hEnd = dayStart + (h + 1) * 3600000;
      const e = Math.min(s.end, hEnd);
      if (h >= 0 && h < 24) (postureInfo(s.posture).good === false ? bad : good)[h] += (e - t) / 60000;
      t = e;
    }
  }
  return { good, bad };
}

// ช่วงที่นั่งผิดท่าต่อเนื่องนานกว่า alertSec (ใช้ทำรายการแจ้งเตือน)
export function badRuns(segs, alertSec = 10) {
  const out = [];
  for (const s of segs) {
    if (postureInfo(s.posture).good !== false) continue;
    const last = out[out.length - 1];
    if (last && last.posture === s.posture && s.start - last.end < 3000) last.end = s.end;
    else out.push({ ...s });
  }
  return out.filter((r) => r.end - r.start >= alertSec * 1000);
}
