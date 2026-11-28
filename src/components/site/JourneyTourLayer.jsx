import { useEffect, useMemo, useRef, useState } from 'react';
import { JOURNEY_TOURS, tourLegs } from './journeyTours';
import { Car, Motorbike } from './journeyVehicles';

/*
 * Lớp lịch trình mẫu trên bản đồ minh họa (JourneyScene):
 * ghim các điểm rơi xuống -> xe chạy từng chặng, nét đường hiện dần sau xe -> tới điểm nào ghim nảy lên và hiện tên
 * -> đi hết thì giữ một nhịp, cả lộ trình mờ đi và chuyển sang chuyến mẫu tiếp theo (điểm, tên, đường đi đều khác).
 * onProgress({ index, reached }) để thẻ "lịch trình tham khảo" bên ngoài đổi theo.
 */

// Nhịp một chuyến (ms)
const START = 1200;  // ghim rơi xuống
const LEG = 3200;    // chạy một chặng
const DWELL = 1000;  // dừng ở mỗi điểm
const HOLD = 3200;   // giữ lại khi đã tới điểm cuối
const LEAVE = 700;   // mờ đi trước khi đổi chuyến
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

export default function JourneyTourLayer({ labels, reduce, onProgress, routeGradient }) {
  const [index, setIndex] = useState(0);
  const [reached, setReached] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const tour = JOURNEY_TOURS[index];
  const legs = useMemo(() => tourLegs(tour.stops), [tour]);
  const legRefs = useRef([]);
  const vehicleRef = useRef(null);
  const onProgressRef = useRef(onProgress);
  useEffect(() => { onProgressRef.current = onProgress; });
  const shownReached = reduce ? tour.stops.length : reached;

  useEffect(() => { onProgressRef.current?.({ index, reached: shownReached }); }, [index, shownReached]);

  useEffect(() => {
    if (reduce) return undefined;
    const lengths = legs.map((_, k) => legRefs.current[k]?.getTotalLength() || 0);
    const total = START + legs.length * (LEG + DWELL) + HOLD;
    const start = performance.now();
    let last = 0;
    let left = false;
    let frame = 0;
    let angle = 0;

    const place = (k, e) => {
      const path = legRefs.current[k];
      const v = vehicleRef.current;
      if (!path || !v) return;
      const len = lengths[k];
      const d = len * e;
      const p = path.getPointAtLength(d);
      const ahead = path.getPointAtLength(Math.min(len, d + 3));
      const behind = path.getPointAtLength(Math.max(0, d - 3));
      if (Math.hypot(ahead.x - behind.x, ahead.y - behind.y) > 0.3) {
        angle = Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * (180 / Math.PI);
      }
      v.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle.toFixed(1)})`);
    };

    const tick = (now) => {
      const t = now - start;
      if (t >= total) {
        setIndex((i) => (i + 1) % JOURNEY_TOURS.length);
        setReached(0);
        setLeaving(false);
        return;
      }
      let current = 0;
      let eased = 0;
      legs.forEach((_, k) => {
        const s0 = START + k * (LEG + DWELL);
        const p = Math.max(0, Math.min(1, (t - s0) / LEG));
        const e = easeInOut(p);
        const trail = legRefs.current[k];
        if (trail) trail.style.strokeDashoffset = String(1 - e);
        if (t >= s0) { current = k; eased = e; }
        if (p >= 1 && last < k + 1) { last = k + 1; setReached(k + 1); }
      });
      place(current, eased);
      const v = vehicleRef.current;
      if (v) {
        const fadeIn = Math.min(1, Math.max(0, (t - START + 500) / 500));
        const fadeOut = Math.min(1, Math.max(0, (total - HOLD + 900 - t) / 600));
        v.style.opacity = String(Math.min(fadeIn, fadeOut));
      }
      if (!left && t >= total - LEAVE) { left = true; setLeaving(true); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [index, legs, reduce]);

  const lastStop = Math.min(shownReached, tour.stops.length - 1);

  return (
    <g className={leaving ? 'tp-tour-leave' : 'tp-tour'} data-tour={tour.id}>
      {/* key theo chuyến: đổi chuyến thì dựng lại toàn bộ (nét đường về trạng thái chưa vẽ, ghim rơi lại) */}
      <g key={tour.id}>
      {/* Đường đi: vệt mờ cả tuyến + vạch chấm gợi ý + nét chính hiện dần theo xe */}
      <g fill="none" strokeLinecap="round">
        {legs.map((d, k) => <path key={`g${k}`} d={d} stroke={routeGradient} strokeWidth="9" strokeOpacity=".14" />)}
        {legs.map((d, k) => <path key={`d${k}`} d={d} strokeWidth="2" strokeDasharray="2 7" style={{ stroke: 'var(--tp-road-mark)' }} />)}
        {legs.map((d, k) => (
          <path key={`t${k}`} ref={(el) => { legRefs.current[k] = el; }} d={d}
            stroke={routeGradient} strokeWidth="3.5" pathLength="1" strokeDasharray="1" style={{ strokeDashoffset: reduce ? 0 : 1 }} />
        ))}
      </g>

      {/* Điểm ghim: rơi xuống khi đổi chuyến, nảy lên + hiện tên khi xe tới */}
      {tour.stops.map((p, k) => {
        const on = shownReached >= k;
        const w = p.name.length * 7.2 + 18;
        // Tên đặt sang trái khi sát mép phải hoặc khi sẽ lấn vào thẻ lịch trình nổi ở góc dưới phải
        const toLeft = p.x > 960 || (p.y > 270 && p.x + 18 + w > 920);
        return (
          <g key={p.name} transform={`translate(${p.x} ${p.y})`}>
            {on && k === lastStop && !reduce && <circle r="9" fill={p.color} opacity=".35" className="tp-pin-ring" />}
            <g className="tp-pin-drop" style={{ animationDelay: `${0.15 + k * 0.15}s` }}>
              <g className={on && !reduce ? 'tp-pin-hop' : undefined}>
                <path d="M0 0 C -4 -8, -12 -13, -12 -22 A 12 12 0 1 1 12 -22 C 12 -13, 4 -8, 0 0 Z" fill={p.color} strokeWidth="2.5" style={{ stroke: 'var(--tp-pin-stroke)' }} />
                <circle cx="0" cy="-22" r="4.5" style={{ fill: 'var(--tp-pin-stroke)' }} />
              </g>
              {labels && on && (
                <g transform={`translate(${toLeft ? -18 - w : 18} -30)`}>
                  <g className="tp-label-pop" style={{ transformOrigin: toLeft ? '100% 50%' : '0 50%' }}>
                    <rect x="0" y="-12" width={w} height="24" rx="12" style={{ fill: 'var(--tp-label-bg)', stroke: 'var(--tp-label-line)' }} />
                    <text x="9" y="4.5" fontSize="12.5" fontWeight="600" style={{ fill: 'var(--tp-label-ink)' }} fontFamily="'Be Vietnam Pro', system-ui, sans-serif">{p.name}</text>
                  </g>
                </g>
              )}
            </g>
          </g>
        );
      })}

      {/* Xe chạy theo lộ trình: xe máy hoặc ô tô tùy chuyến */}
      {!reduce && (
        <g ref={vehicleRef} className="tp-tour-vehicle" style={{ opacity: 0 }} transform={`translate(${tour.stops[0].x} ${tour.stops[0].y})`}>
          <g transform="scale(1.35)">{tour.vehicle === 'car' ? <Car color="#ff5645" /> : <Motorbike color="#7c5cf0" />}</g>
        </g>
      )}
      </g>
    </g>
  );
}
