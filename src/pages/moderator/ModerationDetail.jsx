import { useState } from 'react';
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Info, MapPin, ShieldOff, Star } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import useAsyncData from '../../utils/useAsyncData';
import { actionLabel, formatDateTime, formatRelative, reasonLabel, typeLabel, REPORT_STATUS_LABELS } from '../../utils/moderation';
import { AuthorCell, ErrorBox, MediaGrid, Spinner, StatusBadges, TypeBadge } from '../../components/moderation/ModerationParts';
import ActionDialog from '../../components/moderation/ActionDialog';

const SUCCESS_MESSAGES = {
  HIDE: 'Đã ẩn nội dung và đóng các báo cáo đang chờ.',
  RESTORE: 'Đã khôi phục nội dung.',
  DISMISS: 'Đã bỏ qua các báo cáo, nội dung được giữ nguyên.',
};

const REPORT_STATUS_STYLES = {
  PENDING: 'bg-amber-50 text-amber-700',
  RESOLVED: 'bg-rose-50 text-rose-600',
  REJECTED: 'bg-slate-100 text-slate-600',
};

const reportStatusText = (r) => {
  if (r.status === 'RESOLVED' && r.resolution === 'HIDDEN') return 'Đã ẩn nội dung';
  return REPORT_STATUS_LABELS[r.status] || r.status;
};

const Card = ({ title, children }) => (
  <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
    {title && <h2 className="mb-4 text-lg font-extrabold text-slate-900">{title}</h2>}
    {children}
  </section>
);

// key theo (type, id) để đổi sang nội dung khác thì xóa sạch thông báo và hộp thoại
export default function ModerationDetail() {
  const { type, id } = useParams();
  return <DetailBody key={`${type}:${id}`} type={type} id={id} />;
}

function DetailBody({ type, id }) {
  const location = useLocation();
  const { refreshStats } = useOutletContext();
  const base = `/api/moderation/targets/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;
  const { data, error, loading, reload, setData } = useAsyncData(() => axiosClient.get(base).then((r) => r.data), `detail|${type}|${id}`);
  const [dialog, setDialog] = useState(null); // 'HIDE' | 'RESTORE' | 'DISMISS' | null
  const [notice, setNotice] = useState('');

  const backTo = location.state?.from || '/moderation/queue';

  const confirmAction = async (reason) => {
    try {
      const res = await axiosClient.post(`${base}/${dialog.toLowerCase()}`, { reason });
      setData(res.data);
      setNotice(SUCCESS_MESSAGES[dialog]);
      setDialog(null);
      refreshStats();
    } catch (e) {
      // Trạng thái đã đổi (ví dụ người khác vừa xử lý): làm mới dữ liệu ngầm rồi báo lỗi trong hộp thoại
      const status = e?.response?.status;
      if (status === 409 || status === 404) {
        axiosClient.get(base).then((r) => setData(r.data)).catch(() => {});
        refreshStats();
      }
      throw e;
    }
  };

  const header = (
    <Link to={backTo} className="mb-5 inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900">
      <ArrowLeft className="h-4 w-4" /> Quay lại
    </Link>
  );

  if (loading) return <div>{header}<Spinner /></div>;
  if (error && !data) return <div>{header}<ErrorBox message={error} onRetry={reload} /></div>;
  if (!data) return <div>{header}<ErrorBox message="Không tìm thấy nội dung." /></div>;

  const reports = data.reports || [];
  const history = data.history || [];
  const pending = reports.filter((r) => r.status === 'PENDING').length;
  const canHide = !data.unavailable && !data.hidden && data.canModerate;
  const canRestore = !data.unavailable && data.hidden && data.canModerate;
  const canDismiss = pending > 0 && (data.unavailable || data.canModerate);

  return (
    <div>
      {header}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-3xl font-extrabold text-slate-900">{typeLabel(data.targetType)} #{data.targetId}</h1>
        <TypeBadge type={data.targetType} />
        <StatusBadges hidden={data.hidden} unavailable={data.unavailable} />
      </div>

      {notice && (
        <div role="status" className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {notice}
        </div>
      )}
      {error && <div className="mb-5"><ErrorBox message={error} onRetry={reload} /></div>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <AuthorCell author={data.author} />
              {data.createdAt && <span className="text-xs font-medium text-slate-400">Đăng lúc {formatDateTime(data.createdAt)}</span>}
            </div>

            {data.locationName && (
              <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-slate-600"><MapPin className="h-4 w-4 text-slate-400" /> {data.locationName}</p>
            )}
            {data.postId != null && <p className="mt-4 text-sm font-semibold text-slate-600">Bình luận thuộc bài viết #{data.postId}</p>}
            {data.rating != null && (
              <div className="mt-3 flex gap-0.5" aria-label={`${data.rating} trên 5 sao`}>
                {[1, 2, 3, 4, 5].map((s) => <Star key={s} className={`h-4 w-4 ${s <= data.rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-200'}`} />)}
              </div>
            )}

            {data.unavailable ? (
              <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm italic text-slate-500">Nội dung này đã bị xóa nên không còn để xem. Bạn vẫn có thể bỏ qua các báo cáo còn chờ.</p>
            ) : (
              <>
                {data.text
                  ? <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800">{data.text}</p>
                  : <p className="mt-4 text-sm italic text-slate-400">(Không có nội dung văn bản)</p>}
                <MediaGrid media={data.media} />
              </>
            )}

            {data.hidden && !data.unavailable && (
              <div className="mt-5 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <p className="font-bold">Nội dung đang bị ẩn</p>
                {data.moderationNote && <p className="mt-1 break-words">Lý do: {data.moderationNote}</p>}
                {data.moderatedAt && <p className="mt-1 text-xs text-rose-500">Lúc {formatDateTime(data.moderatedAt)}</p>}
              </div>
            )}
          </Card>

          <Card title={`Báo cáo (${pending} đang chờ / ${reports.length} tổng)`}>
            {reports.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có báo cáo nào.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {reports.map((r) => (
                  <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{r.reporterName || r.reporterUsername || 'Người dùng'}</span>
                      {r.reporterUsername && <span className="text-xs text-slate-400">@{r.reporterUsername}</span>}
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{reasonLabel(r.reasonCode)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${REPORT_STATUS_STYLES[r.status] || 'bg-slate-100 text-slate-600'}`}>{reportStatusText(r)}</span>
                      <span className="ml-auto text-xs text-slate-400">{formatRelative(r.createdAt)}</span>
                    </div>
                    {r.details && <p className="mt-1.5 break-words text-sm text-slate-600">{r.details}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Xử lý">
            {!data.unavailable && !data.canModerate && data.cannotModerateReason && (
              <div role="note" className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800">
                <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" /> {data.cannotModerateReason}
              </div>
            )}
            <div className="flex flex-col gap-2.5">
              {canHide && (
                <button type="button" onClick={() => setDialog('HIDE')} className="flex items-center justify-center gap-2 rounded-full bg-rose-600 px-5 py-3 text-sm font-bold text-white hover:bg-rose-700">
                  <EyeOff className="h-4 w-4" /> Ẩn nội dung
                </button>
              )}
              {canRestore && (
                <button type="button" onClick={() => setDialog('RESTORE')} className="flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700">
                  <Eye className="h-4 w-4" /> Khôi phục nội dung
                </button>
              )}
              {canDismiss && (
                <button type="button" onClick={() => setDialog('DISMISS')} className="flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  <CheckCircle2 className="h-4 w-4" /> Bỏ qua báo cáo
                </button>
              )}
              {!canHide && !canRestore && !canDismiss && (
                <p className="flex items-start gap-2 text-sm text-slate-400"><Info className="mt-0.5 h-4 w-4 shrink-0" /> Hiện không có thao tác nào khả dụng cho nội dung này.</p>
              )}
            </div>
          </Card>

          <Card title="Lịch sử xử lý">
            {history.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có thao tác nào.</p>
            ) : (
              <ul className="space-y-3">
                {history.map((a) => (
                  <li key={a.id} className="text-sm">
                    <p className="font-bold text-slate-800">{actionLabel(a.action)}</p>
                    <p className="text-xs text-slate-500">{a.actorName || a.actorUsername || 'Không rõ'} · {formatDateTime(a.createdAt)}{a.reportCount > 0 ? ` · đóng ${a.reportCount} báo cáo` : ''}</p>
                    {a.reason && <p className="mt-1 break-words text-slate-600">{a.reason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ActionDialog action={dialog} onConfirm={confirmAction} onClose={() => setDialog(null)} />
    </div>
  );
}
