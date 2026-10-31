import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import TripReviews from './TripReviews'; 
import { 
  ArrowLeft, Calendar, MapPin, Plus, 
  Search, X, Users, Receipt, 
  Share2, MoreHorizontal, ChevronLeft, ChevronRight,
  Wand2, Plane, Bed, Car, Train, Paperclip, CheckSquare, Compass,
  Clock, MessageSquare, Star, Heart, Send, Image as ImageIcon, Play,
  Utensils, Wine, Landmark, Ticket, ShoppingBag, ShoppingCart, Fuel, Trash2, Pencil
} from 'lucide-react';

// ================= COMPONENT HỖ TRỢ BẢN ĐỒ =================
// boundsKey / activeKey là chuỗi/số ổn định: bản đồ chỉ di chuyển khi tập điểm hoặc điểm được chọn THẬT SỰ đổi,
// không bị giật mỗi lần sửa ghi chú, "Đã đi", giờ... (những thao tác làm đổi tham chiếu mảng nhưng không đổi toạ độ)
function MapBounds({ points, boundsKey, activePoint, activeKey }) {
  const map = useMap();
  const pointsRef = useRef(points);
  pointsRef.current = points;

  // Chọn một địa điểm -> bay tới đó
  useEffect(() => {
    if (activePoint) map.flyTo(activePoint, 16, { animate: true, duration: 1.5 });
  }, [activeKey, map]);

  // Không có địa điểm nào được chọn -> khung hình ôm trọn các điểm đang xem
  useEffect(() => {
    if (activeKey || pointsRef.current.length === 0) return;
    map.fitBounds(L.latLngBounds(pointsRef.current), { padding: [50, 50], maxZoom: 15, animate: true });
  }, [boundsKey, activeKey, map]);

  return null;
}

// Mỗi ngày một màu (ngày 1 giữ màu thương hiệu) để phân biệt các ngày khi xem toàn bộ chuyến đi
const DAY_COLORS = ['#FF5645', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

// Cache icon: cùng (số, trạng thái, màu) dùng lại 1 icon, tránh Leaflet vẽ lại marker ở mỗi lần render
const markerIconCache = new Map();
const getMarkerIcon = (number, isActive, color) => {
  const key = `${number}|${isActive}|${color}`;
  if (!markerIconCache.has(key)) {
    const size = isActive ? 36 : 24;
    const shadow = isActive ? `0 4px 10px ${color}99` : '0 2px 5px rgba(0,0,0,0.3)';
    const border = isActive ? '3px solid white' : '2px solid white';
    markerIconCache.set(key, L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: ${color}; color: white; width: ${size}px; height: ${size}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: ${isActive ? '16px' : '12px'}; border: ${border}; box-shadow: ${shadow}; transition: all 0.3s ease;">${number}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    }));
  }
  return markerIconCache.get(key);
};

// '2026-10-14' -> '14/10'
const formatDayDate = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return m ? `${m[3]}/${m[2]}` : (d || '');
};

// 48 mốc giờ: 00:00, 00:30, ... 23:30
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) =>
  `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
);

// ================= ĐÍNH KÈM ẢNH / VIDEO CHO ĐÁNH GIÁ =================
// Backend (PlaceReviewService) cũng kiểm tra lại các giới hạn này
const MAX_MEDIA_FILES = 5;
const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 50;
const MAX_TOTAL_MB = 100; // khớp spring.servlet.multipart.max-request-size

// ================= NGÂN SÁCH & CHI TIÊU =================
const MAX_MONEY = 1_000_000_000_000; // 1.000 tỷ ₫, khớp giới hạn kiểm tra ở backend
const formatVND = (n) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`;

// Danh mục chi phí (key khớp với backend: ExpenseService.CATEGORIES)
const EXPENSE_CATEGORIES = [
  { key: 'FLIGHTS', label: 'Vé máy bay', Icon: Plane },
  { key: 'LODGING', label: 'Lưu trú', Icon: Bed },
  { key: 'CAR_RENTAL', label: 'Thuê xe', Icon: Car },
  { key: 'TRANSIT', label: 'Di chuyển', Icon: Train },
  { key: 'FOOD', label: 'Ăn uống', Icon: Utensils },
  { key: 'DRINKS', label: 'Đồ uống', Icon: Wine },
  { key: 'SIGHTSEEING', label: 'Tham quan', Icon: Landmark },
  { key: 'ACTIVITIES', label: 'Hoạt động', Icon: Ticket },
  { key: 'SHOPPING', label: 'Mua sắm', Icon: ShoppingBag },
  { key: 'GAS', label: 'Xăng dầu', Icon: Fuel },
  { key: 'GROCERIES', label: 'Tạp hóa', Icon: ShoppingCart },
  { key: 'OTHER', label: 'Khác', Icon: Receipt },
];
const CATEGORY_MAP = Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c.key, c]));

const EMPTY_EXPENSE_FORM = {
  amount: '',
  destinationId: null,   // địa điểm trong lịch trình (không bắt buộc)
  category: null,        // danh mục (không bắt buộc nếu đã chọn địa điểm)
  description: '',
  payerId: null,
  splitMode: 'none',     // 'none' = không chia, 'equal' = chia đều
  splitUserIds: [],
  date: '',              // để trống = hôm nay
};

const getApiError = (e, fallback) => {
  if (e.response?.status === 413) return 'Tổng dung lượng tệp vượt giới hạn của máy chủ.';
  return typeof e.response?.data === 'string' && e.response.data ? e.response.data : fallback;
};

// Lọc các file hợp lệ trong danh sách vừa chọn; trả về file nhận được + thông báo lỗi (nếu có)
const validateMediaFiles = (current, incoming) => {
  const accepted = [];
  let error = '';
  let total = current.reduce((sum, f) => sum + f.size, 0);
  for (const f of incoming) {
    const isImage = f.type.startsWith('image/');
    const isVideo = f.type.startsWith('video/');
    if (!isImage && !isVideo) { error = `"${f.name}" không phải ảnh hoặc video.`; continue; }
    if (current.length + accepted.length >= MAX_MEDIA_FILES) { error = `Tối đa ${MAX_MEDIA_FILES} tệp cho mỗi đánh giá.`; break; }
    const limitMB = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
    if (f.size > limitMB * 1024 * 1024) { error = `"${f.name}" vượt quá ${limitMB}MB.`; continue; }
    if (total + f.size > MAX_TOTAL_MB * 1024 * 1024) { error = `Tổng dung lượng tối đa ${MAX_TOTAL_MB}MB.`; continue; }
    accepted.push(f);
    total += f.size;
  }
  return { accepted, error };
};

// Ô chọn ảnh/video (dùng ở cả dialog "Đã đi" và form viết đánh giá trong panel)
const MediaPicker = ({ files, onChange, disabled }) => {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const [previews, setPreviews] = useState([]);

  // Tạo URL xem trước trong effect (không dùng useMemo) để không bị thu hồi nhầm khi StrictMode chạy effect 2 lần
  useEffect(() => {
    const next = files.map(f => ({ file: f, url: URL.createObjectURL(f), isVideo: f.type.startsWith('video/') }));
    setPreviews(next);
    return () => next.forEach(p => URL.revokeObjectURL(p.url));
  }, [files]);

  const handleSelect = (e) => {
    const result = validateMediaFiles(files, Array.from(e.target.files || []));
    setError(result.error);
    if (result.accepted.length > 0) onChange([...files, ...result.accepted]);
    e.target.value = ''; // cho phép chọn lại đúng file vừa xoá
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {previews.map((p) => (
          <div key={p.url} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
            {p.isVideo
              ? <video src={p.url} muted preload="metadata" className="w-full h-full object-cover" />
              : <img src={p.url} alt="" className="w-full h-full object-cover" />}
            {p.isVideo && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                <Play className="w-5 h-5 text-white fill-white" />
              </div>
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(files.filter(f => f !== p.file))}
              aria-label="Xoá tệp"
              className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 disabled:opacity-50"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {files.length < MAX_MEDIA_FILES && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="w-20 h-20 rounded-xl border border-dashed border-slate-300 bg-white text-slate-400 hover:text-slate-600 hover:border-slate-400 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Ảnh/Video</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleSelect} />
      <p className="text-[11px] text-slate-400 mt-2">Tối đa {MAX_MEDIA_FILES} tệp · ảnh ≤ {MAX_IMAGE_MB}MB · video ≤ {MAX_VIDEO_MB}MB</p>
      {error && <p className="text-xs text-rose-600 font-medium mt-1">{error}</p>}
    </div>
  );
};

// Lưới ảnh/video dưới mỗi đánh giá trong tab Đánh giá.
// Bấm vào ảnh sẽ mở trình xem ảnh (lightbox) ngay trong app; video phát trực tiếp trong lưới.
const ReviewMediaGrid = ({ media }) => {
  const [viewerIndex, setViewerIndex] = useState(null);
  const images = useMemo(() => (media || []).filter(m => m.type !== 'VIDEO'), [media]);
  const isOpen = viewerIndex !== null;

  const closeViewer = () => setViewerIndex(null);
  const step = (delta) => setViewerIndex(i => (i + delta + images.length) % images.length);

  // Phím tắt: Esc để đóng, ← → để chuyển ảnh
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setViewerIndex(null);
      else if (e.key === 'ArrowLeft' && images.length > 1) step(-1);
      else if (e.key === 'ArrowRight' && images.length > 1) step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, images.length]);

  if (!media || media.length === 0) return null;
  const current = isOpen ? images[viewerIndex] : null;

  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {media.map((m, i) => (
          m.type === 'VIDEO' ? (
            <video key={`${i}-${m.url}`} src={m.url} controls preload="metadata" className="w-full aspect-square object-cover rounded-xl bg-black" />
          ) : (
            <button
              key={`${i}-${m.url}`}
              type="button"
              onClick={() => setViewerIndex(images.indexOf(m))}
              className="block aspect-square rounded-xl overflow-hidden bg-slate-100 cursor-zoom-in"
            >
              <img src={m.url} alt="Ảnh đánh giá" loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
            </button>
          )
        ))}
      </div>

      {/* Dùng portal vì panel cha có transform, nếu không thì "fixed" sẽ chỉ phủ trong panel thay vì cả màn hình */}
      {current && createPortal(
        <div
          className="fixed inset-0 z-[4000] bg-black/90 flex items-center justify-center p-4"
          onClick={closeViewer}
        >
          <button
            onClick={closeViewer}
            aria-label="Đóng"
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); step(-1); }}
              aria-label="Ảnh trước"
              className="absolute left-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          <img
            src={current.url}
            alt="Ảnh đánh giá"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
          />

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); step(1); }}
                aria-label="Ảnh sau"
                className="absolute right-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/80 text-sm font-semibold">
                {viewerIndex + 1} / {images.length}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
};

// ================= TUYẾN ĐƯỜNG (OSRM) =================
// Đổi sang server OSRM của bạn khi triển khai thật (server công cộng chỉ để demo, tối đa 1 request/giây)
const OSRM_BASE_URL = 'https://router.project-osrm.org';
const OSRM_MIN_INTERVAL_MS = 1000;

const hasCoord = (d) => d.latitude != null && d.longitude != null && Number.isFinite(Number(d.latitude)) && Number.isFinite(Number(d.longitude));

// Khoảng cách đường chim bay (mét) - dùng khi không tìm được đường bộ
const haversineMeters = (a, b) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

const formatDistance = (m) => (m >= 1000
  ? `${(m / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} km`
  : `${Math.round(m)} m`);

const formatDuration = (s) => {
  const minutes = Math.max(1, Math.round(s / 60));
  if (minutes < 60) return `${minutes} phút`;
  const h = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return mm ? `${h} giờ ${mm} phút` : `${h} giờ`;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const routeCache = new Map();
let osrmQueue = Promise.resolve();
let lastOsrmCall = 0;

// Xếp hàng các request để cách nhau tối thiểu OSRM_MIN_INTERVAL_MS; request đã bị huỷ thì bỏ qua, không chiếm lượt
const queuedFetch = (url, signal) => {
  const task = osrmQueue.then(async () => {
    if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const wait = lastOsrmCall + OSRM_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
    lastOsrmCall = Date.now();
    return fetch(url, { signal });
  });
  osrmQueue = task.catch(() => {});
  return task;
};

// points: [{ lat, lng }]. Trả về { status: 'ok' | 'nopath' | 'error', positions, legs }
//  - ok: có đường bộ; nopath: OSRM xác nhận không nối được (vd. đảo); error: lỗi mạng / bị giới hạn tốc độ
const getRoute = async (points, signal) => {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
  if (routeCache.has(coords)) return routeCache.get(coords);
  try {
    const res = await queuedFetch(`${OSRM_BASE_URL}/route/v1/driving/${coords}?overview=full&geometries=geojson`, signal);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const r = data.routes[0];
      const result = {
        status: 'ok',
        positions: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        legs: r.legs.map((l) => ({ distance: l.distance, duration: l.duration })),
      };
      routeCache.set(coords, result);
      return result;
    }
    if (data.code === 'NoRoute' || data.code === 'NoSegment') {
      const result = { status: 'nopath' };
      routeCache.set(coords, result);
      return result;
    }
    return { status: 'error' };
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    return { status: 'error' };
  }
};

// stops: [{ id, lat, lng }] của MỘT ngày (đã lọc toạ độ hợp lệ, đúng thứ tự).
// Trả về { segments: [{ positions, approx }], legs: [{ fromId, toId, distance, duration, approx }] }
const buildDayRoute = async (stops, signal) => {
  const whole = await getRoute(stops, signal);
  if (whole.status === 'ok') {
    return {
      segments: [{ positions: whole.positions, approx: false }],
      legs: whole.legs.map((l, i) => ({ fromId: stops[i].id, toId: stops[i + 1].id, distance: l.distance, duration: l.duration, approx: false })),
    };
  }

  // Không nối được cả ngày: thử từng chặng để chặng nào đi được vẫn vẽ đường thật, chặng còn lại vẽ đường thẳng nét đứt.
  // Nếu chỉ là lỗi mạng / bị giới hạn tốc độ thì KHÔNG gọi thêm (tránh dồn request vào server đang quá tải).
  const retryPerLeg = whole.status === 'nopath' && stops.length > 2;
  const segments = [];
  const legs = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    const leg = retryPerLeg ? await getRoute([a, b], signal) : { status: 'skipped' };
    if (leg.status === 'ok') {
      segments.push({ positions: leg.positions, approx: false });
      legs.push({ fromId: a.id, toId: b.id, distance: leg.legs[0].distance, duration: leg.legs[0].duration, approx: false });
    } else {
      segments.push({ positions: [[a.lat, a.lng], [b.lat, b.lng]], approx: true });
      legs.push({ fromId: a.id, toId: b.id, distance: haversineMeters(a, b), duration: null, approx: true });
    }
  }
  return { segments, legs };
};
// ================= HẾT TUYẾN ĐƯỜNG (OSRM) =================

// Chip "12,4 km · 25 phút" hiện dưới mỗi địa điểm (tới điểm kế tiếp trong ngày)
const LegChip = ({ leg }) => {
  if (!leg) return null;
  return (
    <div
      className="flex items-center gap-1.5 mt-3 text-[12px] font-semibold text-slate-400"
      title={leg.approx ? 'Không tìm được đường bộ, hiển thị khoảng cách đường thẳng' : 'Quãng đường và thời gian lái xe ước tính (chưa tính kẹt xe)'}
    >
      <Car className="w-3.5 h-3.5" />
      {leg.approx
        ? `≈ ${formatDistance(leg.distance)} · đường thẳng`
        : `${formatDistance(leg.distance)} · ${formatDuration(leg.duration)}`}
    </div>
  );
};

const TripDetail = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [isItineraryExpanded, setIsItineraryExpanded] = useState(false);
  
  const [focusedDayId, setFocusedDayId] = useState(null);
  const [activeDestination, setActiveDestination] = useState(null);
  const [routeData, setRouteData] = useState({}); // { [dayId]: { segments, legs, legByFrom } }

  const [addingDayId, setAddingDayId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  
  // ================= STATES CHO PANEL TRƯỢT =================
  const [coverImage, setCoverImage] = useState('');
  const [placeInfo, setPlaceInfo] = useState({ extract: '', loading: false });
  const [placeReviews, setPlaceReviews] = useState([]); 
  const [placePosts, setPlacePosts] = useState([]); 
  const [infoTab, setInfoTab] = useState('intro');

  // ================= STATES CHO FORM ĐÁNH GIÁ ĐỊA ĐIỂM =================
  const [newReviewText, setNewReviewText] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [visibleReviewsCount, setVisibleReviewsCount] = useState(3);

  // ================= STATES CHO KHỐI MỞ RỘNG (OVERVIEW) =================
  const [tripNote, setTripNote] = useState('');
  const [isNoteExpanded, setIsNoteExpanded] = useState(true);
  const [customSections, setCustomSections] = useState([]); 
  const [activeMenuId, setActiveMenuId] = useState(null); 

  const searchRef = useRef(null);
  const dayRefs = useRef({}); 
  const [activeTimePickerDestId, setActiveTimePickerDestId] = useState(null);

  // Panel thông tin bên bản đồ: đóng/mở độc lập với địa điểm đang được chọn
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Dialog đánh giá hiện ra sau khi bấm "Đã đi"
  const [visitDialog, setVisitDialog] = useState(null); // { dest, dayDate }
  const [visitRating, setVisitRating] = useState(0);
  const [visitNote, setVisitNote] = useState('');
  const [visitError, setVisitError] = useState('');
  const [isSubmittingVisit, setIsSubmittingVisit] = useState(false);

  // Ảnh/video đính kèm (dialog "Đã đi" và form viết đánh giá trong panel)
  const [visitFiles, setVisitFiles] = useState([]);
  const [newReviewFiles, setNewReviewFiles] = useState([]);
  const [uploadPercent, setUploadPercent] = useState(0);
  const uploadLabel = uploadPercent > 0 && uploadPercent < 100 ? `Đang tải lên ${uploadPercent}%` : 'Đang xử lý...';

  // Ngân sách & chi tiêu
  const [expenseData, setExpenseData] = useState({ currentUserId: null, members: [], expenses: [] });
  const [expenseSort, setExpenseSort] = useState('newest');
  const [expenseDialog, setExpenseDialog] = useState(null); // null | { step: 'form' | 'item' }
  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE_FORM);
  const [expenseError, setExpenseError] = useState('');
  const [showAllDests, setShowAllDests] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [balanceDialog, setBalanceDialog] = useState(null); // null | { loading, data, error }
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // Mọi địa điểm trong lịch trình (để chọn khi thêm chi phí)
  const allDestinations = useMemo(() =>
    (trip?.tripDays || []).flatMap(day =>
      (day.destinations || []).map(d => ({ id: d.id, placeName: d.placeName, dayNumber: day.dayNumber }))
    ), [trip]);

  const expenseStats = useMemo(() => {
    const spent = expenseData.expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const budget = Number(trip?.totalBudget || 0);
    const byDest = {};
    const byCategory = {};
    expenseData.expenses.forEach(e => {
      const amount = Number(e.amount || 0);
      if (e.tripDestinationId) byDest[e.tripDestinationId] = (byDest[e.tripDestinationId] || 0) + amount;
      byCategory[e.category] = (byCategory[e.category] || 0) + amount;
    });
    return {
      spent, budget, byDest, byCategory,
      remaining: budget - spent,
      percent: budget > 0 ? Math.round((spent / budget) * 100) : 0,
    };
  }, [expenseData.expenses, trip]);

  const sortedExpenses = useMemo(() => {
    const list = [...expenseData.expenses];
    const dateKey = (e) => e.expenseDate || '';
    if (expenseSort === 'oldest') list.sort((a, b) => dateKey(a).localeCompare(dateKey(b)) || a.id - b.id);
    else if (expenseSort === 'amount') list.sort((a, b) => Number(b.amount) - Number(a.amount));
    else list.sort((a, b) => dateKey(b).localeCompare(dateKey(a)) || b.id - a.id);
    return list;
  }, [expenseData.expenses, expenseSort]);

  const categoryTotals = useMemo(() => {
    return EXPENSE_CATEGORIES
      .map(c => ({ ...c, amount: expenseStats.byCategory[c.key] || 0 }))
      .filter(c => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .map(c => ({ ...c, percent: expenseStats.spent > 0 ? Math.round((c.amount / expenseStats.spent) * 100) : 0 }));
  }, [expenseStats]);

  // Dữ liệu đang chọn trong form "Thêm chi phí"
  const selectedExpenseDest = allDestinations.find(d => d.id === expenseForm.destinationId) || null;
  const selectedExpenseCategory = expenseForm.category ? CATEGORY_MAP[expenseForm.category] : null;
  const splitCount = expenseForm.splitUserIds.length;
  const splitShare = splitCount > 0 && Number(expenseForm.amount) > 0 ? Math.floor(Number(expenseForm.amount) / splitCount) : 0;
  const fetchTripDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { navigate('/login'); return; }
      const response = await axios.get(`http://localhost:8080/api/trips/${tripId}`, { headers: { Authorization: `Bearer ${token}` } });
      setTrip(response.data);
    } catch (err) { setError('Lỗi máy chủ'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchTripDetails(); }, [tripId]);
  useEffect(() => { fetchExpenses(); }, [tripId]);

  useEffect(() => {
    if (!expenseDialog && !balanceDialog && !breakdownOpen && !budgetDialogOpen) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (!isSavingExpense) setExpenseDialog(null);
      setBalanceDialog(null);
      setBreakdownOpen(false);
      setBudgetDialogOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expenseDialog, balanceDialog, breakdownOpen, budgetDialogOpen, isSavingExpense]);

  useEffect(() => {
    if (!visitDialog) return;
    const onKey = (e) => { if (e.key === 'Escape' && !isSubmittingVisit) setVisitDialog(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visitDialog, isSubmittingVisit]);

  useEffect(() => {
    const fetchPlaces = async () => {
      if (searchQuery.trim().length < 2) { setSuggestions([]); return; }
      try {
        const query = encodeURIComponent(searchQuery.trim());
        const response = await fetch(`https://photon.komoot.io/api/?q=${query}&limit=5`);
        const data = await response.json();
        const formatted = data.features.map(f => {
          const p = f.properties;
          return { id: p.osm_id, name: p.name || p.street || p.city, address: [p.city, p.country].filter(Boolean).join(', '), lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
        }).filter(p => p.name);
        setSuggestions(formatted);
      } catch (err) { console.error(err); }
    };
    const delay = setTimeout(() => { if (addingDayId) fetchPlaces(); }, 500);
    return () => clearTimeout(delay);
  }, [searchQuery, addingDayId]);

  const handleAddDestination = async (place, dayId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:8080/api/trips/days/${dayId}/destinations`, {
        placeName: place.name, latitude: place.lat, longitude: place.lon, note: place.address, estimatedCost: 0
      }, { headers: { Authorization: `Bearer ${token}` }});
      setAddingDayId(null); setSearchQuery(''); setSuggestions([]); fetchTripDetails(); 
    } catch (err) { alert("Lỗi: " + (err.response?.data || err.message)); }
  };

  const handleDestinationClick = async (dest, idx) => {
    setActiveDestination({ ...dest, index: idx + 1 });
    setIsPanelOpen(true);
    setNewReviewFiles([]);
    setInfoTab('intro');
    setPlaceInfo({ extract: '', loading: true });
    
    const fallbackImage = `https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?q=80&w=800&auto=format&fit=crop`; 
    setCoverImage(fallbackImage);

    try {
      const wikiUrl = `https://vi.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(dest.placeName)}&format=json&origin=*`;
      const wikiRes = await fetch(wikiUrl);
      const wikiData = await wikiRes.json();
      const pages = wikiData.query.pages;
      const pageId = Object.keys(pages)[0];
      if (pageId !== "-1" && pages[pageId].extract) setPlaceInfo({ extract: pages[pageId].extract, loading: false });
      else setPlaceInfo({ extract: `Không tìm thấy thông tin trên Wikipedia.`, loading: false });
    } catch (e) { setPlaceInfo({ extract: 'Không thể tải thông tin lúc này.', loading: false }); }

    try {
      const postsRes = await axios.get('http://localhost:8080/api/posts');
      const relatedPosts = postsRes.data.filter(p => p.locationName && p.locationName.toLowerCase().includes(dest.placeName.toLowerCase()));
      setPlacePosts(relatedPosts);
      
      const firstPostWithImg = relatedPosts.find(p => p.imageUrls && p.imageUrls.length > 0);
      if (firstPostWithImg) setCoverImage(firstPostWithImg.imageUrls[0]);
    } catch (e) { console.error(e); }

    fetchReviews(dest.placeName);
  };

  // Quản lý trạng thái cập nhật Địa điểm & Đồng bộ với Server
  const handleUpdateDestProperty = async (dayId, destId, field, value) => {
    // 1. Chuyển đổi tên field 'time' của API thành 'timeRange' của giao diện
    const stateField = field === 'time' ? 'timeRange' : field;

    const updatedDays = trip.tripDays.map(day => {
      if (day.id === dayId) {
        const updatedDests = day.destinations.map(d => 
          d.id === destId ? { ...d, [stateField]: value } : d
        );
        return { ...day, destinations: updatedDests };
      }
      return day;
    });
    setTrip({ ...trip, tripDays: updatedDays });

    // 2. Gửi API xuống Server lưu vĩnh viễn
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `http://localhost:8080/api/trips/days/destinations/${destId}`,
        { field, value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error("Lỗi cập nhật địa điểm:", error);
      alert(getApiError(error, 'Không lưu được thay đổi. Dữ liệu sẽ được tải lại.'));
      fetchTripDetails(); // rollback về dữ liệu thật từ server
    }
  };

  // ================= LOGIC NGÂN SÁCH & CHI TIÊU =================
  const fetchExpenses = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await axios.get(`http://localhost:8080/api/trips/${tripId}/expenses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setExpenseData(res.data);
    } catch (e) {
      console.error('Lỗi tải chi phí:', e);
    }
  };

  // preset.destinationId: mở sẵn với địa điểm đã chọn (từ nút "Thêm chi phí" của địa điểm)
  const openExpenseDialog = (preset = {}) => {
    setExpenseForm({
      ...EMPTY_EXPENSE_FORM,
      destinationId: preset.destinationId || null,
      payerId: expenseData.currentUserId,
      splitUserIds: expenseData.members.map(m => m.userId),
    });
    setExpenseError('');
    setShowAllDests(false);
    setExpenseDialog({ step: 'form' });
  };

  const closeExpenseDialog = () => { if (!isSavingExpense) setExpenseDialog(null); };
  const updateExpenseForm = (patch) => setExpenseForm(f => ({ ...f, ...patch }));
  const toggleSplitUser = (userId) => setExpenseForm(f => ({
    ...f,
    splitUserIds: f.splitUserIds.includes(userId) ? f.splitUserIds.filter(id => id !== userId) : [...f.splitUserIds, userId]
  }));

  const submitExpense = async () => {
    const amount = Number(expenseForm.amount);
    if (!expenseForm.amount || !Number.isFinite(amount) || amount <= 0) { setExpenseError('Vui lòng nhập số tiền lớn hơn 0.'); return; }
    if (amount > MAX_MONEY) { setExpenseError('Số tiền quá lớn.'); return; }
    if (!expenseForm.destinationId && !expenseForm.category) { setExpenseError('Hãy chọn mục chi phí (địa điểm hoặc danh mục).'); return; }
    if (!expenseForm.payerId) { setExpenseError('Vui lòng chọn người trả tiền.'); return; }
    if (expenseForm.splitMode === 'equal' && expenseForm.splitUserIds.length === 0) { setExpenseError('Hãy chọn ít nhất 1 người để chia tiền.'); return; }

    const payload = {
      title: selectedExpenseDest ? selectedExpenseDest.placeName : (selectedExpenseCategory ? selectedExpenseCategory.label : null),
      amount: Math.round(amount),
      category: expenseForm.category || 'OTHER',
      description: expenseForm.description.trim() || null,
      tripDestinationId: expenseForm.destinationId,
      payerId: expenseForm.payerId,
      splitUserIds: expenseForm.splitMode === 'equal' ? expenseForm.splitUserIds : [],
      expenseDate: expenseForm.date || null,
    };

    try {
      setIsSavingExpense(true);
      setExpenseError('');
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:8080/api/trips/${tripId}/expenses`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchExpenses();
      setExpenseDialog(null);
    } catch (e) {
      setExpenseError(getApiError(e, 'Không lưu được khoản chi. Vui lòng thử lại!'));
    } finally {
      setIsSavingExpense(false);
    }
  };

  const deleteExpense = async (expense) => {
    if (!window.confirm(`Xóa khoản chi "${expense.title}"?`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:8080/api/trips/${tripId}/expenses/${expense.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchExpenses();
    } catch (e) {
      alert(getApiError(e, 'Không xóa được khoản chi. Vui lòng thử lại!'));
    }
  };

  const openBalanceDialog = async () => {
    setBalanceDialog({ loading: true, data: null, error: '' });
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:8080/api/trips/${tripId}/expenses/settlement`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBalanceDialog({ loading: false, data: res.data, error: '' });
    } catch (e) {
      setBalanceDialog({ loading: false, data: null, error: getApiError(e, 'Không tính được cân đối nhóm.') });
    }
  };

  const saveBudget = async () => {
    const amount = budgetInput === '' ? 0 : Number(budgetInput);
    if (!Number.isFinite(amount) || amount < 0) { alert('Ngân sách phải là số không âm.'); return; }
    if (amount > MAX_MONEY) { alert('Ngân sách quá lớn.'); return; }
    try {
      setIsSavingBudget(true);
      const token = localStorage.getItem('token');
      await axios.patch(`http://localhost:8080/api/trips/${tripId}/budget`, { totalBudget: amount }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrip(prev => ({ ...prev, totalBudget: amount }));
      setBudgetDialogOpen(false);
    } catch (e) {
      alert(getApiError(e, 'Không lưu được ngân sách. Vui lòng thử lại!'));
    } finally {
      setIsSavingBudget(false);
    }
  };

  // ================= LOGIC "ĐÃ ĐI" + ĐÁNH GIÁ =================
  // Đánh dấu đã đi NGAY (không phụ thuộc dialog) -> đóng dialog vẫn giữ trạng thái đã đi
  const handleToggleVisited = (day, dest, isVisited) => {
    handleUpdateDestProperty(day.id, dest.id, 'isVisited', !isVisited);
    if (!isVisited) { // chỉ hiện dialog khi chuyển từ chưa đi -> đã đi
      setVisitRating(0);
      setVisitNote('');
      setVisitError('');
      setVisitFiles([]);
      setVisitDialog({ dest, dayDate: day.dayDate });
    }
  };

  const closeVisitDialog = () => { if (!isSubmittingVisit) setVisitDialog(null); };

  const submitVisitReview = async () => {
    if (!visitDialog) return;
    if (visitRating < 1) { setVisitError('Hãy chọn số sao trước khi lưu đánh giá.'); return; }
    const placeName = visitDialog.dest.placeName;
    try {
      setIsSubmittingVisit(true);
      setVisitError('');
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('locationName', placeName);
      formData.append('rating', visitRating);
      formData.append('content', visitNote.trim());
      visitFiles.forEach(f => formData.append('files', f));
      setUploadPercent(0);
      await axios.post('http://localhost:8080/api/place-reviews', formData, {
        headers: { Authorization: `Bearer ${token}` },
        onUploadProgress: (ev) => { if (ev.total) setUploadPercent(Math.round((ev.loaded * 100) / ev.total)); }
      });
      setVisitDialog(null);
      setVisitFiles([]);
      await fetchReviews(placeName);
      // Mở panel ở tab Đánh giá để người dùng thấy đánh giá vừa gửi
      setInfoTab('reviews');
      setIsPanelOpen(true);
    } catch (e) {
      setVisitError(getApiError(e, 'Không gửi được đánh giá. Vui lòng thử lại!'));
    } finally {
      setIsSubmittingVisit(false);
    }
  };

  // ================= LOGIC CHỌN GIỜ =================
  const [timeDraft, setTimeDraft] = useState({ start: '', end: '', focus: 'start' });

  const openTimePicker = (dest) => {
    const [start = '', end = ''] = (dest.timeRange || '').split(' - ').map(s => s.trim());
    setTimeDraft({ start, end, focus: 'start' });
    setActiveTimePickerDestId(dest.id);
  };

  const pickTimeSlot = (t) => {
    setTimeDraft(d => d.focus === 'start'
      ? { start: t, end: d.end > t ? d.end : '', focus: 'end' } // chọn xong giờ bắt đầu thì nhảy sang giờ kết thúc
      : { ...d, end: t });
  };

  const saveTime = (dayId, destId) => {
    const { start, end } = timeDraft;
    if (!start) { alert('Vui lòng chọn giờ bắt đầu'); return; }
    if (end && end <= start) { alert('Giờ kết thúc phải sau giờ bắt đầu'); return; }
    handleUpdateDestProperty(dayId, destId, 'time', end ? `${start} - ${end}` : start);
    setActiveTimePickerDestId(null);
  };

  // LOGIC CUSTOM SECTIONS
  const handleAddCustomSection = () => {
    setCustomSections([...customSections, { id: Date.now(), title: '', isExpanded: true, places: [] }]);
  };
  const handleUpdateSectionTitle = (id, newTitle) => {
    setCustomSections(customSections.map(sec => sec.id === id ? { ...sec, title: newTitle } : sec));
  };
  const handleDeleteSection = (id) => {
    setCustomSections(customSections.filter(sec => sec.id !== id));
    setActiveMenuId(null);
  };
  
  // LOGIC ĐÁNH GIÁ ĐỊA ĐIỂM
  const fetchReviews = async (locName) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:8080/api/place-reviews?locationName=${encodeURIComponent(locName)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setPlaceReviews(res.data);
    } catch (e) { console.error(e); }
  };

  const submitReview = async () => {
    if (!newReviewText.trim() && newReviewFiles.length === 0) {
      alert('Hãy viết nội dung hoặc đính kèm ảnh/video trước khi đăng.');
      return;
    }
    try {
      setIsSubmittingReview(true);
      setUploadPercent(0);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('locationName', activeDestination.placeName);
      formData.append('rating', newReviewRating);
      formData.append('content', newReviewText.trim());
      newReviewFiles.forEach(f => formData.append('files', f));

      await axios.post('http://localhost:8080/api/place-reviews', formData, {
        headers: { Authorization: `Bearer ${token}` },
        onUploadProgress: (ev) => { if (ev.total) setUploadPercent(Math.round((ev.loaded * 100) / ev.total)); }
      });
      setNewReviewText('');
      setNewReviewRating(5);
      setNewReviewFiles([]);
      setShowReviewForm(false); // chỉ đóng form khi gửi thành công, lỗi thì giữ nguyên nội dung đã nhập
      fetchReviews(activeDestination.placeName);
    } catch (e) {
      alert(getApiError(e, "Lỗi kết nối đến máy chủ. Vui lòng thử lại!"));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const toggleLikeReview = async (reviewId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:8080/api/place-reviews/${reviewId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchReviews(activeDestination.placeName); 
    } catch (e) { alert("Bạn cần đăng nhập để thả tim."); }
  };

  const handleScrollToDay = (dayId) => {
    setActiveSection('itinerary'); setFocusedDayId(dayId); setActiveDestination(null);
    if (dayRefs.current[dayId]) dayRefs.current[dayId].scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Các điểm có toạ độ hợp lệ của từng ngày. `number` = số thứ tự TRONG NGÀY (khớp với số hiện trong danh sách).
  const routeDays = useMemo(() => (trip?.tripDays || []).map((day, dayIndex) => ({
    id: day.id,
    color: DAY_COLORS[dayIndex % DAY_COLORS.length],
    stops: (day.destinations || [])
      .map((dest, i) => ({ dest, id: dest.id, number: i + 1, lat: Number(dest.latitude), lng: Number(dest.longitude) }))
      .filter(s => hasCoord(s.dest)),
  })), [trip]);

  // Chuỗi đại diện cho toạ độ + thứ tự của mọi ngày: chỉ đổi khi tuyến đường thật sự cần tính lại
  const routeKey = useMemo(
    () => routeDays.map(d => `${d.id}:${d.stops.map(s => `${s.id}@${s.lat},${s.lng}`).join('|')}`).join('||'),
    [routeDays]
  );

  // Các điểm đang hiển thị trên bản đồ (1 ngày được chọn, hoặc tất cả các ngày)
  const mapStops = useMemo(() => routeDays
    .filter(d => !focusedDayId || d.id === focusedDayId)
    .flatMap(d => d.stops.map(s => ({ ...s, color: d.color }))), [routeDays, focusedDayId]);

  const boundsKey = useMemo(
    () => `${focusedDayId || 'all'}#${mapStops.map(s => `${s.id}@${s.lat},${s.lng}`).join('|')}`,
    [mapStops, focusedDayId]
  );

  // THỐNG KÊ ĐÁNH GIÁ (Google Maps Style)
  const reviewStats = useMemo(() => {
    if (!placeReviews || placeReviews.length === 0) return { avg: 0, total: 0, distribution: {5:0, 4:0, 3:0, 2:0, 1:0} };
    const stats = { total: placeReviews.length, sum: 0, distribution: {5:0, 4:0, 3:0, 2:0, 1:0} };
    placeReviews.forEach(r => {
      stats.sum += r.rating;
      stats.distribution[r.rating] = (stats.distribution[r.rating] || 0) + 1;
    });
    stats.avg = (stats.sum / stats.total).toFixed(1);
    return stats;
  }, [placeReviews]);

  // Tính tuyến đường: mỗi ngày 1 request, chỉ chạy lại khi toạ độ/thứ tự thật sự đổi (routeKey) hoặc đổi ngày đang xem.
  // Ngày đang xem được tính trước; request cũ bị huỷ nên kết quả cũ không thể ghi đè kết quả mới.
  useEffect(() => {
    if (routeDays.length === 0) return;
    const controller = new AbortController();
    const ordered = focusedDayId
      ? [...routeDays.filter(d => d.id === focusedDayId), ...routeDays.filter(d => d.id !== focusedDayId)]
      : routeDays;

    (async () => {
      for (const d of ordered) {
        try {
          const result = d.stops.length >= 2
            ? await buildDayRoute(d.stops, controller.signal)
            : { segments: [], legs: [] };
          if (controller.signal.aborted) return;
          const legByFrom = Object.fromEntries(result.legs.map(l => [l.fromId, l]));
          setRouteData(prev => ({ ...prev, [d.id]: { ...result, legByFrom } }));
        } catch (e) {
          if (e && e.name === 'AbortError') return;
        }
      }
    })();

    return () => controller.abort();
  }, [routeKey, focusedDayId]);

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-slate-500">Đang tải hành trình...</div>;
  if (!trip) return null;

  // HÀM AN TOÀN TRÁNH CRASH: Lấy chữ cái đầu của Tên
  const getInitial = (name) => {
    if (!name || typeof name !== 'string') return 'U';
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="h-screen w-full flex bg-slate-50 font-sans overflow-hidden">
      
      {/* 1. SIDEBAR */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col relative z-20 overflow-hidden`}>
        <div className="p-4 flex items-center gap-3 border-b border-slate-100">
          <Link to="/home" className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 text-slate-600"><ArrowLeft className="w-4 h-4" /></Link>
          <span className="font-bold text-slate-800 truncate flex-1">{trip.destination}</span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <button onClick={() => { setActiveSection('overview'); setFocusedDayId(null); setActiveDestination(null); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-sm transition-colors ${activeSection === 'overview' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}><ChevronDownIcon isOpen={activeSection === 'overview'} /> Overview</button>
          <div className="pt-2">
            <button onClick={() => { setActiveSection('itinerary'); setIsItineraryExpanded(!isItineraryExpanded); setFocusedDayId(null); setActiveDestination(null); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-sm transition-colors ${activeSection === 'itinerary' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}><ChevronDownIcon isOpen={isItineraryExpanded} /> Itinerary</button>
            {isItineraryExpanded && (
              <div className="pl-9 space-y-1 mt-1">
                {trip.tripDays?.map((day) => (
                  <span key={day.id} onClick={() => handleScrollToDay(day.id)} className={`block px-3 py-1.5 text-sm cursor-pointer rounded-md transition-colors ${focusedDayId === day.id ? 'font-bold text-[#FF5645] bg-red-50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>Day {day.dayNumber}</span>
                ))}
              </div>
            )}
          </div>
          <div className="pt-2">
            <button onClick={() => setActiveSection('budget')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-sm transition-colors ${activeSection === 'budget' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}><ChevronDownIcon isOpen={activeSection === 'budget'} /> Budget</button>
          </div>
        </div>
      </div>

      {/* 2. MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-y-auto scroll-smooth">
        
        {/* --- TAB 1: OVERVIEW --- */}
        {activeSection === 'overview' && (
          <div className="pb-20">
            <div className="h-[300px] w-full relative bg-slate-800">
              <img src={`https://source.unsplash.com/1200x600/?${encodeURIComponent(trip.destination || 'vietnam')}`} alt="Cover" className="w-full h-full object-cover opacity-80" />
            </div>
            <div className="relative -mt-16 mx-auto max-w-4xl px-4 sm:px-8">
              <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-slate-100 flex flex-col sm:flex-row sm:items-end justify-between">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">{trip.title}</h1>
                  <div className="flex items-center text-sm font-semibold text-slate-500 gap-2"><Calendar className="w-4 h-4 text-slate-400"/> {trip.startDate} — {trip.endDate || 'No end date'}</div>
                </div>
                {/* Đã bọc thép hàm lấy chữ cái đầu */}
                <div className="flex items-center gap-2 mt-4 sm:mt-0">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200">
                    {getInitial(trip.user?.fullName)}
                  </div>
                  <button className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 border border-slate-200 border-dashed"><Users className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            <div className="mx-auto max-w-4xl px-4 sm:px-8 mt-12">
              
              {/* === PHẦN 1: GHI CHÚ (NOTES) === */}
              <div className="mb-10">
                <div className="flex items-center justify-between mb-3 group cursor-pointer" onClick={() => setIsNoteExpanded(!isNoteExpanded)}>
                  <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                    <ChevronDownIcon isOpen={isNoteExpanded} /> Notes
                  </h3>
                  <button className="p-1 rounded hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                
                {isNoteExpanded && (
                  <div className="pl-6">
                    <textarea 
                      value={tripNote}
                      onChange={(e) => setTripNote(e.target.value)}
                      placeholder="Write or paste anything here: how to get around, tips and tricks"
                      className="w-full bg-slate-100/50 hover:bg-slate-100 rounded-xl p-4 text-sm text-slate-700 outline-none border border-transparent focus:border-slate-300 focus:bg-white transition-all resize-none min-h-[100px]"
                    />
                  </div>
                )}
              </div>

              <hr className="border-slate-100 mb-10" />

              {/* === PHẦN 2: CÁC KHỐI CUSTOM SECTIONS === */}
              {customSections.map((section) => (
                <div key={section.id} className="mb-10">
                  <div className="flex items-center justify-between mb-3 relative group">
                    <div className="flex items-center gap-2 flex-1">
                      <button 
                        onClick={() => setCustomSections(customSections.map(s => s.id === section.id ? {...s, isExpanded: !s.isExpanded} : s))} 
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        <ChevronDownIcon isOpen={section.isExpanded} />
                      </button>
                      <input 
                        type="text"
                        value={section.title}
                        onChange={(e) => handleUpdateSectionTitle(section.id, e.target.value)}
                        placeholder='Thêm tiêu đề (VD: "Nhà hàng cần thử")'
                        className="text-xl font-extrabold text-slate-800 focus:text-slate-900 placeholder:text-slate-300 bg-transparent outline-none flex-1 border-b border-transparent focus:border-slate-300 transition-colors"
                      />
                    </div>
                    
                    {/* Nút 3 chấm mở Menu xóa (Tự động hiện khi hover vào vùng section) */}
                    <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setActiveMenuId(activeMenuId === section.id ? null : section.id)}
                        className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                      
                      {activeMenuId === section.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 animate-fade-in overflow-hidden">
                          <button 
                            onClick={() => handleDeleteSection(section.id)}
                            className="w-full text-left px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            Xóa danh sách này
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {section.isExpanded && (
                    <div className="pl-7">
                      {/* Ô thêm địa điểm (Đã bỏ 2 nút và đổi màu sáng hơn) */}
                      <div className="flex items-center gap-3 bg-white hover:bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 shadow-sm transition-all cursor-text focus-within:ring-2 focus-within:ring-cyan-500/20 focus-within:border-cyan-500">
                        <MapPin className="w-5 h-5 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Thêm địa điểm vào danh sách..." 
                          className="bg-transparent text-sm text-slate-800 outline-none flex-1 font-medium placeholder:font-normal placeholder:text-slate-400" 
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* === NÚT TẠO SECTION MỚI === */}
              <div className="flex items-center gap-4 mb-12 group">
                <hr className="flex-1 border-slate-200" />
                <button 
                  onClick={(e) => {
                    e.preventDefault(); // Chống reload trang ngoài ý muốn
                    handleAddCustomSection();
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-bold">Thêm tiêu đề mới</span>
                </button>
                <hr className="flex-1 border-slate-200" />
              </div>

              {/* === PHẦN 3: WIDGET ĐẶT PHÒNG & ĐÁNH GIÁ CHUYẾN ĐI === */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-4 mb-10">
                <div className="sm:col-span-2 bg-slate-100/50 rounded-2xl p-5 border border-slate-200/60">
                  <h3 className="font-bold text-slate-900 mb-4">Reservations and attachments</h3>
                  <div className="flex gap-4 overflow-x-auto pb-2 text-slate-500">
                    <ReservationIcon icon={<Plane/>} label="Flight" />
                    <ReservationIcon icon={<Bed/>} label="Lodging" />
                    <ReservationIcon icon={<Car/>} label="Rental car" />
                    <ReservationIcon icon={<Train/>} label="Train" />
                    <ReservationIcon icon={<Paperclip/>} label="Attachment" />
                    <ReservationIcon icon={<MoreHorizontal/>} label="Other" />
                  </div>
                </div>
                <div className="bg-slate-100/50 rounded-2xl p-5 border border-slate-200/60 flex flex-col justify-between">
                  <h3 className="font-bold text-slate-900">Budgeting</h3>
                  <div>
                    <p className={`text-2xl font-bold ${expenseStats.spent > 0 ? 'text-slate-900' : 'text-slate-400'}`}>{formatVND(expenseStats.spent)}</p>
                    {expenseStats.budget > 0 && <p className="text-xs font-semibold text-slate-500">trên ngân sách {formatVND(expenseStats.budget)}</p>}
                    <button onClick={() => setActiveSection('budget')} className="text-sm font-bold text-slate-600 hover:text-slate-900 mt-1">View details</button>
                  </div>
                </div>
              </div>

              {trip.id && <TripReviews tripId={trip.id} />}
            </div>
          </div>
        )}

        {/* --- TAB 2: ITINERARY --- */}
        {activeSection === 'itinerary' && (
          <div className="p-6 sm:p-8 max-w-3xl mx-auto w-full pt-16">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-8">Itinerary</h2>
            <div className="space-y-8">
              {trip.tripDays?.map((day) => (
                <div key={day.id} ref={el => dayRefs.current[day.id] = el} className={`bg-white border rounded-3xl p-6 shadow-sm transition-all ${focusedDayId === day.id ? 'border-[#FF5645] ring-4 ring-[#FF5645]/10' : 'border-slate-200'}`}>
                  <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-3 mb-6"><span className="bg-slate-900 text-white text-xs px-3 py-1 rounded-md uppercase tracking-wider">Day {day.dayNumber}</span><span className="text-slate-500">{day.dayDate}</span></h3>
                  
                  <div className="space-y-4 mb-4">
                    {(!day.destinations || day.destinations.length === 0) ? (
                      <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl">
                        <CheckSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-400 font-medium">Bạn chưa thêm địa điểm nào.</p>
                      </div>
                    ) : (
                      day.destinations.map((dest, idx) => {
                        const isActive = activeDestination?.id === dest.id;
                        const isVisited = dest.isVisited || false; // Cần thêm trường này vào DB

                        return (
                          <div 
                            key={dest.id} 
                            onClick={(e) => {
                              // Ngăn chặn nổi bọt sự kiện nếu click vào các nút chức năng
                              if (e.target.closest('button') || e.target.closest('input')) return;
                              handleDestinationClick(dest, idx);
                            }} 
                            className={`flex gap-3 items-start group cursor-pointer p-2 -ml-2 rounded-xl transition-all ${isActive ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'hover:bg-slate-50'}`}
                          >
                            {/* Cột trái: Vòng tròn Số thứ tự / Dấu tick Đã đi */}
                            <div className="flex flex-col items-center mt-2 w-8 shrink-0">
                              {isVisited ? (
                                <div className="w-7 h-7 rounded-full bg-slate-400 text-white flex items-center justify-center shadow-sm">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                </div>
                              ) : (
                                <div className={`w-7 h-7 rounded-full text-white text-xs font-extrabold flex items-center justify-center shadow-sm transition-all ${isActive ? 'bg-cyan-500 scale-110' : 'bg-cyan-500/80 group-hover:bg-cyan-500'}`}>
                                  {idx + 1}
                                </div>
                              )}
                              
                              {/* Thanh dọc nối các điểm */}
                              {idx !== day.destinations.length - 1 && (
                                <div className="w-[1.5px] h-full bg-slate-200 border-l border-dashed border-slate-300 mt-2 min-h-[30px]"></div>
                              )}
                            </div>

                            {/* Cột phải: Nội dung & Toolbar */}
                            <div className={`flex-1 p-3 rounded-2xl transition-all ${isActive ? 'bg-slate-50/80' : 'bg-transparent'}`}>
                              
                              <div className="flex items-center justify-between mb-1">
                                <h4 className={`font-bold text-[15px] transition-colors ${isActive ? 'text-slate-900' : (isVisited ? 'text-slate-600' : 'text-slate-800')}`}>
                                  {dest.placeName}
                                </h4>
                                {/* Icon Kéo thả (Grip) khi Active */}
                                {isActive && <button className="text-slate-300 hover:text-slate-500"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM20 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM20 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM20 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"></path></svg></button>}
                              </div>

                              {/* Khung Ghi chú */}
                              {isActive ? (
                                <input 
                                  type="text" 
                                  defaultValue={dest.note || ''} 
                                  onBlur={(e) => handleUpdateDestProperty(day.id, dest.id, 'note', e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                                  placeholder="Thêm ghi chú..." 
                                  className="w-full bg-transparent text-sm text-slate-700 outline-none mb-3 placeholder:text-slate-400 border-b border-transparent focus:border-slate-300 pb-1"
                                />
                              ) : (
                                dest.note && <p className="text-[13px] text-slate-600 mb-2 line-clamp-2">{dest.note}</p>
                              )}

                              {/* TOOLBAR THAO TÁC (Chỉ hiện khi Active) */}
                              {isActive && (
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 pt-2 border-t border-slate-200 relative">
                                  
                                  {/* 1. Nút Đánh dấu đã đi */}
                                  <button 
                                    onClick={() => handleToggleVisited(day, dest, isVisited)}
                                    className={`flex items-center gap-1.5 text-[13px] font-bold transition-colors ${isVisited ? 'text-slate-400 hover:text-slate-600' : 'text-indigo-600 hover:text-indigo-800'}`}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    {isVisited ? 'Bỏ đánh dấu' : 'Đã đi'}
                                  </button>

                                  {/* 2. Thêm giờ & Hiển thị khung chọn giờ (Pop-over) */}
                                  <div className="relative">
                                    {dest.timeRange ? (
                                      <button 
                                        onClick={() => openTimePicker(dest)}
                                        className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md text-[12px] font-bold text-indigo-700 transition-colors"
                                      >
                                        {dest.timeRange}
                                      </button>
                                    ) : (
                                      <button 
                                        onClick={() => openTimePicker(dest)}
                                        className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                                      >
                                        <Clock className="w-3.5 h-3.5" /> Thêm giờ
                                      </button>
                                    )}

                                    {/* Khung Pop-over chọn giờ (Chỉ hiện khi bấm vào) */}
                                    {activeTimePickerDestId === dest.id && (
                                      <>
                                        {/* Lớp phủ trong suốt: bấm ra ngoài để đóng */}
                                        <div
                                          className="fixed inset-0 z-40"
                                          onClick={(e) => { e.stopPropagation(); setActiveTimePickerDestId(null); }}
                                        />
                                        <div
                                          className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 p-3 flex flex-col gap-3 animate-fade-in"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {/* Hai ô nhập giờ */}
                                          <div className="flex items-center gap-2">
                                            <div className={`flex-1 bg-slate-50 rounded-lg p-2 border transition-colors ${timeDraft.focus === 'start' ? 'border-indigo-400' : 'border-slate-100'}`}>
                                              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Start time</span>
                                              <input
                                                type="time"
                                                value={timeDraft.start}
                                                onFocus={() => setTimeDraft(d => ({ ...d, focus: 'start' }))}
                                                onChange={(e) => setTimeDraft(d => ({ ...d, start: e.target.value }))}
                                                className="w-full bg-transparent outline-none text-sm font-bold text-slate-700"
                                              />
                                            </div>
                                            <span className="text-slate-300 font-medium">—</span>
                                            <div className={`flex-1 bg-slate-50 rounded-lg p-2 border transition-colors ${timeDraft.focus === 'end' ? 'border-indigo-400' : 'border-slate-100'}`}>
                                              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">End time</span>
                                              <input
                                                type="time"
                                                value={timeDraft.end}
                                                onFocus={() => setTimeDraft(d => ({ ...d, focus: 'end' }))}
                                                onChange={(e) => setTimeDraft(d => ({ ...d, end: e.target.value }))}
                                                className="w-full bg-transparent outline-none text-sm font-bold text-slate-700"
                                              />
                                            </div>
                                          </div>

                                          {/* Danh sách đủ 48 mốc giờ, bấm để điền vào ô đang chọn */}
                                          <div
                                            className="h-32 overflow-y-auto border border-slate-100 rounded-lg py-1 custom-scrollbar"
                                            ref={(el) => {
                                              if (el && !el.dataset.ready) {
                                                el.dataset.ready = '1';
                                                const idx = TIME_OPTIONS.indexOf(timeDraft[timeDraft.focus]);
                                                el.scrollTop = (idx >= 0 ? idx : 16) * 32; // mặc định cuộn tới 08:00
                                              }
                                            }}
                                          >
                                            {TIME_OPTIONS.map(t => {
                                              const selected = t === timeDraft[timeDraft.focus];
                                              const disabled = timeDraft.focus === 'end' && !!timeDraft.start && t <= timeDraft.start;
                                              return (
                                                <div
                                                  key={t}
                                                  onClick={() => { if (!disabled) pickTimeSlot(t); }}
                                                  className={`h-8 px-3 flex items-center text-sm ${
                                                    disabled ? 'text-slate-300 cursor-not-allowed'
                                                    : selected ? 'bg-indigo-50 text-indigo-700 font-bold cursor-pointer'
                                                    : 'text-slate-700 hover:bg-slate-50 cursor-pointer'
                                                  }`}
                                                >
                                                  {t}
                                                </div>
                                              );
                                            })}
                                          </div>

                                          {/* Nút hành động */}
                                          <div className="flex items-center justify-center gap-3 pt-1">
                                            <button
                                              onClick={() => {
                                                handleUpdateDestProperty(day.id, dest.id, 'time', null);
                                                setActiveTimePickerDestId(null);
                                              }}
                                              className="px-5 py-2 bg-slate-100 text-slate-600 font-bold text-sm rounded-full hover:bg-slate-200 transition-colors"
                                            >
                                              Xóa
                                            </button>
                                            <button
                                              onClick={() => saveTime(day.id, dest.id)}
                                              className="px-5 py-2 bg-[#FF5645] text-white font-bold text-sm rounded-full hover:bg-[#E04B3B] transition-colors"
                                            >
                                              Lưu
                                            </button>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>

                                  {/* 4. Thêm chi phí */}
                                  {(expenseStats.byDest[dest.id] || 0) > 0 ? (
                                    <button 
                                      onClick={() => openExpenseDialog({ destinationId: dest.id })}
                                      className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md text-[12px] font-bold text-indigo-700 transition-colors cursor-pointer"
                                    >
                                      {formatVND(expenseStats.byDest[dest.id])}
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => openExpenseDialog({ destinationId: dest.id })} 
                                      className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                                    >
                                      <span className="font-bold text-sm bg-slate-200 w-4 h-4 rounded-full flex items-center justify-center text-[10px]">$</span> Thêm chi phí
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* HIỂN THỊ BADGE KHI KHÔNG ACTIVE NHƯNG CÓ DỮ LIỆU */}
                              {!isActive && (dest.timeRange || (expenseStats.byDest[dest.id] || 0) > 0) && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {dest.timeRange && dest.timeRange.trim() !== '' && <span className="bg-indigo-50 px-2 py-1 rounded-md text-[11px] font-bold text-indigo-700">{dest.timeRange}</span>}
                                  {(expenseStats.byDest[dest.id] || 0) > 0 && <span className="bg-indigo-50 px-2 py-1 rounded-md text-[11px] font-bold text-indigo-700">{formatVND(expenseStats.byDest[dest.id])}</span>}
                                </div>
                              )}

                              {/* Quãng đường & thời gian tới điểm kế tiếp (OSRM) */}
                              <LegChip leg={routeData[day.id]?.legByFrom?.[dest.id]} />

                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {addingDayId === day.id ? (
                    <div ref={searchRef} className="relative mt-4 pl-12">
                      <div className="flex items-center border border-[#FF5645] rounded-xl px-4 py-3 bg-white shadow-sm ring-4 ring-[#FF5645]/10">
                        <Search className="w-5 h-5 text-[#FF5645] mr-3" />
                        <input type="text" autoFocus placeholder="Tìm quán ăn, khách sạn..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 outline-none text-base bg-transparent font-medium" />
                        <button onClick={() => { setAddingDayId(null); setSearchQuery(''); }} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
                      </div>
                      
                      {suggestions.length > 0 && (
                        <div className="absolute top-full left-12 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden">
                          {suggestions.map((place, idx) => (
                            <div key={idx} onClick={() => handleAddDestination(place, day.id)} className="px-5 py-4 hover:bg-orange-50 cursor-pointer border-b border-slate-50 last:border-0 flex items-start gap-3">
                              <MapPin className="w-5 h-5 text-[#FF5645] mt-0.5 flex-shrink-0" />
                              <div><p className="text-base font-bold text-slate-800">{place.name}</p><p className="text-sm text-slate-500 truncate max-w-[300px]">{place.address}</p></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="pl-12 mt-2">
                      <button onClick={() => setAddingDayId(day.id)} className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 text-sm font-bold hover:border-[#FF5645] hover:text-[#FF5645] hover:bg-orange-50/50 transition-colors flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> Add place to Day {day.dayNumber}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- TAB 3: BUDGET --- */}
        {activeSection === 'budget' && (
          <div className="p-6 sm:p-10 max-w-3xl mx-auto">
            <div className="flex items-center justify-between gap-4 mb-6">
              <h2 className="text-4xl font-extrabold text-slate-900">Ngân sách</h2>
              <button
                onClick={() => openExpenseDialog()}
                className="flex items-center gap-2 px-5 py-3 bg-[#FF5645] text-white font-bold text-sm rounded-full hover:bg-[#E04B3B] transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" /> Thêm chi phí
              </button>
            </div>

            {/* Thẻ tổng quan */}
            <div className="bg-slate-100/70 rounded-3xl p-6 border border-slate-200/60 mb-10">
              <div className="flex items-end justify-between gap-4 mb-3">
                <p className="text-4xl font-extrabold text-slate-900">{formatVND(expenseStats.spent)}</p>
                <p className="text-xs font-semibold text-slate-500 mb-1.5 text-right">
                  {expenseStats.budget > 0 ? `Ngân sách: ${formatVND(expenseStats.budget)}` : 'Chưa đặt ngân sách'}
                </p>
              </div>
              <div className="h-2 rounded-full bg-slate-300/70 overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    expenseStats.remaining < 0 ? 'bg-rose-500' : expenseStats.percent >= 80 ? 'bg-amber-400' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${expenseStats.budget > 0 ? Math.min(100, expenseStats.percent) : 0}%` }}
                />
              </div>
              {expenseStats.budget > 0 && (
                <p className={`text-xs font-semibold ${expenseStats.remaining < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                  {expenseStats.remaining < 0
                    ? `Vượt ngân sách ${formatVND(-expenseStats.remaining)}`
                    : `Đã dùng ${expenseStats.percent}% · còn lại ${formatVND(expenseStats.remaining)}`}
                </p>
              )}
              <div className="flex flex-wrap gap-3 mt-5">
                <button
                  onClick={() => { setBudgetInput(expenseStats.budget > 0 ? String(expenseStats.budget) : ''); setBudgetDialogOpen(true); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-200/70 hover:bg-slate-200 text-slate-800 font-bold text-sm rounded-full transition-colors"
                >
                  <Pencil className="w-4 h-4" /> {expenseStats.budget > 0 ? 'Sửa ngân sách' : 'Đặt ngân sách'}
                </button>
                <button
                  onClick={openBalanceDialog}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-200/70 hover:bg-slate-200 text-slate-800 font-bold text-sm rounded-full transition-colors"
                >
                  <Users className="w-4 h-4" /> Cân đối nhóm
                </button>
                <button
                  onClick={() => setBreakdownOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-200/70 hover:bg-slate-200 text-slate-800 font-bold text-sm rounded-full transition-colors"
                >
                  <Receipt className="w-4 h-4" /> Phân tích chi tiêu
                </button>
              </div>
            </div>

            {/* Danh sách chi phí */}
            <div className="flex items-center justify-between gap-4 mb-2">
              <h3 className="text-2xl font-extrabold text-slate-900">Chi phí</h3>
              <label className="text-sm text-slate-600">
                <span className="font-bold">Sắp xếp:</span>{' '}
                <select
                  value={expenseSort}
                  onChange={(e) => setExpenseSort(e.target.value)}
                  className="bg-transparent outline-none font-semibold cursor-pointer"
                >
                  <option value="newest">Ngày (mới nhất)</option>
                  <option value="oldest">Ngày (cũ nhất)</option>
                  <option value="amount">Số tiền (cao nhất)</option>
                </select>
              </label>
            </div>

            {sortedExpenses.length === 0 ? (
              <div className="py-14 text-center text-slate-400">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-semibold">Chưa có khoản chi nào</p>
                <p className="text-sm">Bấm "Thêm chi phí" để bắt đầu theo dõi chi tiêu của chuyến đi.</p>
              </div>
            ) : (
              sortedExpenses.map((exp) => {
                const Icon = (CATEGORY_MAP[exp.category] || CATEGORY_MAP.OTHER).Icon;
                return (
                  <div key={exp.id} className="flex items-center gap-4 py-4 border-b border-slate-200 last:border-0">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 truncate">{exp.title}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {formatDayDate(exp.expenseDate)} • {(CATEGORY_MAP[exp.category] || CATEGORY_MAP.OTHER).label}
                        {exp.description ? ` • ${exp.description}` : ''}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        Trả bởi {exp.payerId === expenseData.currentUserId ? 'bạn' : exp.payerName}
                        {exp.splits.length > 1 ? ` • chia ${exp.splits.length} người` : ''}
                      </p>
                    </div>
                    <p className="font-bold text-slate-900 shrink-0">{formatVND(exp.amount)}</p>
                    <button
                      onClick={() => deleteExpense(exp)}
                      aria-label="Xóa khoản chi"
                      className="shrink-0 h-8 w-8 rounded-full text-slate-300 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ================= CỘT 3. BẢN ĐỒ VÀ PANEL CHI TIẾT ĐỊA ĐIỂM ================= */}
      <div className="hidden md:block w-1/3 lg:w-[45%] relative z-0 border-l border-slate-200">
        
        {/* PANEL TRƯỢT (NỔI TRÊN BẢN ĐỒ) */}
        <div className={`absolute top-4 left-4 bottom-4 w-[400px] bg-white rounded-3xl shadow-2xl z-[1000] border border-slate-100 flex flex-col overflow-hidden transition-transform duration-500 ease-in-out ${activeDestination && isPanelOpen ? 'translate-x-0 opacity-100 pointer-events-auto' : '-translate-x-[120%] opacity-0 pointer-events-none'}`}>
          {activeDestination && (
            <>
              {/* Ảnh bìa Panel (Lấy động từ Tab Bài đăng) */}
              <div className="relative h-56 bg-slate-800 flex-shrink-0">
                                    <img 
                      src={coverImage || `https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?q=80&w=800&auto=format&fit=crop`} 
                      alt="Cover" 
                      className="w-full h-full object-cover opacity-90 transition-opacity" 
                      onError={(e) => {
                        // Nếu ảnh hỏng hoặc lỗi mạng, tự động fallback về ảnh mặc định an toàn
                        e.target.src = 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?q=80&w=800&auto=format&fit=crop';
                      }}
                    />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <button onClick={() => setIsPanelOpen(false)} className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/40 backdrop-blur transition-colors"><X className="w-4 h-4" /></button>
                <div className="absolute bottom-4 left-5 right-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-[#FF5645] text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">{activeDestination.index}</span>
                  </div>
                  <h3 className="text-2xl font-extrabold text-white text-shadow-md leading-tight">{activeDestination.placeName}</h3>
                </div>
              </div>

              {/* Tabs Menu */}
              <div className="flex border-b border-slate-100 flex-shrink-0 bg-white">
                <button onClick={() => setInfoTab('intro')} className={`flex-1 py-3.5 text-sm font-bold border-b-2 transition-colors ${infoTab === 'intro' ? 'border-[#FF5645] text-[#FF5645]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Giới thiệu</button>
                <button onClick={() => setInfoTab('reviews')} className={`flex-1 py-3.5 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${infoTab === 'reviews' ? 'border-[#FF5645] text-[#FF5645]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                  Đánh giá <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md text-[10px]">{placeReviews.length}</span>
                </button>
                <button onClick={() => setInfoTab('posts')} className={`flex-1 py-3.5 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${infoTab === 'posts' ? 'border-[#FF5645] text-[#FF5645]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                  Bài đăng <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md text-[10px]">{placePosts.length}</span>
                </button>
              </div>

              {/* Nội dung Tabs */}
              <div className="flex-1 overflow-y-auto p-5 scroll-smooth bg-slate-50">
                
                {/* --- 1. GIỚI THIỆU TỪ WIKIPEDIA --- */}
                {infoTab === 'intro' && (
                  <div className="space-y-4">
                    {placeInfo.loading ? (
                      <div className="animate-pulse space-y-3"><div className="h-4 bg-slate-200 rounded w-3/4"></div><div className="h-4 bg-slate-200 rounded w-full"></div></div>
                    ) : (
                      <p className="text-slate-600 text-[15px] leading-relaxed font-medium">{placeInfo.extract}</p>
                    )}
                  </div>
                )}

                {/* --- 2. ĐÁNH GIÁ (RATING & REVIEWS) --- */}
                {infoTab === 'reviews' && (
                  <div className="space-y-6">
                    
                    {/* KHU VỰC 1: TÓM TẮT ĐÁNH GIÁ (Google Maps Style) */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                      <h4 className="font-bold text-slate-900 mb-4 flex items-center justify-between">
                        Tóm tắt bài đánh giá
                        <div className="h-5 w-5 rounded-full border border-slate-300 text-slate-400 flex items-center justify-center text-[10px]">?</div>
                      </h4>
                      
                      <div className="flex gap-6 items-center mb-6">
                        {/* Cột trái: Thanh tiến trình */}
                        <div className="flex-1 space-y-1.5">
                          {[5, 4, 3, 2, 1].map(star => {
                            const count = reviewStats.distribution[star];
                            const percent = reviewStats.total > 0 ? (count / reviewStats.total) * 100 : 0;
                            return (
                              <div key={star} className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                <span className="w-2">{star}</span>
                                <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${percent}%` }}></div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        
                        {/* Cột phải: Điểm số trung bình */}
                        <div className="flex flex-col items-center justify-center w-24">
                          <span className="text-4xl font-normal text-slate-900">{reviewStats.avg.toString().replace('.', ',')}</span>
                          <div className="flex gap-0.5 my-1">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star key={s} className={`w-3 h-3 ${s <= Math.round(reviewStats.avg) ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-200'}`} />
                            ))}
                          </div>
                          <span className="text-xs font-medium text-sky-700">{reviewStats.total} bài viết</span>
                        </div>
                      </div>

                      {/* Nút bật Form viết đánh giá */}
                      {!showReviewForm && (
                        <div className="flex justify-center border-t border-slate-50 pt-4">
                          <button 
                            onClick={() => setShowReviewForm(true)}
                            className="bg-cyan-50 text-cyan-700 font-medium text-sm px-6 py-2 rounded-full flex items-center gap-2 hover:bg-cyan-100 transition-colors"
                          >
                            <MessageSquare className="w-4 h-4" /> Viết bài đánh giá
                          </button>
                        </div>
                      )}
                    </div>

                    {/* KHU VỰC 2: FORM ĐÁNH GIÁ (Ẩn/Hiện) */}
                    {showReviewForm && (
                      <div className="bg-white p-4 rounded-2xl border border-cyan-100 shadow-sm relative animate-fade-in">
                        <button onClick={() => setShowReviewForm(false)} className="absolute top-2 right-2 p-1 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-4 h-4"/></button>
                        <h4 className="text-sm font-bold text-slate-800 mb-2 text-center">Trải nghiệm của bạn?</h4>
                        <div className="flex gap-1.5 mb-3 justify-center">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} onClick={() => setNewReviewRating(star)} className={`w-8 h-8 cursor-pointer transition-colors ${star <= newReviewRating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                          ))}
                        </div>
                        <div className="flex flex-col gap-2">
                          <textarea 
                            value={newReviewText} 
                            onChange={(e) => setNewReviewText(e.target.value)} 
                            placeholder="Chia sẻ thêm chi tiết (không bắt buộc)..." 
                            className="w-full bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500/20 border border-slate-200 transition-all resize-none h-20" 
                          />
                          <MediaPicker files={newReviewFiles} onChange={setNewReviewFiles} disabled={isSubmittingReview} />
                          <div className="flex justify-end mt-1">
                             <button onClick={submitReview} disabled={isSubmittingReview} className="bg-cyan-600 text-white font-bold text-sm px-5 py-2 rounded-full hover:bg-cyan-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                              {isSubmittingReview ? uploadLabel : <><Send className="w-4 h-4" /> Đăng</>}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* KHU VỰC 3: DANH SÁCH ĐÁNH GIÁ (Có Xem thêm) */}
                    <div className="space-y-0">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-bold text-slate-900 text-lg">Tất cả các bài đánh giá</h4>
                        <button className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-cyan-600 hover:bg-slate-50">
                          <Search className="w-4 h-4" />
                        </button>
                      </div>

                      {placeReviews.length === 0 ? (
                        <p className="text-center text-sm text-slate-500 py-6">Chưa có đánh giá nào.</p>
                      ) : (
                        <div className="space-y-4">
                          {placeReviews.slice(0, visibleReviewsCount).map(review => (
                            <div key={review.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                              
                              {/* Đã bọc thép hàm lấy chữ cái đầu */}
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-700 text-sm font-bold flex items-center justify-center">
                                    {review.authorAvatar ? <img src={review.authorAvatar} className="w-full h-full rounded-full object-cover"/> : getInitial(review.authorName)}
                                  </div>
                                  <div>
                                    <span className="text-sm font-bold text-slate-900 block leading-none mb-1">{review.authorName}</span>
                                    <span className="text-[11px] text-slate-500 flex items-center gap-1">Local Guide • 1 bài đánh giá</span>
                                  </div>
                                </div>
                                <button className="text-slate-400 hover:bg-slate-100 p-1 rounded-full"><MoreHorizontal className="w-4 h-4" /></button>
                              </div>

                              {/* Rating & Date */}
                              <div className="flex items-center gap-2 mb-2">
                                <div className="flex gap-0.5">
                                  {[1,2,3,4,5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-200'}`} />)}
                                </div>
                                <span className="text-xs text-slate-500">{new Date(review.createdAt).toLocaleDateString('vi-VN')}</span>
                              </div>

                              {/* Content */}
                              {review.content && <p className="text-[14px] text-slate-700 mb-4 leading-relaxed">{review.content}</p>}
                              <ReviewMediaGrid media={review.media} />
                              
                              {/* Actions (Thích / Chia sẻ) */}
                              <div className="flex items-center gap-6 pt-1">
                                <button onClick={() => toggleLikeReview(review.id)} className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${review.likedByMe ? 'text-cyan-600' : 'text-slate-600 hover:text-slate-900'}`}>
                                  <svg className={`w-4 h-4 ${review.likedByMe ? 'fill-cyan-600' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                                  Thích {review.likesCount > 0 ? `(${review.likesCount})` : ''}
                                </button>
                                <button className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
                                  <Share2 className="w-4 h-4" /> Chia sẻ
                                </button>
                              </div>
                            </div>
                          ))}

                          {/* Nút Xem thêm */}
                          {visibleReviewsCount < placeReviews.length && (
                            <button 
                              onClick={() => setVisibleReviewsCount(prev => prev + 5)}
                              className="w-full py-3 mt-2 rounded-full border border-slate-200 text-sm font-semibold text-cyan-700 hover:bg-slate-50 transition-colors"
                            >
                              Xem thêm bài đánh giá
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* --- 3. BÀI ĐĂNG TỪ MẠNG XÃ HỘI (Lấy từ /api/posts) --- */}
                {infoTab === 'posts' && (
                  <div>
                    {placePosts.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm font-medium">Chưa có bài check-in nào.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {placePosts.map(post => {
                          if (!post.imageUrls || post.imageUrls.length === 0) return null;
                          return (
                            <div key={post.id} className="relative aspect-[4/5] rounded-2xl overflow-hidden group cursor-pointer shadow-sm border border-slate-200">
                              <img src={post.imageUrls[0]} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Checkin" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 text-white">
                                <span className="text-xs font-bold truncate drop-shadow-md">@{post.authorName}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* BẢN ĐỒ LEAFLET CHÍNH */}
        <MapContainer center={[16.047079, 108.206230]} zoom={5} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution='&copy; Google Maps' />
          
          <MapBounds
            points={mapStops.map(s => [s.lat, s.lng])}
            boundsKey={boundsKey}
            activePoint={(() => {
              const a = activeDestination ? mapStops.find(s => s.id === activeDestination.id) : null;
              return a ? [a.lat, a.lng] : null;
            })()}
            activeKey={activeDestination?.id ?? null}
          />

          {/* Đường đi thực tế (OSRM) theo từng ngày; đoạn không tìm được đường bộ vẽ nét đứt */}
          {routeDays
            .filter(d => !focusedDayId || d.id === focusedDayId)
            .map(d => (routeData[d.id]?.segments || []).map((seg, i) => (
              <Polyline
                key={`${d.id}-${i}-${seg.approx ? 'approx' : 'road'}-${d.color}`}
                positions={seg.positions}
                color={d.color}
                weight={4}
                opacity={0.8}
                dashArray={seg.approx ? '8 10' : undefined}
              />
            )))}

          {/* Cắm cờ các điểm đến (số thứ tự khớp với danh sách trong từng ngày) */}
          {mapStops.map((s) => (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={getMarkerIcon(s.number, activeDestination?.id === s.id, s.color)}
              eventHandlers={{ click: () => handleDestinationClick(s.dest, s.number - 1) }}
            />
          ))}
        </MapContainer>
      </div>

      {/* ================= DIALOG THÊM CHI PHÍ ================= */}
      {expenseDialog && (
        <div
          className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-4"
          onClick={closeExpenseDialog}
        >
          <div
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            {expenseDialog.step === 'item' && (
              <button
                onClick={() => setExpenseDialog({ step: 'form' })}
                aria-label="Quay lại"
                className="absolute top-4 left-4 h-8 w-8 rounded-full text-slate-600 flex items-center justify-center hover:bg-slate-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={closeExpenseDialog}
              aria-label="Đóng"
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {expenseDialog.step === 'form' ? (
              <>
                <h3 className="text-xl font-extrabold text-slate-900 text-center mb-6 px-8">Thêm chi phí</h3>

                {/* Số tiền */}
                <label className="flex items-center gap-3 border border-slate-300 rounded-xl px-4 py-3 mb-3 focus-within:border-slate-500 transition-colors">
                  <span className="font-bold text-slate-700">₫</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    autoFocus
                    value={expenseForm.amount}
                    onChange={(e) => updateExpenseForm({ amount: e.target.value })}
                    placeholder="0"
                    className="w-full bg-transparent outline-none text-lg font-bold text-slate-800 placeholder:text-slate-300"
                  />
                </label>

                {/* Chọn mục */}
                <button
                  type="button"
                  onClick={() => setExpenseDialog({ step: 'item' })}
                  className="w-full flex items-center gap-3 border border-slate-300 rounded-xl px-4 py-3 mb-3 text-left hover:bg-slate-50 transition-colors"
                >
                  {(() => {
                    const ItemIcon = selectedExpenseDest ? MapPin : (selectedExpenseCategory ? selectedExpenseCategory.Icon : Receipt);
                    return <ItemIcon className="w-5 h-5 text-slate-600 shrink-0" />;
                  })()}
                  <div className="min-w-0 flex-1">
                    <p className={`truncate ${selectedExpenseDest || selectedExpenseCategory ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
                      {selectedExpenseDest ? selectedExpenseDest.placeName : (selectedExpenseCategory ? selectedExpenseCategory.label : 'Chọn mục')}
                    </p>
                    {selectedExpenseDest && (
                      <p className="text-xs text-slate-500">Danh mục: {(selectedExpenseCategory || CATEGORY_MAP.OTHER).label}</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 shrink-0" />
                </button>

                {/* Mô tả: hiện sau khi đã chọn mục */}
                {(selectedExpenseDest || selectedExpenseCategory) && (
                  <label className="block border border-slate-300 rounded-xl px-4 pt-2 pb-1 mb-3 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                    <span className="text-xs font-bold text-slate-900 block">Thêm mô tả</span>
                    <textarea
                      value={expenseForm.description}
                      onChange={(e) => updateExpenseForm({ description: e.target.value })}
                      maxLength={500}
                      className="w-full bg-transparent outline-none text-sm text-slate-700 resize-none h-14"
                    />
                  </label>
                )}

                {/* Trả bởi */}
                <label className="flex items-center justify-between gap-3 border border-slate-300 rounded-xl px-4 py-3 mb-3">
                  <span className="font-bold text-slate-900 shrink-0">Trả bởi</span>
                  <select
                    value={expenseForm.payerId ?? ''}
                    onChange={(e) => updateExpenseForm({ payerId: Number(e.target.value) })}
                    className="bg-transparent outline-none font-semibold text-slate-700 text-right cursor-pointer min-w-0"
                  >
                    {expenseData.members.map(m => (
                      <option key={m.userId} value={m.userId}>
                        {m.userId === expenseData.currentUserId ? `Bạn (${m.fullName})` : m.fullName}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Chia tiền */}
                <div className="border border-slate-300 rounded-xl px-4 py-3 mb-3">
                  <label className="flex items-center justify-between gap-3">
                    <span className="font-bold text-slate-900">Chia tiền</span>
                    <select
                      value={expenseForm.splitMode}
                      onChange={(e) => updateExpenseForm({ splitMode: e.target.value })}
                      className="bg-transparent outline-none font-semibold text-slate-700 text-right cursor-pointer"
                    >
                      <option value="none">Không chia</option>
                      <option value="equal">Chia đều</option>
                    </select>
                  </label>
                  {expenseForm.splitMode === 'equal' && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
                      {expenseData.members.map(m => {
                        const checked = expenseForm.splitUserIds.includes(m.userId);
                        return (
                          <label key={m.userId} className="flex items-center justify-between gap-3 cursor-pointer">
                            <span className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSplitUser(m.userId)}
                                className="h-4 w-4 accent-[#FF5645]"
                              />
                              <span className="truncate text-sm text-slate-700">
                                {m.userId === expenseData.currentUserId ? `Bạn (${m.fullName})` : m.fullName}
                              </span>
                            </span>
                            {checked && splitShare > 0 && (
                              <span className="text-xs font-semibold text-slate-500 shrink-0">≈ {formatVND(splitShare)}</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Ngày */}
                <label className="flex items-center justify-between gap-3 px-1 mb-5 text-sm">
                  <span className="text-slate-600"><span className="font-bold">Ngày:</span> Tùy chọn</span>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => updateExpenseForm({ date: e.target.value })}
                    className="border border-slate-200 rounded-lg px-2 py-1 text-slate-700 outline-none focus:border-slate-400"
                  />
                </label>

                {expenseError && <p className="text-sm text-rose-600 font-medium mb-3 text-center">{expenseError}</p>}

                <div className="flex justify-center">
                  <button
                    onClick={submitExpense}
                    disabled={isSavingExpense}
                    className="px-14 py-3 bg-[#FF5645] text-white font-bold rounded-full hover:bg-[#E04B3B] transition-colors disabled:opacity-50"
                  >
                    {isSavingExpense ? 'Đang lưu...' : 'Lưu'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-extrabold text-slate-900 text-center mb-6 px-8">Chọn mục</h3>

                <p className="font-bold text-slate-900 mb-3">Chọn từ lịch trình của bạn</p>
                {allDestinations.length === 0 ? (
                  <p className="text-sm text-slate-400 mb-2">Lịch trình chưa có địa điểm nào.</p>
                ) : (
                  <div className="mb-1">
                    {(showAllDests ? allDestinations : allDestinations.slice(0, 3)).map(d => (
                      <button
                        key={d.id}
                        onClick={() => { updateExpenseForm({ destinationId: d.id }); setExpenseDialog({ step: 'form' }); }}
                        className="w-full flex items-center gap-3 py-2 px-1 text-left rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <span className="h-9 w-9 shrink-0 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                          <MapPin className="w-4 h-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-slate-800 font-medium">{d.placeName}</span>
                          <span className="block text-xs text-slate-400">Day {d.dayNumber}</span>
                        </span>
                        {expenseForm.destinationId === d.id && <span className="text-xs font-bold text-[#FF5645]">Đã chọn</span>}
                      </button>
                    ))}
                    {allDestinations.length > 3 && (
                      <button
                        onClick={() => setShowAllDests(v => !v)}
                        className="w-full flex items-center gap-3 py-2 px-1 text-left rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <span className="h-9 w-9 shrink-0 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                          <MoreHorizontal className="w-4 h-4" />
                        </span>
                        <span className="text-slate-800 font-medium">{showAllDests ? 'Thu gọn' : 'Xem tất cả'}</span>
                      </button>
                    )}
                  </div>
                )}
                {expenseForm.destinationId && (
                  <button
                    onClick={() => updateExpenseForm({ destinationId: null })}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    Bỏ chọn địa điểm
                  </button>
                )}

                <hr className="my-5 border-slate-200" />

                <p className="font-bold text-slate-900 mb-3">Hoặc chọn theo danh mục</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {EXPENSE_CATEGORIES.map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      onClick={() => { updateExpenseForm({ category: key }); setExpenseDialog({ step: 'form' }); }}
                      className={`flex flex-col items-center justify-center gap-2 rounded-xl py-4 text-xs font-semibold transition-colors ${
                        expenseForm.category === key
                          ? 'bg-red-50 text-[#FF5645] ring-1 ring-[#FF5645]'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= DIALOG SỬA NGÂN SÁCH ================= */}
      {budgetDialogOpen && (
        <div
          className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-4"
          onClick={() => { if (!isSavingBudget) setBudgetDialogOpen(false); }}
        >
          <div
            className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setBudgetDialogOpen(false)}
              aria-label="Đóng"
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-xl font-extrabold text-slate-900 text-center mb-6 px-8">Ngân sách chuyến đi</h3>
            <label className="flex items-center gap-3 border border-slate-300 rounded-xl px-4 py-3 focus-within:border-slate-500 transition-colors">
              <span className="font-bold text-slate-700">₫</span>
              <input
                type="number"
                min="0"
                step="100000"
                autoFocus
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveBudget(); }}
                placeholder="VD: 10000000"
                className="w-full bg-transparent outline-none text-lg font-bold text-slate-800 placeholder:text-slate-300"
              />
            </label>
            <p className="text-sm text-slate-500 mt-2 h-5">{Number(budgetInput) > 0 ? `= ${formatVND(budgetInput)}` : ''}</p>
            <div className="flex justify-center mt-4">
              <button
                onClick={saveBudget}
                disabled={isSavingBudget}
                className="px-12 py-3 bg-[#FF5645] text-white font-bold rounded-full hover:bg-[#E04B3B] transition-colors disabled:opacity-50"
              >
                {isSavingBudget ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DIALOG CÂN ĐỐI NHÓM ================= */}
      {balanceDialog && (
        <div
          className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setBalanceDialog(null)}
        >
          <div
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setBalanceDialog(null)}
              aria-label="Đóng"
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-xl font-extrabold text-slate-900 text-center mb-6 px-8">Cân đối nhóm</h3>

            {balanceDialog.loading && <p className="text-center text-slate-500">Đang tính toán...</p>}
            {balanceDialog.error && <p className="text-center text-rose-600 font-medium">{balanceDialog.error}</p>}

            {balanceDialog.data && (
              <>
                <p className="font-bold text-slate-900 mb-3">Số dư của mỗi người</p>
                <div className="mb-6">
                  {balanceDialog.data.balances.map(b => {
                    const balance = Number(b.balance);
                    return (
                      <div key={b.userId} className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0">
                        <span className="truncate text-slate-800 font-medium">
                          {b.userId === expenseData.currentUserId ? `Bạn (${b.fullName})` : b.fullName}
                        </span>
                        <span className={`shrink-0 text-sm font-bold ${balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          {balance > 0 ? `được nhận ${formatVND(balance)}` : balance < 0 ? `còn nợ ${formatVND(-balance)}` : 'đã cân bằng'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p className="font-bold text-slate-900 mb-3">Cách thanh toán</p>
                {balanceDialog.data.transfers.length === 0 ? (
                  <p className="text-sm text-slate-500">Không ai nợ ai, mọi khoản tiền đã cân bằng.</p>
                ) : (
                  balanceDialog.data.transfers.map((t, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0">
                      <span className="min-w-0 text-sm text-slate-700">
                        <span className="font-bold">{t.fromUserId === expenseData.currentUserId ? 'Bạn' : t.fromName}</span>
                        {' '}chuyển cho{' '}
                        <span className="font-bold">{t.toUserId === expenseData.currentUserId ? 'bạn' : t.toName}</span>
                      </span>
                      <span className="shrink-0 font-bold text-slate-900">{formatVND(t.amount)}</span>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= DIALOG PHÂN TÍCH CHI TIÊU ================= */}
      {breakdownOpen && (
        <div
          className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setBreakdownOpen(false)}
        >
          <div
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setBreakdownOpen(false)}
              aria-label="Đóng"
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-xl font-extrabold text-slate-900 text-center mb-6 px-8">Phân tích chi tiêu</h3>

            {categoryTotals.length === 0 ? (
              <p className="text-center text-slate-500">Chưa có khoản chi nào để phân tích.</p>
            ) : (
              categoryTotals.map(({ key, label, Icon, amount, percent }) => (
                <div key={key} className="mb-4">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Icon className="w-4 h-4 text-slate-500" /> {label}
                    </span>
                    <span className="text-sm font-bold text-slate-900">{formatVND(amount)} <span className="text-slate-400 font-medium">({percent}%)</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================= DIALOG ĐÁNH GIÁ SAU KHI "ĐÃ ĐI" ================= */}
      {visitDialog && (
        <div
          className="fixed inset-0 z-[3000] bg-black/50 flex items-center justify-center p-4"
          onClick={closeVisitDialog}
        >
          <div
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl p-6 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeVisitDialog}
              aria-label="Đóng"
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-extrabold text-slate-900 text-center mb-6 px-8">Trải nghiệm của bạn tại đây</h3>

            {/* Thẻ địa điểm + chip ngày/giờ */}
            <div className="bg-slate-100 rounded-2xl p-4 mb-5">
              <p className="font-extrabold text-slate-900 mb-2">{visitDialog.dest.placeName}</p>
              <div className="flex flex-wrap gap-2">
                {formatDayDate(visitDialog.dayDate) && (
                  <span className="bg-indigo-50 px-2.5 py-1 rounded-full text-[12px] font-bold text-indigo-700">{formatDayDate(visitDialog.dayDate)}</span>
                )}
                {visitDialog.dest.timeRange && (
                  <span className="bg-indigo-50 px-2.5 py-1 rounded-full text-[12px] font-bold text-indigo-700">{visitDialog.dest.timeRange}</span>
                )}
              </div>
            </div>

            {/* Chọn số sao */}
            <div className="flex gap-1.5 justify-center mb-5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  onClick={() => { setVisitRating(star); setVisitError(''); }}
                  className={`w-9 h-9 cursor-pointer transition-colors ${star <= visitRating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`}
                />
              ))}
            </div>

            {/* Ảnh / video đính kèm */}
            <div className="mb-5">
              <MediaPicker files={visitFiles} onChange={setVisitFiles} disabled={isSubmittingVisit} />
            </div>

            {/* Nội dung đánh giá */}
            <label className="block border border-slate-300 rounded-xl px-3 pt-2 pb-1 focus-within:border-slate-500 transition-colors">
              <span className="text-xs font-bold text-slate-900 block">Đánh giá của bạn</span>
              <textarea
                value={visitNote}
                onChange={(e) => setVisitNote(e.target.value)}
                placeholder="Chia sẻ cảm nhận về chuyến thăm (không bắt buộc)..."
                className="w-full bg-transparent outline-none text-sm text-slate-700 resize-none h-20 placeholder:text-slate-400"
              />
            </label>

            {visitError && <p className="text-sm text-rose-600 font-medium mt-3">{visitError}</p>}

            <button
              onClick={submitVisitReview}
              disabled={isSubmittingVisit}
              className="w-full mt-6 py-4 bg-[#FF5645] text-white font-extrabold rounded-full hover:bg-[#E04B3B] transition-colors disabled:opacity-50"
            >
              {isSubmittingVisit ? uploadLabel : 'Lưu đánh giá'}
            </button>
            <p className="text-center text-xs text-slate-400 mt-3">Bạn có thể bỏ qua, địa điểm vẫn được đánh dấu là đã đi.</p>
          </div>
        </div>
      )}
    </div>
  );
};

const ChevronDownIcon = ({ isOpen }) => (
  <svg className={`w-4 h-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
);

const ReservationIcon = ({ icon, label }) => (
  <div className="flex flex-col items-center gap-1.5 cursor-pointer hover:text-slate-900 transition-colors">
    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 text-slate-500">{icon}</div>
    <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
  </div>
);

export default TripDetail;