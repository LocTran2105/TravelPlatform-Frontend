import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, Megaphone, X } from 'lucide-react';
import { recruitmentApi } from '../api/recruitmentApi';
import { getStoredUser, normalizeRole } from '../utils/auth.jsx';

const DISMISS_PREFIX = 'recruitmentBannerDismissed:';

const isDismissed = (id) => {
  try { return localStorage.getItem(DISMISS_PREFIX + id) === '1'; } catch { return false; }
};

const formatDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN');
};

/**
 * Banner "Đang tuyển kiểm duyệt viên": bài ƯU TIÊN mới nhất đang nhận đơn (quản trị viên bật).
 * Hiện cho khách và người dùng thường (những người có thể ứng tuyển); ẩn với đối tác / kiểm duyệt viên /
 * quản trị viên. Bấm ✕ thì không hiện lại bài đó trên máy này.
 */
export default function RecruitmentBanner({ className = '' }) {
  const user = getStoredUser();
  const role = user ? normalizeRole(user.role) : null;
  const eligible = !user || role === 'ROLE_TRAVELLER';
  const [item, setItem] = useState(null);

  useEffect(() => {
    if (!eligible) return undefined;
    let cancelled = false;
    recruitmentApi.featured()
      .then((r) => { if (!cancelled && r && !isDismissed(r.id)) setItem(r); })
      .catch(() => { /* banner chỉ là phụ, lỗi thì bỏ qua */ });
    return () => { cancelled = true; };
  }, [eligible]);

  if (!eligible || !item) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_PREFIX + item.id, '1'); } catch { /* bỏ qua */ }
    setItem(null);
  };

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-orange-200 bg-gradient-to-r from-orange-50 via-white to-amber-50 p-5 shadow-sm ${className}`}>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Ẩn thông báo tuyển dụng này"
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white hover:text-slate-600"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex flex-col gap-4 pr-8 sm:flex-row sm:items-center">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF5645] to-[#FFA53B] text-white shadow">
          <Megaphone className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-[#E04B3B]">Đang tuyển kiểm duyệt viên</p>
          <p className="truncate text-lg font-bold text-slate-900" title={item.title}>{item.title}</p>
          {item.summary && <p className="line-clamp-2 text-sm text-slate-600">{item.summary}</p>}
          {item.deadline && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
              <CalendarClock className="h-3.5 w-3.5" /> Hạn nộp {formatDate(item.deadline)}
            </p>
          )}
        </div>
        <Link to={`/tuyen-kiem-duyet-vien/${item.id}`} className="tp-btn-primary shrink-0 px-5 py-2 text-sm">
          Xem và ứng tuyển <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
