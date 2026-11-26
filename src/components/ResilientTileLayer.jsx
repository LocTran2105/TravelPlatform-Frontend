import { useEffect, useRef, useState } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const ESRI_ATTRIBUTION = 'Ảnh vệ tinh &copy; Esri, Maxar, Earthstar Geographics, GIS User Community';

/**
 * LƯU Ý BẢN QUYỀN NỀN BẢN ĐỒ (đồ án/demo):
 * - OpenStreetMap không có ảnh vệ tinh riêng. Lớp vệ tinh trên openstreetmap.org/edit là ảnh Bing
 *   chỉ được cấp phép để VẼ BẢN ĐỒ OSM, không được dùng làm nền cho ứng dụng khác -> không dùng ở đây.
 * - Google (lyrs=m / lyrs=y) gọi thẳng không qua Maps API là ngoài điều khoản của Google: chỉ hợp demo.
 * - Esri World Imagery dùng được cho mục đích phi thương mại/phát triển khi ghi nguồn đầy đủ.
 * Khi triển khai thật: dùng preset 'osm' + vệ tinh Esri, hoặc cấu hình VITE_MAP_TILE_URL.
 */
const GOOGLE_ROADMAP = {
  id: 'google',
  label: 'Google Maps',
  url: 'https://mt{s}.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}',
  attribution: '&copy; Google Maps',
  subdomains: '0123',
  maxZoom: 20,
};

const OSM_PROVIDERS = [
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

// Vệ tinh: ảnh + nhãn đường/địa danh (chỉ ảnh trơn thì rất khó đọc tên đường).
const SATELLITE_PROVIDERS = [
  {
    id: 'google-hybrid',
    label: 'Vệ tinh Google',
    url: 'https://mt{s}.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}', // y = ảnh vệ tinh + nhãn
    attribution: '&copy; Google Maps',
    subdomains: '0123',
    maxZoom: 20,
  },
  {
    id: 'esri-imagery',
    label: 'Vệ tinh Esri',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: ESRI_ATTRIBUTION,
    maxZoom: 20,
    maxNativeZoom: 18, // nhiều vùng ở Việt Nam chỉ có ảnh tới ~z18, phóng to hơn thì kéo giãn ảnh z18
    overlays: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    ],
  },
];

const envUrl = import.meta.env?.VITE_MAP_TILE_URL;
const CUSTOM_PROVIDERS = envUrl
  ? [{
    id: 'custom',
    label: 'Tùy chỉnh',
    url: envUrl,
    attribution: import.meta.env?.VITE_MAP_TILE_ATTRIBUTION || OSM_ATTRIBUTION,
    maxZoom: 19,
  }]
  : [];

// Nền "bản đồ" theo preset; các nguồn OSM luôn đứng sau làm dự phòng khi mạng chặn.
const ROADMAP_PRESETS = {
  google: [...CUSTOM_PROVIDERS, GOOGLE_ROADMAP, ...OSM_PROVIDERS],
  osm: [...CUSTOM_PROVIDERS, ...OSM_PROVIDERS],
};

// Vệ tinh lỗi hết thì vẫn còn nền bản đồ để không bị xám.
const providersFor = (mode, preset) => {
  const roadmap = ROADMAP_PRESETS[preset] || ROADMAP_PRESETS.osm;
  return mode === 'satellite' ? [...SATELLITE_PROVIDERS, ...roadmap] : roadmap;
};

// Lựa chọn Vệ tinh/Bản đồ dùng chung cho MỌI bản đồ của app và nhớ qua các lần mở (localStorage).
const MODE_KEY = 'travel.mapBaseMode';
const MODE_EVENT = 'travel-map-base-mode';
const DEFAULT_MODE = 'satellite';

const readMode = () => {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    return saved === 'map' || saved === 'satellite' ? saved : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
};

const saveMode = (mode) => {
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* storage có thể bị chặn */ }
  window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: mode }));
};

// Nguồn tile chạy được trong phiên, theo từng (chế độ + preset), để lần mở sau không phải chờ lại.
const storageKeyOf = (mode, preset) => `travel.mapTileProvider.v3.${mode}.${preset}`;

const readSavedIndex = (providers, key) => {
  try {
    const saved = sessionStorage.getItem(key);
    const index = providers.findIndex((provider) => provider.id === saved);
    return index >= 0 ? index : 0;
  } catch {
    return 0;
  }
};

const ERRORS_BEFORE_SWITCH = 4;    // số tile lỗi liên tiếp khi CHƯA có tile nào tải được
const FIRST_TILE_TIMEOUT_MS = 7000; // mạng "nuốt" request (treo, không trả lỗi) -> sau 7s vẫn chưa có tile nào

// Nút chuyển Vệ tinh / Bản đồ ở góc trên phải bản đồ.
function BaseModeToggle({ mode, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    // Không để click/cuộn trên nút lọt xuống bản đồ (vd. bản đồ Admin đang ở chế độ nhấn để đặt ghim).
    if (ref.current) {
      L.DomEvent.disableClickPropagation(ref.current);
      L.DomEvent.disableScrollPropagation(ref.current);
    }
  }, []);

  const button = (value, label) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={mode === value}
      style={{
        border: 0,
        padding: '6px 10px',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        background: mode === value ? '#0f172a' : '#fff',
        color: mode === value ? '#fff' : '#334155',
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="leaflet-top leaflet-right">
      <div
        ref={ref}
        className="leaflet-control"
        style={{ display: 'flex', overflow: 'hidden', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
      >
        {button('satellite', 'Vệ tinh')}
        {button('map', 'Bản đồ')}
      </div>
    </div>
  );
}

/**
 * Nền bản đồ dùng chung, đặt bên trong <MapContainer>.
 *   <ResilientTileLayer />                    -> mặc định Vệ tinh; chế độ Bản đồ dùng OSM
 *   <ResilientTileLayer preset="google" />    -> chế độ Bản đồ dùng nền Google (giống trang Home)
 *   <ResilientTileLayer showToggle={false} /> -> ẩn nút Vệ tinh/Bản đồ
 * Nguồn hiện tại không tải được tile nào thì tự chuyển sang nguồn kế tiếp.
 */
export default function ResilientTileLayer({ preset = 'osm', showToggle = true }) {
  const [mode, setMode] = useState(readMode);

  // Đổi chế độ ở một bản đồ thì các bản đồ khác đang mở cũng đổi theo.
  useEffect(() => {
    const onModeChange = (event) => setMode(event.detail === 'map' ? 'map' : 'satellite');
    window.addEventListener(MODE_EVENT, onModeChange);
    return () => window.removeEventListener(MODE_EVENT, onModeChange);
  }, []);

  return (
    <>
      {/* key: đổi chế độ thì dựng lại bộ chọn nguồn với danh sách nguồn mới */}
      <ProviderChain key={`${mode}-${preset}`} mode={mode} preset={preset} />
      {showToggle && <BaseModeToggle mode={mode} onChange={saveMode} />}
    </>
  );
}

function ProviderChain({ mode, preset }) {
  const map = useMap();
  const providers = providersFor(mode, preset);
  const storageKey = storageKeyOf(mode, preset);
  const [index, setIndex] = useState(() => readSavedIndex(providers, storageKey));
  const statsRef = useRef({ loaded: 0, errors: 0 });
  const [allFailed, setAllFailed] = useState(false);
  const provider = providers[index];
  const exhausted = index >= providers.length - 1;

  const switchToNext = (reason) => {
    setIndex((current) => {
      if (current >= providers.length - 1) return current;
      console.warn(`[Map] Nền bản đồ "${providers[current].label}" không tải được (${reason}); chuyển sang "${providers[current + 1].label}".`);
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
    // switchToNext chỉ dùng setIndex dạng hàm, không cần làm dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, map, exhausted]);

  const isFallback = index > 0;
  const fellBackToRoadmap = mode === 'satellite' && index >= SATELLITE_PROVIDERS.length;

  return (
    <>
      <TileLayer
        key={provider.id}
        url={provider.url}
        attribution={provider.attribution}
        subdomains={provider.subdomains || 'abc'}
        maxZoom={provider.maxZoom || 19}
        maxNativeZoom={provider.maxNativeZoom || provider.maxZoom || 19}
        // Một số máy chủ tile (OSM) từ chối request không có Referer; giữ Referer kể cả khi trang đặt no-referrer.
        referrerPolicy="strict-origin-when-cross-origin"
        eventHandlers={{
          tileload: () => {
            statsRef.current.loaded += 1;
            if (statsRef.current.loaded === 1) {
              setAllFailed(false);
              try { sessionStorage.setItem(storageKey, provider.id); } catch { /* storage có thể bị chặn */ }
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
      {/* Nhãn đường/địa danh vẽ chồng lên ảnh vệ tinh Esri */}
      {(provider.overlays || []).map((url) => (
        <TileLayer
          key={`${provider.id}-${url}`}
          url={url}
          maxZoom={provider.maxZoom || 19}
          maxNativeZoom={provider.maxNativeZoom || 19}
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ))}
      {allFailed && (
        <div className="leaflet-top leaflet-left" style={{ left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
          <div className="leaflet-control" style={{ marginTop: 12, padding: '6px 12px', borderRadius: 10, background: '#fff7ed', border: '1px solid #fdba74', fontSize: 12, color: '#9a3412', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
            Không tải được nền bản đồ từ mọi nguồn. Mạng hiện tại có thể đang chặn máy chủ bản đồ.
          </div>
        </div>
      )}
      {isFallback && !allFailed && (
        <div className="leaflet-bottom leaflet-left" style={{ pointerEvents: 'none' }}>
          <div className="leaflet-control" style={{ margin: '0 0 6px 8px', padding: '2px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.9)', fontSize: 11, color: '#475569', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
            {fellBackToRoadmap ? 'Không tải được ảnh vệ tinh, đang dùng' : 'Nguồn dự phòng:'} {provider.label}
          </div>
        </div>
      )}
    </>
  );
}