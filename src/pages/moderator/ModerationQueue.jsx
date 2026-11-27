import { Link, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Flag } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import useAsyncData from '../../utils/useAsyncData';
import { PAGE_SIZE, TARGET_TYPES, detailPath, formatRelative } from '../../utils/moderation';
import { AuthorCell, EmptyState, ErrorBox, Pagination, ReasonChips, Spinner, StatusBadges, TypeBadge } from '../../components/moderation/ModerationParts';

const VALID_TYPES = new Set(TARGET_TYPES.map((t) => t.key));

const QueueRow = ({ item, from }) => (
  <Link
    to={detailPath(item.targetType, item.targetId)}
    state={{ from }}
    className="block rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-colors hover:border-slate-300"
  >
    <div className="flex flex-wrap items-center gap-2">
      <TypeBadge type={item.targetType} />
      <StatusBadges hidden={item.hidden} unavailable={item.unavailable} />
      <span className="ml-auto flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-[#FF5645]">
        <Flag className="h-3 w-3" /> {item.reportCount} báo cáo
      </span>
    </div>
    <p className={`mt-3 line-clamp-2 break-words text-[15px] ${item.unavailable ? 'italic text-slate-400' : 'text-slate-800'}`}>
      {item.unavailable ? 'Nội dung này đã bị xóa.' : (item.excerpt || '(Không có nội dung văn bản)')}
    </p>
    <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 space-y-2">
        <AuthorCell author={item.author} />
        <ReasonChips reasons={item.reasons} />
      </div>
      <span className="shrink-0 text-xs font-medium text-slate-400">Báo cáo gần nhất {formatRelative(item.lastReportedAt)}</span>
    </div>
  </Link>
);

export default function ModerationQueue() {
  const { stats } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const rawType = params.get('type') || '';
  const type = VALID_TYPES.has(rawType) ? rawType : '';
  const page = Math.max(0, Number.parseInt(params.get('page') || '0', 10) || 0);

  const { data, error, loading, reload } = useAsyncData(
    () => axiosClient.get('/api/moderation/queue', { params: { ...(type ? { type } : {}), page, size: PAGE_SIZE } }).then((r) => r.data),
    `queue|${type}|${page}`
  );

  const setType = (next) => setParams(next ? { type: next } : {});
  const setPage = (next) => setParams({ ...(type ? { type } : {}), ...(next > 0 ? { page: String(next) } : {}) });
  const from = `${location.pathname}${location.search}`;

  const tabs = [{ key: '', label: 'Tất cả', count: stats?.pendingContents }, ...TARGET_TYPES.map((t) => ({ ...t, count: stats?.pendingByType?.[t.key] }))];

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-slate-900">Hàng đợi báo cáo</h1>
      <p className="mt-1 text-sm text-slate-500">Mỗi dòng là một nội dung bị báo cáo, các báo cáo của cùng nội dung được gộp lại.</p>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Lọc theo loại nội dung">
        {tabs.map((t) => (
          <button
            key={t.key || 'all'}
            type="button"
            role="tab"
            aria-selected={type === t.key}
            onClick={() => setType(t.key)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              type === t.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
            {t.count != null && (
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${type === t.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorBox message={error} onRetry={reload} />
        ) : data.items.length === 0 ? (
          page > 0 ? (
            <EmptyState title="Trang này không còn nội dung" hint="Danh sách đã thay đổi, hãy quay lại trang đầu." />
          ) : (
            <EmptyState icon={CheckCircle2} title="Không có nội dung nào đang chờ xử lý" hint="Khi người dùng báo cáo, nội dung sẽ xuất hiện ở đây." />
          )
        ) : (
          <>
            <div className="space-y-3">
              {data.items.map((item) => <QueueRow key={`${item.targetType}:${item.targetId}`} item={item} from={from} />)}
            </div>
            <Pagination page={data.page} size={data.size} total={data.total} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
