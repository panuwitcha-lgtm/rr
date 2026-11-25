import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Card, PageHeader, Ring } from '../components/ui';
import Icon from '../components/Icon';
import PostureFigure from '../components/PostureFigure';
import { useData } from '../context/DataContext';
import { useDaily } from './History';
import { scoreLevel } from '../lib/stats';
import { POSTURES, SITTING_POSTURES, cssVar } from '../lib/postures';
import { fmtDuration, fmtShortDate, startOfDay } from '../lib/format';
import { useThemeTick } from '../lib/useThemeTick';

const DAY = 86400000;

export default function Score() {
  const { settings } = useData();
  const tick = useThemeTick();
  const today = useMemo(() => startOfDay().getTime(), []);
  const { days } = useDaily(today - 6 * DAY, today + DAY, settings.sit_limit_min);
  const t = days[days.length - 1] || { score: null, goodPct: 0, longSessions: 0, minutes: {}, sitMin: 0, sessions: [] };
  const y = days[days.length - 2];
  const lvl = scoreLevel(t.score);
  const diff = t.score != null && y?.score != null ? t.score - y.score : null;
  const worst = SITTING_POSTURES.filter((p) => p !== 'upright').sort((a, b) => (t.minutes[b] || 0) - (t.minutes[a] || 0))[0];
  const breakScore = Math.max(0, 100 - t.longSessions * 25);

  const line = {
    labels: days.map((d) => fmtShortDate(new Date(d.day))),
    datasets: [{ label: 'คะแนน', data: days.map((d) => d.score), borderColor: cssVar('--primary'), backgroundColor: cssVar('--primary-soft'), fill: true, tension: 0.35, pointRadius: 4, spanGaps: true }],
  };

  return (
    <>
      <PageHeader code="SC-SHS-01-03" title="คะแนนการนั่ง" subtitle="คะแนนสุขภาพการนั่งของวันนี้ และวิธีคิดคะแนน" />
      <div className="grid score-grid">
        <Card className="center">
          <Ring size={210} stroke={16} value={(t.score || 0) / 100} color={`var(--${lvl.tone === 'muted' ? 'muted' : lvl.tone})`}>
            <strong className="ring-num xl">{t.score ?? '-'}</strong><small>คะแนนเต็ม 100</small>
          </Ring>
          <strong className={`level txt-${lvl.tone}`}>{lvl.th}</strong>
          {diff != null && <p className="muted">{diff >= 0 ? `ดีขึ้น ${diff} คะแนนจากเมื่อวาน` : `ลดลง ${-diff} คะแนนจากเมื่อวาน`}</p>}
        </Card>
        <Card title="คะแนนมาจากไหน" icon="info">
          <div className="breakdown">
            <div>
              <div className="row-between"><span>นั่งถูกท่า <small className="muted">(น้ำหนัก 70%)</small></span><b>{t.goodPct}/100</b></div>
              <div className="bar"><i style={{ width: `${t.goodPct}%` }} /></div>
              <small className="muted">นั่งตัวตรง {fmtDuration(t.minutes.upright || 0)} จากเวลานั่งทั้งหมด {fmtDuration(t.sitMin)}</small>
            </div>
            <div>
              <div className="row-between"><span>ลุกพักตามเวลา <small className="muted">(น้ำหนัก 30%)</small></span><b>{breakScore}/100</b></div>
              <div className="bar"><i style={{ width: `${breakScore}%`, background: 'var(--accent)' }} /></div>
              <small className="muted">นั่งเกิน {settings.sit_limit_min} นาที {t.longSessions} รอบ (หักรอบละ 25 คะแนน)</small>
            </div>
          </div>
          <p className="formula">คะแนน = (ถูกท่า × 0.7) + (ลุกพัก × 0.3)</p>
        </Card>
      </div>
      <div className="grid two-1">
        <Card title="คะแนน 7 วันล่าสุด" icon="chart">
          <div className="chart-box">
            <Line key={tick} data={line} options={{ maintainAspectRatio: false, scales: { y: { min: 0, max: 100 }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } }} />
          </div>
        </Card>
        <Card title="คำแนะนำสำหรับคุณ" icon="leaf">
          {worst && (t.minutes[worst] || 0) > 1 ? (
            <div className="advice">
              <PostureFigure posture={worst} size={120} />
              <div>
                <p>วันนี้ท่าที่ผิดบ่อยที่สุดคือ <b>{POSTURES[worst].th}</b> ({fmtDuration(t.minutes[worst])})</p>
                <p className="muted">{POSTURES[worst].tip}</p>
              </div>
            </div>
          ) : <p className="muted">วันนี้ยังไม่มีท่าผิดที่เด่นชัด เยี่ยมมาก!</p>}
          <ul className="tips">
            <li><Icon name="check" size={16} />ลุกพักทุก {settings.sit_limit_min} นาที อย่างน้อย {settings.rest_min} นาที</li>
            <li><Icon name="check" size={16} />เป้าหมาย: นั่งถูกท่าให้ได้ 80% ขึ้นไป</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
