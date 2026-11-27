import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  LayoutDashboard, MapPinned, FileClock, ClipboardCheck, Building2,
  ShieldCheck, ShieldAlert, UserCog, LogOut, Menu, X, Compass, Home, Store, ChevronRight, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { adminApi } from '../api/adminApi';
import { partnerApi } from '../api/partnerApi';
import usePortalTheme from '../hooks/usePortalTheme';
import ThemeToggle from '../components/portal/ThemeToggle';
import { PORTAL_COUNTS_EVENT } from '../utils/portalEvents';
import { getPending, subscribePending } from '../utils/loadingBus';

const PORTALS = {
  partner: {
    name: 'Đối tác',
    role: 'Đối tác du lịch',
    roleIcon: Building2,
    loadCounts: () => partnerApi.getDashboard(),
    links: [
      { to: '/partner', label: 'Tổng quan', icon: LayoutDashboard, end: true },
      { to: '/partner/businesses', label: 'Địa điểm của tôi', icon: MapPinned },
      { to: '/partner/submissions', label: 'Lịch sử xét duyệt', icon: FileClock, countKey: 'pendingSubmissions' },
    ],
  },
  admin: {
    name: 'Quản trị',
    role: 'Quản trị viên',
    roleIcon: ShieldCheck,
    loadCounts: () => adminApi.getDashboard(),
    links: [
      { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true },
      { to: '/admin/applications', label: 'Đơn đăng ký đối tác', icon: ClipboardCheck, countKey: 'pendingPartnerApplications' },
      { to: '/admin/submissions', label: 'Duyệt địa điểm', icon: Building2, countKey: 'pendingSubmissions' },
      { to: '/admin/businesses', label: 'Quản lý địa điểm', icon: Store },
      { to: '/admin/moderators', label: 'Kiểm duyệt viên', icon: UserCog },
    ],
    shortcuts: [
      { to: '/moderation', label: 'Khu kiểm duyệt', icon: ShieldAlert },
    ],
  },
};

const COLLAPSE_KEY = 'portal-sidebar-collapsed';
const readCollapsed = () => { try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; } };
const readUser = () => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } };

const timeFormat = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
const dayFormat = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' });

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const RIPPLE_TARGETS = '.portal-primary-button, .portal-secondary-button, .portal-ghost-button, .portal-danger-button, '
  + '.portal-small-button, .portal-icon-button, .portal-nav-link, .dash-tile';
const SPOT_TARGETS = '.portal-panel, .portal-stat-card, .portal-action-card, .pd-business';

/**
 * Hiệu ứng chung cho mọi trang trong portal (không phải sửa từng trang):
 * gợn sóng tại điểm bấm trên nút/thẻ, và vầng sáng đi theo con trỏ trên các thẻ.
 */
function usePointerEffects(ref) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const onDown = (event) => {
      if (reduce) return;
      const target = event.target.closest(RIPPLE_TARGETS);
      if (!target || target.disabled) return;
      const rect = target.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'fx-ripple';
      ripple.style.position = 'absolute';
      ripple.style.left = `${event.clientX - rect.left}px`;
      ripple.style.top = `${event.clientY - rect.top}px`;
      ripple.style.setProperty('--fx-r', `${Math.max(rect.width, rect.height) * 2.2}px`);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
      target.appendChild(ripple);
    };

    let frame = 0;
    let last = null;
    const onMove = (event) => {
      last = event;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const card = last.target.closest?.(SPOT_TARGETS);
        if (!card) return;
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${last.clientX - rect.left}px`);
        card.style.setProperty('--my', `${last.clientY - rect.top}px`);
      });
    };

    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, [ref]);
}

/** Số việc đang chờ cho badge trên menu; tải lại khi đổi trang hoặc khi trang báo vừa duyệt xong. */
function usePortalCounts(config, pathname) {
  const [counts, setCounts] = useState({});
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const onChanged = () => setVersion((v) => v + 1);
    window.addEventListener(PORTAL_COUNTS_EVENT, onChanged);
    return () => window.removeEventListener(PORTAL_COUNTS_EVENT, onChanged);
  }, []);

  useEffect(() => {
    let cancelled = false;
    config.loadCounts()
      .then((data) => { if (!cancelled && data) setCounts(data); })
      .catch(() => { /* badge chỉ là phụ, lỗi thì bỏ qua */ });
    return () => { cancelled = true; };
  }, [config, pathname, version]);

  return counts;
}

export default function PortalLayout({ type }) {
  const config = PORTALS[type];
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const { theme, toggleTheme } = usePortalTheme();
  const counts = usePortalCounts(config, pathname);
  const now = useNow();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [user] = useState(readUser);
  const shellRef = useRef(null);
  const pending = useSyncExternalStore(subscribePending, getPending);
  usePointerEffects(shellRef);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try { localStorage.setItem(COLLAPSE_KEY, value ? '0' : '1'); } catch { /* bỏ qua */ }
      return !value;
    });
  };
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') closeMobile(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, closeMobile]);

  const current = [...config.links].reverse().find((link) => (link.end ? pathname === link.to : pathname.startsWith(link.to)));
  const RoleIcon = config.roleIcon;
  const displayName = user.fullName || user.displayName || 'Tài khoản';

  const renderLink = ({ to, label, icon: Icon, end, countKey }) => {
    const count = countKey ? Number(counts[countKey]) || 0 : 0;
    return (
      <NavLink key={to} to={to} end={end} onClick={closeMobile} title={collapsed ? label : undefined}
        className={({ isActive }) => `portal-nav-link ${isActive ? 'active' : ''}`}>
        {({ isActive }) => (
          <>
            {isActive && (
              <motion.span layoutId={`portal-nav-pill-${type}`} className="portal-nav-pill"
                transition={{ type: 'spring', stiffness: 520, damping: 40 }} />
            )}
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
            {count > 0 && <em className="portal-nav-count" aria-label={`${count} đang chờ`}>{count > 99 ? '99+' : count}</em>}
          </>
        )}
      </NavLink>
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <div ref={shellRef} className={`portal-shell portal-${type}`} data-theme={theme}>
        <div className={`fx-progress ${pending > 0 ? 'is-active' : ''}`} role="progressbar" aria-hidden={pending === 0} aria-label="Đang xử lý" />
        {mobileOpen && <button type="button" className="portal-mobile-overlay" onClick={closeMobile} aria-label="Đóng menu" />}

        <aside className={`portal-sidebar ${mobileOpen ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`} aria-label="Menu chính">
          <div className="portal-brand">
            <div className="portal-brand-mark"><Compass size={20} aria-hidden="true" /></div>
            <div className="portal-brand-text"><strong>Travel Platform</strong><span>{config.name}</span></div>
            <button type="button" className="portal-icon-button portal-mobile-close" onClick={closeMobile} aria-label="Đóng menu">
              <X size={18} />
            </button>
          </div>

          <div className="portal-sidebar-caption">Công việc</div>
          <nav className="portal-nav">{config.links.map(renderLink)}</nav>

          <div className="portal-sidebar-caption">Khác</div>
          <nav className="portal-nav">
            <NavLink to="/home" end onClick={closeMobile} title={collapsed ? 'Về trang chủ' : undefined} className="portal-nav-link">
              <Home size={18} aria-hidden="true" /><span>Về trang chủ</span>
            </NavLink>
            {(config.shortcuts || []).map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} onClick={closeMobile} title={collapsed ? label : undefined}
                className={({ isActive }) => `portal-nav-link ${isActive ? 'active' : ''}`}>
                <Icon size={18} aria-hidden="true" /><span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="portal-sidebar-bottom">
            <div className="portal-role-chip" title={collapsed ? config.role : undefined}>
              <RoleIcon size={16} aria-hidden="true" /><span>{config.role}</span>
            </div>
            <button type="button" className="portal-collapse" onClick={toggleCollapsed} aria-pressed={collapsed}
              aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'} title={collapsed ? 'Mở rộng menu' : undefined}>
              {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
              <span>{collapsed ? 'Mở rộng' : 'Thu gọn'}</span>
            </button>
            <button type="button" className="portal-logout" onClick={logout} title={collapsed ? 'Đăng xuất' : undefined}>
              <LogOut size={17} aria-hidden="true" /><span>Đăng xuất</span>
            </button>
          </div>
        </aside>

        <main className="portal-main">
          <header className="portal-topbar">
            <div className="portal-topbar-left">
              <button type="button" className="portal-icon-button portal-menu-button" onClick={() => setMobileOpen(true)} aria-label="Mở menu">
                <Menu size={19} />
              </button>
              <nav className="portal-breadcrumb" aria-label="Vị trí">
                <span>{config.name}</span>
                <ChevronRight size={14} aria-hidden="true" />
                <strong>{current?.label || 'Tổng quan'}</strong>
              </nav>
            </div>
            <div className="portal-topbar-right">
              <div className="portal-clock" title="Giờ Việt Nam">
                <span className="portal-clock-dot" aria-hidden="true" />
                <strong className="portal-tnum">{timeFormat.format(now)}</strong>
                <span style={{ textTransform: 'capitalize' }}>{dayFormat.format(now)}</span>
              </div>
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
              <div className="portal-account">
                <div className="portal-avatar" aria-hidden="true">{(displayName || user.email || 'U').slice(0, 1).toUpperCase()}</div>
                <div className="portal-account-info">
                  <strong>{displayName}</strong>
                  <span>{user.email || config.role}</span>
                </div>
              </div>
            </div>
          </header>

          {/* Chuyển trang: trang cũ mờ + nhòe đi trong khi trang mới hiện lên (giữ trang cũ bằng popLayout) */}
          <div className="portal-stage">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={pathname}
                className="portal-content"
                initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none', transform: 'none' } }}
                exit={{ opacity: 0, filter: 'blur(6px)', transition: { duration: 0.22 } }}
                transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
              >
                {outlet}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </MotionConfig>
  );
}
