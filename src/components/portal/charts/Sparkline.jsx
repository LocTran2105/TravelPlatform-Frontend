import { useId } from 'react';
import { motion } from 'motion/react';

/**
 * Đường xu hướng nhỏ trong thẻ số liệu: nét tự vẽ ra khi xuất hiện, nền mờ hiện sau, điểm cuối (hôm nay) nổi bật.
 * Màu lấy từ biến CSS --spark (mỗi loại thẻ một màu; thẻ đang chọn dùng màu chữ).
 */
export default function Sparkline({ values = [], width = 120, height = 36, label }) {
  const gradientId = useId();
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const pad = 5;
  const stepX = (width - pad * 2) / (values.length - 1);
  const points = values.map((v, i) => [pad + i * stepX, height - pad - (v / max) * (height - pad * 2)]);
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${points.at(-1)[0].toFixed(1)},${height - pad} L${pad},${height - pad} Z`;
  const [lastX, lastY] = points.at(-1);
  const ease = [0.2, 0.7, 0.2, 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--spark, var(--p-chart))" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--spark, var(--p-chart))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={area} fill={`url(#${gradientId})`}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 1.1 }} />
      <motion.path d={line} fill="none" stroke="var(--spark, var(--p-chart))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, delay: 0.35, ease }} />
      <motion.circle cx={lastX} cy={lastY} r="4" fill="var(--spark, var(--p-accent))" stroke="var(--p-surface)" strokeWidth="2"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 1.4 }} />
    </svg>
  );
}
