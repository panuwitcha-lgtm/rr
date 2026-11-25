import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { Card, PageHeader, Ring, Stat, Badge } from '../components/ui';
import Icon from '../components/Icon';
import PostureFigure from '../components/PostureFigure';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useSegments } from '../lib/useSeries';
import { hourly, scoreLevel, summarize } from '../lib/stats';
import { postureInfo, cssVar } from '../lib/postures';
import { fmtDuration, fmtDateLong, pad, startOfDay, timeAgo } from '../lib/format';
import { useNow, useThemeTick } from '../lib/useThemeTick';
import { buildFeed } from './Notifications';

function greet(h) { return h < 12 ? 'สวัสดีตอนเช้า' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น'; }

export default function Dashboard() {
  const { user } = useAuth();
  const { live, settings, alarms, online, lastActivity, deviceError } = useData();
  const now = new Date(useNow(1000));
  const tick = useThemeTick();
  const day = useMemo(() => startOfDay().getTime(), []);
  const { segs } = useSegments(day, day + 86400000);
  const sum = useMemo(() => summarize(segs, settings.sit_limit_min), [segs, settings.sit_limit_min]);
  const hours = useMemo(() => hourly(segs, day), [segs, day]);
  const info = postureInfo(live.posture);
  const lvl = scoreLevel(sum.score);
  const sitPct = (live.sit_minutes || 0) / settings.sit_limit_min;
  const feed = buildFeed(alarms, [], online, lastActivity).slice(0, 4);

  const used = hours.good.map((g, i) => g + hours.bad[i] > 0);
  const h0 = Math.min(7, Math.max(0, used.indexOf(true)));
  const h1 = Math.max(20, used.lastIndexOf(true) + 1, now.getHours() + 1);
  const labels = Array.from({ length: h1 - h0 }, (_, i) => `${pad(h0 + i)}`);
  const data = {
    labels,
    datasets: [
      { label: 'ท่าถูก', data: hours.good.slice(h0, h1).map((v) => +v.toFixed(1)), backgroundColor: cssVar('--c-good'), borderRadius: 6, stack: 's' },
      { label: 'ท่าผิด', data: hours.bad.slice(h0, h1).map((v) => +v.toFixed(1)), backgroundColor: cssVar('--c-forward'), borderRadius: 6, stack: 's' },
    ],
  };

  return (
    <>
      <PageHeader code="SC-SMS-01-01" title={`${greet(now.getHours())}, ${user.firstName || user.name}`} subtitle="ภาพรวมการนั่งของคุณวันนี้" />
      {deviceError && <div className="alert tone-warn"><Icon name="alert" size={18} />{deviceError} <Link to="/device/link" className="link">เชื่อมเก้าอี้</Link></div>}

      <div className="grid hero-grid">
        <Card className="clock-card">
          <span className="muted">เวลาขณะนี้</span>
          <div className="big-clock">{pad(now.getHours())}:{pad(now.getMinutes())}<span>:{pad(now.getSeconds())}</span></div>
          <span className="muted">{fmtDateLong(now)}</span>
          <div className={`status-line tone-${info.good === false ? 'warn' : live.occupied ? 'good' : 'muted'}`}>
            <Icon name={live.occupied ? (info.good === false ? 'alert' : 'check') : 'leaf'} size={18} />
            {!live.occupied ? 'ตอนนี้ไม่ได้นั่ง พักผ่อนให้สบาย' : info.good === false ? `${info.th} — ${info.tip}` : 'นั่งได้ดีมาก รักษาท่านี้ไว้นะ'}
          </div>
        </Card>

        <Card title="ท่านั่งตอนนี้" icon="posture" action={<Link to="/live" className="link sm">ดูละเอียด</Link>} className="posture-card">
          <div className="posture-now">
            <PostureFigure posture={live.posture} backrestDeg={live.backrest_deg} size={150} />
            <div>
              <strong className="posture-name" style={{ color: info.color }}>{info.th}</strong>
              <p className="muted">{info.tip}</p>
              {live.occupied && live.confidence > 0 && <Badge tone="info">AI มั่นใจ {Math.round(live.confidence * 100)}%</Badge>}
            </div>
          </div>
        </Card>

        <Card title="นั่งต่อเนื่อง" icon="timer" action={<Link to="/timer" className="link sm">จับเวลา</Link>} className="center">
          <Ring value={sitPct} color={sitPct >= 1 ? 'var(--bad)' : sitPct > 0.8 ? 'var(--warn)' : 'var(--primary)'}>
            <strong className="ring-num">{live.sit_minutes ?? 0}</strong><small>จาก {settings.sit_limit_min} นาที</small>
          </Ring>
          <p className="muted small">{live.occupied ? (sitPct >= 1 ? 'ได้เวลาลุกพักแล้ว' : `อีก ${Math.max(0, settings.sit_limit_min - (live.sit_minutes || 0))} นาทีควรลุกพัก`) : 'ยังไม่ได้นั่ง'}</p>
        </Card>
      </div>

      <div className="grid stats-4">
        <Stat icon="timer" label="นั่งรวมวันนี้" value={fmtDuration(sum.sitMin)} />
        <Stat icon="check" label="นั่งถูกท่า" value={sum.goodPct} unit="%" tone={sum.goodPct >= 70 ? 'good' : sum.goodPct >= 50 ? 'warn' : 'bad'} />
        <Stat icon="score" label="คะแนนวันนี้" value={sum.score ?? '-'} unit={sum.score != null ? '/100' : ''} hint={lvl.th} tone={lvl.tone} />
        <Stat icon="battery" label="แบตเตอรี่" value={live.battery_pct ?? '-'} unit="%" hint={online ? 'ออนไลน์' : `ออฟไลน์ · ${timeAgo(lastActivity)}`} tone={live.battery_pct < 15 ? 'bad' : live.battery_pct < 30 ? 'warn' : undefined} />
      </div>

      <div className="grid two-1">
        <Card title="การนั่งรายชั่วโมง (นาที)" icon="chart" action={<Link to="/stats/today" className="link sm">ดูกราฟเต็ม</Link>}>
          <div className="chart-box sm">
            <Bar key={tick} data={data} options={{ maintainAspectRatio: false, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, max: 60, ticks: { stepSize: 15 } } }, plugins: { legend: { position: 'bottom' } } }} />
          </div>
        </Card>
        <Card title="แจ้งเตือนล่าสุด" icon="bell" action={<Link to="/notifications" className="link sm">ทั้งหมด</Link>}>
          {feed.length ? (
            <ul className="feed compact">
              {feed.map((f) => (
                <li key={f.id}><Link to={`/notifications/${encodeURIComponent(f.id)}`}>
                  <span className={`feed-icon tone-${f.tone}`}><Icon name={f.icon} size={16} /></span>
                  <span><strong>{f.title}</strong><small>{timeAgo(f.ts)}</small></span>
                </Link></li>
              ))}
            </ul>
          ) : <p className="muted">ยังไม่มีแจ้งเตือน</p>}
        </Card>
      </div>
    </>
  );
}
