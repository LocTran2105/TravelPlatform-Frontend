import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Plane } from 'lucide-react';
import JourneyTourLayer from './JourneyTourLayer';
import { Car } from './journeyVehicles';

/*
 * Bản đồ hành trình minh họa (SVG): đường đồng mức, rừng thông, đồng cỏ, hồ nước, các cung đường có vạch giữa.
 * Lần lượt đổi qua các lịch trình mẫu (journeyTours): mỗi chuyến có đường đi riêng, một chiếc xe chạy theo,
 * tới điểm nào thì ghim nảy lên và hiện tên điểm đó; đi hết thì cả lộ trình mờ đi và chuyển sang chuyến khác.
 * Xe nhỏ chạy dọc các cung đường, mây trôi, thỉnh thoảng có máy bay bay ngang (PlaneFlyby).
 * Người dùng bật "giảm chuyển động" thì chỉ còn bản đồ tĩnh với chuyến đầu tiên.
 */

const W = 1200;
const H = 560;

const ROADS = {
  main: 'M -40 500 C 200 470, 380 380, 560 360 S 780 430, 900 400 S 1100 290, 1260 300',
  pass: 'M 560 360 C 600 280, 680 210, 760 190 S 980 150, 1090 110 S 1200 60, 1260 40',
  lake: 'M 900 400 C 920 470, 1000 520, 1100 540 S 1220 560, 1280 600',
  west: 'M -40 250 C 120 230, 260 300, 400 285 S 520 330, 560 360',
};

// Mỗi xe: chạy trên đoạn [from, to] của một cung đường, nghỉ một quãng rồi chạy lại
const CARS = [
  { road: 'main', from: 0.02, to: 0.62, dur: 17, begin: 0.6, color: '#ff5645' },
  { road: 'pass', from: 0.05, to: 0.8, dur: 20, begin: 2.2, color: '#7c5cf0' },
  { road: 'main', from: 0.98, to: 0.45, dur: 18, begin: 5.5, color: '#0f7d68', reverse: true },
  { road: 'lake', from: 0.0, to: 0.7, dur: 14, begin: 1.4, color: '#ffa53b' },
  { road: 'west', from: 0.0, to: 0.95, dur: 16, begin: 7, color: '#2f6fd6' },
  { road: 'pass', from: 0.92, to: 0.25, dur: 21, begin: 10, color: '#d93c6c', reverse: true },
];

// Đồng cỏ (vẽ dưới đường) và hồ nước
const MEADOWS = [
  { cx: 470, cy: 330, r: 95, ry: 42, seed: 2 },
  { cx: 700, cy: 290, r: 70, ry: 30, seed: 4 },
  { cx: 880, cy: 480, r: 110, ry: 40, seed: 6 },
  { cx: 1150, cy: 130, r: 85, ry: 40, seed: 8 },
  { cx: 260, cy: 470, r: 120, ry: 45, seed: 9 },
  { cx: 960, cy: 300, r: 60, ry: 26, seed: 11 },
];
const LAKES = [
  { d: 'M 975 412 C 990 378, 1060 372, 1098 392 C 1128 410, 1110 448, 1062 452 C 1010 456, 962 440, 975 412 Z', ripples: [[1010, 410], [1050, 430]] },
  { d: 'M 600 505 C 630 470, 760 462, 830 490 C 880 512, 850 552, 760 556 C 670 560, 575 540, 600 505 Z', ripples: [[660, 500], [740, 520], [800, 500]] },
  { d: 'M 525 150 C 540 128, 600 124, 618 144 C 632 162, 608 182, 570 182 C 538 182, 512 170, 525 150 Z', ripples: [[560, 150]] },
];

// Số ngẫu nhiên cố định (cùng kết quả mỗi lần vẽ) để rải cây và đường đồng mức
const seeded = (seed) => {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
};

const contour = (cx, cy, r, ry, wobble, seed) => {
  const pts = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const k = 1 + wobble * Math.sin(3 * a + seed) + wobble * 0.6 * Math.cos(5 * a + seed * 2);
    pts.push(`${(cx + Math.cos(a) * r * k).toFixed(1)} ${(cy + Math.sin(a) * ry * k).toFixed(1)}`);
  }
  return `M ${pts.join(' L ')} Z`;
};

const FORESTS = [
  { x: 640, y: 250, w: 120, h: 70, n: 9 },
  { x: 940, y: 200, w: 150, h: 80, n: 11 },
  { x: 1120, y: 180, w: 90, h: 90, n: 7 },
  { x: 700, y: 470, w: 140, h: 60, n: 8 },
  { x: 380, y: 420, w: 120, h: 60, n: 6 },
  { x: 1130, y: 420, w: 80, h: 60, n: 5 },
  { x: 820, y: 60, w: 140, h: 50, n: 7 },
];

function PlaneFlyby() {
  const ref = useRef(null);
  const [flight, setFlight] = useState(null);
  const count = useRef(0);

  // Chuyến bay đầu tiên sau ~2 giây, các chuyến sau cách nhau 7–14 giây
  useEffect(() => {
    if (flight) return undefined;
    const wait = count.current === 0 ? 1800 : 7000 + Math.random() * 7000;
    const t = setTimeout(() => {
      count.current += 1;
      const width = ref.current?.clientWidth || 1200;
      setFlight({
        id: count.current,
        top: 8 + Math.random() * 30,
        dir: Math.random() < 0.5 ? 'ltr' : 'rtl',
        dur: 7 + Math.random() * 3,
        width,
        size: 18 + Math.round(Math.random() * 8),
      });
    }, wait);
    return () => clearTimeout(t);
  }, [flight]);

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 z-[1]" aria-hidden="true">
      {flight && (
        <div key={flight.id} className="tp-flight" data-dir={flight.dir}
          style={{ top: `${flight.top}%`, '--dur': `${flight.dur}s`, '--w': `${flight.width}px` }}>
          <div className="tp-plane" onAnimationEnd={() => setFlight(null)}>
            <span className="tp-contrail" />
            <Plane className="tp-plane-icon" size={flight.size} fill="currentColor" strokeWidth={1.2} />
          </div>
          <span className="tp-plane-shadow" style={{ left: flight.dir === 'ltr' ? 222 : 0 }} />
        </div>
      )}
    </div>
  );
}

export default function JourneyScene({ className = '', children, planes = true, labels = true, onTourProgress }) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (name) => `tp${uid}-${name}`;

  const trees = useMemo(() => {
    const rand = seeded(7);
    return FORESTS.flatMap((f) => Array.from({ length: f.n }, () => ({
      x: f.x + rand() * f.w,
      y: f.y + rand() * f.h,
      s: 0.7 + rand() * 0.6,
      shade: rand() < 0.5 ? 'var(--tp-tree-1)' : 'var(--tp-tree-2)',
    }))).sort((a, b) => a.y - b.y);
  }, []);

  // Đồng cỏ: mảng xanh mềm + các khóm cỏ nhỏ rải bên trong
  const meadows = useMemo(() => MEADOWS.map((m) => ({ key: m.seed, d: contour(m.cx, m.cy, m.r, m.ry, 0.12, m.seed) })), []);
  const tufts = useMemo(() => {
    const rand = seeded(23);
    return MEADOWS.flatMap((m) => Array.from({ length: 7 }, () => {
      const a = rand() * Math.PI * 2;
      const k = Math.sqrt(rand()) * 0.8;
      return { x: m.cx + Math.cos(a) * m.r * k, y: m.cy + Math.sin(a) * m.ry * k, s: 0.8 + rand() * 0.6 };
    }));
  }, []);

  const hills = useMemo(() => [
    { cx: 860, cy: 150, r: 220, ry: 95, seed: 1 },
    { cx: 300, cy: 170, r: 200, ry: 80, seed: 3 },
    { cx: 1080, cy: 480, r: 160, ry: 70, seed: 5 },
  ].flatMap((h) => [1, 0.78, 0.56, 0.34].map((k, i) => ({
    d: contour(h.cx, h.cy, h.r * k, h.ry * k, 0.07, h.seed + i),
    key: `${h.seed}-${i}`,
  }))), []);

  return (
    <div className={`tp-scene ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id={id('land')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--tp-land-1)' }} />
            <stop offset=".55" style={{ stopColor: 'var(--tp-land-2)' }} />
            <stop offset="1" style={{ stopColor: 'var(--tp-land-3)' }} />
          </linearGradient>
          <linearGradient id={id('route')} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#ff5645" />
            <stop offset=".5" stopColor="#ffa53b" />
            <stop offset="1" stopColor="#7c5cf0" />
          </linearGradient>
          <linearGradient id={id('lake')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--tp-lake-1)' }} />
            <stop offset="1" style={{ stopColor: 'var(--tp-lake-2)' }} />
          </linearGradient>
          {/* Vệt đèn pha xe (id cố định: mọi cảnh dùng chung một kiểu) */}
          <linearGradient id="tp-beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff3b0" stopOpacity=".9" />
            <stop offset="1" stopColor="#fff3b0" stopOpacity="0" />
          </linearGradient>
          {Object.entries(ROADS).map(([key, d]) => <path key={key} id={id(key)} d={d} />)}
        </defs>

        <rect width={W} height={H} fill={`url(#${id('land')})`} />

        {/* Đồng cỏ */}
        <g style={{ fill: 'var(--tp-grass)' }}>
          {meadows.map((m) => <path key={m.key} d={m.d} />)}
        </g>
        <g fill="none" strokeWidth="1.6" strokeLinecap="round" style={{ stroke: 'var(--tp-grass-tuft)' }}>
          {tufts.map((t, i) => (
            <path key={i} transform={`translate(${t.x.toFixed(1)} ${t.y.toFixed(1)}) scale(${t.s.toFixed(2)})`} d="M0 0 L-3 -7 M0 0 L0 -9 M0 0 L3 -7" />
          ))}
        </g>

        {/* Đường đồng mức các quả đồi */}
        <g fill="none" strokeWidth="1.2" style={{ stroke: 'var(--tp-contour)' }}>
          {hills.map((h) => <path key={h.key} d={h.d} />)}
        </g>

        {/* Suối và hồ */}
        <path d="M 1240 230 C 1180 280, 1150 320, 1110 360 S 1060 400, 1040 410" fill="none" strokeWidth="6" strokeLinecap="round" style={{ stroke: 'var(--tp-river)' }} />
        {LAKES.map((l, i) => (
          <g key={i}>
            <path d={l.d} fill={`url(#${id('lake')})`} strokeWidth="1.5" style={{ stroke: 'var(--tp-lake-stroke)' }} />
            {/* gợn sóng lăn tăn */}
            {l.ripples.map(([x, y], j) => (
              <path key={j} d={`M ${x - 9} ${y} q 4.5 -3 9 0 t 9 0`} fill="none" strokeWidth="1.3" strokeLinecap="round"
                className="tp-ripple" style={{ stroke: 'var(--tp-ripple)', animationDelay: `${(i + j) * 0.7}s` }} />
            ))}
          </g>
        ))}

        {/* Cung đường: viền, mặt đường, vạch giữa */}
        <g fill="none" strokeLinecap="round">
          {Object.keys(ROADS).map((key) => <use key={`c-${key}`} href={`#${id(key)}`} strokeWidth="17" style={{ stroke: 'var(--tp-road-edge)' }} />)}
          {Object.keys(ROADS).map((key) => <use key={`r-${key}`} href={`#${id(key)}`} strokeWidth="12" style={{ stroke: 'var(--tp-road)' }} />)}
          {Object.keys(ROADS).map((key) => <use key={`m-${key}`} href={`#${id(key)}`} strokeWidth="1.4" strokeDasharray="7 9" style={{ stroke: 'var(--tp-road-mark)' }} />)}
        </g>

        {/* Rừng thông */}
        <g>
          {trees.map((t, i) => (
            <g key={i} transform={`translate(${t.x.toFixed(1)} ${t.y.toFixed(1)}) scale(${t.s.toFixed(2)})`}>
              <ellipse cx="0" cy="1" rx="6" ry="2" style={{ fill: 'var(--tp-tree-shadow)' }} />
              <path d="M0 -18 L7 -4 L3 -4 L8 2 L-8 2 L-3 -4 L-7 -4 Z" style={{ fill: t.shade }} />
            </g>
          ))}
        </g>

        {/* Xe chạy dọc cung đường rồi mờ dần */}
        {!reduce && CARS.map((c, i) => {
          const run = 0.78; // phần thời gian xe chạy, còn lại là nghỉ (đã ẩn)
          return (
            <g key={i} opacity="0">
              <animateMotion dur={`${c.dur}s`} begin={`${c.begin}s`} repeatCount="indefinite"
                rotate={c.reverse ? 'auto-reverse' : 'auto'} calcMode="linear"
                keyPoints={`${c.from};${c.to};${c.to}`} keyTimes={`0;${run};1`}>
                <mpath href={`#${id(c.road)}`} />
              </animateMotion>
              <animate attributeName="opacity" dur={`${c.dur}s`} begin={`${c.begin}s`} repeatCount="indefinite"
                values="0;1;1;0;0" keyTimes={`0;0.08;${run - 0.1};${run};1`} />
              <g transform="scale(1.3)"><Car color={c.color} /></g>
            </g>
          );
        })}

        {/* Lịch trình mẫu đổi lần lượt */}
        <JourneyTourLayer labels={labels} reduce={reduce} onProgress={onTourProgress} routeGradient={`url(#${id('route')})`} />

        {/* Mây trôi */}
        <g style={{ fill: 'var(--tp-cloud)' }}>
          {[{ y: 70, s: 1, d: 70, delay: -10 }, { y: 150, s: 0.7, d: 90, delay: -55 }, { y: 40, s: 0.55, d: 110, delay: -80 }].map((c, i) => (
            <g key={i} className="tp-cloud" style={{ animationDuration: `${c.d}s`, animationDelay: `${c.delay}s`, opacity: 'var(--tp-cloud-opacity)' }}>
              <g transform={`translate(0 ${c.y}) scale(${c.s})`}>
                <ellipse cx="60" cy="20" rx="60" ry="18" />
                <ellipse cx="40" cy="8" rx="28" ry="20" />
                <ellipse cx="80" cy="4" rx="32" ry="24" />
              </g>
            </g>
          ))}
        </g>
      </svg>

      {planes && !reduce && <PlaneFlyby />}
      {children}
    </div>
  );
}
