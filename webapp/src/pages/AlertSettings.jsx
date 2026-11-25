import { useEffect, useState } from 'react';
import { Card, PageHeader, Toggle } from '../components/ui';
import Icon from '../components/Icon';
import { useData } from '../context/DataContext';

function NumberSetting({ label, desc, value, onChange, min, max, step = 1, unit, presets }) {
  return (
    <div className="num-setting">
      <div className="row-between">
        <span><span className="toggle-label">{label}</span>{desc && <span className="toggle-desc">{desc}</span>}</span>
        <span className="num-input">
          <input type="number" className="input" value={value} min={min} max={max} step={step}
            onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
          <small>{unit}</small>
        </span>
      </div>
      <input type="range" min={min} max={Math.min(max, presets[presets.length - 1] * 2)} step={step} value={value || min} onChange={(e) => onChange(Number(e.target.value))} />
      <div className="chips">
        {presets.map((p) => <button key={p} type="button" className={`chip-btn ${value === p ? 'on' : ''}`} onClick={() => onChange(p)}>{p} {unit}</button>)}
      </div>
    </div>
  );
}

export default function AlertSettings() {
  const { settings, saveSettings, toast } = useData();
  const pick = (s) => ({ app_notify: s.app_notify, muted: !!s.muted, sit_limit_min: s.sit_limit_min, rest_min: s.rest_min, bad_posture_alert_sec: s.bad_posture_alert_sec });
  const [form, setForm] = useState(pick(settings));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setForm(pick(settings)); }, [settings.muted, settings.sit_limit_min, settings.rest_min, settings.bad_posture_alert_sec, settings.app_notify]); // eslint-disable-line

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(pick(settings));

  const save = async () => {
    const f = form;
    if (!(f.sit_limit_min >= 1 && f.sit_limit_min <= 240)) return setErr('เวลานั่งต้องอยู่ระหว่าง 1–240 นาที');
    if (!(f.rest_min >= 1 && f.rest_min <= 60)) return setErr('เวลาพักต้องอยู่ระหว่าง 1–60 นาที');
    if (!(f.bad_posture_alert_sec >= 3 && f.bad_posture_alert_sec <= 600)) return setErr('เวลาเตือนท่าผิดต้องอยู่ระหว่าง 3–600 วินาที');
    setErr(''); setBusy(true);
    try {
      await saveSettings(f);
      toast({ title: 'บันทึกการตั้งค่าแล้ว', body: 'เก้าอี้จะใช้ค่าใหม่ภายในไม่กี่วินาที', tone: 'good' });
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader code="SC-STS-01-01" title="ตั้งค่าการแจ้งเตือน" subtitle="ค่าที่บันทึกจะส่งไปที่เก้าอี้ผ่าน ThingsBoard (shared attributes)" />
      <div className="grid two-1">
        <div className="stack">
          <Card title="เปิด / ปิดการแจ้งเตือน" icon="bell">
            <Toggle label="แจ้งเตือนในแอป" desc="เด้งข้อความเมื่อนั่งผิดท่า นั่งนาน หรือแบตต่ำ" checked={form.app_notify} onChange={set('app_notify')} />
            <Toggle label="เสียงเตือนที่เก้าอี้ (Buzzer)" desc="ปิดเมื่ออยู่ในที่ประชุมหรือห้องเงียบ แอปยังแจ้งเตือนตามปกติ" checked={!form.muted} onChange={(v) => set('muted')(!v)} />
          </Card>
          <Card title="เวลานั่งและพัก" icon="timer">
            <NumberSetting label="นั่งต่อเนื่องได้นานสุด" desc="ครบแล้วเก้าอี้บี๊บยาวและเตือนให้ลุก" value={form.sit_limit_min} onChange={set('sit_limit_min')}
              min={1} max={240} unit="นาที" presets={[30, 45, 60, 90]} />
            <NumberSetting label="เวลาพักที่แนะนำ" desc="ใช้จับเวลาพักในแอป" value={form.rest_min} onChange={set('rest_min')}
              min={1} max={60} unit="นาที" presets={[3, 5, 10, 15]} />
          </Card>
          <Card title="ท่านั่ง" icon="posture">
            <NumberSetting label="นั่งผิดท่าต่อเนื่องกี่วินาทีจึงเตือน" desc="ตั้งน้อยเตือนไว แต่อาจรำคาญ" value={form.bad_posture_alert_sec} onChange={set('bad_posture_alert_sec')}
              min={3} max={600} unit="วินาที" presets={[5, 10, 30, 60]} />
          </Card>
          {err && <div className="alert tone-bad"><Icon name="alert" size={18} />{err}</div>}
          <div className="save-bar">
            <button className="btn ghost" disabled={!dirty || busy} onClick={() => setForm(pick(settings))}>ยกเลิก</button>
            <button className="btn primary" disabled={!dirty || busy} onClick={save}>{busy ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}</button>
          </div>
        </div>
        <Card title="ทำงานอย่างไร" icon="info">
          <ul className="tips">
            <li><Icon name="volume" size={16} />นั่งผิดท่าครบเวลาที่ตั้ง เก้าอี้บี๊บสั้นทุก 1 วินาทีจนกว่าจะปรับท่า</li>
            <li><Icon name="timer" size={16} />นั่งครบเวลา เก้าอี้บี๊บยาว และแอปแจ้ง "ได้เวลาลุกพัก"</li>
            <li><Icon name="stand" size={16} />ลุกเกิน 1 นาที เวลานั่งเริ่มนับใหม่</li>
            <li><Icon name="leaf" size={16} />ถ้าเก้าอี้หลับอยู่ (ไม่มีคนนั่ง) จะได้ค่าใหม่ตอนมีคนนั่งครั้งถัดไป</li>
          </ul>
          <p className="muted small">หมายเหตุ: alarm "Sit too long" ใน ThingsBoard ตั้งไว้ที่ 45 นาทีตาม README ของเฟิร์มแวร์ ถ้าเปลี่ยนเวลานั่งที่นี่ ควรแก้ค่าใน Alarm rules ให้ตรงกันด้วย</p>
        </Card>
      </div>
    </>
  );
}
