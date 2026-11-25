import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, PageHeader } from '../components/ui';
import Icon from '../components/Icon';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

export default function DeviceLink() {
  const { user } = useAuth();
  const { deviceId, setDeviceId, toast } = useData();
  const nav = useNavigate();
  const [list, setList] = useState([]);
  const [id, setId] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api().listDevices(user).then(setList).catch(() => setList([])); }, [user]);

  const link = async (target) => {
    const v = (target || id).trim();
    if (!/^[0-9a-f-]{8,}$/i.test(v)) { setErr('Device ID ต้องเป็นรหัส UUID เช่น 1a2b3c4d-…'); return; }
    setErr(''); setBusy(true);
    try {
      const d = await api().getDevice(v);
      setDeviceId(d.id);
      toast({ title: 'เชื่อมเก้าอี้แล้ว', body: d.name, tone: 'good' });
      nav('/device');
    } catch (e) { setErr(e.message.includes('404') ? 'ไม่พบอุปกรณ์นี้ในบัญชีของคุณ' : e.message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Link to="/device" className="link back"><Icon name="back" size={18} />อุปกรณ์ของฉัน</Link>
      <PageHeader code="SC-DMS-01-02" title="เชื่อมเก้าอี้กับบัญชี" subtitle="เลือกเก้าอี้ที่อยู่ในบัญชี หรือกรอก Device ID จาก ThingsBoard" />
      <div className="grid two">
        <Card title="เก้าอี้ในบัญชีนี้" icon="chair">
          {list.length ? (
            <ul className="device-list">
              {list.map((d) => (
                <li key={d.id}>
                  <span className={`dot ${d.active ? 'ok' : 'off'}`} />
                  <span><strong>{d.name}</strong><small className="mono">{d.id}</small></span>
                  {d.id === deviceId ? <span className="badge tone-good">ใช้อยู่</span>
                    : <button className="btn soft sm" disabled={busy} onClick={() => link(d.id)}>เลือก</button>}
                </li>
              ))}
            </ul>
          ) : <p className="muted">ไม่พบเก้าอี้ในบัญชี ผู้ดูแลต้อง Assign device ให้ Customer ของคุณก่อน</p>}
        </Card>
        <Card title="กรอก Device ID" icon="link">
          <form onSubmit={(e) => { e.preventDefault(); link(); }}>
            <label className="field">
              <span>Device ID</span>
              <input className="input mono" placeholder="เช่น 7c1f9a20-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={id} onChange={(e) => setId(e.target.value)} />
            </label>
            {err && <div className="alert tone-bad"><Icon name="alert" size={18} />{err}</div>}
            <button className="btn primary block" disabled={busy}>{busy ? 'กำลังตรวจสอบ…' : 'เชื่อมเก้าอี้'}</button>
          </form>
          <ol className="steps">
            <li>เปิด ThingsBoard → <b>Entities → Devices</b></li>
            <li>คลิกเก้าอี้ของคุณ → กด <b>Copy device Id</b></li>
            <li>วางในช่องด้านบนแล้วกด "เชื่อมเก้าอี้"</li>
          </ol>
        </Card>
      </div>
    </>
  );
}
