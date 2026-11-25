import { useMemo, useRef } from 'react';
import { Card, PageHeader, Ring } from '../components/ui';
import Icon from '../components/Icon';
import { useData } from '../context/DataContext';
import { useSegments } from '../lib/useSeries';
import { summarize } from '../lib/stats';
import { fmtClock, fmtDateLong, fmtDuration, fmtTime, pad, startOfDay } from '../lib/format';
import { useNow } from '../lib/useThemeTick';

export default function SitTimer() {
  const { live, settings, standSince } = useData();
  const now = useNow(1000);
  const d = new Date(now);
  const minRef = useRef({ min: null, at: now });
  if (live.sit_minutes !== minRef.current.min) minRef.current = { min: live.sit_minutes, at: now };

  const limitSec = settings.sit_limit_min * 60;
  const restSec = (settings.rest_min || 5) * 60;
  const sitSec = live.occupied ? (live.sit_minutes || 0) * 60 + Math.min(59, (now - minRef.current.at) / 1000) : 0;
  const restedSec = !live.occupied && standSince ? (now - standSince) / 1000 : 0;

  const day = useMemo(() => startOfDay().getTime(), []);
  const { segs } = useSegments(day, day + 86400000);
  const sessions = useMemo(() => summarize(segs, settings.sit_limit_min).sessions, [segs, settings.sit_limit_min]);

  const over = sitSec >= limitSec;
  const sitting = !!live.occupied;

  return (
    <>
      <PageHeader code="SC-SMS-01-03" title="จับเวลานั่ง / พัก" subtitle={`นั่งได้ ${settings.sit_limit_min} นาที แล้วลุกพัก ${settings.rest_min} นาที (แก้ได้ที่ตั้งค่า)`}>
      </PageHeader>

      <div className="grid timer-grid">
        <Card className="center timer-card">
          <span className="timer-state">{sitting ? (over ? 'ได้เวลาลุกพักแล้ว' : 'กำลังนั่ง') : 'กำลังพัก'}</span>
          <Ring size={260} stroke={16}
            value={sitting ? sitSec / limitSec : restedSec / restSec}
            color={sitting ? (over ? 'var(--bad)' : 'var(--primary)') : 'var(--accent)'}>
            <strong className="timer-num">{sitting ? fmtClock(over ? sitSec - limitSec : limitSec - sitSec) : fmtClock(Math.max(0, restSec - restedSec))}</strong>
            <small>{sitting ? (over ? 'เกินเวลามาแล้ว' : 'เหลือก่อนลุกพัก') : restedSec >= restSec ? 'พักครบแล้ว นั่งต่อได้' : 'เวลาพักที่เหลือ'}</small>
          </Ring>
          <p className="muted">{sitting ? `นั่งต่อเนื่องมาแล้ว ${fmtClock(sitSec)}` : standSince ? `ลุกเมื่อ ${fmtTime(new Date(standSince))}` : 'ยังไม่ได้นั่ง'}</p>
        </Card>
        <Card className="center clock-big-card">
          <span className="muted">เวลาขณะนี้</span>
          <div className="big-clock xl">{pad(d.getHours())}:{pad(d.getMinutes())}<span>:{pad(d.getSeconds())}</span></div>
          <span>{fmtDateLong(d)}</span>
          <ul className="rule-list">
            <li><Icon name="timer" size={16} />เก้าอี้บี๊บยาวเมื่อนั่งครบ {settings.sit_limit_min} นาที</li>
            <li><Icon name="stand" size={16} />ลุกเกิน 1 นาที เวลานั่งจะเริ่มนับใหม่</li>
            <li><Icon name="leaf" size={16} />แนะนำพักอย่างน้อย {settings.rest_min} นาที</li>
          </ul>
        </Card>
      </div>

      <Card title="รอบการนั่งวันนี้" icon="history">
        <div className="day-bar" aria-label="แถบเวลาการนั่งวันนี้">
          {sessions.map((s) => {
            const left = ((s.start - day) / 86400000) * 100, width = Math.max(0.3, ((s.end - s.start) / 86400000) * 100);
            return <i key={s.start} className={s.minutes >= settings.sit_limit_min ? 'long' : ''} style={{ left: `${left}%`, width: `${width}%` }} title={`${fmtTime(new Date(s.start))}–${fmtTime(new Date(s.end))}`} />;
          })}
          <b style={{ left: `${((now - day) / 86400000) * 100}%` }} />
        </div>
        <div className="day-ticks">{[0, 6, 12, 18, 24].map((h) => <span key={h}>{pad(h)}:00</span>)}</div>
        <ul className="session-list">
          {[...sessions].reverse().slice(0, 6).map((s) => (
            <li key={s.start}>
              <span>{fmtTime(new Date(s.start))} – {fmtTime(new Date(s.end))}</span>
              <b className={s.minutes >= settings.sit_limit_min ? 'txt-bad' : ''}>{fmtDuration(s.minutes)}</b>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
