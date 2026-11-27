import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Flag, X, CheckCircle2 } from 'lucide-react';

const API = 'http://localhost:8080/api/reports';
const MAX_DETAILS = 500; // khớp ReportService.MAX_DETAILS_LENGTH ở backend

// Mã lý do khớp ReportService.REASON_CODES ở backend.
const REPORT_REASONS = [
  { code: 'SPAM', label: 'Spam hoặc quảng cáo' },
  { code: 'HARASSMENT', label: 'Quấy rối, xúc phạm hoặc thù ghét' },
  { code: 'SENSITIVE', label: 'Nội dung nhạy cảm hoặc bạo lực' },
  { code: 'MISINFORMATION', label: 'Thông tin sai sự thật' },
  { code: 'OTHER', label: 'Lý do khác' },
];

const FOCUSABLE = 'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), a[href]';

const errorMessage = (error) => {
  const status = error.response?.status;
  const data = error.response?.data;
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (status === 429) return typeof data === 'string' && data ? data : 'Bạn gửi báo cáo quá nhanh. Vui lòng thử lại sau ít phút.';
  if (typeof data === 'string' && data) return data;
  if (data?.message) return data.message;
  return error.message || 'Không gửi được báo cáo. Vui lòng thử lại.';
};

/**
 * Hộp thoại báo cáo nội dung vi phạm (bài viết, bình luận, đánh giá địa điểm).
 *
 * Props:
 *   target     { type: 'POST' | 'POST_COMMENT' | 'PLACE_REVIEW', id, label } hoặc null (đóng)
 *   onClose    đóng hộp thoại
 *   onReported(target)  gọi khi báo cáo đã được ghi nhận (kể cả khi trước đó đã báo cáo rồi)
 *
 * Hộp thoại có thể được mở bên trong hộp thoại khác (ví dụ xem bài viết): nó tự chặn phím
 * Esc / Tab ở pha capture nên không làm đóng hộp thoại bên dưới.
 */
export default function ReportDialog({ target, onClose, onReported }) {
  if (!target) return null;
  // key đặt lại toàn bộ trạng thái mỗi khi mở cho một nội dung khác
  return <ReportForm key={`${target.type}:${target.id}`} target={target} onClose={onClose} onReported={onReported} />;
}

function ReportForm({ target, onClose, onReported }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();

    const onKey = (ev) => {
      if (ev.key === 'Escape') {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        onCloseRef.current();
        return;
      }
      if (ev.key !== 'Tab' || !dialogRef.current) return;
      // Bẫy phím Tab trong hộp thoại này, không để hộp thoại bên dưới xử lý
      ev.stopImmediatePropagation();
      const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) { ev.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (ev.shiftKey && (active === first || active === dialogRef.current)) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && (active === last || !dialogRef.current.contains(active))) { ev.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    };
  }, []);

  const needsDetails = reason === 'OTHER';
  const canSubmit = Boolean(reason) && (!needsDetails || details.trim() !== '') && !submitting;

  const submit = async (ev) => {
    ev.preventDefault();
    if (!canSubmit) return;
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Bạn cần đăng nhập để báo cáo.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await axios.post(
        API,
        { targetType: target.type, targetId: target.id, reasonCode: reason, details: details.trim() || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDone('Cảm ơn bạn. Chúng tôi sẽ xem xét báo cáo sớm.');
      onReported?.(target);
    } catch (e) {
      if (e.response?.status === 409) {
        // Đã báo cáo trước đó: coi như thành công để giao diện hiện "Đã báo cáo"
        setDone(typeof e.response.data === 'string' && e.response.data ? e.response.data : 'Bạn đã báo cáo nội dung này rồi.');
        onReported?.(target);
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const title = `Báo cáo ${target.label || 'nội dung này'}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(ev) => { ev.stopPropagation(); if (ev.target === ev.currentTarget) onClose(); }}
      onClick={(ev) => ev.stopPropagation()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-dialog-title"
        tabIndex={-1}
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <X className="h-5 w-5" />
        </button>

        {done ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h2 id="report-dialog-title" className="mt-3 text-lg font-extrabold text-slate-900">Đã ghi nhận</h2>
            <p role="status" className="mt-1 text-sm text-slate-600">{done}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-slate-700"
            >
              Đóng
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h2 id="report-dialog-title" className="flex items-center gap-2 pr-8 text-lg font-extrabold text-slate-900">
              <Flag className="h-5 w-5 text-[#FF5645]" /> {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">Vì sao bạn báo cáo? Báo cáo được gửi riêng cho đội kiểm duyệt.</p>

            <fieldset className="mt-4 space-y-1.5">
              <legend className="sr-only">Lý do báo cáo</legend>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.code}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    reason === r.code ? 'border-[#FF5645] bg-red-50 text-slate-900' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.code}
                    checked={reason === r.code}
                    onChange={() => setReason(r.code)}
                    className="h-4 w-4 accent-[#FF5645]"
                  />
                  {r.label}
                </label>
              ))}
            </fieldset>

            <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="report-details">
              Mô tả thêm {needsDetails ? <span className="text-red-500">(bắt buộc)</span> : <span className="font-normal text-slate-400">(không bắt buộc)</span>}
            </label>
            <textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={MAX_DETAILS}
              rows={3}
              className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#FF5645] focus:ring-2 focus:ring-red-100"
              placeholder="Cho chúng tôi biết thêm chi tiết..."
            />
            <p className="mt-0.5 text-right text-xs text-slate-400">{details.length}/{MAX_DETAILS}</p>

            {error && (
              <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-full bg-[#FF5645] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#e64a3a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Đang gửi...' : 'Gửi báo cáo'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
