import { useState } from 'react';
import {
  AlertTriangle, Bed, Car, ChevronDown, ChevronUp, Coffee, Copy, Info, Landmark, MapPin, RefreshCw,
  Route, Ticket, Utensils, Wallet,
} from 'lucide-react';
import { getPostItinerary, refreshPostTrip } from '../api/postTripApi';
import { getApiError } from '../api/axiosClient';
import { formatDateRange } from '../utils/trips';
import { CATEGORY_MAP, formatVND } from '../utils/tripDetail';
import { resolveCoverUrl, cloudinaryResize, coverGradient } from '../utils/cover';
import { formatCount, formatCountFull } from './formatCount';
import { toast } from '../utils/toast';
import CopyTripDialog from './CopyTripDialog';

const TYPE_ICONS = {
  CAFE: Coffee,
  RESTAURANT: Utensils,
  ACCOMMODATION: Bed,
  ATTRACTION: Landmark,
  TRANSPORT: Car,
  ACTIVITY: Ticket,
};

const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
const timeRange = (s) => {
  const a = hhmm(s.startTime);
  const b = hhmm(s.endTime);
  if (a && b) return `${a} - ${b}`;
  return a || b || '';
};
const shortDate = (iso) => {
  const [y, m, d] = String(iso || '').split('-');
  return y && m && d ? `${d}/${m}` : '';
};
const money = (v) => (v === null || v === undefined ? '' : formatVND(v));
const categoryLabel = (key) => CATEGORY_MAP[key]?.label || 'Khác';

/** snapshotAt là giờ UTC không kèm múi giờ (LocalDateTime) -> hiển thị theo giờ máy. */
const formatSnapshotAt = (value) => {
  if (!value) return '';
  const d = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
};

/**
 * Thẻ lịch trình trong bài viết (bảng tin Cộng đồng + hộp thoại xem bài).
 * Mọi dữ liệu là BẢN CHỤP lúc đăng: tác giả sửa chuyến đi gốc thì thẻ không đổi cho tới khi
 * tác giả bấm "Cập nhật vào bài".
 *
 * Props:
 *   post           bài viết (post.id, post.trip, post.relationship)
 *   currentUser    người đang đăng nhập, null = khách (xem được, phải đăng nhập để sao chép)
 *   onPostUpdated  (bài viết mới từ server) => void, gọi sau khi tác giả cập nhật lịch trình
 */
export default function PostTripCard({ post, currentUser, onPostUpdated }) {
  const [trip, setTrip] = useState(post?.trip || null);
  const [open, setOpen] = useState(false);
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copying, setCopying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (!trip) return null;

  const isAuthor = post.relationship === 'SELF';
  const cover = resolveCoverUrl(trip);
  const days = Number(trip.dayCount) || 0;
  const places = Number(trip.placeCount) || 0;
  const copies = Number(trip.copyCount) || 0;
  const totalSpent = Number(trip.totalSpent) || 0;
  const members = Number(trip.memberCount) || 1;
  const snapshotLabel = formatSnapshotAt(trip.snapshotAt);

  const loadItinerary = async () => {
    setLoading(true);
    setError('');
    try {
      setItinerary(await getPostItinerary(post.id));
    } catch (e) {
      setError(e.response?.status === 404
        ? 'Lịch trình không còn khả dụng.'
        : getApiError(e, 'Không tải được lịch trình.'));
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !itinerary && !loading) loadItinerary();
  };

  const startCopy = () => {
    if (!currentUser || !localStorage.getItem('token')) {
      toast.info('Vui lòng đăng nhập để sao chép lịch trình!');
      return;
    }
    setCopying(true);
  };

  const refresh = async () => {
    if (refreshing) return;
    if (!window.confirm('Cập nhật lịch trình trong bài theo chuyến đi hiện tại? Người xem sẽ thấy lịch trình và chi phí mới.')) return;
    setRefreshing(true);
    try {
      const updated = await refreshPostTrip(post.id);
      setTrip(updated?.trip || null);
      setItinerary(null);
      if (open) setOpen(false);
      onPostUpdated?.(updated);
      toast.success('Đã cập nhật lịch trình trong bài viết.');
    } catch (e) {
      toast.error(getApiError(e, 'Không cập nhật được lịch trình.'));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex gap-3 p-3">
        <div
          className="h-24 w-24 shrink-0 overflow-hidden rounded-xl"
          style={cover ? undefined : { background: coverGradient(post.id) }}
        >
          {cover && <img src={cloudinaryResize(cover, 192, 192)} alt="" className="h-full w-full object-cover" loading="lazy" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#FF5645]">
              <Route className="h-3.5 w-3.5" /> Lịch trình
            </p>
            {copies > 0 && (
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700"
                title={`${formatCountFull(copies)} người đã sao chép lịch trình này`}
              >
                <Copy className="h-3 w-3" /> {formatCount(copies)} lượt sao chép
              </span>
            )}
          </div>
          <p className="truncate font-bold text-slate-900" title={trip.title}>{trip.title}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {trip.destination ? `${trip.destination} • ` : ''}{formatDateRange(trip.startDate, trip.endDate)}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-600">{days} ngày • {places} địa điểm</p>
          {totalSpent > 0 && (
            <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-slate-700">
              <Wallet className="h-3.5 w-3.5 text-amber-500" />
              Tổng chi {formatVND(totalSpent)}
              {members > 1 && trip.perPerson ? <span className="font-normal text-slate-500"> • ≈ {formatVND(trip.perPerson)}/người</span> : null}
            </p>
          )}
        </div>
      </div>

      {/* Chỉ tác giả: trạng thái so với chuyến đi gốc */}
      {isAuthor && trip.sourceAvailable === false && (
        <p className="flex items-start gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Chuyến đi gốc đã bị xóa. Bài viết vẫn giữ lịch trình đã đăng.
        </p>
      )}
      {isAuthor && trip.sourceChanged && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-100 bg-amber-50 px-4 py-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Lịch trình gốc đã thay đổi so với bản trong bài.
          </p>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-800 shadow-sm ring-1 ring-amber-200 transition-colors hover:bg-amber-100 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Đang cập nhật...' : 'Cập nhật vào bài'}
          </button>
        </div>
      )}

      <div className="flex border-t border-slate-100">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {open ? 'Thu gọn' : 'Xem lịch trình'}
        </button>
        <button
          type="button"
          onClick={startCopy}
          className="flex flex-1 items-center justify-center gap-1.5 border-l border-slate-100 py-2.5 text-sm font-bold text-[#FF5645] transition-colors hover:bg-red-50"
        >
          <Copy className="h-4 w-4" /> Sao chép lịch trình
        </button>
      </div>

      {open && (
        <div className="max-h-96 overflow-y-auto border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          {loading && (
            <div className="flex justify-center py-4" role="status" aria-label="Đang tải lịch trình">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#FF5645]" />
            </div>
          )}
          {error && <p role="alert" className="py-2 text-sm text-red-600">{error}</p>}

          {itinerary && (
            <>
              {itinerary.days?.length === 0 && (
                <p className="py-2 text-sm text-slate-500">Lịch trình chưa có địa điểm nào.</p>
              )}
              {itinerary.days?.map((day) => (
                <div key={day.dayNumber} className="mb-3 last:mb-0">
                  <p className="text-xs font-extrabold text-slate-700">
                    Ngày {day.dayNumber}{day.dayDate ? ` • ${shortDate(day.dayDate)}` : ''}
                  </p>
                  {day.destinations?.length ? (
                    <ol className="mt-1.5 space-y-2 border-l-2 border-slate-200 pl-3">
                      {day.destinations.map((stop, i) => {
                        const Icon = TYPE_ICONS[String(stop.itemType || '').toUpperCase()] || MapPin;
                        const time = timeRange(stop);
                        return (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                            <div className="min-w-0 flex-1">
                              <p className="break-words font-semibold text-slate-800">{stop.placeName}</p>
                              {(time || stop.note) && (
                                <p className="break-words text-xs text-slate-500">
                                  {time}{time && stop.note ? ' • ' : ''}{stop.note}
                                </p>
                              )}
                              {(stop.estimatedCost != null || stop.actualCost != null) && (
                                <p className="mt-0.5 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                                  {stop.estimatedCost != null && (
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Dự kiến {money(stop.estimatedCost)}</span>
                                  )}
                                  {stop.actualCost != null && (
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">Đã chi {money(stop.actualCost)}</span>
                                  )}
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <p className="mt-1 pl-3 text-xs italic text-slate-400">Chưa có địa điểm</p>
                  )}
                </div>
              ))}

              <CostSummary trip={trip} itinerary={itinerary} />

              {isAuthor && snapshotLabel && (
                <p className="mt-3 text-[11px] text-slate-400">Lịch trình trong bài được chụp lúc {snapshotLabel}.</p>
              )}
            </>
          )}
        </div>
      )}

      {copying && <CopyTripDialog postId={post.id} trip={trip} onClose={() => setCopying(false)} />}
    </div>
  );
}

/** Ngân sách, tổng chi, chi theo hạng mục và các khoản chi chung (chỉ tên mục + số tiền). */
function CostSummary({ trip, itinerary }) {
  const categories = itinerary.costByCategory || [];
  const general = itinerary.generalExpenses || [];
  const budget = Number(trip.totalBudget) || 0;
  const spent = Number(trip.totalSpent) || 0;
  if (!budget && !spent) return null;
  const max = Math.max(...categories.map((c) => Number(c.amount) || 0), 1);

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
      <p className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700">
        <Wallet className="h-4 w-4 text-amber-500" /> Chi phí chuyến đi
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
        {budget > 0 && (
          <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
            <dt className="text-slate-500">Ngân sách</dt>
            <dd className="font-bold text-slate-800">{formatVND(budget)}</dd>
          </div>
        )}
        {spent > 0 && (
          <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
            <dt className="text-slate-500">Đã chi{Number(trip.memberCount) > 1 ? ` (${trip.memberCount} người)` : ''}</dt>
            <dd className="font-bold text-slate-800">
              {formatVND(spent)}
              {Number(trip.memberCount) > 1 && trip.perPerson ? <span className="font-normal text-slate-500"> • ≈ {formatVND(trip.perPerson)}/người</span> : null}
            </dd>
          </div>
        )}
      </dl>

      {categories.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {categories.map((c) => {
            const Icon = CATEGORY_MAP[c.category]?.Icon;
            const width = Math.max(4, Math.round(((Number(c.amount) || 0) / max) * 100));
            return (
              <li key={c.category} className="text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                    {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />} {categoryLabel(c.category)}
                  </span>
                  <span className="font-bold text-slate-800">{formatVND(c.amount)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${width}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {general.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Khoản chi chung</p>
          <ul className="mt-1 space-y-1">
            {general.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-slate-700">{e.title || categoryLabel(e.category)}</span>
                <span className="shrink-0 font-semibold text-slate-800">{formatVND(e.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
