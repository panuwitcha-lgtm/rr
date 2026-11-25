import { useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Card, PageHeader, Stat, Empty } from '../components/ui';
import { useData } from '../context/DataContext';
import { useSegments } from '../lib/useSeries';
import { hourly, scoreLevel, summarize } from '../lib/stats';
import { POSTURES, SITTING_POSTURES, cssVar, postureColor } from '../lib/postures';
import { fmtDuration, fmtTime, pad, startOfDay, toInputDate } from '../lib/format';
import { useThemeTick } from '../lib/useThemeTick';

export default function TodayStats() {
  const { settings } = useData();
  const tick = useThemeTick();
  const [dateStr, setDateStr] = useState(toInputDate(new Date()));
  const day = useMemo(() => startOfDay(new Date(`${dateStr}T00:00:00`)).getTime(), [dateStr]);
  const { segs, loading } = useSegments(day, day + 86400000);
  const sum = useMemo(() => summarize(segs, settings.sit_limit_min), [segs, settings.sit_limit_min]);
  const hours = useMemo(() => hourly(segs, day), [segs, day]);
  const isToday = day === startOfDay().getTime();
  const lvl = scoreLevel(sum.score);

  const used = hours.good.map((g, i) => g + hours.bad[i] > 0);
  const h0 = Math.min(6, Math.max(0, used.indexOf(true)));
  const h1 = Math.max(22, used.lastIndexOf(true) + 1);
  const bar = {
    labels: Array.from({ length: h1 - h0 }, (_, i) => `${pad(h0 + i)}:00`),
    datasets: [
      { label: 'นั่งถูกท่า', data: hours.good.slice(h0, h1).map((v) => +v.toFixed(1)), backgroundColor: cssVar('--c-good'), borderRadius: 6, stack: 's' },
      { label: 'นั่งผิดท่า', data: hours.bad.slice(h0, h1).map((v) => +v.toFixed(1)), backgroundColor: cssVar('--c-forward'), borderRadius: 6, stack: 's' },
    ],
  };
  const dn = {
    labels: SITTING_POSTURES.map((p) => POSTURES[p].th),
    datasets: [{ data: SITTING_POSTURES.map((p) => +(sum.minutes[p] || 0).toFixed(1)), backgroundColor: SITTING_POSTURES.map(postureColor), borderWidth: 0, spacing: 2 }],
  };

  return (
    <>
      <PageHeader code="SC-SHS-01-01" title={isToday ? 'กราฟการนั่งวันนี้' : 'กราฟการนั่งรายวัน'} subtitle="เวลานั่งแต่ละชั่วโมง และสัดส่วนท่านั่ง">
        <input type="date" className="input" value={dateStr} max={toInputDate(new Date())} onChange={(e) => e.target.value && setDateStr(e.target.value)} />
      </PageHeader>

      <div className="grid stats-4">
        <Stat icon="timer" label="นั่งรวม" value={fmtDuration(sum.sitMin)} />
        <Stat icon="check" label="นั่งถูกท่า" value={sum.goodPct} unit="%" tone={sum.goodPct >= 70 ? 'good' : 'warn'} />
        <Stat icon="history" label="จำนวนรอบที่นั่ง" value={sum.sessions.length} unit=" รอบ" hint={`นานสุด ${fmtDuration(sum.longest)}`} />
        <Stat icon="score" label="คะแนน" value={sum.score ?? '-'} unit={sum.score != null ? '/100' : ''} hint={lvl.th} tone={lvl.tone} />
      </div>

      {!loading && !sum.sitMin ? <Card><Empty icon="chart" title="ไม่มีข้อมูลการนั่งในวันนี้">ลองเลือกวันอื่น หรือรอให้มีคนนั่งเก้าอี้</Empty></Card> : (
        <div className="grid two-1">
          <Card title="เวลานั่งรายชั่วโมง (นาที)" icon="chart">
            <div className="chart-box">
              <Bar key={tick} data={bar} options={{ maintainAspectRatio: false, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, max: 60, ticks: { stepSize: 15 } } }, plugins: { legend: { position: 'bottom' } } }} />
            </div>
          </Card>
          <Card title="สัดส่วนท่านั่ง" icon="posture">
            <div className="chart-box donut">
              <Doughnut key={tick} data={dn} options={{ maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${fmtDuration(c.raw)}` } } } }} />
              <div className="donut-center"><strong>{sum.goodPct}%</strong><small>ท่าถูก</small></div>
            </div>
            <ul className="legend-list">
              {SITTING_POSTURES.map((p) => (
                <li key={p}><i style={{ background: POSTURES[p].color }} />{POSTURES[p].th}<b>{fmtDuration(sum.minutes[p] || 0)}</b></li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {sum.sessions.length > 0 && (
        <Card title="รอบการนั่ง" icon="timer">
          <table className="table">
            <thead><tr><th>เริ่ม</th><th>ลุก</th><th>ระยะเวลา</th><th>สถานะ</th></tr></thead>
            <tbody>
              {sum.sessions.map((s) => (
                <tr key={s.start}>
                  <td>{fmtTime(new Date(s.start))}</td><td>{fmtTime(new Date(s.end))}</td><td>{fmtDuration(s.minutes)}</td>
                  <td>{s.minutes >= settings.sit_limit_min ? <span className="txt-bad">เกิน {settings.sit_limit_min} นาที</span> : <span className="txt-good">พอดี</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
