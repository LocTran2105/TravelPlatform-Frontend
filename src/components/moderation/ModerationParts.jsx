import { AlertTriangle, ChevronLeft, ChevronRight, EyeOff, Loader2, Play, Trash2 } from 'lucide-react';
import { typeLabel, reasonLabel, roleLabel } from '../../utils/moderation';

// Các phần giao diện nhỏ dùng chung trong khu kiểm duyệt.

const TYPE_STYLES = {
  POST: 'bg-indigo-50 text-indigo-700',
  POST_COMMENT: 'bg-sky-50 text-sky-700',
  PLACE_REVIEW: 'bg-amber-50 text-amber-700',
};

export const TypeBadge = ({ type }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${TYPE_STYLES[type] || 'bg-slate-100 text-slate-600'}`}>
    {typeLabel(type)}
  </span>
);

// Nhãn trạng thái của nội dung: đã ẩn / đã bị xóa
export const StatusBadges = ({ hidden, unavailable }) => (
  <>
    {unavailable && (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-600">
        <Trash2 className="h-3 w-3" /> Đã bị xóa
      </span>
    )}
    {hidden && !unavailable && (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-600">
        <EyeOff className="h-3 w-3" /> Đã ẩn
      </span>
    )}
  </>
);

// reasons: { SPAM: 2, OTHER: 1 }
export const ReasonChips = ({ reasons }) => {
  const entries = Object.entries(reasons || {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([code, count]) => (
        <span key={code} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {reasonLabel(code)} · {count}
        </span>
      ))}
    </div>
  );
};

export const Avatar = ({ author, size = 'h-9 w-9' }) => {
  const initial = (author?.fullName || author?.username || 'U').trim().charAt(0).toUpperCase() || 'U';
  return (
    <div className={`${size} shrink-0 overflow-hidden rounded-full bg-slate-200 text-sm font-bold text-slate-600 flex items-center justify-center`}>
      {author?.avatar ? <img src={author.avatar} alt="" className="h-full w-full object-cover" /> : initial}
    </div>
  );
};

export const AuthorCell = ({ author }) => {
  if (!author) return <span className="text-sm text-slate-400">Không rõ tác giả</span>;
  const staff = author.role === 'ROLE_ADMIN' || author.role === 'ROLE_MODERATOR';
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar author={author} />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-900">
          {author.fullName || author.username}
          {staff && <span className="ml-2 rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">{roleLabel(author.role)}</span>}
        </p>
        {author.username && <p className="truncate text-xs text-slate-500">@{author.username}</p>}
      </div>
    </div>
  );
};

// Ảnh / video của nội dung. Bấm ảnh để mở ảnh gốc trong tab mới.
export const MediaGrid = ({ media }) => {
  if (!media || media.length === 0) return null;
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {media.map((m, i) => (
        m.type === 'VIDEO' ? (
          <div key={`${i}-${m.url}`} className="relative aspect-square overflow-hidden rounded-xl bg-black">
            <video src={m.url} controls preload="metadata" className="h-full w-full object-cover" />
            <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/60 p-1 text-white"><Play className="h-3 w-3 fill-white" /></span>
          </div>
        ) : (
          <a key={`${i}-${m.url}`} href={m.url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-xl bg-slate-100">
            <img src={m.url} alt="Ảnh đính kèm" loading="lazy" className="h-full w-full object-cover transition-transform hover:scale-105" />
          </a>
        )
      ))}
    </div>
  );
};

export const Spinner = ({ label = 'Đang tải...' }) => (
  <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-slate-500" role="status">
    <Loader2 className="h-5 w-5 animate-spin" /> {label}
  </div>
);

export const ErrorBox = ({ message, onRetry }) => (
  <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
    <div className="flex-1">
      <p className="font-semibold">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100">
          Thử lại
        </button>
      )}
    </div>
  </div>
);

export const EmptyState = ({ icon: Icon, title, hint }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
    {Icon && <Icon className="mb-3 h-10 w-10 text-slate-300" />}
    <p className="font-bold text-slate-700">{title}</p>
    {hint && <p className="mt-1 text-sm text-slate-400">{hint}</p>}
  </div>
);

// page tính từ 0 (khớp backend)
export const Pagination = ({ page, size, total, onChange }) => {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  return (
    <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Phân trang">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 0}
        className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" /> Trước
      </button>
      <span className="font-semibold text-slate-500">Trang {page + 1} / {pages}</span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pages - 1}
        className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
      >
        Sau <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
};
