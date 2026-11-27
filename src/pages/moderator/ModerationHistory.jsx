import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { History } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import useAsyncData from '../../utils/useAsyncData';
import { PAGE_SIZE, actionLabel, detailPath, formatDateTime, typeLabel } from '../../utils/moderation';
import { EmptyState, ErrorBox, Pagination, Spinner } from '../../components/moderation/ModerationParts';

const ACTION_STYLES = {
  HIDE: 'bg-rose-50 text-rose-600',
  RESTORE: 'bg-emerald-50 text-emerald-700',
  DISMISS: 'bg-slate-100 text-slate-600',
};

export default function ModerationHistory() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const page = Math.max(0, Number.parseInt(params.get('page') || '0', 10) || 0);

  const { data, error, loading, reload } = useAsyncData(
    () => axiosClient.get('/api/moderation/actions', { params: { page, size: PAGE_SIZE } }).then((r) => r.data),
    `actions|${page}`
  );
  const setPage = (next) => setParams(next > 0 ? { page: String(next) } : {});
  const from = `${location.pathname}${location.search}`;

  return (
    <div>
      <h1 className="text-3xl font-extrabold text-slate-900">Lịch sử xử lý</h1>
      <p className="mt-1 text-sm text-slate-500">Nhật ký mọi thao tác ẩn, khôi phục và bỏ qua báo cáo. Bấm “Xem nội dung” để mở lại, ví dụ khi cần khôi phục nội dung đã ẩn.</p>

      <div className="mt-6">
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorBox message={error} onRetry={reload} />
        ) : data.items.length === 0 ? (
          <EmptyState icon={History} title="Chưa có thao tác kiểm duyệt nào" />
        ) : (
          <>
            <ul className="space-y-3">
              {data.items.map((a) => (
                <li key={a.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ACTION_STYLES[a.action] || 'bg-slate-100 text-slate-600'}`}>{actionLabel(a.action)}</span>
                    <span className="text-sm font-semibold text-slate-700">{typeLabel(a.targetType)} #{a.targetId}</span>
                    <span className="ml-auto text-xs font-medium text-slate-400">{formatDateTime(a.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-bold text-slate-800">{a.actorName || a.actorUsername || 'Không rõ'}</span> thực hiện
                    {a.targetAuthorName && <> trên nội dung của <span className="font-bold text-slate-800">{a.targetAuthorName}</span></>}
                    {a.reportCount > 0 && <> · đóng {a.reportCount} báo cáo</>}
                  </p>
                  {a.reason && <p className="mt-2 break-words rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">Lý do: {a.reason}</p>}
                  <Link to={detailPath(a.targetType, a.targetId)} state={{ from }} className="mt-3 inline-block text-sm font-bold text-[#FF5645] hover:underline">
                    Xem nội dung
                  </Link>
                </li>
              ))}
            </ul>
            <Pagination page={data.page} size={data.size} total={data.total} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
