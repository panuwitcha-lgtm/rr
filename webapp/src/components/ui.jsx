import { useEffect } from 'react';
import Icon from './Icon';
import { cssVar } from '../lib/postures';

export function Card({ title, icon, action, children, className = '', ...rest }) {
  return (
    <section className={`card ${className}`} {...rest}>
      {(title || action) && (
        <header className="card-head">
          <h3>{icon && <Icon name={icon} size={18} />}{title}</h3>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, code, children }) {
  let show = false;
  try { show = localStorage.getItem('hc_show_codes') === '1'; } catch { /* ไม่มี storage */ }
  return (
    <div className="page-head">
      <div>
        {show && code && <span className="sc-code">{code}</span>}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, unit, hint, tone, icon }) {
  return (
    <div className={`stat ${tone ? `tone-${tone}` : ''}`}>
      {icon && <span className="stat-icon"><Icon name={icon} size={18} /></span>}
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}<small>{unit}</small></span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

// วงแหวนแสดงสัดส่วน 0-1
export function Ring({ value, size = 148, stroke = 12, color = 'var(--primary)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--track)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .6s ease, stroke .4s' }} />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, desc, disabled }) {
  return (
    <label className={`toggle-row ${disabled ? 'disabled' : ''}`}>
      <span>
        <span className="toggle-label">{label}</span>
        {desc && <span className="toggle-desc">{desc}</span>}
      </span>
      <span className="switch">
        <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="slider" />
      </span>
    </label>
  );
}

export function Modal({ open, onClose, title, children, actions }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {title && <h2>{title}</h2>}
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Badge({ tone = 'muted', children }) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}

export function Empty({ icon = 'leaf', title, children }) {
  return (
    <div className="empty">
      <Icon name={icon} size={36} />
      <strong>{title}</strong>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented" role="tablist">
      {options.map(([v, label]) => (
        <button key={v} role="tab" aria-selected={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}

export const toneColor = (tone) => cssVar(`--${{ good: 'good', warn: 'warn', bad: 'bad' }[tone] || 'muted'}`);
