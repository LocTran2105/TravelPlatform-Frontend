import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { subscribeToasts } from '../utils/toast';

// Chồng thông báo góc trên bên phải; tự tắt sau vài giây, rê chuột vào thì giữ lại.

const STYLES = {
  error: { icon: AlertCircle, box: 'border-rose-200 bg-white', iconClass: 'text-rose-600', bar: 'bg-rose-500' },
  success: { icon: CheckCircle2, box: 'border-emerald-200 bg-white', iconClass: 'text-emerald-600', bar: 'bg-emerald-500' },
  info: { icon: Info, box: 'border-sky-200 bg-white', iconClass: 'text-sky-600', bar: 'bg-sky-500' },
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
    <div
      role={item.type === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`pointer-events-auto relative flex w-[360px] max-w-[calc(100vw-2rem)] items-start gap-3 overflow-hidden rounded-2xl border px-4 py-3 shadow-xl ${style.box}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} />
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconClass}`} />
      <p className="flex-1 text-sm font-medium leading-relaxed text-slate-700 whitespace-pre-line break-words">{item.message}</p>
      <button type="button" onClick={() => onClose(item.id)} aria-label="Đóng thông báo"
        className="-mr-1 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
        <X className="h-4 w-4" />
      </button>
    </div>
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

  if (items.length === 0) return null;
  return createPortal(
    <div aria-live="polite" className="pointer-events-none fixed right-4 top-4 z-[6000] flex flex-col gap-2">
      {items.map((item) => <ToastItem key={item.id} item={item} onClose={close} />)}
    </div>,
    document.body,
  );
};

export default Toaster;
