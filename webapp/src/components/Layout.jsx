import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { Modal } from './ui';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useNow } from '../lib/useThemeTick';
import { fmtDateLong, pad } from '../lib/format';

const NAV = [
  ['ติดตามการนั่ง', [['/', 'home', 'หน้าหลัก'], ['/live', 'posture', 'ท่านั่งสด'], ['/timer', 'timer', 'จับเวลานั่ง/พัก']]],
  ['สถิติ', [['/stats/today', 'chart', 'กราฟการนั่งวันนี้'], ['/stats/history', 'history', 'ประวัติย้อนหลัง'], ['/stats/score', 'score', 'คะแนนการนั่ง']]],
  ['ระบบ', [['/notifications', 'bell', 'การแจ้งเตือน'], ['/device', 'chair', 'อุปกรณ์'], ['/settings', 'sliders', 'ตั้งค่าแจ้งเตือน'], ['/settings/app', 'settings', 'ตั้งค่าแอป']]],
];
const BOTTOM = [['/', 'home', 'หน้าหลัก'], ['/live', 'posture', 'ท่านั่ง'], ['/stats/today', 'chart', 'สถิติ'], ['/notifications', 'bell', 'แจ้งเตือน'], ['/settings', 'sliders', 'ตั้งค่า']];

export function LogoutModal({ open, onClose }) {
  const { logout } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="ออกจากระบบ?"
      actions={<>
        <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
        <button className="btn danger" disabled={busy} onClick={async () => { setBusy(true); await logout(); nav('/login', { replace: true }); }}>
          {busy ? 'กำลังออก…' : 'ออกจากระบบ'}
        </button>
      </>}>
      <p className="muted">เก้าอี้ยังทำงานและเตือนตามปกติ แค่แอปนี้จะไม่แสดงข้อมูลจนกว่าจะเข้าสู่ระบบอีกครั้ง</p>
    </Modal>
  );
}

export default function Layout({ children }) {
  const { user } = useAuth();
  const { unread, toasts, device, online, live } = useData();
  const [drawer, setDrawer] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const loc = useLocation();
  const now = new Date(useNow(1000));
  useEffect(() => { setDrawer(false); window.scrollTo(0, 0); }, [loc.pathname]);

  const link = ([to, icon, label]) => (
    <NavLink key={to} to={to} end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <Icon name={icon} /> <span>{label}</span>
      {to === '/notifications' && unread > 0 && <span className="nav-count">{unread}</span>}
    </NavLink>
  );

  return (
    <div className="shell">
      <aside className={`sidebar ${drawer ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><Icon name="chair" size={22} /></span>
          <div><strong>Health Chair</strong><small>นั่งดี สุขภาพดี</small></div>
          <button className="icon-btn only-mobile" onClick={() => setDrawer(false)} aria-label="ปิดเมนู"><Icon name="close" /></button>
        </div>
        <nav>
          {NAV.map(([group, items]) => (
            <div key={group} className="nav-group"><span className="nav-title">{group}</span>{items.map(link)}</div>
          ))}
        </nav>
        <div className="side-foot">
          <NavLink to="/profile" className="me">
            <span className="avatar">{(user.firstName || user.email || '?').slice(0, 1).toUpperCase()}</span>
            <span><strong>{user.name}</strong><small>{user.email}</small></span>
          </NavLink>
          <button className="nav-item" onClick={() => setLogoutOpen(true)}><Icon name="logout" /> <span>ออกจากระบบ</span></button>
        </div>
      </aside>
      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn only-mobile" onClick={() => setDrawer(true)} aria-label="เปิดเมนู"><Icon name="menu" /></button>
          <div className="top-clock">
            <strong>{pad(now.getHours())}:{pad(now.getMinutes())}<span className="sec">:{pad(now.getSeconds())}</span></strong>
            <small>{fmtDateLong(now)}</small>
          </div>
          <div className="top-right">
            <NavLink to="/device" className={`chip ${online ? 'ok' : 'off'}`} title="สถานะเก้าอี้">
              <span className="dot" />{device?.name || 'เก้าอี้'}{live.battery_pct != null && <span className="hide-xs"> · {live.battery_pct}%</span>}
            </NavLink>
            <NavLink to="/notifications" className="icon-btn bell" aria-label="การแจ้งเตือน">
              <Icon name="bell" />{unread > 0 && <span className="bell-dot">{unread}</span>}
            </NavLink>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>

      <nav className="bottom-nav">
        {BOTTOM.map(([to, icon, label]) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={icon} /><span>{label}</span>
            {to === '/notifications' && unread > 0 && <i className="bn-dot" />}
          </NavLink>
        ))}
      </nav>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast tone-${t.tone || 'info'}`}>
            <Icon name={t.tone === 'good' ? 'check' : 'alert'} />
            <div><strong>{t.title}</strong>{t.body && <p>{t.body}</p>}</div>
          </div>
        ))}
      </div>
      <LogoutModal open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </div>
  );
}
