import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { MAX_REASON_LENGTH, getApiMessage } from '../../utils/moderation';

const CONFIG = {
  HIDE: {
    title: 'Ẩn nội dung này?',
    description: 'Nội dung sẽ không còn hiển thị với người khác. Tác giả vẫn thấy nội dung của mình kèm lý do bị ẩn. Các báo cáo đang chờ sẽ được đóng.',
    label: 'Lý do ẩn (tác giả sẽ thấy)',
    placeholder: 'Ví dụ: Nội dung chứa quảng cáo, vi phạm quy tắc cộng đồng...',
    confirm: 'Ẩn nội dung',
    busy: 'Đang ẩn...',
    required: true,
    tone: 'bg-rose-600 hover:bg-rose-700',
  },
  RESTORE: {
    title: 'Khôi phục nội dung này?',
    description: 'Nội dung sẽ hiển thị trở lại với mọi người.',
    label: 'Ghi chú (không bắt buộc)',
    placeholder: 'Ví dụ: Ẩn nhầm, nội dung không vi phạm.',
    confirm: 'Khôi phục',
    busy: 'Đang khôi phục...',
    required: false,
    tone: 'bg-emerald-600 hover:bg-emerald-700',
  },
  DISMISS: {
    title: 'Bỏ qua các báo cáo?',
    description: 'Nội dung được giữ nguyên và các báo cáo đang chờ sẽ được đóng là không vi phạm.',
    label: 'Ghi chú (không bắt buộc)',
    placeholder: 'Ví dụ: Nội dung không vi phạm quy tắc.',
    confirm: 'Bỏ qua báo cáo',
    busy: 'Đang xử lý...',
    required: false,
    tone: 'bg-slate-800 hover:bg-slate-900',
  },
};

/**
 * Hộp thoại xác nhận một thao tác kiểm duyệt.
 *   action     'HIDE' | 'RESTORE' | 'DISMISS' | null (đóng)
 *   onConfirm  (reason: string) => Promise  — ném lỗi (axios) để hộp thoại hiện thông báo và giữ nguyên nội dung đã nhập
 *   onClose    đóng hộp thoại
 */
export default function ActionDialog({ action, onConfirm, onClose }) {
  if (!action) return null;
  return <DialogBody key={action} action={action} onConfirm={onConfirm} onClose={onClose} />;
}

function DialogBody({ action, onConfirm, onClose }) {
  const cfg = CONFIG[action];
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef(null);
  const busyRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => { textareaRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busyRef.current) onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const trimmed = reason.trim();

  const submit = async () => {
    if (busyRef.current) return;
    if (cfg.required && !trimmed) { setError('Vui lòng nhập lý do.'); return; }
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await onConfirm(trimmed);
    } catch (e) {
      setError(getApiMessage(e, 'Không thực hiện được thao tác. Vui lòng thử lại.'));
      busyRef.current = false;
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busyRef.current) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="mod-action-title" className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Đóng"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 id="mod-action-title" className="pr-10 text-lg font-extrabold text-slate-900">{cfg.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{cfg.description}</p>

        <label className="mt-4 block text-sm font-bold text-slate-800" htmlFor="mod-action-reason">{cfg.label}</label>
        <textarea
          id="mod-action-reason"
          ref={textareaRef}
          value={reason}
          maxLength={MAX_REASON_LENGTH}
          onChange={(e) => { setReason(e.target.value); setError(''); }}
          placeholder={cfg.placeholder}
          disabled={busy}
          rows={4}
          className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-500 disabled:bg-slate-50"
        />
        <p className="mt-1 text-right text-[11px] text-slate-400">{reason.length}/{MAX_REASON_LENGTH}</p>

        {error && <p role="alert" className="mt-2 text-sm font-medium text-rose-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-full px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50">
            Hủy
          </button>
          <button type="button" onClick={submit} disabled={busy} className={`rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60 ${cfg.tone}`}>
            {busy ? cfg.busy : cfg.confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
