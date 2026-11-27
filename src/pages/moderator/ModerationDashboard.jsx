import { Link, useOutletContext } from 'react-router-dom';
import { Activity, ArrowRight, Flag, ListChecks } from 'lucide-react';
import { TARGET_TYPES, readStoredUser } from '../../utils/moderation';
import { Spinner } from '../../components/moderation/ModerationParts';

const StatCard = ({ icon: Icon, label, value, tone }) => (
  <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span>
    <p className="mt-4 text-3xl font-extrabold text-slate-900">{value}</p>
    <p className="mt-1 text-sm font-semibold text-slate-500">{label}</p>
  </div>
);

export default function ModerationDashboard() {
  const { stats } = useOutletContext();
  const user = readStoredUser();

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-slate-900">Tổng quan kiểm duyệt</h1>
      <p className="mt-1 text-sm text-slate-500">Xin chào{user?.fullName ? `, ${user.fullName}` : ''}. Đây là tình hình các báo cáo cần xử lý.</p>

      {!stats ? (
        <Spinner />
      ) : (
        <>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={ListChecks} label="Nội dung chờ xử lý" value={stats.pendingContents} tone="bg-red-50 text-[#FF5645]" />
            <StatCard icon={Flag} label="Báo cáo chờ xử lý" value={stats.pendingReports} tone="bg-amber-50 text-amber-600" />
            <StatCard icon={Activity} label="Đã xử lý hôm nay" value={stats.actionsToday} tone="bg-emerald-50 text-emerald-600" />
          </div>

          <div className="mt-10 flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-slate-900">Theo loại nội dung</h2>
            <Link to="/moderation/queue" className="flex items-center gap-1.5 rounded-full bg-[#FF5645] px-4 py-2 text-sm font-bold text-white hover:bg-[#E04B3B]">
              Mở hàng đợi <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {TARGET_TYPES.map((t) => {
              const count = stats.pendingByType?.[t.key] ?? 0;
              return (
                <Link key={t.key} to={`/moderation/queue?type=${t.key}`} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-colors hover:border-slate-300">
                  <p className="text-sm font-bold text-slate-700">{t.label}</p>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900">{count}</p>
                  <p className="text-xs font-medium text-slate-400">đang chờ xử lý</p>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
