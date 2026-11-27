import { useEffect, useState } from 'react';
import axios from 'axios';
import { Trash2, AlertTriangle } from 'lucide-react';
import ShareTripModal from './ShareTripModal';
import { API_BASE_URL } from '../config/api';

const apiMessage = (e, fallback) => {
  const data = e?.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (data && typeof data.message === 'string' && data.message.trim()) return data.message;
  return fallback;
};

/**
 * Các thao tác trên thẻ chuyến đi (chia sẻ, đổi quyền hiển thị, xóa) dùng chung cho Trang chủ và Trang cá nhân.
 * Trả về các hàm thao tác và `dialogs` (hộp thoại xác nhận xóa / báo lỗi / modal chia sẻ) để render một lần ở cuối trang.
 *   onDeleted(tripId)                   : đã xóa thành công
 *   onVisibilityChanged(tripId, value)  : đã đổi quyền hiển thị thành công
 *   onShareChanged()                    : modal chia sẻ có thay đổi (đổi thành viên, link...)
 */
export default function useTripActions({ onDeleted, onVisibilityChanged, onShareChanged } = {}) {
  const [dialog, setDialog] = useState(null); // { type: 'confirm', trip } | { type: 'error', title, message }
  const [deletingId, setDeletingId] = useState(null);
  const [visibilityBusyId, setVisibilityBusyId] = useState(null);
  const [shareTrip, setShareTrip] = useState(null);

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && deletingId === null) setDialog(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, deletingId]);

  const closeDialog = () => { if (deletingId === null) setDialog(null); };

  const openShare = (trip) => setShareTrip(trip);
  const askDelete = (trip) => setDialog({ type: 'confirm', trip });

  const confirmDelete = async () => {
    const trip = dialog?.trip;
    if (!trip) return;
    setDeletingId(trip.id);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/api/trips/${trip.id}`, { headers: { Authorization: `Bearer ${token}` } });
      setDialog(null);
      onDeleted?.(trip.id);
    } catch (e) {
      setDialog({ type: 'error', title: 'Không thể xóa chuyến đi', message: apiMessage(e, 'Không thể xóa chuyến đi, vui lòng thử lại.') });
    } finally {
      setDeletingId(null);
    }
  };

  const changeVisibility = async (trip, value) => {
    if (!trip || value === (trip.visibility || 'PRIVATE') || visibilityBusyId !== null) return;
    setVisibilityBusyId(trip.id);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.patch(`${API_BASE_URL}/api/trips/${trip.id}/visibility`, { visibility: value },
        { headers: { Authorization: `Bearer ${token}` } });
      onVisibilityChanged?.(trip.id, res?.data?.visibility || value);
    } catch (e) {
      setDialog({ type: 'error', title: 'Không thể đổi quyền hiển thị', message: apiMessage(e, 'Không thể đổi quyền hiển thị, vui lòng thử lại.') });
    } finally {
      setVisibilityBusyId(null);
    }
  };

  /** Thao tác đang chạy trên một chuyến đi: 'delete' | 'visibility' | null */
  const busyOf = (tripId) => (deletingId === tripId ? 'delete' : visibilityBusyId === tripId ? 'visibility' : null);

  const dialogs = (
    <>
      {dialog && (
        <div
          className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
          onClick={closeDialog}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
              {dialog.type === 'confirm' ? <Trash2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </div>
            <h3 className="mt-4 text-center text-lg font-extrabold text-slate-900">
              {dialog.type === 'confirm' ? 'Xóa chuyến đi?' : dialog.title}
            </h3>
            <p className="mt-2 text-center text-sm leading-relaxed text-slate-500">
              {dialog.type === 'confirm' ? (
                <>
                  Chuyến đi <span className="font-semibold text-slate-700">“{dialog.trip.title}”</span> cùng toàn bộ lịch trình,
                  chi tiêu và đánh giá sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.
                </>
              ) : (
                dialog.message
              )}
            </p>
            {dialog.type === 'confirm' ? (
              <div className="mt-6 flex gap-3">
                <button
                  onClick={closeDialog}
                  disabled={deletingId !== null}
                  className="flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deletingId !== null}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-red-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-600 disabled:opacity-70"
                >
                  {deletingId !== null && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                  {deletingId !== null ? 'Đang xóa...' : 'Xóa'}
                </button>
              </div>
            ) : (
              <button
                onClick={closeDialog}
                className="mt-6 w-full rounded-full bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800"
              >
                Đóng
              </button>
            )}
          </div>
        </div>
      )}

      {shareTrip && (
        <ShareTripModal
          trip={{ id: shareTrip.id, title: shareTrip.title }}
          onClose={() => setShareTrip(null)}
          onChanged={() => onShareChanged?.()}
        />
      )}
    </>
  );

  return { openShare, askDelete, changeVisibility, busyOf, dialogs };
}
