import { useEffect, useRef, useState } from 'react';
import { Card, PageHeader, Badge } from '../components/ui';
import Icon from '../components/Icon';
import PostureFigure from '../components/PostureFigure';
import PressureMap from '../components/PressureMap';
import { useData } from '../context/DataContext';
import { POSTURES, SITTING_POSTURES, postureInfo } from '../lib/postures';
import { fmtTime, timeAgo } from '../lib/format';

export default function LivePosture() {
  const { live, attrs, lastTs, settings } = useData();
  const info = postureInfo(live.posture);
  const [log, setLog] = useState([]);
  const last = useRef(null);

  // เก็บประวัติการเปลี่ยนท่าระหว่างเปิดหน้านี้
  useEffect(() => {
    if (!live.posture || live.posture === last.current) return;
    last.current = live.posture;
    setLog((l) => [{ ts: Date.now(), p: live.posture }, ...l].slice(0, 12));
  }, [live.posture]);

  const model = attrs.client.model === 'edge_impulse' ? 'Edge Impulse (AI)' : attrs.client.model === 'rules' ? 'กฎพื้นฐาน (ยังไม่ใส่โมเดล)' : '-';
  const conf = Math.round((live.confidence || 0) * 100);

  return (
    <>
      <PageHeader code="SC-SMS-01-02" title="ท่านั่งสด" subtitle={`อัปเดตล่าสุด ${timeAgo(lastTs)} · ส่งทุก 1 วินาทีขณะนั่ง`} />
      <div className="grid live-grid">
        <Card className="live-main">
          <div className="live-fig" style={{ '--pc': info.color }}>
            <PostureFigure posture={live.posture} backrestDeg={live.backrest_deg} size={260} />
          </div>
          <div className="live-info">
            <span className="muted">ท่าปัจจุบัน</span>
            <strong className="posture-name xl" style={{ color: info.color }}>{info.th}</strong>
            <p>{info.tip}</p>
            {live.bad_posture && (
              <div className={`alert tone-${live.alert === 'bad_posture' ? 'bad' : 'warn'}`}>
                <Icon name="alert" size={18} />
                ผิดท่ามา {live.bad_posture_sec} วินาที {live.alert === 'bad_posture' ? '(เก้าอี้กำลังเตือน)' : `(จะเตือนเมื่อครบ ${settings.bad_posture_alert_sec} วินาที)`}
              </div>
            )}
            <div className="meter">
              <div className="row-between"><span>ความมั่นใจของ AI</span><b>{conf}%</b></div>
              <div className="bar"><i style={{ width: `${conf}%`, background: conf >= 60 ? 'var(--primary)' : 'var(--warn)' }} /></div>
            </div>
            <dl className="kv tight">
              <dt>มุมพนักพิง (MPU6050)</dt><dd>{live.backrest_deg ?? '-'}°</dd>
              <dt>ค่าผิดปกติ (anomaly)</dt><dd>{live.anomaly ?? '-'}</dd>
              <dt>วิธีแยกท่า</dt><dd>{model}</dd>
            </dl>
          </div>
        </Card>
        <Card title="แรงกดบนเก้าอี้" icon="chair">
          <PressureMap values={live} size={210} />
        </Card>
      </div>

      <div className="grid two-1">
        <Card title="ท่าที่ระบบแยกได้ (7 ท่า)" icon="posture">
          <div className="posture-grid">
            {['empty', ...SITTING_POSTURES].map((k) => (
              <div key={k} className={`pg-item ${live.posture === k ? 'on' : ''}`}>
                <PostureFigure posture={k} size={84} />
                <span>{POSTURES[k].th}</span>
                {POSTURES[k].good === true && <Badge tone="good">ถูกท่า</Badge>}
                {POSTURES[k].good === false && <Badge tone="warn">ควรแก้</Badge>}
              </div>
            ))}
          </div>
        </Card>
        <Card title="การเปลี่ยนท่าล่าสุด" icon="history">
          {log.length ? (
            <ul className="timeline">
              {log.map((l) => <li key={l.ts}><i style={{ background: postureInfo(l.p).color }} /><span>{postureInfo(l.p).th}</span><small>{fmtTime(new Date(l.ts))}</small></li>)}
            </ul>
          ) : <p className="muted">รอการเปลี่ยนท่า…</p>}
        </Card>
      </div>
    </>
  );
}
