import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, PageHeader, Badge, Empty } from '../components/ui';
import Icon from '../components/Icon';
import PostureFigure from '../components/PostureFigure';
import { useData } from '../context/DataContext';
import { useFeed } from './Notifications';
import { fmtDateTime, fmtDuration } from '../lib/format';

const ADVICE = {
  sit: ['ลุกขึ้นยืน เดินไปดื่มน้ำ หรือยืดเหยียดสัก 3–5 นาที', 'หมุนไหล่และคอเบา ๆ ข้างละ 10 ครั้ง', 'ตั้งเวลานั่งให้สั้นลงได้ที่หน้า "ตั้งค่าแจ้งเตือน"'],
  posture: ['นั่งให้สะโพกชิดพนักพิง หลังตรง', 'วางเท้าราบกับพื้น เข่างอประมาณ 90 องศา', 'จอควรอยู่ระดับสายตา ห่างประมาณหนึ่งช่วงแขน'],
  battery: ['เสียบสาย USB ที่ช่องบนบอร์ดหลังเก้าอี้ ไฟแดงติดระหว่างชาร์จ ไฟเขียวติดเมื่อเต็ม', 'ชาร์จเต็มใช้ได้ประมาณ 3–4 สัปดาห์ (นั่งวันละ 8 ชั่วโมง)', 'ถ้าแบตต่ำกว่า 3.3V เก้าอี้จะหลับลึกเพื่อถนอมถ่าน'],
  device: ['ตรวจว่า Wi-Fi ที่ตั้งไว้ในเฟิร์มแวร์ยังใช้ได้', 'ตรวจแบตเตอรี่และสวิตช์เปิดเครื่อง', 'ถ้าไม่มีคนนั่ง เก้าอี้จะส่งข้อมูลทุก 30 นาทีเท่านั้น'],
  other: ['ดูรายละเอียดเพิ่มเติมใน ThingsBoard'],
};

export default function NotificationDetail() {
  const { id } = useParams();
  const { feed, loading } = useFeed();
  const { ackAlarm } = useData();
  const [busy, setBusy] = useState(false);
  const f = feed.find((x) => x.id === decodeURIComponent(id));

  if (!f) {
    return (<>
      <PageHeader code="SC-NTS-01-02" title="รายละเอียดการแจ้งเตือน" />
      <Card>{loading ? <div className="splash small"><div className="spinner" /></div> : <Empty icon="info" title="ไม่พบรายการนี้">อาจเก่ากว่าช่วงที่เก็บไว้</Empty>}</Card>
    </>);
  }

  const dur = f.endTs ? (f.endTs - f.ts) / 60000 : (Date.now() - f.ts) / 60000;
  return (
    <>
      <Link to="/notifications" className="link back"><Icon name="back" size={18} />การแจ้งเตือนทั้งหมด</Link>
      <PageHeader code="SC-NTS-01-02" title={f.title} subtitle={fmtDateTime(f.ts)}>
        {f.alarm && !f.acknowledged && (
          <button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); await ackAlarm(f.id); setBusy(false); }}>
            <Icon name="check" size={18} />{busy ? 'กำลังบันทึก…' : 'รับทราบ'}
          </button>
        )}
      </PageHeader>
      <div className="grid two-1">
        <Card>
          <div className={`detail-hero tone-${f.tone}`}>
            <span className="feed-icon big"><Icon name={f.icon} size={28} /></span>
            <div>
              <p>{f.body}</p>
              <div className="badges">
                {f.active ? <Badge tone={f.tone}>กำลังเกิดอยู่</Badge> : <Badge tone="good">จบแล้ว</Badge>}
                {f.alarm && (f.acknowledged ? <Badge tone="muted">รับทราบแล้ว</Badge> : <Badge tone="info">ยังไม่รับทราบ</Badge>)}
              </div>
            </div>
          </div>
          <dl className="kv">
            <dt>เริ่ม</dt><dd>{fmtDateTime(f.ts)}</dd>
            {f.endTs && <><dt>สิ้นสุด</dt><dd>{fmtDateTime(f.endTs)}</dd></>}
            {f.kind !== 'device' && <><dt>ระยะเวลา</dt><dd>{fmtDuration(dur)}</dd></>}
            {f.alarm && <><dt>ประเภท (ThingsBoard)</dt><dd>{f.alarm.type} · {f.alarm.severity}</dd></>}
            {f.alarm?.ackTs > 0 && <><dt>รับทราบเมื่อ</dt><dd>{fmtDateTime(f.alarm.ackTs)}</dd></>}
          </dl>
        </Card>
        <Card title="ควรทำอย่างไร" icon="leaf">
          {f.posture && <div className="center"><PostureFigure posture={f.posture} size={150} /></div>}
          <ul className="tips">{(ADVICE[f.kind] || ADVICE.other).map((t) => <li key={t}><Icon name="check" size={16} />{t}</li>)}</ul>
        </Card>
      </div>
    </>
  );
}
