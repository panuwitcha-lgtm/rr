import { useEffect, useState } from 'react';
import { applyChartTheme } from './chart';

// คืนเลขที่เปลี่ยนเมื่อสลับธีม ใช้เป็น key ให้กราฟวาดใหม่ด้วยสีใหม่
export function useThemeTick() {
  const [n, setN] = useState(0);
  useEffect(() => {
    applyChartTheme();
    const bump = () => { applyChartTheme(); setN((x) => x + 1); };
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    window.addEventListener('hc-theme', bump);
    mq.addEventListener('change', bump);
    return () => { window.removeEventListener('hc-theme', bump); mq.removeEventListener('change', bump); };
  }, []);
  return n;
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
