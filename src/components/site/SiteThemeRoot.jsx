import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useAppTheme from '../../hooks/useAppTheme';

// Portal Admin/Partner có bộ màu riêng (data-portal-theme); các trang còn lại là trang du khách.
const isPortalPath = (pathname) => /^\/(admin|partner)(\/|$)/.test(pathname);

/** Gắn <html data-site-theme="light|dark"> cho mọi trang du khách (site-dark.css đọc thuộc tính này). */
export default function SiteThemeRoot() {
  const { pathname } = useLocation();
  const { theme } = useAppTheme();
  const portal = isPortalPath(pathname);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (portal) delete root.dataset.siteTheme;
    else root.dataset.siteTheme = theme;
  }, [portal, theme]);

  return null;
}
