import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { History, Home, LayoutDashboard, ListChecks, LogOut, ShieldCheck, ShieldAlert } from 'lucide-react';
import axiosClient from '../api/axiosClient';
import useAsyncData from '../utils/useAsyncData';
import { readStoredUser, roleLabel } from '../utils/moderation';
import SiteThemeToggle from '../components/site/SiteThemeToggle';

const STATS_REFRESH_MS = 60 * 1000;

const navClass = (active) =>
  `relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
    active ? 'bg-red-50 text-[#FF5645]' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
  }`;

// Khung của khu kiểm duyệt: thanh bên + nội dung. Các trang con lấy thống kê qua useOutletContext().
export default function ModeratorLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [user] = useState(readStoredUser);
  const { data: stats, reload } = useAsyncData(() => axiosClient.get('/api/moderation/stats').then((r) => r.data), 'stats');

  // Làm mới thống kê định kỳ để số "chờ xử lý" không bị cũ khi để trang mở lâu
  useEffect(() => {
    const timer = setInterval(reload, STATS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const inQueue = pathname.startsWith('/moderation/queue') || pathname.startsWith('/moderation/content');
  const pending = stats?.pendingContents ?? 0;
  const isAdmin = user?.role === 'ROLE_ADMIN';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF5645] text-white"><ShieldCheck className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-extrabold leading-tight text-slate-900">Kiểm duyệt</p>
              <p className="text-[11px] font-medium text-slate-500">Quản lý nội dung cộng đồng</p>
            </div>
            <SiteThemeToggle className="tp-icon-button ml-auto !h-8 !w-8" />
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Điều hướng kiểm duyệt">
          <NavLink to="/moderation" end className={({ isActive }) => navClass(isActive)}>
            <LayoutDashboard className="h-[18px] w-[18px] shrink-0" /> Tổng quan
          </NavLink>
          <NavLink to="/moderation/queue" className={() => navClass(inQueue)}>
            <ListChecks className="h-[18px] w-[18px] shrink-0" />
            <span className="flex-1">Hàng đợi</span>
            {pending > 0 && (
              <span aria-label={`${pending} nội dung chờ xử lý`} className="rounded-full bg-[#FF5645] px-2 py-0.5 text-[11px] font-bold text-white">{pending > 99 ? '99+' : pending}</span>
            )}
          </NavLink>
          <NavLink to="/moderation/history" className={({ isActive }) => navClass(isActive)}>
            <History className="h-[18px] w-[18px] shrink-0" /> Lịch sử xử lý
          </NavLink>
        </nav>

        <div className="space-y-1 border-t border-slate-100 p-3">
          <Link to="/home" className={navClass(false)}><Home className="h-[18px] w-[18px] shrink-0" /> Về trang chủ</Link>
          {isAdmin && <Link to="/admin" className={navClass(false)}><ShieldAlert className="h-[18px] w-[18px] shrink-0" /> Khu quản trị</Link>}
          <button type="button" onClick={logout} className={navClass(false)}><LogOut className="h-[18px] w-[18px] shrink-0" /> Đăng xuất</button>
          {user && (
            <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2.5">
              <p className="truncate text-sm font-bold text-slate-800">{user.fullName || user.email}</p>
              <p className="text-[11px] font-medium text-slate-500">{roleLabel(user.role)}</p>
            </div>
          )}
        </div>
      </aside>

      <main className="h-full flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8 sm:px-10">
          <Outlet context={{ stats, refreshStats: reload }} />
        </div>
      </main>
    </div>
  );
}
