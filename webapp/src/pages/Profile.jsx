import { useState } from 'react';
import { Card, PageHeader } from '../components/ui';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { LogoutModal } from '../components/Layout';

const ROLE = { TENANT_ADMIN: 'ผู้ดูแลระบบ (Tenant admin)', CUSTOMER_USER: 'ผู้ใช้เก้าอี้ (Customer user)', SYS_ADMIN: 'ผู้ดูแลระบบสูงสุด' };

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const { toast, device } = useData();
  const [first, setFirst] = useState(user.firstName);
  const [last, setLast] = useState(user.lastName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [logout, setLogout] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await updateProfile({ firstName: first.trim(), lastName: last.trim() }); toast({ title: 'บันทึกโปรไฟล์แล้ว', tone: 'good' }); }
    catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader code="SC-UAMS-01-03" title="โปรไฟล์ของฉัน" />
      <div className="grid two-1">
        <Card>
          <div className="profile-head">
            <span className="avatar xl">{(user.firstName || user.email).slice(0, 1).toUpperCase()}</span>
            <div><h2>{user.name}</h2><p className="muted">{user.email}</p></div>
          </div>
          <form onSubmit={save} className="form-grid">
            <label className="field"><span>ชื่อ</span><input className="input" value={first} onChange={(e) => setFirst(e.target.value)} /></label>
            <label className="field"><span>นามสกุล</span><input className="input" value={last} onChange={(e) => setLast(e.target.value)} /></label>
            <label className="field full"><span>อีเมล (ใช้เข้าสู่ระบบ แก้ไม่ได้)</span><input className="input" value={user.email} disabled /></label>
            {err && <div className="alert tone-bad full"><Icon name="alert" size={18} />{err}</div>}
            <div className="full"><button className="btn primary" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</button></div>
          </form>
        </Card>
        <Card title="ข้อมูลบัญชี" icon="user">
          <dl className="kv">
            <dt>สิทธิ์</dt><dd>{ROLE[user.authority] || user.authority}</dd>
            <dt>เก้าอี้ที่ใช้</dt><dd>{device?.name || '-'}</dd>
          </dl>
          <p className="muted small">เปลี่ยนรหัสผ่าน: ออกจากระบบแล้วกด "ลืมรหัสผ่าน" ที่หน้าเข้าสู่ระบบ</p>
          <button className="btn danger" onClick={() => setLogout(true)}><Icon name="logout" size={18} />ออกจากระบบ</button>
        </Card>
      </div>
      <LogoutModal open={logout} onClose={() => setLogout(false)} />
    </>
  );
}
