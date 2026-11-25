import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { thingsboard } from '../api/thingsboard';
import AuthShell from './AuthShell';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setErr('รูปแบบอีเมลไม่ถูกต้อง'); return; }
    setErr(''); setState('busy');
    try { await thingsboard.resetPassword(email.trim()); setState('sent'); }
    catch (e2) { setErr(e2.message); setState('idle'); }
  };

  return (
    <AuthShell>
      <form className="form-card" onSubmit={submit}>
        <Link to="/login" className="link back"><Icon name="back" size={18} />กลับไปหน้าเข้าสู่ระบบ</Link>
        <h1>ลืมรหัสผ่าน</h1>
        {state === 'sent' ? (
          <div className="sent">
            <span className="sent-icon"><Icon name="mail" size={28} /></span>
            <p>ถ้ามีบัญชีที่ใช้อีเมล <b>{email}</b> ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว เปิดอีเมลแล้วกดลิงก์ภายใน 24 ชั่วโมง</p>
            <Link to="/login" className="btn primary block">กลับไปเข้าสู่ระบบ</Link>
          </div>
        ) : (
          <>
            <p className="muted">กรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้</p>
            <label className="field">
              <span>อีเมล</span>
              <div className="input-icon"><Icon name="mail" size={18} />
                <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </label>
            {err && <div className="alert tone-bad"><Icon name="alert" size={18} />{err}</div>}
            <button className="btn primary block" disabled={state === 'busy'}>{state === 'busy' ? 'กำลังส่ง…' : 'ส่งลิงก์รีเซ็ตรหัสผ่าน'}</button>
          </>
        )}
      </form>
    </AuthShell>
  );
}
