import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from './AuthContext';
import { DEFAULTS, DEFAULT_DEVICE_ID, OFFLINE_AFTER_MIN } from '../config';
import { postureInfo } from '../lib/postures';

const Ctx = createContext(null);
const DEV_KEY = 'hc_device';
const APP_KEY = 'hc_app_settings';
const SEEN_KEY = 'hc_seen_alarms';

const readJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const writeJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ไม่มี storage */ } };

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [deviceId, setDeviceIdState] = useState(() => readJson(DEV_KEY, null) || DEFAULT_DEVICE_ID || null);
  const [device, setDevice] = useState(null);
  const [deviceError, setDeviceError] = useState('');
  const [live, setLive] = useState({});
  const [lastTs, setLastTs] = useState(0);
  const [attrs, setAttrs] = useState({ shared: {}, client: {}, server: {} });
  const [appSettings, setAppSettings] = useState(() => ({ app_notify: DEFAULTS.app_notify, ...readJson(APP_KEY, {}) }));
  const [alarms, setAlarms] = useState([]);
  const [seen, setSeen] = useState(() => new Set(readJson(SEEN_KEY, [])));
  const [toasts, setToasts] = useState([]);
  const [standSince, setStandSince] = useState(null);
  const prev = useRef({});

  const setDeviceId = (id) => { writeJson(DEV_KEY, id); setDeviceIdState(id); };

  // หาเครื่องแรกในบัญชี ถ้ายังไม่ได้เลือก
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        if (!deviceId) {
          const list = await api().listDevices(user);
          if (!list.length) { setDeviceError('ยังไม่มีเก้าอี้ในบัญชีนี้ ไปที่หน้า "เชื่อมเก้าอี้" เพื่อเพิ่ม'); return; }
          // เลือกเครื่องที่กำลังออนไลน์ (เช่นตัวจำลอง Wokwi ที่กำลังรัน) ก่อน ถ้าไม่มีค่อยเอาเครื่องแรก
          const pick = list.find((d) => d.active) || list[0];
          if (!off) setDeviceId(pick.id);
          return;
        }
        const d = await api().getDevice(deviceId);
        if (off) return;
        setDevice(d); setDeviceError('');
        const [{ values, ts }, a] = await Promise.all([api().getLatest(deviceId), api().getAttributes(deviceId)]);
        if (off) return;
        setLive(values); setLastTs(Math.max(0, ...Object.values(ts))); setAttrs(a);
      } catch (e) { if (!off) setDeviceError(e.message); }
    })();
    return () => { off = true; };
  }, [deviceId, user]);

  const toast = useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((x) => [...x, { id, ...t }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), t.timeout || 6000);
  }, []);

  const settings = { ...DEFAULTS, ...attrs.shared, ...appSettings };

  // แจ้งเตือนเมื่อค่าสดเปลี่ยน (เด้งในแอป + แจ้งเตือนของเบราว์เซอร์)
  const notify = useCallback((title, body, tone) => {
    if (!settings.app_notify) return;
    toast({ title, body, tone });
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      try { new Notification(title, { body, icon: './favicon.svg' }); } catch { /* บางเบราว์เซอร์ไม่รองรับ */ }
    }
  }, [settings.app_notify, toast]);

  useEffect(() => {
    if (!deviceId || !device) return;
    return api().subscribe(deviceId, (values, ts) => {
      setLive((old) => ({ ...old, ...values }));
      if (ts) setLastTs(ts);
    });
  }, [deviceId, device]);

  useEffect(() => {
    const p = prev.current;
    if (p.alert !== undefined && live.alert !== p.alert) {
      if (live.alert === 'bad_posture') notify('นั่งผิดท่าแล้วนะ', `${postureInfo(live.posture).th}: ${postureInfo(live.posture).tip}`, 'warn');
      if (live.alert === 'sit_too_long') notify('ได้เวลาลุกพักแล้ว', `นั่งต่อเนื่อง ${live.sit_minutes} นาที ลุกยืดเส้นสัก ${settings.rest_min} นาที`, 'bad');
    }
    if (p.battery_pct >= 15 && live.battery_pct < 15) notify('แบตเตอรี่ใกล้หมด', `เหลือ ${live.battery_pct}% เสียบสาย USB เพื่อชาร์จ`, 'bad');
    if (p.occupied === true && live.occupied === false) setStandSince(Date.now());
    if (live.occupied) setStandSince(null);
    prev.current = live;
  }, [live, notify, settings.rest_min]);

  const refreshAlarms = useCallback(async () => {
    if (!deviceId) return;
    try { setAlarms(await api().getAlarms(deviceId)); } catch { /* ลองใหม่รอบหน้า */ }
  }, [deviceId]);
  useEffect(() => { refreshAlarms(); const t = setInterval(refreshAlarms, 30000); return () => clearInterval(t); }, [refreshAlarms]);

  const ackAlarm = async (id) => { await api().ackAlarm(id); await refreshAlarms(); };
  const markSeen = (ids) => { const s = new Set([...seen, ...ids]); setSeen(s); writeJson(SEEN_KEY, [...s].slice(-500)); };

  const saveSettings = async (patch) => {
    const { app_notify, ...dev } = patch;
    if (app_notify !== undefined) { const a = { ...appSettings, app_notify }; setAppSettings(a); writeJson(APP_KEY, a); }
    if (Object.keys(dev).length) {
      await api().saveShared(deviceId, dev);
      setAttrs((a) => ({ ...a, shared: { ...a.shared, ...dev } }));
    }
  };

  const lastActivity = Math.max(lastTs || 0, attrs.server.lastActivityTime || 0);
  const online = lastActivity > 0 && Date.now() - lastActivity < OFFLINE_AFTER_MIN * 60000;
  const unread = alarms.filter((a) => !a.acknowledged && !seen.has(a.id)).length + (lastActivity && !online ? 1 : 0);

  return (
    <Ctx.Provider value={{
      deviceId, setDeviceId, device, deviceError, live, lastTs, lastActivity, online, attrs, settings, saveSettings,
      alarms, refreshAlarms, ackAlarm, unread, seen, markSeen, toast, toasts, standSince,
    }}>
      {children}
    </Ctx.Provider>
  );
}
export const useData = () => useContext(Ctx);
