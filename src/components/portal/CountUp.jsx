import { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';

const formatVi = (n) => Math.round(n).toLocaleString('vi-VN');

/**
 * Số tăng dần từ giá trị trước tới `value`. Ghi thẳng vào DOM (không setState mỗi khung hình).
 * `format` nên là hàm cố định (khai báo ngoài component) để không chạy lại hiệu ứng mỗi lần render.
 */
export default function CountUp({ value, format = formatVi, duration = 0.9, className = '' }) {
  const ref = useRef(null);
  const fromRef = useRef(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const target = Number(value) || 0;
    const from = fromRef.current;
    fromRef.current = target;
    if (reduceMotion || from === target) {
      el.textContent = format(target);
      return undefined;
    }
    const controls = animate(from, target, {
      duration,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => { el.textContent = format(v); },
    });
    return () => controls.stop();
  }, [value, format, duration, reduceMotion]);

  return <span ref={ref} className={className || undefined}>{format(0)}</span>;
}
