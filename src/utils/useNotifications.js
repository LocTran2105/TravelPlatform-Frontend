import { useCallback, useEffect, useRef, useState } from 'react';
import notificationsApi from '../api/notificationsApi';

const CHANGED_EVENT = 'notifications:changed';
export const POLL_INTERVAL_MS = 30000;

/** Báo cho mọi nơi đang hiển thị số chưa đọc (chuông, trang thông báo) tải lại. */
export const notifyNotificationsChanged = () => {
  window.dispatchEvent(new Event(CHANGED_EVENT));
};

const hasToken = () => {
  try {
    return Boolean(localStorage.getItem('token'));
  } catch {
    return false;
  }
};

/**
 * Số thông báo chưa đọc, tự cập nhật:
 *   - định kỳ mỗi 30 giây khi tab đang hiển thị
 *   - ngay khi tab được focus lại / hiện lại
 *   - ngay khi nơi khác gọi notifyNotificationsChanged()
 * Không gọi API khi chưa đăng nhập. Lỗi mạng được bỏ qua (giữ số cũ).
 */
export function useUnreadCount(intervalMs = POLL_INTERVAL_MS) {
  const [count, setCount] = useState(0);
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!hasToken()) {
      setCount(0);
      return;
    }
    try {
      const value = await notificationsApi.unreadCount();
      if (aliveRef.current) setCount(value);
    } catch {
      // giữ nguyên số hiện tại
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    const kickoff = setTimeout(refresh, 0);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(CHANGED_EVENT, refresh);
    return () => {
      aliveRef.current = false;
      clearTimeout(kickoff);
      clearInterval(timer);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(CHANGED_EVENT, refresh);
    };
  }, [refresh, intervalMs]);

  return { count, setCount, refresh };
}
