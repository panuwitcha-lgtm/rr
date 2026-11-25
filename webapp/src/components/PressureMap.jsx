// แผนผังแรงกด FSR 6 จุด มองจากด้านบน: เบาะ 4 มุม + พนักพิง 2 จุด
// เฟิร์มแวร์ส่ง fsr1–fsr6 เป็นจำนวนเต็ม 0–100 (%)
const SPOTS = [
  { k: 'fsr5', x: 100, y: 34, label: 'พนักล่าง' }, { k: 'fsr6', x: 100, y: 70, label: 'พนักบน' },
  { k: 'fsr3', x: 66, y: 140, label: 'หลังซ้าย' }, { k: 'fsr4', x: 134, y: 140, label: 'หลังขวา' },
  { k: 'fsr1', x: 66, y: 206, label: 'หน้าซ้าย' }, { k: 'fsr2', x: 134, y: 206, label: 'หน้าขวา' },
];

export default function PressureMap({ values = {}, size = 240 }) {
  return (
    <div className="pmap">
      <svg viewBox="0 0 200 250" width={size} height={size * 1.25} role="img" aria-label="แผนผังแรงกด">
        <rect x="44" y="12" width="112" height="80" rx="18" className="pmap-zone" />
        <text x="100" y="104" textAnchor="middle" className="pmap-cap">พนักพิง</text>
        <rect x="24" y="112" width="152" height="124" rx="26" className="pmap-zone" />
        <text x="100" y="248" textAnchor="middle" className="pmap-cap">เบาะนั่ง (ด้านหน้า)</text>
        {SPOTS.map((s) => {
          const v = Math.max(0, Math.min(100, Number(values[s.k]) || 0)) / 100;
          return (
            <g key={s.k}>
              <circle cx={s.x} cy={s.y} r={10 + v * 16} fill="var(--primary)" opacity={0.15 + v * 0.75} style={{ transition: 'all .4s' }} />
              <text x={s.x} y={s.y + 4} textAnchor="middle" className="pmap-val">{Math.round(v * 100)}</text>
            </g>
          );
        })}
      </svg>
      <ul className="pmap-legend">
        {SPOTS.map((s) => <li key={s.k}><b>{s.k.toUpperCase()}</b> {s.label} <span>{Math.round(Number(values[s.k]) || 0)}%</span></li>)}
      </ul>
    </div>
  );
}
