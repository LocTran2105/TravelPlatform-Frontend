import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

/*
 * Máy bay đỏ cất cánh: xuất phát từ góc dưới bên trái màn hình, lượn một vòng cong rồi bay lên
 * giữa nửa trên màn hình, để lại vệt bay nét đứt vẽ dần theo sau; tới nơi thì bay cao dần (nhỏ lại) và mờ đi.
 * Máy bay và vệt bay dùng chung một đường cong + cùng nhịp (SMIL keySplines) nên luôn khớp nhau.
 */

const DURATION = 4.2; // giây bay
const EASE = '0.45 0 0.25 1'; // keySplines: chậm lúc cất cánh, nhanh giữa chừng, êm khi tới
const START = '0.4s';

function RedPlane() {
  // Hướng mũi máy bay theo trục +x (animateMotion rotate="auto")
  return (
    <g>
      <path d="M-22 0 C-22 -3.2 -18 -4.4 -10 -4.4 L16 -3.2 C22 -2.8 26 -1.2 27 0 C26 1.2 22 2.8 16 3.2 L-10 4.4 C-18 4.4 -22 3.2 -22 0 Z" fill="#e8322a" />
      <path d="M2 -3.6 L-8 -24 L-2.5 -24 L12 -3.2 Z" fill="#ff5645" />
      <path d="M2 3.6 L-8 24 L-2.5 24 L12 3.2 Z" fill="#c9241d" />
      <path d="M-15 -3.4 L-22 -11 L-18.5 -11 L-10 -3.6 Z" fill="#ff5645" />
      <path d="M-15 3.4 L-22 11 L-18.5 11 L-10 3.6 Z" fill="#c9241d" />
      <path d="M19 -2.2 C22 -1.6 24.5 -0.8 25.4 0 C24.5 0.8 22 1.6 19 2.2 Z" fill="#1c2421" opacity=".55" />
      <path d="M-20 -0.6 L20 -0.6" stroke="#fff" strokeOpacity=".55" strokeWidth="1" />
    </g>
  );
}

export default function TakeoffPlane({ onDone }) {
  const reduce = useReducedMotion();
  const [size] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [phase, setPhase] = useState('flying'); // flying | leaving | done
  // Giữ onDone mới nhất mà không khởi động lại hẹn giờ mỗi lần trang cha vẽ lại
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    if (reduce) return undefined;
    const leave = setTimeout(() => setPhase('leaving'), (DURATION + 0.4) * 1000);
    const done = setTimeout(() => { setPhase('done'); doneRef.current?.(); }, (DURATION + 1.4) * 1000);
    return () => { clearTimeout(leave); clearTimeout(done); };
  }, [reduce]);

  if (reduce || phase === 'done') return null;
  const { w, h } = size;
  const end = { x: w * 0.5, y: h * 0.24 };
  // Cất cánh ở góc dưới trái, vòng sang phải rồi ngoặt lên trái, sau đó lượn sang giữa nửa trên
  const d = `M -60 ${h + 40}
    C ${w * 0.2} ${h * 0.98}, ${w * 0.34} ${h * 0.66}, ${w * 0.25} ${h * 0.5}
    S ${w * 0.17} ${h * 0.18}, ${end.x} ${end.y}`;

  return (
    <div className="tp-takeoff" data-phase={phase} aria-hidden="true">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <linearGradient id="tp-takeoff-trail" gradientUnits="userSpaceOnUse" x1="0" y1={h} x2={end.x} y2={end.y}>
            <stop offset="0" stopColor="#ff5645" stopOpacity="0" />
            <stop offset=".45" stopColor="#ff5645" stopOpacity=".55" />
            <stop offset="1" stopColor="#ffa53b" stopOpacity=".95" />
          </linearGradient>
          {/* Mặt nạ "vẽ dần": nét liền chạy theo máy bay, che phần vệt chưa bay tới */}
          <mask id="tp-takeoff-reveal" maskUnits="userSpaceOnUse" x="-100" y="-100" width={w + 200} height={h + 200}>
            <path d={d} fill="none" stroke="#fff" strokeWidth="24" strokeLinecap="round" pathLength="1" strokeDasharray="1 1" strokeDashoffset="1">
              <animate attributeName="stroke-dashoffset" values="1;0" keyTimes="0;1" calcMode="spline" keySplines={EASE}
                dur={`${DURATION}s`} begin={START} fill="freeze" />
            </path>
          </mask>
          <filter id="tp-takeoff-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
        </defs>

        <g mask="url(#tp-takeoff-reveal)" fill="none" strokeLinecap="round">
          <path d={d} stroke="url(#tp-takeoff-trail)" strokeWidth="10" strokeOpacity=".18" />
          <path d={d} stroke="url(#tp-takeoff-trail)" strokeWidth="2.5" strokeDasharray="10 9" />
        </g>

        {/* Bóng máy bay trên mặt đất: lệch xuống dưới, mờ */}
        <g opacity="0">
          <animateMotion dur={`${DURATION}s`} begin={START} fill="freeze" rotate="auto" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines={EASE} path={d} />
          <set attributeName="opacity" to=".22" begin={START} />
          <g transform="translate(16 26)" filter="url(#tp-takeoff-blur)"><g fill="#1c2421"><path d="M-22 0 L27 0 L2 -24 L-8 -24 Z M2 0 L-8 24 L-2.5 24 Z" /></g></g>
        </g>

        <g opacity="0">
          <animateMotion dur={`${DURATION}s`} begin={START} fill="freeze" rotate="auto" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines={EASE} path={d} />
          <set attributeName="opacity" to="1" begin={START} />
          {/* to lên khi lại gần, rồi nhỏ dần như đang lên cao */}
          <g>
            <animateTransform attributeName="transform" type="scale" values="0.7;1.35;0.75" keyTimes="0;0.45;1"
              dur={`${DURATION}s`} begin={START} fill="freeze" />
            <RedPlane />
          </g>
        </g>
      </svg>
    </div>
  );
}
