import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Settings, LogOut, Store, ShieldCheck, ShieldAlert, Megaphone } from 'lucide-react';
import { normalizeRole } from '../utils/auth.jsx';
import NotificationBell from './NotificationBell';

const UserMenu = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Đóng menu khi click ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!open) return;
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

  const handleLogout = () => {
    setOpen(false);
    if (onLogout) {
      onLogout();
      return;
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const initial = user?.fullName?.trim().charAt(0).toUpperCase() || 'U';
  const itemClass =
    'flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50';

  return (
    <div className="flex items-center gap-1.5">
    <NotificationBell />
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user?.fullName || 'Tài khoản'}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 ring-2 ring-transparent transition-all hover:ring-emerald-200 focus:outline-none focus-visible:ring-emerald-300"
      >
        {user?.avatar ? (
          <img src={user.avatar} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-2xl border border-slate-100 bg-white py-2 shadow-xl"
        >
          <Link to="/profile" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
            <User className="h-4 w-4 text-slate-500" />
            Hồ sơ của bạn
          </Link>
          <Link to="/settings" role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
            <Settings className="h-4 w-4 text-slate-500" />
            Chỉnh sửa thông tin
          </Link>
          {/* Lối vào khu vực đối tác / quản trị / kiểm duyệt theo vai trò */}
          {(() => {
            const role = normalizeRole(user?.role);
            const moderationEntry = { to: '/moderation', label: 'Khu kiểm duyệt', Icon: ShieldAlert };
            const entries = role === 'ROLE_PARTNER'
              ? [{ to: '/partner', label: 'Partner Portal', Icon: Store }]
              : role === 'ROLE_ADMIN'
                ? [{ to: '/admin', label: 'Trang quản trị', Icon: ShieldCheck }, moderationEntry]
                : role === 'ROLE_MODERATOR'
                  ? [moderationEntry]
                  : [
                    { to: '/tro-thanh-doi-tac', label: 'Đăng ký làm đối tác', Icon: Store },
                    { to: '/tuyen-kiem-duyet-vien', label: 'Tuyển kiểm duyệt viên', Icon: Megaphone },
                  ];
            return entries.map((entry) => (
              <Link key={entry.to} to={entry.to} role="menuitem" onClick={() => setOpen(false)} className={itemClass}>
                <entry.Icon className="h-4 w-4 text-slate-500" />
                {entry.label}
              </Link>
            ));
          })()}
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      )}
    </div>
    </div>
  );
};

export default UserMenu;