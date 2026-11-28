import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Copy, X, CalendarDays } from 'lucide-react';
import { copyTripFromPost } from '../api/postTripApi';
import { getApiError } from '../api/axiosClient';
import { toast } from '../utils/toast';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), a[href]';
const MAX_TITLE = 255;

/** 'YYYY-MM-DD' theo giờ máy người dùng (không dùng toISOString vì lệch múi giờ). */
const toInputDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  return toInputDate(new Date(y, m - 1, d + n));
};

const viDate = (iso) => {
  const [y, m, d] = String(iso || '').split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
};

/**
 * Hộp thoại sao chép lịch trình từ bài viết.
 *
 * Props:
 *   postId   bài viết chứa lịch trình
 *   trip     TripPreview của bài (title, dayCount...)
 *   onClose  đóng hộp thoại
 *
 * Sao chép xong: chuyến đi mới ở chế độ Riêng tư, chuyển thẳng tới trang chi tiết để chỉnh sửa.
 */
export default function CopyTripDialog({ postId, trip, onClose }) {
  const navigate = useNavigate();
  const today = toInputDate(new Date());
  const dayCount = Math.max(1, Number(trip?.dayCount) || 1);

  const [title, setTitle] = useState(`Bản sao của: ${trip?.title || 'Chuyến đi'}`.slice(0, MAX_TITLE));
  const [keepDates, setKeepDates] = useState(false);
  const [startDate, setStartDate] = useState(addDays(today, 7));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Esc để đóng, bẫy phím Tab (chạy ở pha capture để không đóng hộp thoại bên dưới, vd. xem bài viết)
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialogRef.current?.querySelector('input')?.focus();
    const onKey = (ev) => {
      if (ev.key === 'Escape') {
        ev.stopImmediatePropagation();
        ev.preventDefault();
        onCloseRef.current();
        return;
      }
      if (ev.key !== 'Tab' || !dialogRef.current) return;
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

  const canSubmit = !submitting && (keepDates || Boolean(startDate));

  const submit = async (ev) => {
    ev.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await copyTripFromPost(postId, {
        title: title.trim() || null,
        startDate: keepDates ? null : startDate,
      });
      toast.success('Đã sao chép lịch trình vào chuyến đi của bạn.');
      onClose();
      navigate(`/trips/${result.tripId}`);
    } catch (e) {
      const status = e.response?.status;
      if (status === 403) setError('Lịch trình này đang ở chế độ riêng tư, bạn không thể sao chép.');
      else if (status === 404) setError('Bài viết hoặc lịch trình không còn khả dụng.');
      else setError(getApiError(e, 'Không sao chép được lịch trình. Vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="tp-modal fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(ev) => { ev.stopPropagation(); if (ev.target === ev.currentTarget && !submitting) onClose(); }}
      onClick={(ev) => ev.stopPropagation()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="copy-trip-title"
        tabIndex={-1}
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Đóng"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <X className="h-5 w-5" />
        </button>

        <form onSubmit={submit}>
          <h2 id="copy-trip-title" className="flex items-center gap-2 pr-8 text-lg font-extrabold text-slate-900">
            <Copy className="h-5 w-5 text-[#FF5645]" /> Sao chép lịch trình
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Toàn bộ {dayCount} ngày và các địa điểm sẽ được chép thành chuyến đi riêng tư của bạn. Bạn có thể chỉnh sửa thoải mái mà không ảnh hưởng tới lịch trình gốc.
          </p>
          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {Number(trip?.totalBudget) > 0
              ? 'Ngân sách của chuyến đi được giữ lại. '
              : ''}
            Các khoản chi thực tế của tác giả không được chép sang chuyến đi của bạn.
          </p>

          <label htmlFor="copy-trip-name" className="mt-4 block text-sm font-semibold text-slate-700">Tên chuyến đi</label>
          <input
            id="copy-trip-name"
            type="text"
            value={title}
            maxLength={MAX_TITLE}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#FF5645] focus:ring-2 focus:ring-red-100"
          />

          <label htmlFor="copy-trip-start" className="mt-4 block text-sm font-semibold text-slate-700">Ngày bắt đầu</label>
          <div className="mt-1 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              id="copy-trip-start"
              type="date"
              value={startDate}
              min={today}
              disabled={keepDates}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#FF5645] focus:ring-2 focus:ring-red-100 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          {!keepDates && startDate && (
            <p className="mt-1 text-xs text-slate-500">
              Kết thúc: {viDate(addDays(startDate, dayCount - 1))} ({dayCount} ngày)
            </p>
          )}
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={keepDates}
              onChange={(e) => setKeepDates(e.target.checked)}
              className="h-4 w-4 accent-[#FF5645]"
            />
            Giữ nguyên ngày của lịch trình gốc
          </label>

          {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-full px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="tp-btn-primary px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Đang sao chép...' : <><Copy className="h-4 w-4" /> Sao chép</>}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
