import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import notificationsApi from '../api/notificationsApi';
import { badgeText, safeInternalLink } from '../utils/notificationText';
import { notifyNotificationsChanged, useUnreadCount } from '../utils/useNotifications';
import NotificationItem from './NotificationItem';

const PANEL_SIZE = 10;

/** Chuông thông báo: huy hiệu số chưa đọc + danh sách thả xuống. Đặt trong UserMenu. */
export default function NotificationBell() {
  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const requestRef = useRef(0);
  const { count, setCount, refresh } = useUnreadCount();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError('');
    try {
      const data = await notificationsApi.list({ page: 0, size: PANEL_SIZE });
      if (requestRef.current !== requestId) return;
      setItems(data?.items || []);
      setCount(Number(data?.unreadCount) || 0);
    } catch {
      if (requestRef.current === requestId) setError('Không tải được thông báo.');
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [setCount]);

  useEffect(() => {
    if (!open) return undefined;
    const onMouseDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  const handleOpenItem = async (item) => {
    setOpen(false);
    if (!item.read) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      setCount((c) => Math.max(0, c - 1));
      notificationsApi
        .markRead(item.id)
        .catch(() => refresh())
        .finally(notifyNotificationsChanged);
    }
    const link = safeInternalLink(item.link);
    if (link) navigate(link);
  };

  const handleMarkAll = async () => {
    const previous = items;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setCount(0);
    try {
      await notificationsApi.markAllRead();
    } catch {
      setItems(previous);
      refresh();
      setError('Không thể đánh dấu đã đọc. Vui lòng thử lại.');
    }
    notifyNotificationsChanged();
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={count > 0 ? `Thông báo, ${count} chưa đọc` : 'Thông báo'}
        title="Thông báo"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span
            data-testid="notification-badge"
            className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-[18px] text-white ring-2 ring-white"
          >
            {badgeText(count)}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Thông báo"
          className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-900">Thông báo</h2>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={count === 0}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-[#E04B3B] transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Đánh dấu đã đọc tất cả
            </button>
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {loading && items.length === 0 && (
              <div className="flex items-center justify-center py-10" role="status" aria-label="Đang tải">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-200 border-t-[#FF5645]" />
              </div>
            )}
            {error && (
              <p role="alert" className="px-4 py-3 text-center text-sm text-red-600">
                {error}{' '}
                <button type="button" onClick={load} className="font-semibold underline">Thử lại</button>
              </p>
            )}
            {!loading && !error && items.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">Bạn chưa có thông báo nào.</p>
              </div>
            )}
            {items.length > 0 && (
              <ul className="divide-y divide-slate-50">
                {items.map((item) => (
                  <NotificationItem key={item.id} item={item} onOpen={handleOpenItem} />
                ))}
              </ul>
            )}
          </div>

          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-semibold text-[#E04B3B] transition hover:bg-orange-50"
          >
            Xem tất cả thông báo
          </Link>
        </div>
      )}
    </div>
  );
}
