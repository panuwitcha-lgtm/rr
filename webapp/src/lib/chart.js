import { Chart as C, ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import { cssVar } from './postures';

C.register(ArcElement, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Filler, Legend, Tooltip);

// อ่านสีจากธีมทุกครั้งที่วาด เพื่อให้กราฟเปลี่ยนตามโหมดสว่าง/มืด
export function applyChartTheme() {
  C.defaults.font.family = "'Prompt', 'Sarabun', sans-serif";
  C.defaults.color = cssVar('--muted');
  C.defaults.borderColor = cssVar('--border');
  C.defaults.plugins.tooltip.backgroundColor = cssVar('--text');
  C.defaults.plugins.tooltip.titleColor = cssVar('--surface');
  C.defaults.plugins.tooltip.bodyColor = cssVar('--surface');
  C.defaults.plugins.tooltip.padding = 10;
  C.defaults.plugins.tooltip.cornerRadius = 10;
  C.defaults.plugins.legend.labels.usePointStyle = true;
  C.defaults.plugins.legend.labels.boxHeight = 8;
}
