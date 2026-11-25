import { useEffect, useRef, useState } from 'react';
import { TileLayer, useMap } from 'react-leaflet';

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Các nguồn nền bản đồ đều dùng dữ liệu OpenStreetMap, nhưng do các máy chủ (host) khác nhau phục vụ.
 * Mạng chặn host này thì vẫn còn host khác. Không dùng tile Google vì không có giấy phép dùng trực tiếp.
 * Có thể ép một nguồn riêng bằng biến môi trường VITE_MAP_TILE_URL (+ VITE_MAP_TILE_ATTRIBUTION).
 */
const DEFAULT_PROVIDERS = [
  {
    id: 'osm',
    label: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  },
  {
    id: 'carto-voyager',
    label: 'CARTO (dữ liệu OSM)',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`,
    subdomains: 'abcd',
    maxZoom: 20,
  },
  {
    id: 'osm-fr-hot',
    label: 'OSM France (HOT)',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: `${OSM_ATTRIBUTION}, tiles: Humanitarian OSM Team, hosted by OpenStreetMap France`,
    subdomains: 'abc',
    maxZoom: 19,
  },
];

const envUrl = import.meta.env?.VITE_MAP_TILE_URL;
const PROVIDERS = envUrl
  ? [{
    id: 'custom',
    label: 'Tùy chỉnh',
    url: envUrl,
    attribution: import.meta.env?.VITE_MAP_TILE_ATTRIBUTION || OSM_ATTRIBUTION,
    maxZoom: 19,
  }, ...DEFAULT_PROVIDERS]
  : DEFAULT_PROVIDERS;

const STORAGE_KEY = 'travel.mapTileProvider';
const ERRORS_BEFORE_SWITCH = 4;   // số tile lỗi liên tiếp khi CHƯA có tile nào tải được
const FIRST_TILE_TIMEOUT_MS = 7000; // mạng "nuốt" request (treo, không trả lỗi) -> sau 7s vẫn chưa có tile nào

const readSavedIndex = () => {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    const index = PROVIDERS.findIndex((provider) => provider.id === saved);
    return index >= 0 ? index : 0;
  } catch {
    return 0;
  }
};

/**
 * TileLayer tự chuyển sang nguồn kế tiếp khi nguồn hiện tại không tải được tile nào.
 * Nguồn chạy được được nhớ trong phiên (sessionStorage) để lần mở trang sau không phải chờ lại.
 * Đặt bên trong <MapContainer>.
 */
export default function ResilientTileLayer() {
  const map = useMap();
  const [index, setIndex] = useState(readSavedIndex);
  const statsRef = useRef({ loaded: 0, errors: 0 });
  const [allFailed, setAllFailed] = useState(false);
  const provider = PROVIDERS[index];
  const exhausted = index >= PROVIDERS.length - 1;

  const switchToNext = (reason) => {
    setIndex((current) => {
      if (current >= PROVIDERS.length - 1) return current;
      console.warn(`[Map] Nền bản đồ "${PROVIDERS[current].label}" không tải được (${reason}); chuyển sang "${PROVIDERS[current + 1].label}".`);
      return current + 1;
    });
  };

  // Mỗi lần đổi nguồn: reset thống kê và đặt hạn chờ tile đầu tiên.
  useEffect(() => {
    statsRef.current = { loaded: 0, errors: 0 };
    if (exhausted) return undefined;

    let timer = 0;
    const arm = () => {
      timer = window.setTimeout(() => {
        const size = map.getSize();
        // Bản đồ đang bị ẩn (tab khác, màn hình nhỏ) thì không có tile nào được yêu cầu: chờ tiếp.
        if (size.x === 0 || size.y === 0) { arm(); return; }
        if (statsRef.current.loaded === 0) switchToNext('quá thời gian chờ');
      }, FIRST_TILE_TIMEOUT_MS);
    };
    arm();
    return () => window.clearTimeout(timer);
  }, [index, map, exhausted]);

  return (
    <>
      <TileLayer
        key={provider.id}
        url={provider.url}
        attribution={provider.attribution}
        subdomains={provider.subdomains || 'abc'}
        maxZoom={provider.maxZoom || 19}
        // Một số máy chủ tile (OSM) từ chối request không có Referer; giữ Referer kể cả khi trang đặt no-referrer.
        referrerPolicy="strict-origin-when-cross-origin"
        eventHandlers={{
          tileload: () => {
            statsRef.current.loaded += 1;
            if (statsRef.current.loaded === 1) {
              setAllFailed(false);
              try { sessionStorage.setItem(STORAGE_KEY, provider.id); } catch { /* storage có thể bị chặn */ }
            }
          },
          tileerror: (event) => {
            statsRef.current.errors += 1;
            if (statsRef.current.errors === 1) {
              console.warn('[Map] Lỗi tải tile:', event?.tile?.src);
            }
            if (statsRef.current.loaded === 0 && statsRef.current.errors >= ERRORS_BEFORE_SWITCH) {
              if (exhausted) setAllFailed(true);
              else switchToNext(`${statsRef.current.errors} tile lỗi`);
            }
          },
        }}
      />
      {allFailed && (
        <div className="leaflet-top leaflet-left" style={{ left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
          <div className="leaflet-control" style={{ marginTop: 12, padding: '6px 12px', borderRadius: 10, background: '#fff7ed', border: '1px solid #fdba74', fontSize: 12, color: '#9a3412', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
            Không tải được nền bản đồ từ mọi nguồn. Mạng hiện tại có thể đang chặn máy chủ bản đồ.
          </div>
        </div>
      )}
      {index > 0 && !allFailed && (
        <div className="leaflet-bottom leaflet-left" style={{ pointerEvents: 'none' }}>
          <div className="leaflet-control" style={{ margin: '0 0 6px 8px', padding: '2px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.9)', fontSize: 11, color: '#475569', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
            Bản đồ dự phòng: {provider.label}
          </div>
        </div>
      )}
    </>
  );
}