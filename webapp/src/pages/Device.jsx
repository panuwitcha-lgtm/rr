import { Link } from 'react-router-dom';
import { Card, PageHeader, Badge, Ring } from '../components/ui';
import Icon from '../components/Icon';
import { useData } from '../context/DataContext';
import { fmtDateTime, timeAgo } from '../lib/format';

function rssiText(r) {
  if (r == null) return '-';
  if (r >= -60) return `ดีมาก (${r} dBm)`;
  if (r >= -70) return `ดี (${r} dBm)`;
  if (r >= -80) return `พอใช้ (${r} dBm)`;
  return `อ่อน (${r} dBm)`;
}

export default function Device() {
  const { device, deviceId, live, attrs, online, lastActivity, deviceError } = useData();
  const c = attrs.client;
  const bat = live.battery_pct;
  const sensors = [
    ['FSR เบาะนั่ง 4 จุด', ['fsr1', 'fsr2', 'fsr3', 'fsr4'].every((k) => live[k] != null)],
    ['FSR พนักพิง 2 จุด', ['fsr5', 'fsr6'].every((k) => live[k] != null)],
    ['MPU6050 วัดมุมพนักพิง', c.mpu_ok !== false],
  ];
  return (
    <>
      <PageHeader code="SC-DMS-01-01" title="อุปกรณ์ของฉัน" subtitle="สถานะเก้าอี้ แบตเตอรี่ และการเชื่อมต่อ">
        <Link to="/device/link" className="btn ghost"><Icon name="link" size={18} />เปลี่ยน / เชื่อมเก้าอี้</Link>
      </PageHeader>
      {deviceError && <div className="alert tone-warn"><Icon name="alert" size={18} />{deviceError}</div>}
      <div className="grid device-grid">
        <Card className="device-hero">
          <span className="device-icon"><Icon name="chair" size={40} /></span>
          <div>
            <h2>{device?.name || 'ยังไม่ได้เชื่อมเก้าอี้'}</h2>
            <p className="muted">{device?.label || 'Health Chair'}</p>
            <div className="badges">
              <Badge tone={online ? 'good' : 'bad'}>{online ? 'ออนไลน์' : 'ออฟไลน์'}</Badge>
              <Badge tone={live.occupied ? 'info' : 'muted'}>{live.occupied ? 'มีคนนั่ง' : 'ว่าง (โหมดประหยัดไฟ)'}</Badge>
            </div>
            <small className="muted">ติดต่อล่าสุด {lastActivity ? `${timeAgo(lastActivity)} · ${fmtDateTime(lastActivity)}` : '-'}</small>
          </div>
        </Card>
        <Card title="แบตเตอรี่" icon="battery" className="center">
          <Ring size={140} value={(bat || 0) / 100} color={bat < 15 ? 'var(--bad)' : bat < 30 ? 'var(--warn)' : 'var(--primary)'}>
            <strong className="ring-num">{bat ?? '-'}<small>%</small></strong><small>{live.battery_v ?? '-'} V</small>
          </Ring>
          <p className="muted small">18650 × 4 แบบขนาน · ชาร์จผ่านช่อง USB ของบอร์ด</p>
        </Card>
      </div>
      <div className="grid two">
        <Card title="ข้อมูลอุปกรณ์" icon="cpu">
          <dl className="kv">
            <dt>Device ID</dt><dd className="mono">{deviceId || '-'}</dd>
            <dt>บอร์ด</dt><dd>ESP32-S3-WROOM-1</dd>
            <dt>เฟิร์มแวร์</dt><dd>{c.firmware ? `v${c.firmware}` : '-'}</dd>
            <dt>การแยกท่า</dt><dd>{c.model === 'edge_impulse' ? 'Edge Impulse (AI)' : c.model === 'rules' ? 'กฎพื้นฐาน' : '-'}</dd>
            <dt>สัญญาณ Wi-Fi</dt><dd>{rssiText(c.rssi)}</dd>
            <dt>คลาวด์</dt><dd>ThingsBoard Cloud (MQTT)</dd>
          </dl>
        </Card>
        <Card title="เซนเซอร์" icon="posture">
          <ul className="check-list">
            {sensors.map(([n, ok]) => <li key={n}><span className={`dot ${ok ? 'ok' : 'off'}`} />{n}<b className={ok ? 'txt-good' : 'txt-bad'}>{ok ? 'ปกติ' : 'ไม่พบข้อมูล'}</b></li>)}
            <li><span className="dot ok" />Buzzer เตือน<b className="muted">บนเก้าอี้</b></li>
          </ul>
          <p className="muted small">ตอนไม่มีคนนั่ง เก้าอี้ปิด Wi-Fi และส่งสถานะแบตทุก 30 นาที เพื่อให้แบตอยู่ได้ประมาณ 3–4 สัปดาห์</p>
        </Card>
      </div>
    </>
  );
}
