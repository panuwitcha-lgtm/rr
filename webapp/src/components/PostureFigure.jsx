import { postureInfo } from '../lib/postures';

const rad = (d) => (d * Math.PI) / 180;

// ภาพคนนั่งเก้าอี้ตามท่า: มุมมองด้านข้าง (เอียงซ้าย/ขวาใช้มุมมองด้านหน้า)
export default function PostureFigure({ posture = 'empty', backrestDeg = 8, size = 200 }) {
  const info = postureInfo(posture);
  const color = info.color;
  const front = posture === 'lean_left' || posture === 'lean_right';

  if (front) {
    const tilt = posture === 'lean_left' ? -18 : 18;
    const hip = [100, 118];
    const sh = [hip[0] + 46 * Math.sin(rad(tilt)), hip[1] - 46 * Math.cos(rad(tilt))];
    const head = [hip[0] + 64 * Math.sin(rad(tilt)), hip[1] - 64 * Math.cos(rad(tilt))];
    return (
      <svg viewBox="0 0 200 190" width={size} height={size * 0.95} className="posture-fig" role="img" aria-label={info.th}>
        <rect x="58" y="36" width="84" height="74" rx="12" className="chair-back" />
        <rect x="50" y="112" width="100" height="16" rx="8" className="chair" />
        <path d="M62 128v44M138 128v44" className="chair-line" />
        <g stroke={color} strokeWidth="11" strokeLinecap="round" fill="none" style={{ transition: 'all .5s' }}>
          <path d={`M${hip[0]} ${hip[1]}L${sh[0]} ${sh[1]}`} />
          <path d={`M${sh[0] - 20} ${sh[1] + 4}L${sh[0] + 20} ${sh[1] + 4}`} strokeWidth="9" />
          <path d="M86 120l-4 52M114 120l4 52" strokeWidth="10" />
        </g>
        <circle cx={head[0]} cy={head[1]} r="12" fill={color} />
        <path d={`M${tilt < 0 ? 46 : 154} 60l${tilt < 0 ? -10 : 10} 10l${tilt < 0 ? 10 : -10} 10`} stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" opacity=".7" />
      </svg>
    );
  }

  // [ตำแหน่งสะโพก x, มุมลำตัว (บวก=เอนไปพนัก)]
  const pose = { upright: [76, 4], lean_forward: [80, -32], lean_back: [94, 38], perch: [120, -6], unknown: [78, 4] }[posture];
  const bx = 60, by = 122;
  const back = [bx - 78 * Math.sin(rad(backrestDeg)), by - 78 * Math.cos(rad(backrestDeg))];

  return (
    <svg viewBox="0 0 200 190" width={size} height={size * 0.95} className="posture-fig" role="img" aria-label={info.th}>
      <path d={`M${bx} ${by}L${back[0]} ${back[1]}`} className="chair-line thick" />
      <path d={`M${bx - 4} ${by}H146`} className="chair-line thick" />
      <path d={`M70 ${by}l-6 50M136 ${by}l6 50`} className="chair-line" />
      {pose && (() => {
        const [hx, a] = pose;
        const hip = [hx, by - 10];
        const sh = [hip[0] - 50 * Math.sin(rad(a)), hip[1] - 50 * Math.cos(rad(a))];
        const head = [hip[0] - 68 * Math.sin(rad(a)), hip[1] - 68 * Math.cos(rad(a))];
        const knee = posture === 'perch' ? [hx + 34, by + 4] : [hx + 48, hip[1]];
        const hand = [sh[0] + 26, sh[1] + 26];
        return (
          <g opacity={posture === 'unknown' ? 0.45 : 1} style={{ transition: 'all .5s' }}>
            <g stroke={color} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <path d={`M${hip[0]} ${hip[1]}L${sh[0]} ${sh[1]}`} />
              <path d={`M${hip[0]} ${hip[1]}L${knee[0]} ${knee[1]}L${knee[0] + 2} 172`} strokeWidth="10" />
              <path d={`M${sh[0]} ${sh[1] + 4}L${hand[0]} ${hand[1]}`} strokeWidth="7" opacity=".8" />
            </g>
            <circle cx={head[0]} cy={head[1]} r="12" fill={color} />
          </g>
        );
      })()}
      {posture === 'empty' && <text x="104" y="96" textAnchor="middle" className="fig-empty">ว่าง</text>}
    </svg>
  );
}
