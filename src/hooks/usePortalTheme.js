import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

// Theme sáng/tối cho Admin/Partner portal.
// Lưu lựa chọn ở localStorage; chưa chọn thì theo cài đặt của máy.
// Gắn <html data-portal-theme="..."> khi đang ở portal để cả modal/toast (render ngoài shell) cũng đổi màu,
// và gỡ khi rời portal để trang du khách không bị ảnh hưởng.

const STORAGE_KEY = 'portal-theme';

const readStored = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
};

const systemTheme = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function usePortalTheme() {
  const [stored, setStored] = useState(readStored);
  const [system, setSystem] = useState(systemTheme);
  const theme = stored || system;

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const onChange = (event) => setSystem(event.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.portalTheme = theme;
    return () => { delete root.dataset.portalTheme; };
  }, [theme]);

  /** Đổi theme; truyền event của nút bấm để màu mới lan ra thành vòng tròn từ vị trí nút. */
  const toggleTheme = useCallback((event) => {
    const next = theme === 'dark' ? 'light' : 'dark';
    const apply = () => {
      document.documentElement.dataset.portalTheme = next;
      flushSync(() => setStored(next));
    };
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* chế độ riêng tư: chỉ giữ trong phiên */ }

    if (!document.startViewTransition || prefersReducedMotion()) {
      apply();
      return;
    }
    const rect = event?.currentTarget?.getBoundingClientRect?.();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 60;
    const y = rect ? rect.top + rect.height / 2 : 30;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = document.startViewTransition(apply);
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => { /* trình duyệt hủy hiệu ứng: theme vẫn đã đổi */ });
  }, [theme]);

  return { theme, toggleTheme };
}
