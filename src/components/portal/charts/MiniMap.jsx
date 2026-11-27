import { useMemo, useState } from 'react';
import { motion } from 'motion/react';

// Bản đồ mini không cần tile: chiếu tọa độ các địa điểm lên khung SVG, nền là đường đồng mức vẽ bằng toán
// (gợi đồi núi Đà Lạt). Chấm cam nhịp nhẹ = đang chờ duyệt, chấm xám = đang hiển thị cho du khách.

const W = 520;
const H = 300;
const PAD = 38;

function contourPaths() {
  const hills = [
    { cx: 0.32, cy: 0.42, rings: 9, base: 20, seed: 1.3 },
    { cx: 0.78, cy: 0.7, rings: 6, base: 18, seed: 2.9 },
  ];
  const paths = [];
  for (const hill of hills) {
    for (let k = 1; k <= hill.rings; k += 1) {
      const r = hill.base * k;
      let d = '';
      for (let s = 0; s <= 96; s += 1) {
        const t = (s / 96) * Math.PI * 2;
        const wobble = 1 + 0.09 * Math.sin(3 * t + hill.seed + k * 0.4) + 0.05 * Math.sin(5 * t - k * 0.7) + 0.03 * Math.cos(7 * t + hill.seed);
        const x = hill.cx * W + Math.cos(t) * r * wobble * 1.25;
        const y = hill.cy * H + Math.sin(t) * r * wobble * 0.85;
        d += `${s ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
      }
      paths.push({ d: `${d}Z`, strong: k % 4 === 0 });
    }
  }
  return paths;
}
const CONTOURS = contourPaths();

function project(points) {
  const valid = points.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  if (valid.length === 0) return [];
  const lats = valid.map((p) => p.latitude);
  const lngs = valid.map((p) => p.longitude);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  let minX = Math.min(...lngs) * kx; let maxX = Math.max(...lngs) * kx;
  let minY = Math.min(...lats); let maxY = Math.max(...lats);
  // Ít điểm hoặc các điểm sát nhau: mở khung tối thiểu ~1 km để không phóng to quá mức
  const minSpan = 0.01;
  if (maxX - minX < minSpan) { const c = (maxX + minX) / 2; minX = c - minSpan / 2; maxX = c + minSpan / 2; }
  if (maxY - minY < minSpan) { const c = (maxY + minY) / 2; minY = c - minSpan / 2; maxY = c + minSpan / 2; }
  const scale = Math.min((W - PAD * 2) / (maxX - minX), (H - PAD * 2) / (maxY - minY));
  const offX = (W - (maxX - minX) * scale) / 2;
  const offY = (H - (maxY - minY) * scale) / 2;
  return valid.map((p) => ({
    ...p,
    x: offX + (p.longitude * kx - minX) * scale,
    y: H - (offY + (p.latitude - minY) * scale),
  }));
}

export default function MiniMap({ points = [], onSelect }) {
  const projected = useMemo(() => project(points), [points]);
  const [hover, setHover] = useState(null);
  // Vẽ điểm chờ duyệt sau cùng để nằm trên
  const ordered = useMemo(() => [...projected].sort((a, b) => (a.state === 'PENDING') - (b.state === 'PENDING')), [projected]);
  const hovered = hover === null ? null : projected.find((p) => p.id === hover);

  return (
    <div className="dash-map">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img"
        aria-label={`Bản đồ ${projected.length} địa điểm`}>
        <g aria-hidden="true">
          {CONTOURS.map((c, i) => (
            <path key={i} d={c.d} fill="none" stroke="var(--p-contour)" strokeWidth={c.strong ? 1.2 : 0.8} />
          ))}
        </g>
        {ordered.map((p, i) => {
          const pending = p.state === 'PENDING';
          return (
            <g key={p.id} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
              tabIndex={0} role="button" aria-label={`${p.name}${pending ? ', đang chờ duyệt' : ''}`}
              className="dash-map-point"
              onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(p.id)} onBlur={() => setHover(null)}
              onClick={() => onSelect?.(p)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSelect?.(p); }}>
              <circle r="14" fill="transparent" />
              {pending && (
                <motion.circle r="6" fill="none" stroke="var(--p-accent)" strokeWidth="1.5"
                  initial={{ scale: 1, opacity: 0.7 }} animate={{ scale: 2.6, opacity: 0 }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut', delay: (i % 5) * 0.3 }} />
              )}
              <motion.circle r={pending ? 6 : 4.5} fill={pending ? 'var(--p-accent)' : 'var(--p-chart)'}
                stroke="var(--p-surface)" strokeWidth="2"
                initial={{ scale: 0 }} animate={{ scale: hover === p.id ? 1.35 : 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 26, delay: hover === null ? 0.25 + i * 0.03 : 0 }} />
            </g>
          );
        })}
      </svg>
      {hovered && (
        <div className="dash-map-tip" style={{ left: `${(hovered.x / W) * 100}%`, top: `${(hovered.y / H) * 100}%` }}>
          <strong>{hovered.name}</strong>
          <span>{hovered.state === 'PENDING' ? 'Đang chờ duyệt' : hovered.state === 'PUBLISHED' ? 'Đang hiển thị' : 'Chưa hiển thị'}</span>
        </div>
      )}
      {projected.length === 0 && <p className="dash-map-empty">Chưa có địa điểm nào có tọa độ.</p>}
    </div>
  );
}
