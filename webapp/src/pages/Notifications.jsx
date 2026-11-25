import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, PageHeader, Segmented, Empty, Badge } from '../components/ui';
import Icon from '../components/Icon';
import { useData } from '../context/DataContext';
import { useSegments } from '../lib/useSeries';
import { badRuns } from '../lib/stats';
import { postureInfo } from '../lib/postures';
import { fmtDate, fmtTime, startOfDay, timeAgo } from '../lib/format';

export const BAD_RUN_LIST_SEC = 180;
const PAGE = 15;

// รวม alarm จาก ThingsBoard + ช่วงนั่งผิดท่า + สถานะออฟไลน์ เป็นรายการเดียว
export function buildFeed(alarms, runs, online, lastActivity) {
  const out = alarms.map((a) => {
    const kind = a.type === 'Sit too long' ? 'sit' : a.type === 'Low battery' ? 'battery' : a.type === 'Bad posture' ? 'posture' : 'other';
    const meta = {
      sit: { title: 'นั่งนานเกินกำหนด', icon: 'timer', tone: 'warn', body: `นั่งต่อเนื่อง ${a.details?.sit_minutes ?? ''} นาทีโดยไม่ได้ลุกพัก` },
      battery: { title: 'แบตเตอรี่ใกล้หมด', icon: 'battery', tone: 'bad', body: `แบตเหลือ ${a.details?.battery_pct ?? '<15'}% ควรเสียบสาย USB เพื่อชาร์จ` },
      posture: { title: 'นั่งผิดท่า', icon: 'posture', tone: 'warn', body: 'นั่งผิดท่าต่อเนื่องเกินเวลาที่ตั้งไว้' },
      other: { title: a.type, icon: 'alert', tone: 'info', body: `ระดับ ${a.severity}` },
    }[kind];
    return { id: a.id, kind, ...meta, ts: a.createdTime, endTs: a.cleared ? a.clearTs || a.endTs : null, alarm: a, acknowledged: a.acknowledged, active: !a.cleared };
  });
  for (const r of runs) {
    const p = postureInfo(r.posture);
    out.push({ id: `bad-${r.start}`, kind: 'posture', title: `นั่งผิดท่า: ${p.th}`, icon: 'posture', tone: 'warn',
      body: `${Math.max(1, Math.round((r.end - r.start) / 60000))} นาที · ${p.tip}`, ts: r.start, endTs: r.end, posture: r.posture, acknowledged: true });
  }
  if (lastActivity && !online) {
    out.push({ id: 'offline', kind: 'device', title: 'เก้าอี้ออฟไลน์', icon: 'wifi', tone: 'bad', active: true,
      body: `ไม่ได้รับข้อมูลตั้งแต่ ${timeAgo(lastActivity)} ตรวจ Wi-Fi และแบตเตอรี่`, ts: lastActivity });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

export function useFeed() {
  const { alarms, online, lastActivity, settings } = useData();
  const start = useMemo(() => startOfDay().getTime() - 2 * 86400000, []);
  const { segs, loading } = useSegments(start, start + 4 * 86400000);
  // เก้าอี้เตือนทันทีตามเวลาที่ตั้ง แต่ในรายการเก็บเฉพาะช่วงที่ผิดท่าต่อเนื่องนาน ไม่ให้รายการยาวเกิน
  const runs = useMemo(() => badRuns(segs, Math.max(BAD_RUN_LIST_SEC, settings.bad_posture_alert_sec)), [segs, settings.bad_posture_alert_sec]);
  return { feed: buildFeed(alarms, runs, online, lastActivity), loading };
}

function dayLabel(ts) {
  const d = startOfDay(new Date(ts)).getTime();
  const t = startOfDay().getTime();
  if (d === t) return 'วันนี้';
  if (d === t - 86400000) return 'เมื่อวาน';
  return fmtDate(new Date(ts));
}

export default function Notifications() {
  const { feed, loading } = useFeed();
  const { markSeen, seen } = useData();
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');

  useEffect(() => {
    const ids = feed.filter((f) => f.alarm).map((f) => f.id);
    if (ids.some((i) => !seen.has(i))) markSeen(ids);
  }, [feed]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = feed.filter((f) => filter === 'all' || f.kind === filter);
  const groups = [];
  for (const f of list.slice(0, limit)) {
    const l = dayLabel(f.ts);
    if (!groups.length || groups[groups.length - 1][0] !== l) groups.push([l, []]);
    groups[groups.length - 1][1].push(f);
  }

  return (
    <>
      <PageHeader code="SC-NTS-01-01" title="การแจ้งเตือน" subtitle="นั่งนานเกิน นั่งผิดท่า แบตต่ำ และสถานะเก้าอี้">
        {perm === 'default' && (
          <button className="btn soft" onClick={async () => setPerm(await Notification.requestPermission())}>
            <Icon name="bell" size={18} />เปิดแจ้งเตือนบนเครื่องนี้
          </button>
        )}
      </PageHeader>
      <Segmented value={filter} onChange={(v) => { setFilter(v); setLimit(PAGE); }} options={[['all', 'ทั้งหมด'], ['sit', 'นั่งนาน'], ['posture', 'ผิดท่า'], ['battery', 'แบตเตอรี่'], ['device', 'อุปกรณ์']]} />
      {filter === 'posture' && <p className="muted small">แสดงเฉพาะช่วงที่ผิดท่าต่อเนื่องเกิน {BAD_RUN_LIST_SEC / 60} นาที (เก้าอี้ยังเตือนทันทีตามเวลาที่ตั้งไว้)</p>}
      {loading && !feed.length ? <div className="splash small"><div className="spinner" /></div>
        : !list.length ? <Card><Empty title="ไม่มีการแจ้งเตือน">เยี่ยมมาก! ช่วงนี้ยังไม่มีเรื่องที่ต้องระวัง</Empty></Card>
          : groups.map(([label, items]) => (
            <Card key={label} title={label}>
              <ul className="feed">
                {items.map((f) => (
                  <li key={f.id} className={!f.acknowledged ? 'unread' : ''}>
                    <Link to={`/notifications/${encodeURIComponent(f.id)}`}>
                      <span className={`feed-icon tone-${f.tone}`}><Icon name={f.icon} size={18} /></span>
                      <span className="feed-body">
                        <strong>{f.title}</strong>
                        <small>{f.body}</small>
                      </span>
                      <span className="feed-meta">
                        <small>{fmtTime(new Date(f.ts))}</small>
                        {f.active && <Badge tone={f.tone}>กำลังเกิด</Badge>}
                        {f.alarm && !f.acknowledged && !f.active && <Badge tone="info">ยังไม่รับทราบ</Badge>}
                      </span>
                      <Icon name="chevron" size={16} className="muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
      {list.length > limit && (
        <button className="btn ghost more" onClick={() => setLimit(limit + PAGE)}>แสดงเพิ่ม ({list.length - limit} รายการ)</button>
      )}
    </>
  );
}
