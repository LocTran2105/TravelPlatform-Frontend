import { useLayoutEffect } from 'react';
import useAppTheme from './useAppTheme';

// Theme sáng/tối cho Admin/Partner portal (dùng chung lựa chọn với trang du khách, xem utils/themeStore).
// Gắn <html data-portal-theme="..."> khi đang ở portal để cả modal/toast (render ngoài shell) cũng đổi màu,
// và gỡ khi rời portal để trang du khách không bị ảnh hưởng.
export default function usePortalTheme() {
  const { theme, toggleTheme } = useAppTheme();

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.portalTheme = theme;
    return () => { delete root.dataset.portalTheme; };
  }, [theme]);

  return { theme, toggleTheme };
}
