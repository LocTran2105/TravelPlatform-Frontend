import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMap } from 'react-leaflet';
import axios from 'axios';
import { MapPin, Utensils, Coffee, Bed, Landmark, Car, Ticket, ImageOff } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8080';
const COVER_CHUNK_SIZE = 100; // khớp MAX_PLACE_IDS của PlaceCoverService

// Kích thước cố định để card không bị lệch vị trí khi ảnh tải xong
const CARD_W = 224;
const CARD_H = 272;
const CARD_GAP = 20;  // khoảng cách từ marker tới card
const CARD_PAD = 12;  // lề tối thiểu với mép bản đồ

/** Place ID hợp lệ của một điểm trong lịch trình (null nếu là địa điểm tự nhập, chưa liên kết bảng places). */
export const getDestPlaceId = (dest) => {
  const n = Number(dest?.placeId ?? dest?.place?.id ?? null);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/**
 * Lấy ảnh cover của mọi Place trong chuyến đi bằng đúng 1 request (chia chunk nếu > 100 ID).
 * Backend chỉ trả ảnh Partner đã được Admin duyệt; Place không có ảnh sẽ không có key trong kết quả.
 * Trả về { covers: { [placeId]: url } }.
 */
export function usePlaceCovers(trip) {
  const [covers, setCovers] = useState({});
  const requestedRef = useRef(new Set());
  // Chỉ chặn setState khi component thật sự unmount. Không huỷ theo từng lần đổi idsKey:
  // ID đã đánh dấu "đã gửi" thì kết quả của nó phải được ghi lại, kể cả khi effect chạy lại
  // (React StrictMode chạy effect 2 lần ở dev; thêm địa điểm trong lúc request đang chạy).
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const ids = [...new Set((trip?.tripDays || [])
    .flatMap((day) => (day.destinations || []).map(getDestPlaceId))
    .filter((id) => id != null))];
  const idsKey = ids.join(',');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !idsKey) return undefined;

    const pending = idsKey.split(',').filter((id) => !requestedRef.current.has(id));
    if (pending.length === 0) return undefined;
    pending.forEach((id) => requestedRef.current.add(id));

    (async () => {
      for (let i = 0; i < pending.length; i += COVER_CHUNK_SIZE) {
        const chunk = pending.slice(i, i + COVER_CHUNK_SIZE);
        try {
          const { data } = await axios.get(`${API_BASE_URL}/api/v1/places/covers`, {
            params: { placeIds: chunk.join(',') },
            headers: { Authorization: `Bearer ${token}` },
          });
          if (aliveRef.current && data && typeof data === 'object') {
            setCovers((previous) => ({ ...previous, ...data }));
          }
        } catch (error) {
          // Cho phép thử lại ở lần đổi lịch trình tiếp theo.
          chunk.forEach((id) => requestedRef.current.delete(id));
          console.warn('Không tải được ảnh đại diện địa điểm:', error);
        }
      }
    })();
    return undefined;
  }, [idsKey]);

  return { covers };
}

const TYPE_META = {
  CAFE: { label: 'Quán cà phê', Icon: Coffee },
  RESTAURANT: { label: 'Nhà hàng · Quán ăn', Icon: Utensils },
  ACCOMMODATION: { label: 'Chỗ ở', Icon: Bed },
  ATTRACTION: { label: 'Tham quan', Icon: Landmark },
  TRANSPORT: { label: 'Di chuyển', Icon: Car },
  ACTIVITY: { label: 'Hoạt động', Icon: Ticket },
};

const getTypeMeta = (dest) => {
  const key = String(dest?.itemType || dest?.place?.placeType || '').toUpperCase();
  return TYPE_META[key] || { label: null, Icon: MapPin };
};

const getSourceLabel = (dest) => {
  const provider = String(dest?.place?.provider || '').toUpperCase();
  if (provider === 'PARTNER') return 'Đối tác đã xác minh';
  if (provider === 'OSM') return 'OpenStreetMap';
  return null;
};

/** Card xem nhanh: ảnh cover + tên địa điểm (không bịa ảnh khi chưa có dữ liệu). */
export function PlaceHoverCard({ dest, number, color, coverUrl }) {
  // Ghi nhớ URL bị lỗi thay vì cờ boolean: đổi sang ảnh khác thì tự thử lại, không cần effect reset.
  const [failedUrl, setFailedUrl] = useState(null);

  const { label: typeLabel, Icon } = getTypeMeta(dest);
  const sourceLabel = getSourceLabel(dest);
  const address = dest?.place?.address || null;
  const showImage = Boolean(coverUrl) && failedUrl !== coverUrl;

  return (
    <div
      className="relative overflow-hidden bg-slate-900 text-white shadow-2xl shadow-slate-900/40 ring-1 ring-black/10"
      style={{ width: CARD_W, height: CARD_H, borderRadius: 28 }}
    >
      {showImage ? (
        <img
          src={coverUrl}
          alt={dest?.placeName || 'Địa điểm'}
          referrerPolicy="no-referrer"
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailedUrl(coverUrl)}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-600 via-slate-700 to-slate-900 text-white/30">
          <Icon className="h-14 w-14" strokeWidth={1.5} />
          <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider">
            <ImageOff className="h-3 w-3" /> Chưa có ảnh
          </span>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/25" />

      <div className="absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
        {sourceLabel ? (
          <span className="inline-flex max-w-[150px] items-center gap-1.5 truncate rounded-full bg-black/45 py-1 pl-1 pr-2.5 text-[11px] font-bold backdrop-blur">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[10px]">
              {sourceLabel.charAt(0)}
            </span>
            <span className="truncate">{sourceLabel}</span>
          </span>
        ) : <span />}
        <span
          className="flex h-6 min-w-[24px] items-center justify-center rounded-full px-1.5 text-xs font-extrabold text-white shadow ring-2 ring-white"
          style={{ backgroundColor: color || '#FF5645' }}
        >
          {number}
        </span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4">
        {typeLabel && (
          <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/75">
            <Icon className="h-3 w-3" /> {typeLabel}
          </p>
        )}
        <h4 className="line-clamp-3 text-[17px] font-extrabold leading-snug">{dest?.placeName}</h4>
        {address && <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/70">{address}</p>}
      </div>
    </div>
  );
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Đặt BÊN TRONG <MapContainer>. Hiện card cạnh marker của `stop` (hover từ marker hoặc từ danh sách).
 * Vị trí được kẹp trong khung bản đồ nên không bao giờ bị cắt; pointer-events: none để không chặn chuột.
 */
export function MapHoverPreview({ stop, coverUrl }) {
  const map = useMap();
  // Chỉ dùng để render lại khi bản đồ di chuyển/zoom; vị trí được tính trực tiếp lúc render.
  const [, setViewVersion] = useState(0);

  useEffect(() => {
    if (!stop) return undefined;
    const onViewChange = () => setViewVersion((version) => version + 1);
    map.on('move zoom resize', onViewChange);
    return () => { map.off('move zoom resize', onViewChange); };
  }, [stop, map]);

  let position = null;
  if (stop) {
    const size = map.getSize();
    const point = map.latLngToContainerPoint([stop.lat, stop.lng]);
    const inside = point.x >= 0 && point.y >= 0 && point.x <= size.x && point.y <= size.y;
    if (inside) {
      // Marker ở nửa trái bản đồ -> card bên phải marker, và ngược lại.
      const placeRight = point.x < size.x / 2;
      const rawX = placeRight ? point.x + CARD_GAP : point.x - CARD_GAP - CARD_W;
      const rawY = point.y - CARD_H / 2;
      position = {
        x: clamp(rawX, CARD_PAD, Math.max(CARD_PAD, size.x - CARD_W - CARD_PAD)),
        y: clamp(rawY, CARD_PAD, Math.max(CARD_PAD, size.y - CARD_H - CARD_PAD)),
      };
    }
  }

  if (!stop || !position) return null;

  return createPortal(
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 1100,
        pointerEvents: 'none',
        animation: 'place-hover-in 140ms ease-out',
      }}
    >
      <style>{`@keyframes place-hover-in { from { opacity: 0; transform: translateY(6px) scale(.97); } to { opacity: 1; transform: none; } }`}</style>
      <PlaceHoverCard dest={stop.dest} number={stop.number} color={stop.color} coverUrl={coverUrl} />
    </div>,
    map.getContainer()
  );
}
