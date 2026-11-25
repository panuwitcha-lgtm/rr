import { useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { Card, PageHeader, Segmented, Stat, Empty } from '../components/ui';
import Icon from '../components/Icon';
import { useData } from '../context/DataContext';
import { useSegments } from '../lib/useSeries';
import { summarize } from '../lib/stats';
import { cssVar } from '../lib/postures';
import { fmtDuration, fmtShortDate, fmtDate, startOfDay, toInputDate } from '../lib/format';
import { useThemeTick } from '../lib/useThemeTick';

const DAY = 86400000;

// แบ่งช่วงเวลาเป็นรายวันแล้วสรุปทีละวัน
export function useDaily(start, end, sitLimit) {
  const { segs, loading, error } = useSegments(start, end, 5 * 60000);
  const days = useMemo(() => {
    const out = [];
    for (let d = start; d < end; d += DAY) {
      const daySegs = segs.filter((s) => s.end > d && s.start < d + DAY)
        .map((s) => ({ ...s, start: Math.max(s.start, d), end: Math.min(s.end, d + DAY) }));
      out.push({ day: d, ...summarize(daySegs, sitLimit) });
    }
    return out;
  }, [segs, start, end, sitLimit]);
  return { days, loading, error };
}

export default function History() {
  const { settings } = useData();
  const tick = useThemeTick();
  const today = startOfDay().getTime();
  const [range, setRange] = useState('7');
  const [from, setFrom] = useState(toInputDate(new Date(today - 13 * DAY)));
  const [to, setTo] = useState(toInputDate(new Date()));

  const [start, end] = useMemo(() => {
    if (range !== 'custom') return [today - (Number(range) - 1) * DAY, today + DAY];
    const s = startOfDay(new Date(`${from}T00:00:00`)).getTime();
    const e = startOfDay(new Date(`${to}T00:00:00`)).getTime() + DAY;
    return [Math.max(s, today - 29 * DAY), Math.max(e, s + DAY)];
  }, [range, from, to, today]);

  const { days, loading } = useDaily(start, end, settings.sit_limit_min);
  const active = days.filter((d) => d.sitMin > 0);
  const avg = (f) => (active.length ? active.reduce((a, d) => a + f(d), 0) / active.length : 0);

  const labels = days.map((d) => fmtShortDate(new Date(d.day)));
  const bar = {
    labels,
    datasets: [
      { label: 'ถูกท่า (ชม.)', data: days.map((d) => +((d.minutes.upright || 0) / 60).toFixed(2)), backgroundColor: cssVar('--c-good'), borderRadius: 6, stack: 's' },
      { label: 'ผิดท่า (ชม.)', data: days.map((d) => +(d.badMin / 60).toFixed(2)), backgroundColor: cssVar('--c-forward'), borderRadius: 6, stack: 's' },
    ],
  };
  const line = {
    labels,
    datasets: [
      { label: 'คะแนน', data: days.map((d) => d.score), borderColor: cssVar('--primary'), backgroundColor: cssVar('--primary-soft'), fill: true, tension: 0.35, pointRadius: 3, spanGaps: true },
      { label: '% ท่าถูก', data: days.map((d) => (d.sitMin ? d.goodPct : null)), borderColor: cssVar('--accent'), borderDash: [5, 4], tension: 0.35, pointRadius: 2, spanGaps: true },
    ],
  };

  const exportCsv = () => {
    const rows = [['วันที่', 'นั่งรวม(นาที)', 'ถูกท่า(%)', 'จำนวนรอบ', 'รอบที่นั่งเกิน', 'คะแนน']];
    for (const d of days) rows.push([toInputDate(new Date(d.day)), Math.round(d.sitMin), d.goodPct, d.sessions.length, d.longSessions, d.score ?? '']);
    const blob = new Blob(['﻿' + rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `health-chair-${toInputDate(new Date(start))}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <PageHeader code="SC-SHS-01-02" title="ประวัติการนั่งย้อนหลัง" subtitle="ดูแนวโน้มรายวัน (ThingsBoard Cloud เก็บข้อมูลย้อนหลังได้ 30 วัน)">
        <button className="btn ghost" onClick={exportCsv}><Icon name="history" size={18} />ส่งออก CSV</button>
      </PageHeader>
      <div className="toolbar">
        <Segmented value={range} onChange={setRange} options={[['7', '7 วัน'], ['14', '14 วัน'], ['30', '30 วัน'], ['custom', 'กำหนดเอง']]} />
        {range === 'custom' && (
          <div className="date-range">
            <input type="date" className="input" value={from} min={toInputDate(new Date(today - 29 * DAY))} max={to} onChange={(e) => setFrom(e.target.value)} />
            <span>ถึง</span>
            <input type="date" className="input" value={to} min={from} max={toInputDate(new Date())} onChange={(e) => setTo(e.target.value)} />
          </div>
        )}
      </div>

      <div className="grid stats-4">
        <Stat icon="timer" label="นั่งเฉลี่ยต่อวัน" value={fmtDuration(avg((d) => d.sitMin))} />
        <Stat icon="check" label="ถูกท่าเฉลี่ย" value={Math.round(avg((d) => d.goodPct))} unit="%" />
        <Stat icon="alert" label="รอบที่นั่งเกินเวลา" value={days.reduce((a, d) => a + d.longSessions, 0)} unit=" ครั้ง" />
        <Stat icon="score" label="คะแนนเฉลี่ย" value={active.length ? Math.round(avg((d) => d.score || 0)) : '-'} unit="/100" />
      </div>

      {loading && !active.length ? <div className="splash small"><div className="spinner" /></div>
        : !active.length ? <Card><Empty icon="history" title="ยังไม่มีข้อมูลในช่วงนี้" /></Card> : (
          <>
            <div className="grid two">
              <Card title="ชั่วโมงที่นั่งต่อวัน" icon="chart">
                <div className="chart-box">
                  <Bar key={tick} data={bar} options={{ maintainAspectRatio: false, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true } }, plugins: { legend: { position: 'bottom' } } }} />
                </div>
              </Card>
              <Card title="แนวโน้มคะแนนการนั่ง" icon="score">
                <div className="chart-box">
                  <Line key={tick} data={line} options={{ maintainAspectRatio: false, scales: { y: { min: 0, max: 100 }, x: { grid: { display: false } } }, plugins: { legend: { position: 'bottom' } } }} />
                </div>
              </Card>
            </div>
            <Card title="สรุปรายวัน" icon="history">
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>วันที่</th><th>นั่งรวม</th><th>ถูกท่า</th><th>รอบ</th><th>เกินเวลา</th><th>คะแนน</th></tr></thead>
                  <tbody>
                    {[...days].reverse().map((d) => (
                      <tr key={d.day}>
                        <td>{fmtDate(new Date(d.day))}</td>
                        <td>{d.sitMin ? fmtDuration(d.sitMin) : '-'}</td>
                        <td>{d.sitMin ? `${d.goodPct}%` : '-'}</td>
                        <td>{d.sessions.length || '-'}</td>
                        <td className={d.longSessions ? 'txt-bad' : ''}>{d.longSessions || '-'}</td>
                        <td>{d.score ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
    </>
  );
}
