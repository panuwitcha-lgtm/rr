import { useEffect, useState } from 'react';
import { api } from '../api';
import { useData } from '../context/DataContext';
import { toSegments } from './stats';

// ดึง posture ย้อนหลังแล้วแปลงเป็นช่วงเวลา (รีเฟรชทุก refreshMs ถ้าช่วงนั้นรวมเวลาปัจจุบัน)
export function useSegments(startTs, endTs, refreshMs = 60000) {
  const { deviceId } = useData();
  const [state, setState] = useState({ segs: [], loading: true, error: '' });
  useEffect(() => {
    if (!deviceId) return;
    let off = false;
    const load = async () => {
      try {
        const end = Math.min(endTs, Date.now());
        const pts = await api().getPostureSeries(deviceId, startTs, end);
        if (!off) setState({ segs: toSegments(pts, end), loading: false, error: '' });
      } catch (e) { if (!off) setState((s) => ({ ...s, loading: false, error: e.message })); }
    };
    setState((s) => ({ ...s, loading: true }));
    load();
    const live = endTs > Date.now();
    const t = live ? setInterval(load, refreshMs) : null;
    return () => { off = true; clearInterval(t); };
  }, [deviceId, startTs, endTs, refreshMs]);
  return state;
}
