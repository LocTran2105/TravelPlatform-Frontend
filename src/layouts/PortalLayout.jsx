import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MapPinned,
  FileClock,
  ClipboardCheck,
  Building2,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Compass,
} from 'lucide-react';
import { useState } from 'react';

const PORTALS = {
  partner: {
    title: 'Partner Portal',
    subtitle: 'Quản lý dữ liệu địa điểm du lịch',
    accent: 'partner',
    links: [
      { to: '/partner', label: 'Tổng quan', icon: LayoutDashboard, end: true },
      { to: '/partner/businesses', label: 'Địa điểm của tôi', icon: MapPinned },
      { to: '/partner/submissions', label: 'Lịch sử xét duyệt', icon: FileClock },
    ],
  },
  admin: {
    title: 'Admin Portal',
    subtitle: 'Quản trị và xác minh dữ liệu du lịch',
    accent: 'admin',
    links: [
      { to: '/admin', label: 'Tổng quan', icon: LayoutDashboard, end: true },
      { to: '/admin/applications', label: 'Đơn đăng ký Partner', icon: ClipboardCheck },
      { to: '/admin/submissions', label: 'Duyệt địa điểm', icon: Building2 },
    ],
  },
};

export default function PortalLayout({ type }) {
  const config = PORTALS[type];
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  });

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className={`portal-shell portal-${config.accent}`}>
      {mobileOpen && <button className="portal-mobile-overlay" onClick={closeMobile} aria-label="Đóng menu" />}

      <aside className={`portal-sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="portal-brand">
          <div className="portal-brand-mark"><Compass size={22} /></div>
          <div>
            <strong>Travel Platform</strong>
            <span>{config.title}</span>
          </div>
          <button className="portal-icon-button portal-mobile-close" onClick={closeMobile} aria-label="Đóng menu">
            <X size={19} />
          </button>
        </div>

        <div className="portal-sidebar-caption">WORKSPACE</div>
        <nav className="portal-nav">
          {config.links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={closeMobile}
              className={({ isActive }) => `portal-nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="portal-sidebar-bottom">
          <div className="portal-role-chip">
            {type === 'admin' ? <ShieldCheck size={16} /> : <Building2 size={16} />}
            <span>{type === 'admin' ? 'Quản trị viên' : 'Đối tác du lịch'}</span>
          </div>
          <button className="portal-logout" onClick={logout}>
            <LogOut size={17} /> Đăng xuất
          </button>
        </div>
      </aside>

      <main className="portal-main">
        <header className="portal-topbar">
          <div className="portal-topbar-left">
            <button className="portal-icon-button portal-menu-button" onClick={() => setMobileOpen(true)} aria-label="Mở menu">
              <Menu size={20} />
            </button>
            <div>
              <div className="portal-topbar-title">{config.title}</div>
              <div className="portal-topbar-subtitle">{config.subtitle}</div>
            </div>
          </div>
          <div className="portal-account">
            <div className="portal-avatar">{(user.fullName || user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}</div>
            <div className="portal-account-info">
              <strong>{user.fullName || user.displayName || 'Tài khoản'}</strong>
              <span>{user.email || (type === 'admin' ? 'Administrator' : 'Partner')}</span>
            </div>
          </div>
        </header>

        <div className="portal-content"><Outlet /></div>
      </main>
    </div>
  );
}
