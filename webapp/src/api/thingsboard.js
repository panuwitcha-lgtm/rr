// เชื่อม ThingsBoard ผ่าน REST API + WebSocket
// เอกสาร: https://thingsboard.io/docs/reference/rest-api/
import { TB_URL } from '../config';

const LIVE_KEYS = ['posture', 'occupied', 'bad_posture', 'bad_posture_sec', 'sit_minutes', 'alert',
  'fsr1', 'fsr2', 'fsr3', 'fsr4', 'fsr5', 'fsr6', 'backrest_deg', 'confidence', 'anomaly', 'battery_v', 'battery_pct'];
const STORE = 'hc_tb_auth';

let auth = load();
function load() { try { return JSON.parse(localStorage.getItem(STORE)) || null; } catch { return null; } }
function save(a) { auth = a; try { a ? localStorage.setItem(STORE, JSON.stringify(a)) : localStorage.removeItem(STORE); } catch { /* ไม่มี storage */ } }

// ThingsBoard ส่งค่า telemetry มาเป็น string ต้องแปลงกลับ
function parse(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(v)) return Number(v);
  return v;
}

class TbError extends Error {}

async function req(path, { method = 'GET', body, noAuth = false, retry = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (!noAuth && auth?.token) headers['X-Authorization'] = `Bearer ${auth.token}`;
  let res;
  try {
    res = await fetch(TB_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new TbError('เชื่อมต่อ ThingsBoard ไม่ได้ ตรวจอินเทอร์เน็ตหรือ TB_URL ใน src/config.js');
  }
  if (res.status === 401 && retry && auth?.refreshToken && !noAuth) {
    if (await refresh()) return req(path, { method, body, retry: false });
  }
  if (!res.ok) {
    let msg = `ThingsBoard ตอบกลับ ${res.status}`;
    try { const j = await res.json(); if (j.message) msg = j.message; } catch { /* ไม่มี body */ }
    if (res.status === 401) msg = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    if (res.status === 403) msg = 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้';
    throw new TbError(msg);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function refresh() {
  try {
    const r = await req('/api/auth/token', { method: 'POST', body: { refreshToken: auth.refreshToken }, noAuth: true });
    save({ ...auth, token: r.token, refreshToken: r.refreshToken });
    return true;
  } catch { save(null); return false; }
}

function toUser(u) {
  return {
    id: u.id?.id, email: u.email, authority: u.authority, customerId: u.customerId?.id,
    firstName: u.firstName || '', lastName: u.lastName || '',
    name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
  };
}

const tel = (id) => `/api/plugins/telemetry/DEVICE/${id}`;

export const thingsboard = {
  async login(username, password) {
    const r = await req('/api/auth/login', { method: 'POST', body: { username, password }, noAuth: true });
    save({ token: r.token, refreshToken: r.refreshToken });
    return toUser(await req('/api/auth/user'));
  },

  async restore() {
    if (!auth?.token) return null;
    try { return toUser(await req('/api/auth/user')); } catch { save(null); return null; }
  },

  async logout() {
    try { await req('/api/auth/logout', { method: 'POST' }); } catch { /* token หมดอายุแล้วก็ไม่เป็นไร */ }
    save(null);
  },

  resetPassword: (email) => req('/api/noauth/resetPasswordByEmail', { method: 'POST', body: { email }, noAuth: true }),

  async updateProfile(user, patch) {
    const u = await req('/api/auth/user');
    return toUser(await req('/api/user', { method: 'POST', body: { ...u, ...patch } }));
  },

  async listDevices(user) {
    const q = '?pageSize=50&page=0&sortProperty=name&sortOrder=ASC';
    // ThingsBoard Cloud (PE) ไม่มี /api/tenant/deviceInfos (ตอบ "Invalid UUID string: deviceInfos")
    // เลยลองทีละ endpoint: แบบ PE ก่อน แล้วค่อยแบบ CE
    const paths = user.authority === 'CUSTOMER_USER'
      ? [`/api/customer/${user.customerId}/deviceInfos${q}`, `/api/customer/${user.customerId}/devices${q}`]
      : [`/api/deviceInfos/all${q}`, `/api/tenant/deviceInfos${q}`, `/api/tenant/devices${q}`];
    let err;
    for (const p of paths) {
      try {
        const r = await req(p);
        return (r.data || []).map((d) => ({ id: d.id.id, name: d.name, label: d.label, type: d.type, active: d.active }));
      } catch (e) { err = e; }
    }
    throw err;
  },

  async getDevice(id) {
    const d = await req(`/api/device/${id}`);
    return { id: d.id.id, name: d.name, label: d.label, type: d.type };
  },

  async getLatest(id) {
    const r = await req(`${tel(id)}/values/timeseries?keys=${LIVE_KEYS.join(',')}`);
    const values = {}, ts = {};
    for (const k in r) if (r[k]?.[0]) { values[k] = parse(r[k][0].value); ts[k] = r[k][0].ts; }
    return { values, ts };
  },

  async getAttributes(id) {
    const get = async (scope) => {
      const out = {};
      try { for (const a of await req(`${tel(id)}/values/attributes/${scope}`)) out[a.key] = a.value; } catch { /* scope ว่าง */ }
      return out;
    };
    const [shared, client, server] = await Promise.all([get('SHARED_SCOPE'), get('CLIENT_SCOPE'), get('SERVER_SCOPE')]);
    return { shared, client, server };
  },

  saveShared: (id, values) => req(`${tel(id)}/attributes/SHARED_SCOPE`, { method: 'POST', body: values }),

  // ดึง posture ย้อนหลัง แบ่งเป็นช่วงละ 3 วันกันข้อมูลก้อนใหญ่เกิน
  async getPostureSeries(id, startTs, endTs) {
    const out = [];
    const step = 3 * 86400000;
    for (let s = startTs; s < endTs; s += step) {
      const e = Math.min(endTs, s + step);
      const r = await req(`${tel(id)}/values/timeseries?keys=posture&startTs=${s}&endTs=${e}&limit=100000&agg=NONE&orderBy=ASC`);
      for (const p of r.posture || []) out.push({ ts: p.ts, v: p.value });
    }
    return out;
  },

  async getAlarms(id) {
    const r = await req(`/api/alarm/DEVICE/${id}?pageSize=100&page=0&sortProperty=createdTime&sortOrder=DESC`);
    return (r.data || []).map((a) => ({
      id: a.id.id, type: a.type, severity: a.severity, status: a.status,
      createdTime: a.createdTime, endTs: a.endTs, ackTs: a.ackTs, clearTs: a.clearTs,
      acknowledged: a.acknowledged ?? a.status.endsWith('_ACK'),
      cleared: a.cleared ?? a.status.startsWith('CLEARED'),
      details: a.details,
    }));
  },

  ackAlarm: (alarmId) => req(`/api/alarm/${alarmId}/ack`, { method: 'POST' }),

  // รับค่าสดผ่าน WebSocket ถ้าต่อไม่ได้จะถอยไปดึงทุก 3 วินาที
  subscribe(id, onData) {
    let ws, timer, closed = false;
    const poll = () => {
      if (timer) return;
      timer = setInterval(async () => {
        try { const { values, ts } = await this.getLatest(id); onData(values, Math.max(0, ...Object.values(ts))); } catch { /* รอรอบหน้า */ }
      }, 3000);
    };
    try {
      const base = TB_URL ? TB_URL.replace(/^http/, 'ws') : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
      ws = new WebSocket(`${base}/api/ws/plugins/telemetry?token=${auth.token}`);
      ws.onopen = () => ws.send(JSON.stringify({
        tsSubCmds: [{ entityType: 'DEVICE', entityId: id, scope: 'LATEST_TELEMETRY', cmdId: 1 }], historyCmds: [], attrSubCmds: [],
      }));
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (!m.data) return;
        const values = {};
        let last = 0;
        for (const k in m.data) if (m.data[k]?.[0]) { values[k] = parse(m.data[k][0][1]); last = Math.max(last, m.data[k][0][0]); }
        onData(values, last);
      };
      ws.onerror = () => !closed && poll();
      ws.onclose = () => !closed && poll();
    } catch { poll(); }
    return () => { closed = true; ws?.close(); clearInterval(timer); };
  },
};
