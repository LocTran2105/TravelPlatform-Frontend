import { useCallback, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { getTheme, setTheme, subscribeTheme } from '../utils/themeStore';

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Theme sáng/tối dùng chung. `toggleTheme(event)`: màu mới lan ra thành vòng tròn từ vị trí nút bấm
 * (View Transitions API); trình duyệt không hỗ trợ hoặc người dùng giảm chuyển động thì đổi ngay.
 * Nơi gắn thuộc tính lên <html> phải dùng useLayoutEffect để kịp trước khi chụp khung hình mới.
 */
export default function useAppTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => 'light');

  const toggleTheme = useCallback((event) => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    const apply = () => flushSync(() => setTheme(next));
    if (!document.startViewTransition || prefersReducedMotion()) { apply(); return; }

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
  }, []);

  return { theme, toggleTheme };
}
