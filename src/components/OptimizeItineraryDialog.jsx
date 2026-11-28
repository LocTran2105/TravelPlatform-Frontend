import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle, ArrowRight, BedDouble, Bike, Car, CheckCircle2, Clock, Footprints, Map as MapIcon, Route,
  Sparkles, Sunrise, Sunset, X, Wand2, CornerDownRight, GripHorizontal, Minus, Maximize2, Minimize2
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import { toast } from '../utils/toast';
import { buildGoogleMapsUrl, MAX_WAYPOINTS } from '../utils/directions';
import useFloatingWindow from '../hooks/useFloatingWindow';

// Hộp "Tối ưu lộ trình": backend xếp lại thứ tự + giờ ghé theo quãng đường, giờ mở cửa và khung giờ đẹp
// (săn mây, chụp ảnh, giờ ăn...), xuất phát/kết thúc ở nơi ở. Người dùng xem trước rồi mới bấm Áp dụng.
// Hộp là cửa sổ nổi giống khung chat AI, KHÔNG che/làm mờ trang: kéo để di chuyển, kéo góc để đổi kích thước,
// phóng to, "Về góc", hoặc thu thành bong bóng ở góc dưới để xem lịch trình cũ mà vẫn giữ kết quả.

// Mặc định nép bên phải, phía trên các bong bóng ở góc dưới.
const defaultOptimizeWindow = () => {
  const w = Math.min(600, window.innerWidth - 32);
  const h = Math.min(760, window.innerHeight - 140);
  return { w, h, x: window.innerWidth - w - 20, y: Math.max(16, window.innerHeight - h - 96) };
};

const TRANSPORTS = [
  { key: 'MOTORBIKE', label: 'Xe máy', Icon: Bike, maps: 'two-wheeler' },
  { key: 'CAR', label: 'Ô tô', Icon: Car, maps: 'driving' },
  { key: 'WALK', label: 'Đi bộ', Icon: Footprints, maps: 'walking' },
];
const INTENSITIES = [
  { key: 'RELAX', label: 'Thong thả' },
  { key: 'BALANCED', label: 'Vừa phải' },
  { key: 'PACKED', label: 'Đi nhiều' },
];
const STATUS = {
  OPTIMIZED: { label: 'Có lộ trình tốt hơn', cls: 'bg-emerald-50 text-emerald-700' },
  UNCHANGED: { label: 'Thứ tự đã hợp lý', cls: 'bg-slate-100 text-slate-600' },
  SKIPPED: { label: 'Chưa tối ưu được', cls: 'bg-amber-50 text-amber-700' },
};

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const apiError = (e, fallback) => (typeof e?.response?.data === 'string' && e.response.data ? e.response.data : fallback);
const km = (v) => `${Number(v || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`;
const shortDate = (iso) => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : '');

const mapsUrlForDay = (day, transport) => {
  const stops = (day.stops || []).filter((s) => s.latitude != null).map((s) => ({ lat: s.latitude, lng: s.longitude }));
  if (stops.length === 0) return null;
  const origin = day.start?.latitude != null ? { lat: day.start.latitude, lng: day.start.longitude } : stops[0];
  const end = day.end?.latitude != null ? { lat: day.end.latitude, lng: day.end.longitude } : null;
  const destination = end || stops[stops.length - 1];
  const middle = day.start ? stops : stops.slice(1);
  const waypoints = (end ? middle : middle.slice(0, -1)).slice(0, MAX_WAYPOINTS);
  return buildGoogleMapsUrl({ origin, destination, waypoints, mode: TRANSPORTS.find((t) => t.key === transport)?.maps });
};

const OptimizeItineraryDialog = ({ tripId, dayIds, canEdit, onClose, onApplied, onMoveDestination }) => {
  const [transport, setTransport] = useState('MOTORBIKE');
  const [intensity, setIntensity] = useState('BALANCED');
  const [applying, setApplying] = useState(false);
  const [fillTimes, setFillTimes] = useState(true);
  const [movingId, setMovingId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const fw = useFloatingWindow({ storageKey: 'trip-optimize-window', minW: 380, minH: 360, defaultWindow: defaultOptimizeWindow });
  // Kết quả gắn với khóa yêu cầu: đổi phương tiện/nhịp độ là tính lại, "đang tải" suy ra từ khóa lệch nhau.
  const [result, setResult] = useState({ key: null, data: null, error: null });
  const dayKey = (dayIds || []).join(',');
  const requestKey = `${tripId}|${dayKey}|${transport}|${intensity}|${reloadKey}`;

  useEffect(() => {
    let cancelled = false;
    axios.post(`${API_BASE_URL}/api/trips/${tripId}/itinerary/optimize`,
      { dayIds: dayKey ? dayKey.split(',').map(Number) : [], transport, intensity },
      { headers: authHeaders() })
      .then((res) => { if (!cancelled) setResult({ key: requestKey, data: res.data, error: null }); })
      .catch((e) => {
        if (!cancelled) setResult({ key: requestKey, data: null, error: apiError(e, 'Không tối ưu được lộ trình. Vui lòng thử lại.') });
      });
    return () => { cancelled = true; };
  }, [requestKey, tripId, dayKey, transport, intensity]);

  const loading = result.key !== requestKey;
  const data = loading ? null : result.data;
  const error = loading ? null : result.error;
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    // Esc thu hộp xuống góc (không mất kết quả); muốn đóng hẳn thì bấm X.
    const onKey = (e) => { if (e.key === 'Escape' && !applying) setMinimized(true); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [applying]);

  const days = data?.days || [];
  const applicable = days.filter((d) => d.status !== 'SKIPPED'
    && (d.changed || (fillTimes && (d.stops || []).some((s) => s.suggestedTime))));
  const changedCount = days.filter((d) => d.changed).length;
  const timesCount = fillTimes ? applicable.reduce((n, d) => n + d.stops.filter((s) => s.suggestedTime).length, 0) : 0;

  const apply = async () => {
    if (!data || applicable.length === 0) return;
    setApplying(true);
    try {
      const body = {
        signature: data.signature,
        days: applicable.map((d) => ({
          dayId: d.dayId,
          destinationIds: d.proposedOrder,
          times: fillTimes
            ? Object.fromEntries(d.stops.filter((s) => s.suggestedTime).map((s) => [s.destinationId, s.suggestedTime]))
            : {},
        })),
      };
      const res = await axios.post(`${API_BASE_URL}/api/trips/${tripId}/itinerary/optimize/apply`, body, { headers: authHeaders() });
      const filled = res.data?.timesFilled || 0;
      toast.success(`Đã áp dụng lộ trình tối ưu${filled ? ` và điền giờ cho ${filled} điểm` : ''}. Nhấn Ctrl+Z hoặc "Hoàn tác" để quay lại.`);
      // Trả về các giờ vừa điền để trang cha hoàn tác được (xóa lại đúng những giờ này).
      const filledTimes = Object.assign({}, ...body.days.map((d) => d.times));
      onApplied?.({ filledTimes });
      onClose();
    } catch (e) {
      toast.error(apiError(e, 'Không áp dụng được lộ trình.'));
      if (e?.response?.status === 409) load();
    } finally {
      setApplying(false);
    }
  };

  const move = async (suggestion) => {
    if (!onMoveDestination) return;
    setMovingId(suggestion.destinationId);
    try {
      await onMoveDestination(suggestion.destinationId, suggestion.toDayId);
      load();
    } finally {
      setMovingId(null);
    }
  };

  // Thu nhỏ: chỉ còn bong bóng ở góc dưới (cạnh bong bóng chat AI), bấm để mở lại đúng kết quả đang xem.
  if (minimized) {
    const changed = days.filter((d) => d.changed).length;
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        title="Mở lại hộp tối ưu lộ trình"
        className="fixed bottom-6 right-24 z-[5001] inline-flex h-12 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-bold text-white shadow-xl transition hover:-translate-y-0.5"
      >
        <Wand2 className="h-4 w-4 text-[#FF8A7A]" /> Tối ưu lộ trình
        {changed > 0 && <span className="rounded-full bg-[#FF5645] px-1.5 text-[11px]">{changed}</span>}
      </button>
    );
  }

  return (
    <section
      role="dialog"
      aria-label="Tối ưu lộ trình"
      aria-modal="false"
      style={fw.style}
      className={`tp-ai-window fixed z-[5000] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/25 ${fw.interaction ? 'select-none' : ''}`}
    >
        {/* Thanh tiêu đề: kéo để di chuyển, nhấp đúp để phóng to */}
        <header
          onPointerDown={(event) => fw.startInteraction(event, 'move')}
          onDoubleClick={(event) => { if (!fw.isCompact && !event.target.closest('button')) fw.setIsMaximized((v) => !v); }}
          title={fw.isCompact ? undefined : 'Kéo để di chuyển · Nhấp đúp để phóng to/thu nhỏ'}
          className={`flex shrink-0 items-center justify-between gap-2 bg-slate-900 px-4 py-3 text-white ${
            fw.isCompact || fw.isMaximized ? '' : fw.interaction === 'move' ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
          <h2 className="flex min-w-0 items-center gap-2 truncate text-base font-extrabold">
            <Wand2 className="h-5 w-5 shrink-0 text-[#FF8A7A]" /> Tối ưu lộ trình
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            {!fw.isCompact && (
              <>
                {!fw.isMaximized && <GripHorizontal className="mr-1 h-4 w-4 text-white/40" aria-hidden="true" />}
                <button type="button" onClick={fw.resetWindow} title="Đưa hộp về vị trí mặc định"
                  className="rounded-full px-2 py-1 text-[11px] font-semibold text-white/70 transition hover:bg-white/15 hover:text-white">
                  Về góc
                </button>
                <button type="button" onClick={() => fw.setIsMaximized((v) => !v)}
                  aria-label={fw.isMaximized ? 'Thu nhỏ' : 'Phóng to'} title={fw.isMaximized ? 'Thu nhỏ' : 'Phóng to'}
                  className="rounded-full p-2 text-white/80 transition hover:bg-white/15 hover:text-white">
                  {fw.isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              </>
            )}
            <button type="button" onClick={() => setMinimized(true)} aria-label="Thu xuống góc"
              title="Thu xuống góc (giữ kết quả, bấm bong bóng để mở lại)"
              className="rounded-full p-2 text-white/80 transition hover:bg-white/15 hover:text-white">
              <Minus className="h-5 w-5" />
            </button>
            <button type="button" onClick={onClose} aria-label="Đóng"
              className="rounded-full p-2 text-white/80 transition hover:bg-white/15 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Mô tả + lựa chọn */}
        <div className="shrink-0 border-b border-slate-100 px-5 pb-3 pt-3">
          <p className="text-[13px] leading-5 text-slate-500">
            Xếp lại thứ tự và giờ ghé theo quãng đường, giờ mở cửa và khung giờ đẹp của từng điểm
            (săn mây lúc bình minh, cà phê chụp ảnh giờ vàng, ăn đúng bữa…), xuất phát và về lại nơi ở.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-slate-100 p-1">
              {TRANSPORTS.map(({ key, label, Icon }) => (
                <button key={key} type="button" onClick={() => setTransport(key)}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${transport === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
            <div className="flex rounded-xl bg-slate-100 p-1">
              {INTENSITIES.map(({ key, label }) => (
                <button key={key} type="button" onClick={() => setIntensity(key)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${intensity === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  {label}
                </button>
              ))}
            </div>
            {data && (
              <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200"
                title={data.googleMaps ? 'Thời gian đi đường lấy từ Google Maps' : 'Ước lượng theo đường chim bay × hệ số đường đèo, tốc độ trung bình trong phố'}>
                Thời gian đi đường: {data.googleMaps ? 'Google Maps' : 'ước lượng'}
              </span>
            )}
          </div>
        </div>

        {/* Nội dung */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-slate-500">
              <Sparkles className="h-4 w-4 animate-pulse text-[#FF5645]" /> Đang tính lộ trình tốt nhất…
            </div>
          )}
          {!loading && error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
          )}
          {!loading && !error && data && (
            <div className="space-y-5">
              {(data.moveSuggestions || []).length > 0 && (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 px-4 py-3">
                  <p className="text-sm font-bold text-indigo-800">Gợi ý chuyển ngày</p>
                  <ul className="mt-2 space-y-2">
                    {data.moveSuggestions.map((m) => (
                      <li key={m.destinationId} className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-indigo-900">
                        <span className="min-w-0">
                          <strong>{m.name}</strong>: Ngày {m.fromDayNumber} <ArrowRight className="inline h-3.5 w-3.5" /> Ngày {m.toDayNumber}.
                          <span className="text-indigo-700"> {m.reason}</span>
                        </span>
                        {canEdit && onMoveDestination && (
                          <button type="button" onClick={() => move(m)} disabled={movingId != null}
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200 transition hover:bg-indigo-100 disabled:opacity-50">
                            <CornerDownRight className="h-3.5 w-3.5" /> {movingId === m.destinationId ? 'Đang chuyển…' : `Chuyển sang Ngày ${m.toDayNumber}`}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {days.map((day) => <DayResult key={day.dayId} day={day} transport={transport} />)}
            </div>
          )}
        </div>

        {/* Chân hộp */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-600">
            <input type="checkbox" checked={fillTimes} onChange={(e) => setFillTimes(e.target.checked)} className="h-4 w-4 accent-[#FF5645]" />
            Điền giờ dự kiến cho các điểm chưa đặt giờ
          </label>
          <div className="flex items-center gap-2">
            {!canEdit && <span className="text-xs font-semibold text-slate-400">Bạn chỉ có quyền xem.</span>}
            <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100">Đóng</button>
            <button type="button" onClick={apply} disabled={!canEdit || applying || loading || applicable.length === 0}
              className="tp-btn-primary px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50">
              <CheckCircle2 className="h-4 w-4" />
              {applying ? 'Đang áp dụng…'
                : changedCount > 0 ? `Áp dụng${timesCount ? ` (+${timesCount} giờ)` : ''}`
                  : timesCount > 0 ? `Điền ${timesCount} giờ dự kiến` : 'Không có gì cần đổi'}
            </button>
          </div>
        </div>

        {/* Tay nắm đổi kích thước: góc dưới-phải và góc trên-trái (giống khung chat AI) */}
        {!fw.isCompact && !fw.isMaximized && (
          <>
            <div
              role="separator"
              aria-label="Kéo để đổi kích thước"
              onPointerDown={(event) => fw.startInteraction(event, 'resize-se')}
              className="absolute bottom-1 right-1 h-4 w-4 cursor-nwse-resize touch-none"
              style={{ background: 'linear-gradient(135deg, transparent 55%, rgba(100,116,139,.55) 55%, rgba(100,116,139,.55) 62%, transparent 62%, transparent 72%, rgba(100,116,139,.55) 72%, rgba(100,116,139,.55) 79%, transparent 79%)' }}
            />
            <div
              aria-hidden="true"
              onPointerDown={(event) => fw.startInteraction(event, 'resize-nw')}
              className="absolute left-0 top-0 h-4 w-4 cursor-nwse-resize touch-none"
            />
          </>
        )}
    </section>
  );
};

const DayResult = ({ day, transport }) => {
  const status = STATUS[day.status] || STATUS.SKIPPED;
  const mapsUrl = day.status !== 'SKIPPED' ? mapsUrlForDay(day, transport) : null;
  const savedKm = day.before && day.after ? day.before.distanceKm - day.after.distanceKm : 0;
  const savedMin = day.before && day.after ? day.before.travelMinutes - day.after.travelMinutes : 0;

  return (
    <section className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="tp-day-badge">Ngày {day.dayNumber}</span>
          {day.date && <span className="text-sm font-semibold text-slate-500">{shortDate(day.date)}</span>}
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${status.cls}`}>{status.label}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400">
          {day.sunrise && <span className="inline-flex items-center gap-1" title="Mặt trời mọc"><Sunrise className="h-3.5 w-3.5 text-amber-500" />{day.sunrise}</span>}
          {day.sunset && <span className="inline-flex items-center gap-1" title="Mặt trời lặn"><Sunset className="h-3.5 w-3.5 text-orange-500" />{day.sunset}</span>}
        </div>
      </div>

      {day.status === 'SKIPPED' ? (
        <p className="mt-3 text-sm text-slate-500">{day.message}</p>
      ) : (
        <>
          <p className="mt-2 text-sm font-semibold text-slate-700">{day.summary}</p>
          {day.before && day.after && (
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Route className="h-3.5 w-3.5" />
              {day.changed ? (
                <>
                  <span className="line-through decoration-slate-300">{km(day.before.distanceKm)} · {day.before.travelMinutes} phút</span>
                  <ArrowRight className="h-3 w-3" />
                  <span className="text-emerald-700">{km(day.after.distanceKm)} · {day.after.travelMinutes} phút</span>
                  {(savedKm >= 0.1 || savedMin >= 1) && (
                    <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                      −{km(Math.max(0, savedKm))} · −{Math.max(0, savedMin)} phút
                    </span>
                  )}
                </>
              ) : (
                <span>{km(day.after.distanceKm)} · {day.after.travelMinutes} phút di chuyển</span>
              )}
            </p>
          )}

          <ol className="mt-3 space-y-0">
            {day.start && (
              <AnchorRow icon={BedDouble} title={`Xuất phát: ${day.start.name}`} time={day.departAt} />
            )}
            {day.stops.map((s, i) => (
              <li key={s.destinationId} className="relative border-l-2 border-dashed border-slate-200 pb-3 pl-5 ml-3">
                {(i > 0 || day.start) && s.distanceKmFromPrev > 0 && (
                  <p className="mb-1 text-[11px] font-semibold text-slate-400">
                    ↓ {km(s.distanceKmFromPrev)} · {s.travelMinutesFromPrev} phút
                    {s.waitMinutes >= 10 ? ` · chờ ${s.waitMinutes} phút` : ''}
                  </p>
                )}
                <span className="absolute -left-[11px] top-5 flex h-5 w-5 items-center justify-center rounded-full bg-[#FF5645] text-[10px] font-bold text-white">{i + 1}</span>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-bold text-slate-800">{s.name}</span>
                    {day.changed && s.previousPosition && s.previousPosition !== i + 1 && (
                      <span className="text-[11px] font-semibold text-slate-400">(trước: #{s.previousPosition})</span>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-indigo-700">
                      <Clock className="h-3.5 w-3.5" /> {s.start} – {s.depart}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">{s.purposeLabel}</span>
                    {s.hours && (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200"
                        title={s.hoursEstimated ? 'Giờ mở cửa ước tính theo loại địa điểm' : 'Giờ mở cửa do đối tác khai báo'}>
                        {s.hoursEstimated ? '≈ ' : ''}{s.hours}
                      </span>
                    )}
                    {s.fixedTime && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">Giờ bạn đặt</span>}
                    {!s.fixedTime && s.suggestedTime && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Giờ gợi ý</span>}
                  </div>
                  {s.reasons.map((r) => (
                    <p key={r} className="mt-1 flex items-start gap-1 text-[12px] font-medium text-emerald-700"><Sparkles className="mt-0.5 h-3 w-3 shrink-0" />{r}</p>
                  ))}
                  {s.warnings.map((w) => (
                    <p key={w} className="mt-1 flex items-start gap-1 text-[12px] font-semibold text-amber-700"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />{w}</p>
                  ))}
                </div>
              </li>
            ))}
            {day.end && (
              <AnchorRow icon={BedDouble} title={`Về: ${day.end.name}`} time={day.returnAt} last />
            )}
          </ol>

          {(day.unplaced || []).length > 0 && (
            <p className="mt-2 text-xs font-semibold text-amber-700">
              Giữ ở cuối ngày (chưa có vị trí): {day.unplaced.map((u) => u.name).join(', ')}
            </p>
          )}
          {(day.warnings || []).map((w) => (
            <p key={w} className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-amber-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}</p>
          ))}
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-[#FF5645] hover:text-[#FF5645]">
              <MapIcon className="h-3.5 w-3.5" /> Xem đường đi trên Google Maps
            </a>
          )}
        </>
      )}
    </section>
  );
};

const AnchorRow = ({ icon: Icon, title, time, last = false }) => (
  <li className={`relative ml-3 pl-5 ${last ? '' : 'border-l-2 border-dashed border-slate-200 pb-3'}`}>
    <span className="absolute -left-[11px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-white">
      <Icon className="h-3 w-3" />
    </span>
    <p className="flex items-center gap-2 text-[13px] font-bold text-indigo-700">
      {title}{time && <span className="text-xs font-semibold text-indigo-500">{time}</span>}
    </p>
  </li>
);

export default OptimizeItineraryDialog;
