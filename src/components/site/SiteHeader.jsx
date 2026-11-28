import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Compass, LogIn, Menu, Moon, Sun, UserPlus, X } from 'lucide-react';
import UserMenu from '../UserMenu';
import UserSearchBox from '../UserSearchBox';
import ThemeToggle from '../portal/ThemeToggle';
import useAppTheme from '../../hooks/useAppTheme';

const NAV = [
  { to: '/', label: 'Trang chủ', match: (p) => p === '/' || p === '/home' },
  { to: '/community', label: 'Cộng đồng', match: (p) => p.startsWith('/community') },
  { to: '/plan', label: 'Lên kế hoạch', match: (p) => p.startsWith('/plan') },
  { to: '/tro-thanh-doi-tac', label: 'Dành cho đối tác', match: (p) => p.startsWith('/tro-thanh-doi-tac') },
];

const readStoredUser = () => {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
};

/**
 * Header dùng chung cho các trang du khách: nền kính mờ có dải màu loang chuyển động,
 * viền dưới chảy màu (đậm hơn khi cuộn trang), viên thuốc đánh dấu trang đang mở và menu cho điện thoại.
 * `user`/`onLogout` không bắt buộc: thiếu thì tự đọc tài khoản đang lưu và tự đăng xuất về trang chủ.
 */
export default function SiteHeader({ user: userProp, onLogout, search = true }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [storedUser, setStoredUser] = useState(readStoredUser);
  const user = userProp !== undefined ? userProp : storedUser;
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useAppTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const logout = () => {
    setOpen(false);
    if (onLogout) { onLogout(); return; }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setStoredUser(null);
    navigate('/');
  };

  return (
    <header className="tp-header" data-scrolled={scrolled}>
      <div className="tp-header-wash" aria-hidden="true" />
      <div className="tp-header-inner mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="tp-logo flex flex-shrink-0 items-center gap-2.5" aria-label="TravelPlatform, về trang chủ">
          <span className="tp-logo-mark"><Compass className="h-5 w-5" aria-hidden="true" /></span>
          <span className="tp-logo-word">TravelPlatform</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Điều hướng chính" onMouseLeave={() => setHovered(null)}>
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link key={item.to} to={item.to} className="tp-nav-link isolate" aria-current={active ? 'page' : undefined}
                onMouseEnter={() => setHovered(item.to)}>
                {hovered === item.to && !active && (
                  <motion.span layoutId="tp-nav-hover" className="tp-nav-hover" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
                )}
                {active && (
                  <motion.span className="tp-nav-pill" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 28 }} />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {search && <UserSearchBox />}

        <div className="ml-auto flex items-center gap-2">
          {/* Điện thoại: nút sáng/tối nằm trong menu để header không bị tràn */}
          <ThemeToggle theme={theme} onToggle={toggleTheme} className="tp-icon-button max-sm:hidden" />
          {user ? (
            <span className="tp-user"><UserMenu user={user} onLogout={logout} /></span>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link to="/login" className="rounded-full px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900">
                Đăng nhập
              </Link>
              <Link to="/register" className="tp-btn-primary px-5 py-2 text-sm">Đăng ký</Link>
            </div>
          )}
          <button type="button" className="tp-menu-button lg:hidden" onClick={() => setOpen((v) => !v)}
            aria-expanded={open} aria-controls="tp-mobile-nav" aria-label={open ? 'Đóng menu' : 'Mở menu'}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav id="tp-mobile-nav" className="tp-drawer lg:hidden" aria-label="Điều hướng chính"
            initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}>
            {NAV.map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setOpen(false)} aria-current={item.match(pathname) ? 'page' : undefined}>
                {item.label}
              </Link>
            ))}
            <button type="button" className="tp-drawer-item sm:hidden" onClick={(e) => toggleTheme(e)}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}
            </button>
            {!user && (
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                <Link to="/login" onClick={() => setOpen(false)} className="justify-center"><LogIn className="h-4 w-4" /> Đăng nhập</Link>
                <Link to="/register" onClick={() => setOpen(false)} className="tp-btn-primary justify-center py-3 text-sm"><UserPlus className="h-4 w-4" /> Đăng ký</Link>
              </div>
            )}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
