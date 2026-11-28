import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarClock, CheckCircle2, Clock, Hourglass, Megaphone, ShieldCheck, Users, XCircle,
} from 'lucide-react';
import SiteHeader from '../components/site/SiteHeader';
import { recruitmentApi } from '../api/recruitmentApi';
import { getApiError } from '../api/axiosClient';
import { getStoredUser } from '../utils/auth.jsx';
import { withRedirect } from '../utils/redirect';
import { toast } from '../utils/toast';

// Giới hạn khớp ModeratorApplicationService ở backend
const MIN_MOTIVATION = 50;
const MAX_TEXT = 2000;

const formatDateTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
};

const slotText = (r) => (r.slots ? `Đã nhận ${r.approvedCount}/${r.slots}` : `Đã nhận ${r.approvedCount}`);

function StateBadge({ recruitment }) {
  if (recruitment.accepting) {
    return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">Đang nhận đơn</span>;
  }
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">Đã đóng nhận đơn</span>;
}

function Cover({ recruitment, className }) {
  return recruitment.coverImageUrl
    ? <img src={recruitment.coverImageUrl} alt="" className={`object-cover ${className}`} />
    : (
      <div className={`flex items-center justify-center bg-gradient-to-br from-[#FF5645] to-[#FFA53B] ${className}`}>
        <ShieldCheck className="h-10 w-10 text-white/90" />
      </div>
    );
}

// ---------------------------------------------------------------------------
// Danh sách: /tuyen-kiem-duyet-vien
// ---------------------------------------------------------------------------

export function RecruitmentListPage() {
  const user = getStoredUser();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    recruitmentApi.list()
      .then(setItems)
      .catch((e) => setError(getApiError(e, 'Không tải được bài tuyển.')));
  }, []);

  return (
    <div className="tp-site min-h-screen w-full !bg-slate-50 text-slate-900 antialiased">
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <p className="flex items-center gap-2 text-sm font-bold text-[#FF5645]"><Megaphone className="h-4 w-4" /> Tuyển kiểm duyệt viên</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Cùng giữ cộng đồng an toàn</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kiểm duyệt viên xem xét các báo cáo vi phạm và ẩn nội dung không phù hợp với bài viết, bình luận, đánh giá địa điểm.
          </p>
        </div>

        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {!items && !error && (
          <div className="space-y-4" role="status" aria-label="Đang tải">
            {[0, 1].map((i) => <div key={i} className="tp-skeleton h-32 w-full rounded-3xl" />)}
          </div>
        )}
        {items && items.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-14 text-center">
            <Megaphone className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <h2 className="text-lg font-bold text-slate-800">Hiện chưa có đợt tuyển nào</h2>
            <p className="mt-1 text-sm text-slate-500">Bạn sẽ nhận được thông báo khi có đợt tuyển mới.</p>
          </div>
        )}
        <div className="space-y-4">
          {items?.map((r) => (
            <Link
              key={r.id}
              to={`/tuyen-kiem-duyet-vien/${r.id}`}
              className="flex gap-4 overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <Cover recruitment={r} className="h-24 w-32 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StateBadge recruitment={r} />
                  {r.featured && r.accepting && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">Nổi bật</span>}
                </div>
                <h2 className="mt-1.5 truncate text-lg font-bold text-slate-900">{r.title}</h2>
                {r.summary && <p className="line-clamp-2 text-sm text-slate-600">{r.summary}</p>}
                <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {slotText(r)}</span>
                  {r.deadline && <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Hạn nộp {formatDateTime(r.deadline)}</span>}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chi tiết + ứng tuyển: /tuyen-kiem-duyet-vien/:id
// ---------------------------------------------------------------------------

const APP_VIEW = {
  PENDING: { Icon: Hourglass, tone: 'border-amber-200 bg-amber-50 text-amber-800', title: 'Đơn của bạn đang chờ xét', text: 'Quản trị viên sẽ xem xét và bạn sẽ nhận được thông báo khi có kết quả.' },
  APPROVED: { Icon: CheckCircle2, tone: 'border-emerald-200 bg-emerald-50 text-emerald-800', title: 'Chúc mừng! Bạn đã trở thành kiểm duyệt viên', text: 'Bạn có thể vào Khu kiểm duyệt để bắt đầu xử lý báo cáo.' },
  REJECTED: { Icon: XCircle, tone: 'border-red-200 bg-red-50 text-red-800', title: 'Đơn của bạn chưa được chấp nhận', text: 'Cảm ơn bạn đã quan tâm. Bạn có thể ứng tuyển ở đợt tuyển sau.' },
  WITHDRAWN: { Icon: Clock, tone: 'border-slate-200 bg-slate-50 text-slate-700', title: 'Bạn đã rút đơn', text: 'Bạn có thể nộp lại khi bài tuyển còn nhận đơn.' },
};

function ApplicationStatus({ app, onWithdraw, withdrawing }) {
  const view = APP_VIEW[app.status] || APP_VIEW.PENDING;
  const Icon = view.Icon;
  return (
    <div className={`rounded-2xl border px-4 py-3 ${view.tone}`}>
      <p className="flex items-center gap-2 font-bold"><Icon className="h-5 w-5" /> {view.title}</p>
      <p className="mt-1 text-sm">{view.text}</p>
      {app.adminNote && (
        <p className="mt-2 text-sm"><span className="font-semibold">{app.status === 'REJECTED' ? 'Lý do: ' : 'Ghi chú từ quản trị viên: '}</span>{app.adminNote}</p>
      )}
      <p className="mt-2 text-xs opacity-80">Nộp lúc {formatDateTime(app.submittedAt)}{app.reviewedAt ? ` · Xét lúc ${formatDateTime(app.reviewedAt)}` : ''}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {app.status === 'APPROVED' && (
          <Link to="/moderation" className="tp-btn-primary px-4 py-2 text-sm">Vào Khu kiểm duyệt</Link>
        )}
        {app.status === 'PENDING' && (
          <button type="button" onClick={onWithdraw} disabled={withdrawing} className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60">
            {withdrawing ? 'Đang rút đơn...' : 'Rút đơn'}
          </button>
        )}
      </div>
    </div>
  );
}

function ApplyForm({ recruitmentId, previous, onApplied }) {
  const [motivation, setMotivation] = useState(previous?.motivation || '');
  const [experience, setExperience] = useState(previous?.experience || '');
  const [weeklyHours, setWeeklyHours] = useState(previous?.weeklyHours ?? '');
  const [contactPhone, setContactPhone] = useState(previous?.contactPhone || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const tooShort = motivation.trim().length < MIN_MOTIVATION;

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (tooShort) { setError(`Hãy chia sẻ lý do ứng tuyển (ít nhất ${MIN_MOTIVATION} ký tự).`); return; }
    setSubmitting(true); setError('');
    try {
      const detail = await recruitmentApi.apply(recruitmentId, {
        motivation: motivation.trim(),
        experience: experience.trim() || null,
        weeklyHours: weeklyHours === '' ? null : Number(weeklyHours),
        contactPhone: contactPhone.trim() || null,
      });
      toast.success('Đã nộp đơn ứng tuyển. Bạn sẽ nhận được thông báo khi có kết quả.');
      onApplied(detail);
    } catch (err) {
      setError(getApiError(err, 'Không nộp được đơn. Vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = 'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#FF5645] focus:ring-2 focus:ring-red-100';

  return (
    <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Ứng tuyển</h2>
      <p className="mt-1 text-sm text-slate-500">Thông tin chỉ được gửi cho quản trị viên.</p>

      <label htmlFor="rc-motivation" className="mt-4 block text-sm font-semibold text-slate-700">
        Vì sao bạn muốn làm kiểm duyệt viên? <span className="text-red-500">*</span>
      </label>
      <textarea
        id="rc-motivation"
        value={motivation}
        onChange={(e) => setMotivation(e.target.value)}
        maxLength={MAX_TEXT}
        rows={5}
        className={`${fieldClass} resize-y`}
        placeholder="Chia sẻ động lực, cách bạn nhìn nhận một cộng đồng du lịch lành mạnh..."
      />
      <p className={`mt-0.5 text-right text-xs ${tooShort ? 'text-slate-400' : 'text-emerald-600'}`}>
        {motivation.trim().length}/{MAX_TEXT}{tooShort ? ` (tối thiểu ${MIN_MOTIVATION})` : ''}
      </p>

      <label htmlFor="rc-experience" className="mt-3 block text-sm font-semibold text-slate-700">
        Kinh nghiệm kiểm duyệt / quản lý cộng đồng <span className="font-normal text-slate-400">(không bắt buộc)</span>
      </label>
      <textarea
        id="rc-experience"
        value={experience}
        onChange={(e) => setExperience(e.target.value)}
        maxLength={MAX_TEXT}
        rows={3}
        className={`${fieldClass} resize-y`}
        placeholder="VD: quản trị nhóm Facebook du lịch 2 năm..."
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700">
          Số giờ có thể dành mỗi tuần
          <input type="number" min={1} max={168} value={weeklyHours} onChange={(e) => setWeeklyHours(e.target.value)} className={fieldClass} />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Số điện thoại liên hệ
          <input type="tel" maxLength={20} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={fieldClass} placeholder="Không bắt buộc" />
        </label>
      </div>

      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      <button type="submit" disabled={submitting} className="tp-btn-primary mt-5 w-full justify-center py-2.5 text-sm disabled:opacity-60">
        {submitting ? 'Đang nộp đơn...' : 'Nộp đơn ứng tuyển'}
      </button>
    </form>
  );
}

export function RecruitmentDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const user = getStoredUser();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    recruitmentApi.detail(id)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => {
        if (cancelled) return;
        setError(e.response?.status === 404
          ? 'Bài tuyển này không tồn tại hoặc hiện không hiển thị.'
          : getApiError(e, 'Không tải được bài tuyển.'));
      });
    return () => { cancelled = true; };
  }, [id]);

  const withdraw = async () => {
    if (!window.confirm('Rút đơn ứng tuyển? Bạn vẫn có thể nộp lại khi bài tuyển còn nhận đơn.')) return;
    setWithdrawing(true);
    try {
      setDetail(await recruitmentApi.withdraw(id));
      toast.success('Đã rút đơn.');
    } catch (e) {
      toast.error(getApiError(e, 'Không rút được đơn.'));
    } finally {
      setWithdrawing(false);
    }
  };

  const r = detail?.recruitment;
  const mine = detail?.myApplication;

  return (
    <div className="tp-site min-h-screen w-full !bg-slate-50 text-slate-900 antialiased">
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link to="/tuyen-kiem-duyet-vien" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Tất cả đợt tuyển
        </Link>

        {error && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white py-14 text-center">
            <Megaphone className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-600">{error}</p>
          </div>
        )}
        {!detail && !error && <div className="tp-skeleton h-72 w-full rounded-3xl" role="status" aria-label="Đang tải" />}

        {r && (
          <div className="space-y-5">
            <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <Cover recruitment={r} className="h-48 w-full sm:h-60" />
              <div className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StateBadge recruitment={r} />
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500"><Users className="h-3.5 w-3.5" /> {slotText(r)}</span>
                  {r.deadline && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <CalendarClock className="h-3.5 w-3.5" /> Hạn nộp {formatDateTime(r.deadline)}
                    </span>
                  )}
                </div>
                <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{r.title}</h1>
                {r.summary && <p className="mt-1 text-base text-slate-600">{r.summary}</p>}
                <div className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-800">{r.content}</div>
              </div>
            </article>

            {mine && <ApplicationStatus app={mine} onWithdraw={withdraw} withdrawing={withdrawing} />}

            {!user ? (
              r.accepting && (
                <div className="rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                  <p className="text-sm text-slate-600">Đăng nhập để ứng tuyển làm kiểm duyệt viên.</p>
                  <Link to={withRedirect('/login', location.pathname)} className="tp-btn-primary mt-3 inline-flex px-5 py-2 text-sm">Đăng nhập</Link>
                </div>
              )
            ) : detail.canApply ? (
              <ApplyForm
                key={mine?.status || 'new'}
                recruitmentId={r.id}
                previous={mine?.status === 'WITHDRAWN' ? mine : null}
                onApplied={setDetail}
              />
            ) : (
              detail.applyBlockedReason && !mine && (
                <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{detail.applyBlockedReason}</p>
              )
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default RecruitmentListPage;
