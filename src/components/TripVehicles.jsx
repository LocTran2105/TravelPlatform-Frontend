import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

/*
 * Minh họa trên bản đồ chi tiết chuyến đi (chỉ để xem, không nhận thao tác; tắt khi bật "giảm chuyển động"):
 * - Mỗi ngày có một phương tiện chạy theo đường thật (OSRM), lượt này xe máy, lượt sau ô tô.
 *   Xe đi từng chặng: tới mỗi điểm thì dừng một nhịp, ghim định vị nảy lên kèm tên điểm rồi mờ dần.
 * - Thỉnh thoảng một máy bay bay ngang qua khung bản đồ, để lại vệt khói rồi tan.
 */

const LEAD_IN_MS = 600;   // hiện dần ở điểm xuất phát
const DWELL_MS = 1500;    // dừng ở mỗi điểm
const FADE_OUT_MS = 500;  // mờ dần ở điểm cuối
const REST_MS = 2200;     // nghỉ trước lượt sau
const PING_MS = 3000;     // thời gian ghim + tên điểm hiện rồi tan
const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Nhìn từ trên xuống, đầu xe hướng sang phải (0°) để xoay theo hướng đường
const VEHICLES = {
  car: {
    size: [30, 18],
    html: (color) => `
      <svg viewBox="-17 -10 34 20" width="30" height="18" aria-hidden="true">
        <rect x="-15" y="-6.5" width="30" height="15" rx="5" fill="rgba(0,0,0,.28)"/>
        <rect x="-15" y="-8.5" width="30" height="15" rx="5" fill="${color}" stroke="#fff" stroke-width="1.6"/>
        <rect x="3" y="-6.5" width="7" height="11" rx="2" fill="#1c2421" opacity=".55"/>
        <rect x="-11" y="-6.5" width="5" height="11" rx="1.5" fill="#1c2421" opacity=".35"/>
        <circle cx="14.2" cy="-5" r="1.5" fill="#fff4c2"/><circle cx="14.2" cy="2" r="1.5" fill="#fff4c2"/>
      </svg>`,
  },
  motorbike: {
    size: [28, 16],
    html: (color) => `
      <svg viewBox="-15 -9 30 18" width="28" height="16" aria-hidden="true">
        <rect x="-13" y="-1.6" width="26" height="5.2" rx="2.6" fill="rgba(0,0,0,.25)"/>
        <rect x="6" y="-2.4" width="7" height="4.2" rx="2" fill="#1c2421"/>
        <rect x="-13" y="-2.4" width="7" height="4.2" rx="2" fill="#1c2421"/>
        <rect x="-8" y="-3.6" width="16" height="6.6" rx="3.3" fill="${color}" stroke="#fff" stroke-width="1.4"/>
        <rect x="5.4" y="-6.8" width="1.8" height="13" rx=".9" fill="#1c2421"/>
        <ellipse cx="-1.5" cy="-.3" rx="4.2" ry="5.6" fill="#2b3a35" stroke="#fff" stroke-width="1"/>
        <circle cx="0" cy="-.3" r="3.1" fill="${color}" stroke="#fff" stroke-width="1"/>
        <circle cx="13.2" cy="-.3" r="1.4" fill="#fff4c2"/>
      </svg>`,
  },
};

const vehicleIcon = (type, color) => {
  const v = VEHICLES[type];
  return L.divIcon({
    className: 'tp-vehicle-icon',
    html: `<div class="tp-vehicle" data-type="${type}"><div class="tp-vehicle-body">${v.html(color)}</div></div>`,
    iconSize: v.size,
    iconAnchor: [v.size[0] / 2, v.size[1] / 2],
  });
};

// Ghim định vị nảy lên tại điểm + tên điểm, rồi cả cụm mờ dần (CSS .tp-ping)
const pingIcon = (name, color) => L.divIcon({
  className: 'tp-ping-icon',
  html: `<div class="tp-ping" style="--c:${color}">
      <span class="tp-ping-ring"></span>
      <span class="tp-ping-pin"><svg viewBox="0 0 24 32" width="22" height="30" aria-hidden="true">
        <path d="M12 31s10-10.3 10-18.5A10 10 0 0 0 2 12.5C2 20.7 12 31 12 31z" fill="${color}" stroke="#fff" stroke-width="2"/>
        <circle cx="12" cy="12.5" r="4" fill="#fff"/></svg></span>
      <span class="tp-ping-label">${escapeHtml(name)}</span>
    </div>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

/** Quãng đường cộng dồn (mét) để xe chạy đều theo quãng đường, không theo số điểm. */
const measure = (latlngs) => {
  const cumulative = [0];
  for (let i = 1; i < latlngs.length; i++) cumulative.push(cumulative[i - 1] + latlngs[i - 1].distanceTo(latlngs[i]));
  return cumulative;
};

/** Vị trí (mét tính từ đầu đường) của từng điểm dừng: điểm gần nhất trên đường, đi tuần tự để không quay ngược. */
const locateStops = (latlngs, cumulative, stops) => {
  let from = 0;
  return stops.map((s, k) => {
    if (k === 0) return 0;
    if (k === stops.length - 1) return cumulative[cumulative.length - 1];
    const p = L.latLng(s.lat, s.lng);
    let best = from;
    let bestD = Infinity;
    for (let j = from; j < latlngs.length; j++) {
      const d = p.distanceTo(latlngs[j]);
      if (d < bestD) { bestD = d; best = j; }
    }
    from = best;
    return cumulative[best];
  });
};

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

function animateRoute(map, route, order) {
  const latlngs = route.positions.map((p) => L.latLng(p[0], p[1]));
  const cumulative = measure(latlngs);
  const total = cumulative[cumulative.length - 1];
  if (!(total > 0)) return () => {};
  const stops = route.stops?.length >= 2 ? route.stops : [
    { lat: latlngs[0].lat, lng: latlngs[0].lng, name: '' },
    { lat: latlngs.at(-1).lat, lng: latlngs.at(-1).lng, name: '' },
  ];
  const stopAt = locateStops(latlngs, cumulative, stops);

  // Lịch một lượt: hiện dần -> [chạy chặng k -> dừng ở điểm k+1]... -> mờ dần -> nghỉ
  const legs = [];
  let clock = LEAD_IN_MS;
  for (let k = 0; k < stops.length - 1; k++) {
    const len = Math.max(0, stopAt[k + 1] - stopAt[k]);
    // chặng ngắn trong phố ~3,5 giây, chặng dài tối đa 9 giây (người dùng thấy 1,8 giây là quá nhanh)
    const dur = Math.min(9000, Math.max(3500, 2600 + len / 1.2));
    legs.push({ from: stopAt[k], to: stopAt[k + 1], start: clock, end: clock + dur, arrive: k + 1 });
    clock += dur + DWELL_MS;
  }
  const travelEnd = clock - DWELL_MS;
  const lap = travelEnd + DWELL_MS + FADE_OUT_MS + REST_MS;

  // Lệch pha giữa các ngày khi xem cả chuyến, và xen kẽ xe máy / ô tô
  let lapIndex = 0;
  const typeFor = (n) => ((n + order) % 2 === 0 ? 'motorbike' : 'car');
  const marker = L.marker(latlngs[0], { icon: vehicleIcon(typeFor(0), route.color), interactive: false, keyboard: false, zIndexOffset: -500 });
  const pings = new Set();
  const timers = new Set();
  let frame = 0;
  let start = performance.now() + order * 1400;
  let shown = -1; // điểm cuối cùng đã hiện ghim trong lượt này
  let angle = 0;

  const ping = (k) => {
    const s = stops[k];
    if (!s?.name) return;
    const m = L.marker([s.lat, s.lng], { icon: pingIcon(s.name, route.color), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(map);
    pings.add(m);
    const timer = setTimeout(() => { m.remove(); pings.delete(m); timers.delete(timer); }, PING_MS);
    timers.add(timer);
  };

  const pointAt = (dist) => {
    let i = 1;
    while (i < cumulative.length - 1 && cumulative[i] < dist) i++;
    const segLen = cumulative[i] - cumulative[i - 1] || 1;
    const k = Math.max(0, Math.min(1, (dist - cumulative[i - 1]) / segLen));
    const a = latlngs[i - 1];
    const b = latlngs[i];
    return { latlng: [a.lat + (b.lat - a.lat) * k, a.lng + (b.lng - a.lng) * k], a, b };
  };

  const tick = (now) => {
    frame = requestAnimationFrame(tick);
    let t = now - start;
    if (t < 0) return;
    if (t >= lap) {
      start = now; t = 0; shown = -1; lapIndex += 1;
      marker.setIcon(vehicleIcon(typeFor(lapIndex), route.color));
    }
    if (!map.hasLayer(marker)) marker.addTo(map);

    if (shown < 0) { ping(0); shown = 0; }
    let dist = 0;
    let moving = false;
    for (const leg of legs) {
      if (t < leg.start) break;
      if (t <= leg.end) {
        dist = leg.from + (leg.to - leg.from) * easeInOut((t - leg.start) / (leg.end - leg.start));
        moving = true;
        break;
      }
      dist = leg.to;
      if (shown < leg.arrive) { ping(leg.arrive); shown = leg.arrive; }
    }

    const { latlng, a, b } = pointAt(dist);
    marker.setLatLng(latlng);
    const el = marker.getElement();
    if (!el) return;
    if (moving) {
      const pa = map.latLngToLayerPoint(a);
      const pb = map.latLngToLayerPoint(b);
      if (pa.distanceTo(pb) > 0.5) angle = Math.atan2(pb.y - pa.y, pb.x - pa.x) * (180 / Math.PI);
    }
    const body = el.querySelector('.tp-vehicle-body');
    if (body) body.style.transform = `rotate(${angle}deg)`;
    el.classList.toggle('is-moving', moving);
    const fadeStart = travelEnd + DWELL_MS;
    const opacity = t < LEAD_IN_MS ? t / LEAD_IN_MS
      : t < fadeStart ? 1
        : Math.max(0, 1 - (t - fadeStart) / FADE_OUT_MS);
    el.style.opacity = String(opacity);
  };
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    pings.forEach((m) => m.remove());
    marker.remove();
  };
}

/* Máy bay bay ngang khung bản đồ theo đường cong nhẹ (SVG SMIL), vệt khói hiện theo rồi tan. */
const FLIGHT_MS = 9000;
function Flyover() {
  const map = useMap();
  const [flight, setFlight] = useState(null);
  const svgRef = useRef(null);

  // SVG chèn động: Chrome không tự chạy animateMotion của SVG vừa gắn vào trang, nên bắt đầu thủ công ở khung hình kế tiếp.
  useEffect(() => {
    if (!flight) return undefined;
    const raf = requestAnimationFrame(() => {
      svgRef.current?.querySelectorAll('animateMotion').forEach((a) => a.beginElement?.());
    });
    return () => cancelAnimationFrame(raf);
  }, [flight]);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    let timer = 0;
    let n = 0;
    const schedule = (delay) => {
      timer = setTimeout(() => {
        const { x: w, y: h } = map.getSize();
        if (w < 200 || h < 200 || document.hidden) { schedule(8000); return; }
        // Lượt chẵn bay trái -> phải, lượt lẻ ngược lại; cao độ ngẫu nhiên trong nửa giữa khung
        const ltr = n % 2 === 0;
        const y0 = h * (0.45 + Math.random() * 0.35);
        const y1 = h * (0.1 + Math.random() * 0.3);
        const [x0, x1] = ltr ? [-60, w + 60] : [w + 60, -60];
        const cx = w / 2;
        const cy = Math.min(y0, y1) - h * 0.12;
        setFlight({ id: n, w, h, d: `M${x0} ${y0.toFixed(1)} Q${cx} ${cy.toFixed(1)} ${x1} ${y1.toFixed(1)}` });
        n += 1;
        timer = setTimeout(() => { setFlight(null); schedule(16000 + Math.random() * 14000); }, FLIGHT_MS + 1500);
      }, delay);
    };
    schedule(3500);
    return () => clearTimeout(timer);
  }, [map]);

  if (!flight) return null;
  return createPortal(
    <svg key={flight.id} ref={svgRef} className="tp-flyover" width={flight.w} height={flight.h} viewBox={`0 0 ${flight.w} ${flight.h}`} aria-hidden="true">
      <path className="tp-flyover-trail" d={flight.d} pathLength="1" />
      {/* Bóng đổ lệch xuống dưới (không xoay theo máy bay) để thấy máy bay đang ở trên cao */}
      <g className="tp-flyover-shadow" transform="translate(18 30)">
        <g>
          <path d="M14 0 L-6 -15 L-9 -13 L1 -2 L-10 -2 L-14 -7 L-16 -6 L-13 0 L-16 6 L-14 7 L-10 2 L1 2 L-9 13 L-6 15 Z" transform="scale(1.35)" />
          <animateMotion dur={`${FLIGHT_MS}ms`} begin="indefinite" fill="freeze" rotate="auto" path={flight.d} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".35 0 .65 1" />
        </g>
      </g>
      <g className="tp-flyover-plane">
        <path d="M14 0 L-6 -15 L-9 -13 L1 -2 L-10 -2 L-14 -7 L-16 -6 L-13 0 L-16 6 L-14 7 L-10 2 L1 2 L-9 13 L-6 15 Z" transform="scale(1.5)" />
        <animateMotion dur={`${FLIGHT_MS}ms`} begin="indefinite" fill="freeze" rotate="auto" path={flight.d} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".35 0 .65 1" />
      </g>
    </svg>,
    map.getContainer()
  );
}

/** routes: [{ id, color, positions: [[lat, lng], ...], stops: [{ lat, lng, name }] }] */
export default function TripVehicles({ routes }) {
  const map = useMap();
  const routesRef = useRef(routes);
  useEffect(() => { routesRef.current = routes; }, [routes]);
  // Chỉ khởi động lại khi lộ trình thật sự đổi (không phải mỗi lần trang cha vẽ lại)
  const key = routes.map((r) => `${r.id}:${r.color}:${r.positions.length}:${r.positions[0]?.join(',')}:${r.positions.at(-1)?.join(',')}:${(r.stops || []).map((s) => s.name).join('/')}`).join('|');

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const stops = routesRef.current.filter((r) => r.positions.length >= 2).map((r, i) => animateRoute(map, r, i));
    return () => stops.forEach((stop) => stop());
  }, [key, map]);

  return <Flyover />;
}
