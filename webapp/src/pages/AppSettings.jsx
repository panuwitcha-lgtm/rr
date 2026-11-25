import { useState } from 'react';
import { Card, PageHeader, Segmented, Toggle } from '../components/ui';
import Icon from '../components/Icon';
import { useTheme } from '../context/ThemeContext';
import { LogoutModal } from '../components/Layout';
import { TB_URL } from '../config';

export default function AppSettings() {
  const { theme, setTheme } = useTheme();
  const [codes, setCodes] = useState(() => { try { return localStorage.getItem('hc_show_codes') === '1'; } catch { return false; } });
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const [logout, setLogout] = useState(false);

  return (
    <>
      <PageHeader code="SC-STS-01-02" title="ตั้งค่าแอป" subtitle="หน้าตา การเชื่อมต่อ และบัญชี" />
      <div className="grid two">
        <Card title="หน้าตา" icon="sun">
          <div className="setting-row">
            <span><span className="toggle-label">ธีม</span><span className="toggle-desc">อัตโนมัติจะตามการตั้งค่าของเครื่อง</span></span>
            <Segmented value={theme} onChange={setTheme} options={[['auto', 'อัตโนมัติ'], ['light', 'สว่าง'], ['dark', 'มืด']]} />
          </div>
          <Toggle label="แสดงรหัสหน้าจอ (SC-xxx)" desc="ใช้ตอนทำเอกสาร Screen Design" checked={codes}
            onChange={(v) => { setCodes(v); try { localStorage.setItem('hc_show_codes', v ? '1' : '0'); } catch { /* ไม่มี storage */ } }} />
        </Card>
        <Card title="แจ้งเตือนบนเครื่องนี้" icon="bell">
          <p className="muted">ให้เบราว์เซอร์เด้งแจ้งเตือนแม้สลับไปแท็บอื่น</p>
          {perm === 'granted' && <p className="txt-good"><Icon name="check" size={16} /> อนุญาตแล้ว</p>}
          {perm === 'denied' && <p className="txt-bad">ถูกปิดไว้ เปิดได้ที่การตั้งค่าเว็บไซต์ของเบราว์เซอร์</p>}
          {perm === 'default' && <button className="btn soft" onClick={async () => setPerm(await Notification.requestPermission())}>อนุญาตการแจ้งเตือน</button>}
          {perm === 'unsupported' && <p className="muted">เบราว์เซอร์นี้ไม่รองรับ</p>}
        </Card>
        <Card title="การเชื่อมต่อ" icon="wifi">
          <dl className="kv">
            <dt>เซิร์ฟเวอร์</dt><dd>{TB_URL || 'thingsboard.cloud (ผ่าน proxy)'}</dd>
            <dt>รับค่าสด</dt><dd>WebSocket (สำรอง: ดึงทุก 3 วินาที)</dd>
          </dl>
          <p className="muted small">เปลี่ยนเซิร์ฟเวอร์ได้ที่ src/config.js และ vite.config.js</p>
        </Card>
        <Card title="บัญชี" icon="user">
          <p className="muted">ออกจากระบบเมื่อใช้เครื่องร่วมกับคนอื่น</p>
          <button className="btn danger" onClick={() => setLogout(true)}><Icon name="logout" size={18} />ออกจากระบบ</button>
          <p className="muted small">Health Chair v1.0 · เฟิร์มแวร์ที่รองรับ v1.3.x</p>
        </Card>
      </div>
      <LogoutModal open={logout} onClose={() => setLogout(false)} />
    </>
  );
}
