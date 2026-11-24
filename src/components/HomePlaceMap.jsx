import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Search, MapPin, Loader2, ExternalLink } from 'lucide-react';

// Cùng nguồn với bản đồ ở trang chi tiết chuyến đi: tìm địa điểm bằng Photon (OpenStreetMap) ngay trên trình duyệt.
const PHOTON_URL = 'https://photon.komoot.io/api/';
const TILE_URL = 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';
const MARKER_COLOR = '#FF5645';
const RESULT_LIMIT = 8;
// Thiên về kết quả ở Việt Nam nhưng vẫn tìm được nơi khác
const BIAS = { lat: '16.047079', lon: '108.20623' };
const OSM_TYPES = { N: 'node', W: 'way', R: 'relation' };

const iconCache = new Map();
const markerIcon = (number, active) => {
  const key = `${number}|${active}`;
  if (!iconCache.has(key)) {
    const size = active ? 38 : 28;
    iconCache.set(key, L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background:${MARKER_COLOR};color:#fff;width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${active ? 15 : 12}px;border:${active ? 3 : 2}px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)">${number}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    }));
  }
  return iconCache.get(key);
};

// Tự co giãn bản đồ vừa các địa điểm tìm được
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) { map.setView(points[0], 15); return; }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
  }, [points, map]);
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target.point, Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [target, map]);
  return null;
}

const toCoord = (v) => (v === null || v === undefined || String(v).trim() === '' ? NaN : Number(v));

// Photon (GeoJSON) -> danh sách địa điểm; bỏ mục không có tên hoặc tọa độ, bỏ trùng
const parseFeatures = (data) => {
  const seen = new Set();
  const out = [];
  (Array.isArray(data?.features) ? data.features : []).forEach((f, i) => {
    const p = f?.properties || {};
    const coords = f?.geometry?.coordinates;
    const lng = Array.isArray(coords) ? toCoord(coords[0]) : NaN;
    const lat = Array.isArray(coords) ? toCoord(coords[1]) : NaN;
    const name = p.name || p.street || p.city;
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
    const key = p.osm_id != null ? `${p.osm_type || '?'}${p.osm_id}` : `${i}-${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    const address = [...new Set([p.street, p.district, p.city, p.state, p.country].filter((x) => x && x !== name))].join(', ');
    const osmType = OSM_TYPES[p.osm_type];
    out.push({
      key, name, address, lat, lng,
      sourceUrl: osmType && p.osm_id != null ? `https://www.openstreetmap.org/${osmType}/${p.osm_id}` : null,
    });
  });
  return out;
};

/**
 * Bản đồ tra cứu địa điểm ở Trang chủ: một ô tìm kiếm + nút tìm; kết quả hiện thành các điểm trên bản đồ
 * và danh sách gợi ý (giống ô tìm địa điểm ở trang chi tiết chuyến đi).
 */
export default function HomePlaceMap() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [places, setPlaces] = useState([]);
  const [error, setError] = useState('');
  const [searchedFor, setSearchedFor] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const abortRef = useRef(null);
  const markerRefs = useRef({});
  const flyCount = useRef(0);
  const searchBoxRef = useRef(null);

  // Hủy yêu cầu đang chạy khi rời trang
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Đóng danh sách khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!listOpen) return undefined;
    const onDown = (ev) => { if (searchBoxRef.current && !searchBoxRef.current.contains(ev.target)) setListOpen(false); };
    const onKey = (ev) => { if (ev.key === 'Escape') setListOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [listOpen]);

  const focusPlace = (p) => {
    setSelectedKey(p.key);
    setFlyTarget({ point: [p.lat, p.lng], n: ++flyCount.current });
    // Mở popup của điểm sau khi bản đồ bay tới
    setTimeout(() => markerRefs.current[p.key]?.openPopup(), 650);
  };

  const search = async (raw) => {
    const q = String(raw ?? '').trim();
    if (q.length < 2) { setError('Hãy nhập ít nhất 2 ký tự, ví dụ: Hồ Xuân Hương.'); setStatus('error'); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    markerRefs.current = {};
    setStatus('loading'); setError(''); setSelectedKey(null); setFlyTarget(null); setSearchedFor(q);
    try {
      // Photon công khai không hỗ trợ lang=vi nên không truyền lang (tránh HTTP 400)
      const params = new URLSearchParams({ q, limit: String(RESULT_LIMIT), lat: BIAS.lat, lon: BIAS.lon });
      const res = await fetch(`${PHOTON_URL}?${params.toString()}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);
      const list = parseFeatures(await res.json());
      setPlaces(list);
      setStatus('done');
      setListOpen(list.length > 1);
      if (list.length === 1) focusPlace(list[0]);
    } catch (e) {
      if (e?.name === 'AbortError') return; // bị hủy do tìm kiếm mới hơn
      setPlaces([]); setListOpen(false); setStatus('error');
      setError('Không tìm được địa điểm lúc này. Vui lòng thử lại sau ít phút.');
    }
  };

  const onSubmit = (ev) => { ev.preventDefault(); search(query); };
  const points = useMemo(() => places.map((p) => [p.lat, p.lng]), [places]);

  return (
    <section id="home-map" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-1">
        <h2 className="text-2xl font-extrabold text-slate-900">Tra cứu địa điểm</h2>
        <p className="text-sm text-slate-500">Tìm một địa điểm, quán ăn hay khách sạn để xem vị trí trên bản đồ.</p>
      </div>

      <div ref={searchBoxRef} className="relative mb-4">
        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              maxLength={100}
              onChange={(ev) => setQuery(ev.target.value)}
              onFocus={() => { if (places.length > 1) setListOpen(true); }}
              onClick={() => { if (places.length > 1) setListOpen(true); }}
              placeholder="Tìm địa điểm, ví dụ: Hồ Xuân Hương, Đà Lạt"
              aria-label="Tìm địa điểm"
              className="w-full rounded-full border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-medium outline-none transition focus:border-[#FF5645] focus:ring-2 focus:ring-[#FF5645]/20"
            />
          </div>
          <button
            type="submit"
            disabled={status === 'loading'}
            className="flex items-center justify-center gap-2 rounded-full bg-[#FF5645] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#E04B3B] disabled:opacity-70"
          >
            {status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Tìm kiếm
          </button>
        </form>

        {listOpen && places.length > 1 && (
          <ul role="listbox" aria-label="Kết quả tìm kiếm" className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl sm:right-auto sm:w-[28rem]">
            {places.map((p, i) => (
              <li key={p.key} role="option" aria-selected={selectedKey === p.key}>
                <button
                  type="button"
                  onClick={() => { focusPlace(p); setListOpen(false); }}
                  className="flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-orange-50"
                >
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#FF5645] text-xs font-bold text-white">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-800">{p.name}</span>
                    {p.address && <span className="block truncate text-xs text-slate-500">{p.address}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mb-3 min-h-5 text-sm" aria-live="polite">
        {status === 'loading' && <span className="text-slate-500">Đang tìm “{searchedFor}”...</span>}
        {status === 'error' && <span role="alert" className="font-medium text-red-600">{error}</span>}
        {status === 'done' && places.length === 0 && (
          <span className="text-slate-500">Không tìm thấy địa điểm phù hợp với “{searchedFor}”. Hãy thử từ khóa khác.</span>
        )}
        {status === 'done' && places.length > 0 && (
          <span className="text-slate-500">Tìm thấy {places.length} địa điểm cho “{searchedFor}”. Bấm vào điểm trên bản đồ để xem chi tiết.</span>
        )}
      </p>

      <div className="relative z-0 h-[26rem] overflow-hidden rounded-2xl border border-slate-200 lg:h-[34rem]">
        <MapContainer center={[16.047079, 108.20623]} zoom={5} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer url={TILE_URL} attribution="&copy; Google Maps" />
          <FitBounds points={points} />
          <FlyTo target={flyTarget} />
          {places.map((p, i) => (
            <Marker
              key={p.key}
              position={[p.lat, p.lng]}
              icon={markerIcon(i + 1, selectedKey === p.key)}
              ref={(m) => { if (m) markerRefs.current[p.key] = m; else delete markerRefs.current[p.key]; }}
              eventHandlers={{ click: () => setSelectedKey(p.key) }}
            >
              <Popup>
                <div className="min-w-[10rem] max-w-[15rem]">
                  <p className="flex items-start gap-1 text-sm font-bold text-slate-900"><MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#FF5645]" />{p.name}</p>
                  {p.address && <p className="mt-0.5 text-xs text-slate-500">{p.address}</p>}
                  {p.sourceUrl && (
                    <a
                      href={p.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-[#FF5645] hover:underline"
                    >
                      Xem trên OpenStreetMap <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <p className="mt-2 text-xs text-slate-400">Dữ liệu địa điểm: Photon / © OpenStreetMap contributors.</p>
    </section>
  );
}
