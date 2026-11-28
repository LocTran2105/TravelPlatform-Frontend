import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import NotificationItem from '../components/NotificationItem';
import notificationsApi from '../api/notificationsApi';
import { safeInternalLink } from '../utils/notificationText';
import { notifyNotificationsChanged } from '../utils/useNotifications';
import SiteHeader from '../components/site/SiteHeader';

const PAGE_SIZE = 20;

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user')) || null;
  } catch {
    return null;
  }
};

/** Trang /notifications: toàn bộ thông báo, lọc chưa đọc, tải thêm, xóa. */
export default function Notifications() {
  const navigate = useNavigate();
  const [user] = useState(readStoredUser);
  const [filter, setFilter] = useState('all'); // all | unread
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

  const loggedIn = Boolean(localStorage.getItem('token'));

  useEffect(() => {
    if (!loggedIn) navigate('/login', { replace: true });
  }, [loggedIn, navigate]);

  const fetchPage = useCallback(async (nextPage, mode) => {
    const data = await notificationsApi.list({ unreadOnly: mode === 'unread', page: nextPage, size: PAGE_SIZE });
    return data || { items: [], hasMore: false, unreadCount: 0 };
  }, []);

  // Tải trang đầu (khi đổi bộ lọc hoặc bấm "Thử lại"); bỏ qua kết quả của yêu cầu đã cũ.
  const loadFirst = useCallback(async (mode) => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError('');
    try {
      const data = await fetchPage(0, mode);
      if (requestRef.current !== requestId) return;
      setItems(data.items || []);
      setPage(0);
      setHasMore(Boolean(data.hasMore));
      setUnread(Number(data.unreadCount) || 0);
    } catch {
      if (requestRef.current === requestId) setError('Không tải được thông báo. Vui lòng thử lại.');
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    if (!loggedIn) return undefined;
    const timer = setTimeout(() => loadFirst(filter), 0);
    return () => clearTimeout(timer);
  }, [filter, loggedIn, loadFirst]);

  const loadMore = async () => {
    const requestId = requestRef.current;
    setLoadingMore(true);
    try {
      const data = await fetchPage(page + 1, filter);
      if (requestRef.current !== requestId) return;
      setItems((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...(data.items || []).filter((n) => !seen.has(n.id))];
      });
      setPage((p) => p + 1);
      setHasMore(Boolean(data.hasMore));
      setUnread(Number(data.unreadCount) || 0);
    } catch {
      setError('Không tải thêm được thông báo.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOpen = (item) => {
    if (!item.read) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
      notificationsApi.markRead(item.id).catch(() => {}).finally(notifyNotificationsChanged);
    }
    const link = safeInternalLink(item.link);
    if (link) navigate(link);
  };

  const handleRemove = async (item) => {
    const previous = items;
    const wasUnread = !item.read;
    setItems((prev) => prev.filter((n) => n.id !== item.id));
    if (wasUnread) setUnread((u) => Math.max(0, u - 1));
    try {
      await notificationsApi.remove(item.id);
      notifyNotificationsChanged();
    } catch {
      setItems(previous);
      if (wasUnread) setUnread((u) => u + 1);
      setError('Không xóa được thông báo. Vui lòng thử lại.');
    }
  };

  const handleMarkAll = async () => {
    const previous = items;
    const previousUnread = unread;
    setItems((prev) => (filter === 'unread' ? [] : prev.map((n) => ({ ...n, read: true }))));
    setUnread(0);
    try {
      await notificationsApi.markAllRead();
      notifyNotificationsChanged();
    } catch {
      setItems(previous);
      setUnread(previousUnread);
      setError('Không thể đánh dấu đã đọc. Vui lòng thử lại.');
    }
  };

  const tabClass = (active) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition ${
      active ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
    }`;

  if (!loggedIn) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader search={false} user={user} />

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Bell className="h-5 w-5 text-emerald-600" />
            Thông báo
          </h1>
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={unread === 0}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
          >
            <CheckCheck className="h-4 w-4" />
            Đánh dấu đã đọc tất cả
          </button>
        </div>

        <div className="mb-4 flex gap-2" role="tablist" aria-label="Lọc thông báo">
          <button type="button" role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')} className={tabClass(filter === 'all')}>
            Tất cả
          </button>
          <button type="button" role="tab" aria-selected={filter === 'unread'} onClick={() => setFilter('unread')} className={tabClass(filter === 'unread')}>
            Chưa đọc{unread > 0 ? ` (${unread})` : ''}
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">
            {error}{' '}
            <button type="button" onClick={() => loadFirst(filter)} className="font-semibold underline">Thử lại</button>
          </p>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16" role="status" aria-label="Đang tải">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <Bell className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">
                {filter === 'unread' ? 'Bạn đã đọc hết thông báo.' : 'Bạn chưa có thông báo nào.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {items.map((item) => (
                <NotificationItem key={item.id} item={item} onOpen={handleOpen} onRemove={handleRemove} />
              ))}
            </ul>
          )}
        </div>

        {hasMore && !loading && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-emerald-600 ring-1 ring-emerald-200 transition hover:bg-emerald-50 disabled:opacity-60"
            >
              {loadingMore ? 'Đang tải…' : 'Tải thêm'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
