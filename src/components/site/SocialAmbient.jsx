import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Camera, Heart, MapPin, Send } from 'lucide-react';

/*
 * Hoạt họa trang trí hai bên bảng tin Cộng đồng (chỉ màn rộng, không nhận thao tác, ẩn với trình đọc màn hình):
 *  - Bên trái (chụp ảnh): máy ảnh chớp đèn, ảnh polaroid in ra rồi hiện màu dần, tường ảnh đung đưa.
 *  - Bên phải (tương tác): bong bóng bình luận gõ chữ, tim bay lên như thả cảm xúc, máy bay giấy (chia sẻ),
 *    ghim địa điểm check-in, thẻ hashtag trôi.
 * Nội dung chỉ là minh họa (không có tên người, không giả thông báo thật).
 */

const SCENES = ['hill', 'sea', 'pine', 'lantern'];
const PLACES = { hill: 'Đà Lạt', sea: 'Phú Quốc', pine: 'Măng Đen', lantern: 'Hội An' };
const COMMENTS = ['Đẹp quá!', 'Quán này ở đâu vậy?', 'Lưu lại cho chuyến sau', 'Cuối tuần đi không?', 'Ảnh chụp lúc mấy giờ thế?', 'Nhìn là muốn đi liền'];
const TAGS = [
  { t: '#ĐàLạt', x: 6, y: 0 }, { t: '#CheckIn', x: 52, y: 14 }, { t: '#CafeView', x: 18, y: 62 },
  { t: '#SănMây', x: 58, y: 96 }, { t: '#PhượtCuốiTuần', x: 4, y: 136 }, { t: '#HộiAn', x: 50, y: 176 },
];
const BUBBLE_COLORS = ['#ff5645', '#7c5cf0', '#0f7d68', '#2f6fd6', '#ffa53b'];

/** Ảnh minh họa nhỏ trong khung polaroid (SVG), mỗi cảnh một bảng màu. */
export function PhotoArt({ scene }) {
  if (scene === 'sea') {
    return (
      <svg viewBox="0 0 120 90" className="h-full w-full" aria-hidden="true">
        <defs><linearGradient id="pa-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8fd3ff" /><stop offset="1" stopColor="#ffe3c2" /></linearGradient></defs>
        <rect width="120" height="90" fill="url(#pa-sea)" />
        <circle cx="88" cy="30" r="11" fill="#fff4c9" />
        <rect y="52" width="120" height="38" fill="#2c8fc9" />
        <path d="M0 60 Q15 56 30 60 T60 60 T90 60 T120 60" stroke="#bfe8ff" strokeWidth="1.5" fill="none" />
        <path d="M40 52 L52 52 L49 56 L43 56 Z M46 52 L46 40 L53 50 Z" fill="#1c2421" opacity=".75" />
        <path d="M0 78 Q30 70 60 78 T120 76 L120 90 L0 90 Z" fill="#f5d7a8" />
      </svg>
    );
  }
  if (scene === 'pine') {
    return (
      <svg viewBox="0 0 120 90" className="h-full w-full" aria-hidden="true">
        <defs><linearGradient id="pa-pine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9efe6" /><stop offset="1" stopColor="#a7d4c0" /></linearGradient></defs>
        <rect width="120" height="90" fill="url(#pa-pine)" />
        <ellipse cx="62" cy="70" rx="40" ry="9" fill="#5fa8c7" />
        {[12, 26, 40, 84, 98, 110].map((x, i) => (
          <path key={x} d={`M${x} ${30 + (i % 3) * 6} L${x + 9} ${66} L${x - 9} ${66} Z`} fill={i % 2 ? '#1f6b52' : '#2f7a5f'} />
        ))}
        <rect y="32" width="120" height="8" fill="#fff" opacity=".35" />
      </svg>
    );
  }
  if (scene === 'lantern') {
    return (
      <svg viewBox="0 0 120 90" className="h-full w-full" aria-hidden="true">
        <rect width="120" height="90" fill="#1f2a4d" />
        <path d="M0 26 Q60 44 120 24" stroke="#4a5577" fill="none" />
        {[[14, 32, '#ff5645'], [32, 37, '#ffa53b'], [52, 40, '#ffd166'], [72, 39, '#ff5645'], [92, 35, '#d93c6c'], [108, 30, '#ffa53b']].map(([x, y, c]) => (
          <g key={x}><circle cx={x} cy={y} r="11" fill={c} opacity=".25" /><ellipse cx={x} cy={y} rx="5.5" ry="7" fill={c} /></g>
        ))}
        <rect y="64" width="120" height="26" fill="#2b3a66" />
        <path d="M0 70 Q30 66 60 70 T120 69" stroke="#ffd166" strokeOpacity=".5" fill="none" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 90" className="h-full w-full" aria-hidden="true">
      <defs><linearGradient id="pa-hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffb38a" /><stop offset="1" stopColor="#ffd9c2" /></linearGradient></defs>
      <rect width="120" height="90" fill="url(#pa-hill)" />
      <circle cx="40" cy="38" r="12" fill="#fff1d6" />
      <path d="M0 62 L30 36 L52 56 L76 30 L120 66 L120 90 L0 90 Z" fill="#7c5cf0" opacity=".75" />
      <path d="M0 72 L40 54 L70 70 L96 56 L120 70 L120 90 L0 90 Z" fill="#3e3a8c" />
    </svg>
  );
}

function Polaroid({ scene, className = '', style, developing = false }) {
  return (
    <div className={`tp-polaroid ${className}`} style={style}>
      <div className={`tp-polaroid-photo ${developing ? 'is-developing' : ''}`}><PhotoArt scene={scene} /></div>
      <span className="tp-polaroid-caption">{PLACES[scene]}</span>
    </div>
  );
}

/** Lặp lại một hàm theo nhịp ngẫu nhiên trong khoảng [min, max] ms. */
function useJitterInterval(fn, min, max, enabled) {
  const saved = useRef(fn);
  useEffect(() => { saved.current = fn; }, [fn]);
  useEffect(() => {
    if (!enabled) return undefined;
    let t;
    const tick = () => { saved.current(); t = setTimeout(tick, min + Math.random() * (max - min)); };
    t = setTimeout(tick, 600);
    return () => clearTimeout(t);
  }, [min, max, enabled]);
}

function CameraColumn({ active }) {
  const [shot, setShot] = useState(null); // { id, scene, tilt }
  const count = useRef(0);
  useJitterInterval(() => {
    count.current += 1;
    setShot({ id: count.current, scene: SCENES[count.current % SCENES.length], tilt: -9 + Math.random() * 18 });
  }, 6500, 8500, active);

  return (
    <div className="tp-ambient-col left">
      {/* Máy ảnh: mỗi lần chụp có chớp đèn và ảnh in ra */}
      <div className="tp-camera">
        <span className="tp-camera-body"><Camera className="h-9 w-9" strokeWidth={1.6} /></span>
        <AnimatePresence>
          {shot && <motion.span key={`f${shot.id}`} className="tp-flash" initial={{ opacity: 0.95, scale: 0.4 }} animate={{ opacity: 0, scale: 2.6 }} exit={{ opacity: 0 }} transition={{ duration: 0.55, ease: 'easeOut' }} />}
        </AnimatePresence>
        <AnimatePresence>
          {shot && (
            <motion.div key={shot.id} className="tp-print"
              initial={{ y: -40, opacity: 0, rotate: 0, scale: 0.85 }}
              animate={{ y: [-40, 70, 110], opacity: [0, 1, 1], rotate: [0, shot.tilt * 0.5, shot.tilt], scale: [0.85, 1, 1] }}
              exit={{ y: 150, opacity: 0, scale: 0.92, transition: { duration: 0.8, ease: 'easeIn' } }}
              transition={{ duration: 1.6, times: [0, 0.55, 1], ease: 'easeOut' }}>
              <Polaroid scene={shot.scene} developing />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tường ảnh: vài tấm ghim băng dính, đung đưa nhẹ */}
      <div className="tp-photo-wall">
        <Polaroid scene="lantern" className="tp-sway" style={{ '--tilt': '-7deg', left: '4%', top: 0 }} />
        <Polaroid scene="pine" className="tp-sway" style={{ '--tilt': '6deg', left: '52%', top: '34px', animationDelay: '-2s' }} />
        <Polaroid scene="sea" className="tp-sway" style={{ '--tilt': '-3deg', left: '26%', top: '190px', animationDelay: '-4s' }} />
      </div>

      <div className="tp-checkin">
        <span className="tp-checkin-ring" /><span className="tp-checkin-ring" style={{ animationDelay: '1.2s' }} />
        <MapPin className="tp-checkin-pin h-7 w-7" fill="currentColor" strokeWidth={1.2} />
      </div>
    </div>
  );
}

function SocialColumn({ active }) {
  const [comments, setComments] = useState([]);
  const [hearts, setHearts] = useState([]);
  const n = useRef(0);

  useJitterInterval(() => {
    n.current += 1;
    const id = n.current;
    setComments((prev) => [...prev.slice(-2), { id, text: COMMENTS[id % COMMENTS.length], color: BUBBLE_COLORS[id % BUBBLE_COLORS.length], typing: true }]);
    setTimeout(() => setComments((prev) => prev.map((c) => (c.id === id ? { ...c, typing: false } : c))), 1100);
  }, 3200, 4600, active);

  useJitterInterval(() => {
    const burst = 1 + Math.floor(Math.random() * 3);
    const now = Date.now();
    setHearts((prev) => [...prev.filter((h) => now - h.born < 3200), ...Array.from({ length: burst }, (_, i) => ({
      id: `${now}-${i}`, born: now, x: -26 + Math.random() * 52, drift: -40 + Math.random() * 80,
      size: 16 + Math.random() * 14, hue: ['#ff5645', '#e8335f', '#ff7a59', '#d93c6c'][Math.floor(Math.random() * 4)], delay: i * 0.12,
    }))]);
  }, 700, 1500, active);

  return (
    <div className="tp-ambient-col right">
      <div className="tp-thread">
        <AnimatePresence initial={false}>
          {comments.map((c) => (
            <motion.div key={c.id} layout className="tp-bubble-row"
              initial={{ opacity: 0, y: 16, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -14, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
              <span className="tp-bubble-avatar" style={{ background: c.color }} />
              <span className="tp-bubble">
                {c.typing ? <span className="tp-typing"><i /><i /><i /></span> : c.text}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="tp-tags">
        {TAGS.map(({ t, x, y }, i) => <span key={t} className="tp-tag" style={{ animationDelay: `${-i * 2.3}s`, left: `${x}%`, top: y }}>{t}</span>)}
      </div>

      <span className="tp-paper-plane"><Send className="h-6 w-6" /></span>

      {/* Nút tim: thả cảm xúc bay lên */}
      <div className="tp-hearts">
        {hearts.map((h) => (
          <motion.span key={h.id} className="tp-heart" style={{ color: h.hue }}
            initial={{ y: 0, x: h.x, opacity: 0, scale: 0.4 }}
            animate={{ y: -260, x: h.x + h.drift, opacity: [0, 1, 1, 0], scale: [0.4, 1.1, 1, 0.9] }}
            transition={{ duration: 2.8, delay: h.delay, ease: 'easeOut' }}>
            <Heart style={{ width: h.size, height: h.size }} fill="currentColor" strokeWidth={0} />
          </motion.span>
        ))}
        <span className="tp-like-button"><Heart className="h-6 w-6" fill="currentColor" strokeWidth={0} /></span>
      </div>
    </div>
  );
}

/** Chỉ chạy trên màn đủ rộng để có khoảng trống hai bên bảng tin. */
export default function SocialAmbient() {
  const reduce = useReducedMotion();
  const [wide, setWide] = useState(() => window.matchMedia?.('(min-width: 1200px)').matches ?? false);
  const [visible, setVisible] = useState(() => !document.hidden);

  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 1200px)');
    const onMedia = (e) => setWide(e.matches);
    const onVis = () => setVisible(!document.hidden);
    media?.addEventListener('change', onMedia);
    document.addEventListener('visibilitychange', onVis);
    return () => { media?.removeEventListener('change', onMedia); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  if (!wide) return null;
  const active = !reduce && visible;
  return (
    <div className="tp-ambient" aria-hidden="true">
      <CameraColumn active={active} />
      <SocialColumn active={active} />
    </div>
  );
}
