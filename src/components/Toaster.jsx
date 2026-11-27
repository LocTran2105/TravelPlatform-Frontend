import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { subscribeToasts } from '../utils/toast';

// Chồng thông báo góc trên bên phải; tự tắt sau vài giây (thanh dưới cùng cho biết còn bao lâu),
// rê chuột vào thì giữ lại. Màu lấy từ biến --p-* nên đổi theo giao diện sáng/tối của portal.

const STYLES = {
  error: { icon: AlertCircle, color: 'var(--p-danger-dot, #e0605a)' },
  success: { icon: CheckCircle2, color: 'var(--p-success-dot, #3e8e6e)' },
  info: { icon: Info, color: 'var(--p-info-dot, #4a8bb0)' },
};
const MAX_VISIBLE = 4;

const ToastItem = ({ item, onClose }) => {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => onClose(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [paused, item, onClose]);

  const style = STYLES[item.type] || STYLES.info;
  const Icon = style.icon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 28, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 28, scale: 0.97, transition: { duration: 0.16 } }}
      transition={{ type: 'spring', stiffness: 480, damping: 36 }}
      role={item.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto relative flex w-[360px] max-w-[calc(100vw-2rem)] items-start gap-3 overflow-hidden rounded-2xl border px-4 py-3"
      style={{
        background: 'var(--p-raised, #fff)',
        borderColor: 'var(--p-line, #e2e8f0)',
        boxShadow: 'var(--p-shadow-pop, 0 20px 40px -16px rgba(0,0,0,.25))',
        fontFamily: 'var(--p-font, inherit)',
      }}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: style.color }} />
      <p className="flex-1 text-sm font-medium leading-relaxed whitespace-pre-line break-words" style={{ color: 'var(--p-ink, #334155)' }}>
        {item.message}
      </p>
      <button type="button" onClick={() => onClose(item.id)} aria-label="Đóng thông báo"
        className="-mr-1 rounded-lg p-1 transition hover:opacity-100 opacity-60" style={{ color: 'var(--p-ink, #334155)' }}>
        <X className="h-4 w-4" />
      </button>
      {/* Thời gian còn lại trước khi tự đóng */}
      <span
        aria-hidden="true"
        className="toast-timer absolute bottom-0 left-0 h-[3px] w-full origin-left"
        style={{
          background: style.color,
          opacity: 0.55,
          animation: `toast-timer ${item.duration}ms linear forwards`,
          animationPlayState: paused ? 'paused' : 'running',
        }}
      />
    </motion.div>
  );
};

const Toaster = () => {
  const [items, setItems] = useState([]);
  useEffect(() => subscribeToasts((item) => setItems((prev) => {
    // Cùng nội dung đang hiện thì không chồng thêm (vd. bấm lưu nhiều lần khi mất mạng)
    if (prev.some((p) => p.message === item.message && p.type === item.type)) return prev;
    return [...prev, item].slice(-MAX_VISIBLE);
  })), []);
  const close = useCallback((id) => setItems((prev) => prev.filter((p) => p.id !== id)), []);

  return createPortal(
    <MotionConfig reducedMotion="user">
    <div aria-live="polite" className="pointer-events-none fixed right-4 top-4 z-[6000] flex flex-col items-end gap-2">
      <style>{'@keyframes toast-timer { from { transform: scaleX(1); } to { transform: scaleX(0); } }'}</style>
      <AnimatePresence initial={false}>
        {items.map((item) => <ToastItem key={item.id} item={item} onClose={close} />)}
      </AnimatePresence>
    </div>
    </MotionConfig>,
    document.body,
  );
};

export default Toaster;
