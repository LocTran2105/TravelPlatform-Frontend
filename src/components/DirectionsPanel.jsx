import { useMemo, useState } from 'react';
import {
  CURRENT_LOCATION, MAX_WAYPOINTS_MOBILE, buildGoogleMapsUrl, haversineKm, isMobileBrowser, MAX_WAYPOINTS,
} from '../utils/directions';
import {
  ArrowUpDown, Bike, Bus, Car, Copy, ExternalLink, Footprints, LocateFixed, MapPin, Navigation, Plus, X,
} from 'lucide-react';

/**
 * Chỉ đường: chọn điểm đi, điểm đến (và điểm dừng nếu muốn) trong lịch trình rồi mở Google Maps.
 * Dùng "Maps URLs" của Google: không cần API key, không tốn phí; Google Maps (web hoặc app) tự tính đường.
 * https://developers.google.com/maps/documentation/urls/get-started
 */

const TRAVEL_MODES = [
  { key: 'two-wheeler', label: 'Xe máy', Icon: Bike },
  { key: 'driving', label: 'Ô tô', Icon: Car },
  { key: 'walking', label: 'Đi bộ', Icon: Footprints },
  { key: 'transit', label: 'Xe buýt', Icon: Bus },
];

function StopSelect({ label, value, onChange, stops, allowCurrent, excludeIds = [] }) {
  const byDay = useMemo(() => {
    const groups = new Map();
    stops.forEach((stop) => {
      if (excludeIds.includes(stop.id)) return;
      const key = stop.dayNumber;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(stop);
    });
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [stops, excludeIds]);

  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === CURRENT_LOCATION
          ? CURRENT_LOCATION
          : event.target.value === '' ? null : Number(event.target.value))}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-slate-400"
      >
        <option value="">— Chọn địa điểm —</option>
        {allowCurrent && <option value={CURRENT_LOCATION}>📍 Vị trí hiện tại của tôi</option>}
        {byDay.map(([dayNumber, items]) => (
          <optgroup key={dayNumber} label={`Ngày ${dayNumber}`}>
            {items.map((stop) => (
              <option key={stop.id} value={stop.id}>{stop.number}. {stop.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/**
 * Bảng chỉ đường nổi trên bản đồ.
 * stops: [{ id, name, lat, lng, dayNumber, number }] - mọi địa điểm có tọa độ của chuyến đi.
 * value: { originId, destinationId, waypointIds, mode }; onChange(nextValue); onClose().
 */
export default function DirectionsPanel({ stops, value, onChange, onClose }) {
  const [copied, setCopied] = useState(false);
  const stopById = useMemo(() => new Map(stops.map((s) => [s.id, s])), [stops]);

  const origin = value.originId === CURRENT_LOCATION ? null : stopById.get(value.originId) || null;
  const destination = stopById.get(value.destinationId) || null;
  const waypoints = (value.waypointIds || []).map((id) => stopById.get(id)).filter(Boolean);
  const originReady = value.originId === CURRENT_LOCATION || origin != null;
  const ready = originReady && destination != null
    && !(origin && destination && origin.id === destination.id && waypoints.length === 0);

  const mobile = isMobileBrowser();
  const waypointLimit = mobile ? MAX_WAYPOINTS_MOBILE : MAX_WAYPOINTS;
  const usedIds = [value.originId, value.destinationId, ...(value.waypointIds || [])];

  // Ước lượng đường chim bay để người dùng hình dung trước khi mở Google Maps.
  const straightKm = (() => {
    if (!destination) return null;
    const points = [origin, ...waypoints, destination].filter(Boolean);
    if (points.length < 2) return null;
    let total = 0;
    for (let i = 1; i < points.length; i += 1) total += haversineKm(points[i - 1], points[i]);
    return total;
  })();

  const url = ready
    ? buildGoogleMapsUrl({ origin, destination, waypoints: waypoints.slice(0, waypointLimit), mode: value.mode })
    : null;

  const update = (patch) => { setCopied(false); onChange({ ...value, ...patch }); };

  const swap = () => {
    if (value.originId === CURRENT_LOCATION) return; // không thể đặt "vị trí của tôi" làm điểm đến
    update({
      originId: value.destinationId,
      destinationId: value.originId,
      waypointIds: [...(value.waypointIds || [])].reverse(),
    });
  };

  const copyLink = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt('Sao chép đường dẫn:', url);
    }
  };

  return (
    <div className="absolute left-3 top-16 z-[1000] w-[340px] max-w-[calc(100%-24px)] rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/5">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
          <Navigation className="h-4 w-4 text-[#FF5645]" /> Chỉ đường
        </p>
        <button type="button" onClick={onClose} aria-label="Đóng chỉ đường"
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative space-y-2">
        <StopSelect label="Điểm đi" value={value.originId} stops={stops} allowCurrent
          onChange={(originId) => update({ originId })} />

        {waypoints.map((stop, index) => (
          <div key={stop.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1 truncate">Dừng {index + 1}: {stop.name}</span>
            <button type="button" aria-label={`Bỏ điểm dừng ${stop.name}`}
              onClick={() => update({ waypointIds: value.waypointIds.filter((id) => id !== stop.id) })}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {waypoints.length < waypointLimit && (
          <select
            value=""
            onChange={(event) => {
              const id = Number(event.target.value);
              if (id) update({ waypointIds: [...(value.waypointIds || []), id] });
            }}
            className="w-full rounded-xl border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 outline-none"
          >
            <option value="">+ Thêm điểm dừng (không bắt buộc)</option>
            {stops.filter((s) => !usedIds.includes(s.id)).map((stop) => (
              <option key={stop.id} value={stop.id}>Ngày {stop.dayNumber} · {stop.number}. {stop.name}</option>
            ))}
          </select>
        )}

        <StopSelect label="Điểm đến" value={value.destinationId} stops={stops}
          onChange={(destinationId) => update({ destinationId })} />

        <button type="button" onClick={swap} disabled={value.originId === CURRENT_LOCATION}
          title="Đảo điểm đi và điểm đến"
          className="absolute right-2 top-[30px] rounded-full bg-white p-1.5 text-slate-500 shadow ring-1 ring-slate-200 hover:text-slate-900 disabled:opacity-30">
          <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {TRAVEL_MODES.map(({ key, label, Icon }) => (
          <button key={key} type="button" onClick={() => update({ mode: key })}
            className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-bold transition ${value.mode === key ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {value.originId === CURRENT_LOCATION && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-slate-500">
          <LocateFixed className="mt-0.5 h-3 w-3 shrink-0" />
          Google Maps sẽ dùng vị trí hiện tại của thiết bị (cần cho phép truy cập vị trí) và vào thẳng chế độ dẫn đường.
        </p>
      )}
      {mobile && (value.waypointIds || []).length > MAX_WAYPOINTS_MOBILE && (
        <p className="mt-2 text-[11px] text-amber-700">
          Trình duyệt trên điện thoại chỉ nhận tối đa {MAX_WAYPOINTS_MOBILE} điểm dừng; các điểm sau sẽ bị bỏ qua.
        </p>
      )}
      {straightKm != null && (
        <p className="mt-2 text-[11px] text-slate-500">
          Khoảng cách đường chim bay ≈ {straightKm.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km.
          Quãng đường và thời gian thực tế xem trên Google Maps.
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <a
          href={url || undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!ready}
          onClick={(event) => { if (!ready) event.preventDefault(); }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold text-white transition ${ready ? 'bg-[#FF5645] hover:bg-[#E04B3B]' : 'cursor-not-allowed bg-slate-300'}`}
        >
          <ExternalLink className="h-4 w-4" /> Mở Google Maps
        </a>
        <button type="button" onClick={copyLink} disabled={!ready} title="Sao chép đường dẫn để gửi cho bạn đồng hành"
          className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
          <Copy className="h-3.5 w-3.5" /> {copied ? 'Đã chép' : 'Chép link'}
        </button>
      </div>
      {!ready && (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
          <Plus className="h-3 w-3" /> Chọn điểm đi và điểm đến (có thể bấm “Từ đây / Đến đây” trên thẻ địa điểm của bản đồ).
        </p>
      )}
    </div>
  );
}