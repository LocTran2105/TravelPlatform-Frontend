import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import { 
  ArrowLeft, Calendar, MapPin, Plus, 
  X, Users, Receipt,
  Share2, MoreHorizontal,
  LayoutDashboard, CalendarDays, Wallet, Camera,
  Star,
  Trash2, Pencil
} from 'lucide-react';
import AiAssistantChat from './AiAssistantChat';
import ShareTripModal from './ShareTripModal';
import TripMembersStack from './TripMembersStack';
import TripMembersDialog from './TripMembersDialog';
import TripCoverImage from './TripCoverImage';
import CoverImagePicker from './CoverImagePicker';
import { usePlaceCovers, usePlaceActivity, getDestPlaceId } from './PlaceHoverPreview';
import ItineraryDay from './ItineraryDay';
import PlaceInfoPanel, { MediaPicker } from './PlaceInfoPanel';
import ReportDialog from './ReportDialog';
import TripMap from './TripMap';
import ExpenseDialogs from './ExpenseDialogs';
import { presetForDay } from '../utils/directions';
import { DAY_COLORS, formatFullDate, formatVND, EXPENSE_CATEGORIES, CATEGORY_MAP } from '../utils/tripDetail';

// Thẻ địa điểm AI (AiAssistantChat) gửi payload JSON với MIME này khi kéo.
const PLACE_MIME_TYPE = 'application/x-travel-place';
// Kéo thả để sắp xếp lại địa điểm đã có trong lịch trình (trong ngày hoặc sang ngày khác).
const DEST_MIME_TYPE = 'application/x-travel-destination';

// '2026-10-14' -> '14/10'
const formatDayDate = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return m ? `${m[3]}/${m[2]}` : (d || '');
};

// Các phần của trang, theo thứ tự từ trên xuống (cuộn liên tục kiểu Wanderlog)
const SECTION_IDS = ['overview', 'itinerary', 'budget'];
const SPY_OFFSET = 140; // phần nào chạm vạch cách mép trên khung cuộn 140px thì được coi là đang xem

// ================= NGÂN SÁCH & CHI TIÊU =================
const MAX_MONEY = 1_000_000_000_000; // 1.000 tỷ ₫, khớp giới hạn kiểm tra ở backend

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

// ================= TUYẾN ĐƯỜNG (OSRM) =================
// Đổi sang server OSRM của bạn khi triển khai thật (server công cộng chỉ để demo, tối đa 1 request/giây)
const OSRM_BASE_URL = 'https://router.project-osrm.org';
const OSRM_MIN_INTERVAL_MS = 1000;

const hasCoord = (d) => {
  if (!d || d.latitude == null || d.longitude == null
      || String(d.latitude).trim() === '' || String(d.longitude).trim() === '') return false;
  const lat = Number(d.latitude);
  const lng = Number(d.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

const isValidLatLng = (lat, lng) => Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
  && Number(lat) >= -90 && Number(lat) <= 90
  && Number(lng) >= -180 && Number(lng) <= 180;

// Cache tọa độ Photon trong phiên để không geocode lặp khi React render lại.
const destinationGeocodeCache = new Map();

// Khoảng cách đường chim bay (mét) - dùng khi không tìm được đường bộ
const haversineMeters = (a, b) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
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

// Nút trong thanh bên: mục đang xem có nền đỏ nhạt + vạch đỏ bên trái
const SidebarNavButton = ({ icon: Icon, label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'true' : undefined}
    className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
      active ? 'bg-red-50 text-[#FF5645]' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`}
  >
    {active && <span className="absolute bottom-2 left-0 top-2 w-1 rounded-full bg-[#FF5645]" />}
    <Icon className="h-[18px] w-[18px] shrink-0" />
    <span className="flex-1 text-left">{label}</span>
  </button>
);

// Id người đang đăng nhập (Login lưu object user vào localStorage)
const readMyId = () => {
  try {
    const id = JSON.parse(localStorage.getItem('user') || 'null')?.id;
    return id === undefined || id === null ? null : String(id);
  } catch {
    return null;
  }
};

const TripDetail = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  
  const [trip, setTrip] = useState(null);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [isItineraryExpanded, setIsItineraryExpanded] = useState(true); // danh sách ngày trong thanh bên mặc định mở
  
  const [focusedDayId, setFocusedDayId] = useState(null);
  const [activeDestination, setActiveDestination] = useState(null);
  const [routeData, setRouteData] = useState({}); // { [dayId]: { segments, legs, legByFrom } }
  const [mapPanelWidth, setMapPanelWidth] = useState(460);
  const [isResizingMap, setIsResizingMap] = useState(false);
  const mapResizeStartRef = useRef(null);
  const [geocodedCoordinates, setGeocodedCoordinates] = useState({});
  const geocodeAttemptedRef = useRef(new Set());

  const [addingDayId, setAddingDayId] = useState(null);
  // Thông báo hiện trên ô tìm kiếm khi người dùng kéo một gợi ý "Tham khảo" (AI chưa xác minh vị trí).
  const [searchNotice, setSearchNotice] = useState(null); // { dayId, name } | null
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  
  // ================= STATES CHO PANEL TRƯỢT =================
  const [coverImage, setCoverImage] = useState('');
  const [placeInfo, setPlaceInfo] = useState({ extract: '', loading: false });
  const [placeReviews, setPlaceReviews] = useState([]); 
  const [placePosts, setPlacePosts] = useState([]); 
  const [infoTab, setInfoTab] = useState('intro');
  // Báo cáo đánh giá địa điểm vi phạm: reportTarget = đánh giá đang mở hộp thoại; reportedReviewIds = các đánh giá đã báo cáo trong phiên này
  const [reportTarget, setReportTarget] = useState(null);
  const [reportedReviewIds, setReportedReviewIds] = useState(() => new Set());

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
  const scrollRef = useRef(null);      // khung cuộn chính
  const sectionRefs = useRef({});      // { overview, itinerary, budget } -> phần tử DOM
  const tripRef = useRef(null);        // bản trip mới nhất cho bộ theo dõi cuộn
  const scrollLockRef = useRef(false); // true khi đang tự cuộn do bấm thanh bên: tạm ngưng theo dõi cuộn
  const scrollLockTimer = useRef(0);
  const [activeTimePickerDestId, setActiveTimePickerDestId] = useState(null);

  // Panel thông tin bên bản đồ: đóng/mở độc lập với địa điểm đang được chọn
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  // Bỏ qua kết quả tải ảnh/bài đăng của lần bấm cũ khi người dùng đã bấm sang địa điểm khác
  const activeDestinationRequestRef = useRef(0);

  // Card xem nhanh (ảnh + tên) khi lia chuột vào địa điểm trong danh sách hoặc marker trên bản đồ.
  // source = 'list' -> marker được phóng to; source = 'map' -> giữ nguyên icon để không chớp khi con trỏ đang ở trên marker.
  const [hover, setHover] = useState(null); // { id, source } | null
  const hoverTimerRef = useRef(null);
  const { covers: destCovers } = usePlaceCovers(trip);

  const placeActivity = usePlaceActivity(trip);

  // pinned = thẻ hiện do người dùng CHỌN địa điểm (bấm dòng/marker): không tự ẩn khi rời chuột.
  const showHover = (id, source, delayMs = 0, pinned = false) => {
    clearTimeout(hoverTimerRef.current);
    if (delayMs > 0) {
      hoverTimerRef.current = setTimeout(() => setHover({ id, source, pinned }), delayMs);
    } else {
      setHover({ id, source, pinned });
    }
  };
  // Ẩn có độ trễ để người dùng kịp rê chuột từ dòng/marker sang thẻ (rê vào thẻ thì keepHover hủy việc ẩn).
  const hideHover = (id, { force = false, delayMs = 0 } = {}) => {
    clearTimeout(hoverTimerRef.current);
    const apply = () => setHover((current) => {
      if (!current) return current;
      if (id != null && current.id !== id) return current;
      if (current.pinned && !force) return current;
      return null;
    });
    if (delayMs > 0) hoverTimerRef.current = setTimeout(apply, delayMs);
    else apply();
  };
  const keepHover = () => clearTimeout(hoverTimerRef.current);
  useEffect(() => () => clearTimeout(hoverTimerRef.current), []);

  // Kéo thẻ AI thả vào ngày: dropDayId = ngày đang được kéo qua, droppingDayId = ngày đang lưu.
  const [dropDayId, setDropDayId] = useState(null);
  // Sắp xếp lại lịch trình: địa điểm đang kéo + vị trí sẽ chèn ({ dayId, index }).
  const [draggingDestId, setDraggingDestId] = useState(null);
  const [reorderTarget, setReorderTarget] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);
  // Ngày hiển thị trên bản đồ: 'auto' = theo ngày đang cuộn tới, 'all' = cả chuyến, hoặc id của một ngày.
  const [mapDayMode, setMapDayMode] = useState('auto');
  // Chỉ đường: null = đóng; { originId ('current' | id địa điểm), destinationId, waypointIds, mode }.
  const [directions, setDirections] = useState(null);
  const [droppingDayId, setDroppingDayId] = useState(null);

  // Menu "6 chấm" của từng địa điểm trong lịch trình
  const [destMenuId, setDestMenuId] = useState(null);
  const [deletingDestId, setDeletingDestId] = useState(null);

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

  // Thành viên + quyền của người đang xem
  const [members, setMembers] = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [membersReload, setMembersReload] = useState(0);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [shareModalView, setShareModalView] = useState(null); // null | 'share' | 'manage'
  const [storedId] = useState(readMyId);

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

  // Danh sách thành viên (chủ chuyến đi đứng đầu). Người chưa là thành viên không xem được trang này.
  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('token');
    if (!token) return undefined;
    axios
      .get(`http://localhost:8080/api/trips/${tripId}/members`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (cancelled) return;
        setMembers(Array.isArray(res.data) ? res.data : []);
        setMembersLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) console.error('Lỗi tải thành viên:', err);
      });
    return () => { cancelled = true; };
  }, [tripId, membersReload]);

  // Id của mình: ưu tiên giá trị server trả về khi tải chi phí (luôn có), dự phòng là user trong localStorage
  const myId = expenseData.currentUserId != null ? String(expenseData.currentUserId) : storedId;

  // Quyền của mình: lấy từ danh sách thành viên (nguồn đúng nhất); trong lúc chờ thì suy từ chủ chuyến đi
  const myRole = useMemo(() => {
    if (myId === null) return null;
    const mine = members.find((m) => String(m.userId) === myId);
    if (mine) return mine.role === 'MEMBER' ? 'EDITOR' : mine.role;
    if (!membersLoaded && trip?.user?.id !== undefined && trip?.user?.id !== null && String(trip.user.id) === myId) return 'OWNER';
    return null;
  }, [members, membersLoaded, myId, trip]);
  const canEdit = myRole === 'OWNER' || myRole === 'EDITOR';
  const isViewer = myRole === 'VIEWER';

  // Trong lúc chưa tải xong danh sách, vẫn hiện avatar chủ chuyến đi
  const stackMembers = useMemo(() => {
    if (members.length > 0) return members;
    const u = trip?.user;
    return u ? [{ userId: u.id ?? 'owner', fullName: u.fullName, username: u.username, avatar: u.avatar, role: 'OWNER', owner: true }] : [];
  }, [members, trip]);

  // Kéo thanh chia ở mép trái bản đồ: kéo sang trái để mở rộng map, sang phải để thu nhỏ.
  useEffect(() => {
    if (!isResizingMap) return undefined;

    const onPointerMove = (event) => {
      const start = mapResizeStartRef.current;
      if (!start) return;
      const sidebarWidth = isSidebarOpen ? 256 : 0;
      const maxWidth = Math.max(340, window.innerWidth - sidebarWidth - 380);
      const nextWidth = Math.max(320, Math.min(maxWidth, start.width + start.x - event.clientX));
      setMapPanelWidth(nextWidth);
    };
    const onPointerUp = () => {
      mapResizeStartRef.current = null;
      setIsResizingMap(false);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingMap, isSidebarOpen]);

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

  // Tìm địa điểm khi thêm vào ngày:
  //  1) DB của hệ thống trước (Place PARTNER đã được Admin xác minh + POI OSM đã lưu) -> OSM thiếu vẫn tìm được;
  //  2) Photon/OSM sau, ưu tiên gần các điểm đã có của chuyến đi.
  useEffect(() => {
    const q = searchQuery.trim();
    // Chuỗi quá ngắn: không gọi API; danh sách gợi ý bị ẩn khi render (visibleSuggestions).
    if (!addingDayId || q.length < 2) return undefined;
    const controller = new AbortController();

    const fetchPlaces = async () => {
      const token = localStorage.getItem('token');
      // Điểm neo cho Photon: địa điểm đầu tiên đã có tọa độ trong chuyến đi.
      const anchorDest = (trip?.tripDays || []).flatMap(d => d.destinations || []).find(hasCoord);
      const anchor = anchorDest ? { lat: Number(anchorDest.latitude), lng: Number(anchorDest.longitude) } : null;

      const dbRequest = axios.get('http://localhost:8080/api/v1/places/search', {
        params: { q, destination: trip?.destination || '', limit: 5 },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      }).then(res => (Array.isArray(res.data) ? res.data : []).map(p => ({
        key: `db-${p.id}`,
        source: 'db',
        placeId: p.id,
        verified: Boolean(p.verified),
        name: p.name,
        address: p.address || p.destination || '',
        lat: Number(p.latitude),
        lon: Number(p.longitude),
      })));

      const photonParams = new URLSearchParams({ q, limit: '5' });
      if (anchor) { photonParams.set('lat', String(anchor.lat)); photonParams.set('lon', String(anchor.lng)); }
      const photonRequest = fetch(`https://photon.komoot.io/api/?${photonParams.toString()}`, { signal: controller.signal })
        .then(res => (res.ok ? res.json() : { features: [] }))
        .then(data => (data.features || []).map(f => {
          const p = f.properties || {};
          return {
            key: `osm-${p.osm_type || ''}${p.osm_id}`,
            source: 'photon',
            name: p.name || p.street || p.city,
            address: [p.street && p.name ? p.street : null, p.city, p.country].filter(Boolean).join(', '),
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
          };
        }).filter(p => p.name));

      const [dbResult, photonResult] = await Promise.allSettled([dbRequest, photonRequest]);
      if (controller.signal.aborted) return;
      const fromDb = dbResult.status === 'fulfilled' ? dbResult.value : [];
      const fromPhoton = photonResult.status === 'fulfilled' ? photonResult.value : [];
      // Bỏ kết quả Photon trùng tên với địa điểm đã có trong DB.
      const dbNames = new Set(fromDb.map(p => String(p.name).trim().toLowerCase()));
      setSuggestions([...fromDb, ...fromPhoton.filter(p => !dbNames.has(String(p.name).trim().toLowerCase()))].slice(0, 8));
    };

    const delay = setTimeout(() => { fetchPlaces().catch(err => { if (err?.name !== 'AbortError' && err?.name !== 'CanceledError') console.error(err); }); }, 400);
    return () => { clearTimeout(delay); controller.abort(); };
  // trip chỉ dùng để lấy điểm neo/điểm đến; không cần tìm lại mỗi khi dữ liệu chuyến đi tải lại.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, addingDayId, trip?.destination]);
  const visibleSuggestions = searchQuery.trim().length >= 2 ? suggestions : [];

  const handleAddDestination = async (place, dayId) => {
    if (place.source === 'db') {
      try {
        await addRecommendedPlaceToDay({ placeId: place.placeId, name: place.name }, dayId);
        setAddingDayId(null); setSearchQuery(''); setSuggestions([]); setSearchNotice(null);
      } catch (err) { alert(getApiError(err, err?.message || 'Không thêm được địa điểm.')); }
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:8080/api/trips/days/${dayId}/destinations`, {
        placeName: place.name, latitude: place.lat, longitude: place.lon, note: place.address, estimatedCost: 0
      }, { headers: { Authorization: `Bearer ${token}` }});
      setAddingDayId(null); setSearchQuery(''); setSuggestions([]); setSearchNotice(null); fetchTripDetails(); 
    } catch (err) { alert("Lỗi: " + (err.response?.data || err.message)); }
  };

  // Thêm địa điểm đề xuất (đã có Place ID) vào một ngày. Dùng chung cho nút "Thêm" trong AI chat và kéo-thả.
  // Backend lấy tên/tọa độ/loại/chi phí tham khảo từ bảng places khi có placeId, nên chỉ cần gửi ID.
  const addRecommendedPlaceToDay = async (place, dayId) => {
    if (!canEdit) throw new Error('Bạn chỉ có quyền xem chuyến đi này.');
    if (place?.trustLevel === 'AI_REFERENCE') {
      throw new Error('Địa điểm tham khảo chưa được xác nhận vị trí nên chưa thể thêm trực tiếp. Hãy tìm địa chỉ trong ô tìm kiếm của ngày.');
    }
    const placeId = Number(place?.placeId ?? place?.id);
    const placeName = place?.name || place?.placeName || 'Địa điểm';
    if (!Number.isSafeInteger(placeId) || placeId <= 0) {
      throw new Error('Địa điểm đề xuất chưa có Place ID hợp lệ nên chưa thể thêm vào lịch trình.');
    }
    const day = (trip?.tripDays || []).find(d => String(d.id) === String(dayId));
    if (!day) throw new Error('Không tìm thấy ngày cần thêm trong chuyến đi.');
    if ((day.destinations || []).some(d => getDestPlaceId(d) === placeId)) {
      throw new Error(`${placeName} đã có trong Ngày ${day.dayNumber}.`);
    }

    const token = localStorage.getItem('token');
    if (!token) throw new Error('Bạn cần đăng nhập để thêm địa điểm.');
    await axios.post(`http://localhost:8080/api/trips/days/${day.id}/destinations`, {
      placeId,
      placeName,
      orderIndex: (day.destinations || []).length,
    }, { headers: { Authorization: `Bearer ${token}` } });
    await fetchTripDetails();
    return day;
  };

  const hasPlacePayload = (event) => Array.from(event.dataTransfer?.types || []).includes(PLACE_MIME_TYPE);

  // Gợi ý "Tham khảo" của AI chưa có trong DB (chưa có tọa độ) -> không thêm thẳng được.
  // Mở ô tìm kiếm của ngày đó, điền sẵn tên + khu vực để người dùng tự kiểm tra và chọn kết quả đúng.
  const openReferenceSearch = (place, day) => {
    if (!canEdit || !day) return;
    const name = String(place?.name || place?.placeName || '').trim();
    if (!name) return;
    const area = String(place?.address || '').trim();
    setAddingDayId(day.id);
    setSearchQuery(area ? `${name}, ${area}` : name);
    setSearchNotice({ dayId: day.id, name });
    requestAnimationFrame(() => dayRefs.current[day.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // Nút "Tìm trên bản đồ" trong thẻ Tham khảo của AI chat.
  const openReferenceSearchRef = useRef(openReferenceSearch);
  useEffect(() => { openReferenceSearchRef.current = openReferenceSearch; });
  useEffect(() => {
    const onReferenceSearch = (event) => {
      const detail = event?.detail || {};
      if (String(detail.tripId) !== String(tripId)) return;
      const days = tripRef.current?.tripDays || [];
      const day = days.find(d => String(d.id) === String(detail.dayId)) || days[0];
      openReferenceSearchRef.current(detail.place, day);
    };
    window.addEventListener('travel-ai-reference-search', onReferenceSearch);
    return () => window.removeEventListener('travel-ai-reference-search', onReferenceSearch);
  }, [tripId]);

  // Gắn vào khối Ngày (Lịch trình) và mục "Ngày N" ở thanh bên. Người chỉ xem (VIEWER) không thả được.
  const hasDestPayload = (event) => Array.from(event.dataTransfer?.types || []).includes(DEST_MIME_TYPE);

  // Chuyển địa điểm destId tới vị trí toIndex của ngày toDayId (cập nhật giao diện ngay, rồi lưu lên server).
  const moveDestination = async (destId, toDayId, toIndex) => {
    if (!canEdit || savingOrder) return;
    const days = trip?.tripDays || [];
    const fromDay = days.find(d => (d.destinations || []).some(x => x.id === destId));
    const toDay = days.find(d => d.id === toDayId);
    if (!fromDay || !toDay) return;

    const fromList = [...(fromDay.destinations || [])];
    const fromIndex = fromList.findIndex(x => x.id === destId);
    const [moving] = fromList.splice(fromIndex, 1);
    const sameDay = fromDay.id === toDay.id;
    const targetList = sameDay ? fromList : [...(toDay.destinations || [])];
    let insertAt = sameDay && fromIndex < toIndex ? toIndex - 1 : toIndex;
    insertAt = Math.max(0, Math.min(insertAt, targetList.length));
    if (sameDay && insertAt === fromIndex) return; // thả lại đúng chỗ cũ
    targetList.splice(insertAt, 0, moving);

    setTrip(prev => ({
      ...prev,
      tripDays: (prev?.tripDays || []).map(d => {
        if (d.id === toDay.id) return { ...d, destinations: targetList };
        if (d.id === fromDay.id) return { ...d, destinations: fromList };
        return d;
      }),
    }));

    const body = { days: [{ dayId: toDay.id, destinationIds: targetList.map(x => x.id) }] };
    if (!sameDay) body.days.push({ dayId: fromDay.id, destinationIds: fromList.map(x => x.id) });
    setSavingOrder(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put('http://localhost:8080/api/trips/days/order', body, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      alert(getApiError(err, 'Không lưu được thứ tự lịch trình. Dữ liệu sẽ được tải lại.'));
    } finally {
      setSavingOrder(false);
      fetchTripDetails(); // đồng bộ lại (rollback nếu lỗi)
    }
  };

  const handleDestDrop = (event, dayId, fallbackIndex) => {
    event.preventDefault();
    event.stopPropagation();
    let payload;
    try { payload = JSON.parse(event.dataTransfer.getData(DEST_MIME_TYPE)); } catch { payload = null; }
    const index = reorderTarget?.dayId === dayId ? reorderTarget.index : fallbackIndex;
    setReorderTarget(null);
    setDraggingDestId(null);
    setDropDayId(null);
    if (payload?.destId != null) moveDestination(payload.destId, dayId, index);
  };

  // Thuộc tính kéo/thả cho từng dòng địa điểm: thả lên nửa trên = chèn trước, nửa dưới = chèn sau.
  const getDestRowDragProps = (day, dest, idx) => (canEdit ? {
    draggable: true,
    onDragStart: (event) => {
      if (event.target.closest?.('input, textarea, button, select')) { event.preventDefault(); return; }
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(DEST_MIME_TYPE, JSON.stringify({ destId: dest.id, fromDayId: day.id }));
      setDraggingDestId(dest.id);
      setDestMenuId(null);
      hideHover(null, { force: true });
    },
    onDragEnd: () => { setDraggingDestId(null); setReorderTarget(null); setDropDayId(null); },
    onDragOver: (event) => {
      if (!hasDestPayload(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      const rect = event.currentTarget.getBoundingClientRect();
      const index = idx + (event.clientY > rect.top + rect.height / 2 ? 1 : 0);
      if (reorderTarget?.dayId !== day.id || reorderTarget?.index !== index) setReorderTarget({ dayId: day.id, index });
    },
    onDrop: (event) => {
      if (!hasDestPayload(event)) return;
      handleDestDrop(event, day.id, idx);
    },
  } : {});

  const getDayDropProps = (day) => (canEdit ? {
    onDragOver: (event) => {
      if (hasDestPayload(event)) {
        // Kéo địa điểm vào vùng trống của ngày (hoặc mục "Ngày N" ở thanh bên) -> đưa xuống cuối ngày đó.
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const end = (day.destinations || []).length;
        if (reorderTarget?.dayId !== day.id || reorderTarget?.index !== end) setReorderTarget({ dayId: day.id, index: end });
        if (dropDayId !== day.id) setDropDayId(day.id);
        return;
      }
      if (!hasPlacePayload(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      if (dropDayId !== day.id) setDropDayId(day.id);
    },
    onDragLeave: (event) => {
      if (event.currentTarget.contains(event.relatedTarget)) return;
      setDropDayId(current => (current === day.id ? null : current));
      setReorderTarget(current => (current?.dayId === day.id ? null : current));
    },
    onDrop: async (event) => {
      if (hasDestPayload(event)) {
        handleDestDrop(event, day.id, (day.destinations || []).length);
        return;
      }
      if (!hasPlacePayload(event)) return;
      event.preventDefault();
      setDropDayId(null);
      let place;
      try {
        place = JSON.parse(event.dataTransfer.getData(PLACE_MIME_TYPE));
      } catch {
        return;
      }
      if (place?.trustLevel === 'AI_REFERENCE' || !(Number(place?.placeId) > 0)) {
        openReferenceSearch(place, day);
        return;
      }
      if (droppingDayId != null) return;
      setDroppingDayId(day.id);
      try {
        await addRecommendedPlaceToDay(place, day.id);
        // AiAssistantChat lắng nghe sự kiện này để báo "Đã thêm ... vào Day N".
        window.dispatchEvent(new CustomEvent('travel-ai-place-added', {
          detail: { tripId: trip?.id, placeName: place?.name, dayNumber: day.dayNumber },
        }));
      } catch (err) {
        alert(getApiError(err, err?.message || 'Không thể thêm địa điểm vào lịch trình.'));
      } finally {
        setDroppingDayId(null);
      }
    },
  } : {});

  // Xóa địa điểm khỏi ngày. Place gốc vẫn giữ trong DB; khoản chi đã gắn sẽ chuyển thành "không gắn địa điểm".
  const handleDeleteDestination = async (day, dest) => {
    if (!canEdit || deletingDestId != null) return;
    if (!window.confirm(`Xóa "${dest.placeName}" khỏi Ngày ${day.dayNumber}?`)) return;
    setDeletingDestId(dest.id);
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:8080/api/trips/days/destinations/${dest.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (activeDestination?.id === dest.id) {
        setActiveDestination(null);
        setIsPanelOpen(false);
      }
      hideHover(dest.id, { force: true });
      setDestMenuId(null);
      // Cập nhật ngay trên giao diện, sau đó đồng bộ lại dữ liệu thật từ server.
      setTrip(prev => ({
        ...prev,
        tripDays: (prev?.tripDays || []).map(d => d.id === day.id
          ? { ...d, destinations: (d.destinations || []).filter(x => x.id !== dest.id) }
          : d),
      }));
      fetchTripDetails();
      fetchExpenses();
    } catch (e) {
      alert(getApiError(e, 'Không xóa được địa điểm. Vui lòng thử lại!'));
    } finally {
      setDeletingDestId(null);
    }
  };

  // Bấm vào địa điểm trong lịch trình hoặc marker: bản đồ bay tới địa điểm và hiện thẻ xem nhanh (ghim).
  // Trang thông tin (giới thiệu, đánh giá, bài đăng) chỉ mở khi bấm vào thẻ xem nhanh.
  const selectDestination = (dest, idx) => {
    setActiveDestination({ ...dest, index: idx + 1 });
    setIsPanelOpen(false);
    showHover(dest.id, 'select', 0, true);
  };

  const handleDestinationClick = async (dest, idx) => {
    const requestId = ++activeDestinationRequestRef.current;
    // Đã mở panel chi tiết thì card xem nhanh không cần nữa (trên màn hình cảm ứng không có mouseleave để tự tắt).
    hideHover(null, { force: true });
    setActiveDestination({ ...dest, index: idx + 1 });
    setIsPanelOpen(true);
    setNewReviewFiles([]);
    setInfoTab('intro');
    setPlaceInfo({ extract: '', loading: true });
    
    const fallbackImage = `https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?q=80&w=800&auto=format&fit=crop`; 
    // Ảnh Partner đã được Admin duyệt (đã tải sẵn cho cả chuyến đi) được ưu tiên hơn ảnh bài đăng.
    const partnerCover = destCovers[String(getDestPlaceId(dest))] || null;
    setCoverImage(partnerCover || fallbackImage);

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
      if (!partnerCover && firstPostWithImg && requestId === activeDestinationRequestRef.current) {
        setCoverImage(firstPostWithImg.imageUrls[0]);
      }
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

  const openReviewReport = (review) => {
    if (!review?.id || reportedReviewIds.has(review.id)) return;
    const place = activeDestination?.placeName;
    setReportTarget({
      type: 'PLACE_REVIEW',
      id: review.id,
      label: `đánh giá của ${review.authorName || 'người dùng'}${place ? ` về ${place}` : ''}`,
    });
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

  // Cuộn khung chính tới một phần tử. Trong lúc cuộn mượt, tạm tắt bộ theo dõi để thanh bên không nhấp nháy qua các mục ở giữa.
  const scrollToElement = (el, offset = 0) => {
    const container = scrollRef.current;
    if (!container || !el) return;
    scrollLockRef.current = true;
    clearTimeout(scrollLockTimer.current);
    scrollLockTimer.current = setTimeout(() => { scrollLockRef.current = false; }, 900); // phòng khi không có sự kiện cuộn nào
    const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - offset;
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };

  const handleScrollToSection = (id) => {
    setActiveSection(id);
    setActiveDestination(null);
    setFocusedDayId(id === 'itinerary' ? (trip?.tripDays?.[0]?.id ?? null) : null);
    scrollToElement(sectionRefs.current[id]);
  };

  const handleScrollToDay = (dayId) => {
    setMapDayMode('auto'); // bấm ngày ở thanh bên: bản đồ lại đi theo ngày đang xem
    setActiveSection('itinerary');
    setFocusedDayId(dayId);
    setActiveDestination(null);
    scrollToElement(dayRefs.current[dayId], 16);
  };

  // Những destination cũ chỉ có placeName (chưa lưu latitude/longitude) vẫn được geocode qua Photon.
  // Query gắn destination của Trip để giảm nhầm địa điểm trùng tên ở tỉnh/thành khác.
  const missingCoordinateDestinations = useMemo(() =>
    (trip?.tripDays || []).flatMap(day => (day.destinations || [])
      .filter(dest => dest?.id != null && dest?.placeName && !hasCoord(dest)
        && !geocodedCoordinates[dest.id]
        && !geocodeAttemptedRef.current.has(String(dest.id)))
      .map(dest => ({ id: dest.id, placeName: dest.placeName }))),
    [trip, geocodedCoordinates]
  );

  const missingCoordinatesKey = useMemo(() => missingCoordinateDestinations
    .map(item => `${item.id}:${item.placeName}`).join('|'), [missingCoordinateDestinations]);

  useEffect(() => {
    if (!missingCoordinateDestinations.length) return undefined;
    const controller = new AbortController();
    let cancelled = false;

    const resolveMissingCoordinates = async () => {
      const newlyResolved = {};
      for (const destinationItem of missingCoordinateDestinations) {
        if (cancelled || controller.signal.aborted) return;
        const cacheKey = `${destinationItem.placeName}|${trip?.destination || ''}`.toLowerCase();
        const cached = destinationGeocodeCache.get(cacheKey);
        if (cached && isValidLatLng(cached.latitude, cached.longitude)) {
          newlyResolved[destinationItem.id] = cached;
          continue;
        }

        geocodeAttemptedRef.current.add(String(destinationItem.id));
        try {
          const query = `${destinationItem.placeName}, ${trip?.destination || ''}, Việt Nam`;
          // Photon public API does not support lang=vi; omit lang to avoid HTTP 400.
          const params = new URLSearchParams({ q: query, limit: '1' });
          const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
          });
          if (!response.ok) throw new Error(`Photon HTTP ${response.status}`);
          const data = await response.json();
          const feature = data?.features?.[0];
          const coordinates = feature?.geometry?.coordinates;
          if (!Array.isArray(coordinates) || coordinates.length < 2) continue;

          const longitude = Number(coordinates[0]);
          const latitude = Number(coordinates[1]);
          if (!isValidLatLng(latitude, longitude)) continue;

          const resolved = { latitude, longitude, source: 'Photon/OSM' };
          destinationGeocodeCache.set(cacheKey, resolved);
          if (!cancelled) newlyResolved[destinationItem.id] = resolved;
        } catch (error) {
          if (error?.name !== 'AbortError') {
            console.warn(`Không geocode được địa điểm "${destinationItem.placeName}" qua Photon:`, error);
          }
        }
        // Giữ request thưa để không tạo burst vào demo API Photon.
        await sleep(250);
      }
      if (!cancelled && Object.keys(newlyResolved).length > 0) {
        setGeocodedCoordinates(previous => ({ ...previous, ...newlyResolved }));
      }
    };

    resolveMissingCoordinates();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [missingCoordinatesKey, trip?.destination]);

  // Các điểm có tọa độ hợp lệ theo từng ngày; ưu tiên tọa độ đã lưu, fallback Photon cho bản ghi cũ.
  const routeDays = useMemo(() => (trip?.tripDays || []).map((day, dayIndex) => ({
    id: day.id,
    color: DAY_COLORS[dayIndex % DAY_COLORS.length],
    stops: (day.destinations || []).map((dest, i) => {
      const fallback = geocodedCoordinates[dest.id];
      const lat = hasCoord(dest) ? Number(dest.latitude) : Number(fallback?.latitude);
      const lng = hasCoord(dest) ? Number(dest.longitude) : Number(fallback?.longitude);
      if (!isValidLatLng(lat, lng)) return null;
      const mapDestination = hasCoord(dest) ? dest : { ...dest, latitude: lat, longitude: lng };
      return { dest: mapDestination, id: dest.id, number: i + 1, lat, lng };
    }).filter(Boolean),
  })), [trip, geocodedCoordinates]);

  // Mọi địa điểm có tọa độ của chuyến đi (cho bảng chỉ đường).
  const directionStops = useMemo(() => {
    const dayNumberById = new Map((trip?.tripDays || []).map(d => [d.id, d.dayNumber]));
    return routeDays.flatMap(d => d.stops.map(s => ({
      id: s.id, name: s.dest?.placeName || 'Địa điểm', lat: s.lat, lng: s.lng, number: s.number,
      dayNumber: dayNumberById.get(d.id),
    })));
  }, [routeDays, trip]);

  const openDirections = (patch = {}) => {
    setIsPanelOpen(false);
    setDirections(prev => ({
      originId: null, destinationId: null, waypointIds: [], mode: 'two-wheeler',
      ...(prev || {}),
      ...patch,
    }));
  };

  // Chỉ đường cả ngày: điểm đầu -> điểm cuối, các điểm giữa là điểm dừng theo đúng thứ tự lịch trình.
  const openDayDirections = (dayId) => {
    const preset = presetForDay(routeDays.find(d => d.id === dayId)?.stops || []);
    if (!preset) return;
    setMapDayMode(dayId);
    openDirections(preset);
  };

  // Địa điểm chưa có tọa độ và Photon không tìm được được giữ lại để hiển thị cảnh báo trên bản đồ.
  const unmappedDestinations = useMemo(() => (trip?.tripDays || []).flatMap(day =>
    (day.destinations || []).filter(dest => !hasCoord(dest) && !geocodedCoordinates[dest.id])
      .map(dest => dest.placeName).filter(Boolean)
  ), [trip, geocodedCoordinates]);

  // Chuỗi đại diện cho toạ độ + thứ tự của mọi ngày: chỉ đổi khi tuyến đường thật sự cần tính lại
  const routeKey = useMemo(
    () => routeDays.map(d => `${d.id}:${d.stops.map(s => `${s.id}@${s.lat},${s.lng}`).join('|')}`).join('||'),
    [routeDays]
  );

  // Các điểm đang hiển thị trên bản đồ (1 ngày được chọn, hoặc tất cả các ngày)
  // Ngày đang xem chưa có điểm nào trên bản đồ -> hiện cả chuyến đi thay vì bản đồ trống.
  const dayHasStops = (dayId) => Boolean(dayId) && routeDays.some(d => d.id === dayId && d.stops.length > 0);
  const mapDayId = mapDayMode === 'all'
    ? null
    : mapDayMode === 'auto'
      ? (dayHasStops(focusedDayId) ? focusedDayId : null)
      : (dayHasStops(mapDayMode) ? mapDayMode : null);
  const mapStops = useMemo(() => routeDays
    .filter(d => !mapDayId || d.id === mapDayId)
    .flatMap(d => d.stops.map(s => ({ ...s, color: d.color }))), [routeDays, mapDayId]);

  const boundsKey = useMemo(
    () => `${mapDayId || 'all'}#${mapStops.map(s => `${s.id}@${s.lat},${s.lng}`).join('|')}`,
    [mapStops, mapDayId]
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

  useEffect(() => { tripRef.current = trip; });

  // Cuộn liên tục kiểu Wanderlog: cuộn tới đâu thì mục (Tổng quan / Lịch trình / Ngân sách) và NGÀY tương ứng được chọn tới đó.
  // Ngày đang xem cũng là ngày bản đồ đang hiển thị.
  const hasTrip = Boolean(trip);
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return undefined;
    let frame = 0;

    const sync = () => {
      frame = 0;
      const line = container.getBoundingClientRect().top + SPY_OFFSET;
      const scrollable = container.scrollHeight > container.clientHeight + 8;
      const atBottom = scrollable && container.scrollTop + container.clientHeight >= container.scrollHeight - 4;

      let current = SECTION_IDS[0];
      for (const id of SECTION_IDS) {
        const el = sectionRefs.current[id];
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      if (atBottom) current = SECTION_IDS[SECTION_IDS.length - 1]; // phần cuối ngắn không chạm tới vạch thì vẫn được chọn khi cuộn hết

      let dayId = null;
      if (current === 'itinerary') {
        const days = tripRef.current?.tripDays || [];
        dayId = days[0]?.id ?? null;
        for (const d of days) {
          const el = dayRefs.current[d.id];
          if (el && el.getBoundingClientRect().top <= line) dayId = d.id;
        }
      }

      setActiveSection(current);
      setFocusedDayId(dayId);
      // Đang chọn một địa điểm của ngày khác thì bỏ chọn, để bản đồ chuyển sang ngày mới
      setActiveDestination((prev) => {
        if (!prev || dayId === null) return prev;
        const owner = (tripRef.current?.tripDays || []).find((d) => (d.destinations || []).some((x) => x.id === prev.id));
        return owner && owner.id !== dayId ? null : prev;
      });
    };

    const schedule = () => { if (!frame) frame = requestAnimationFrame(sync); };
    const onScroll = () => {
      if (scrollLockRef.current) {
        // đang tự cuộn: đợi cuộn xong rồi mới đồng bộ một lần
        clearTimeout(scrollLockTimer.current);
        scrollLockTimer.current = setTimeout(() => { scrollLockRef.current = false; schedule(); }, 140);
        return;
      }
      schedule();
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
      clearTimeout(scrollLockTimer.current);
    };
  }, [loading, hasTrip]);

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-slate-500">Đang tải hành trình...</div>;
  if (!trip) return null;

  // Props dùng chung cho mọi ngày trong phần Lịch trình (ItineraryDay)
  const itineraryDayProps = {
    tripDays: trip.tripDays,
    getDayDropProps, dropDayId, focusedDayId, droppingDayId, dayHasStops, openDayDirections,
    draggingDestId, reorderTarget, activeDestination, getDestRowDragProps, showHover, hideHover,
    selectDestination, canEdit, destMenuId, setDestMenuId, savingOrder, moveDestination,
    deletingDestId, handleDeleteDestination, handleUpdateDestProperty, handleToggleVisited,
    openTimePicker, activeTimePickerDestId, setActiveTimePickerDestId, timeDraft, setTimeDraft,
    pickTimeSlot, saveTime, expenseStats, openExpenseDialog, routeData, addingDayId, searchRef,
    searchNotice, searchQuery, setSearchQuery, setAddingDayId, setSearchNotice, visibleSuggestions,
    handleAddDestination
  };

  return (
    <div className="h-screen w-full flex bg-slate-50 font-sans overflow-hidden">
      
      {/* 1. THANH BÊN */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out relative z-20 overflow-hidden`}>
        <div className="flex h-full w-64 flex-col">
          <div className="border-b border-slate-100 px-4 pb-4 pt-4">
            <Link to="/home" className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 transition-colors hover:text-slate-900">
              <ArrowLeft className="h-3.5 w-3.5" /> Trang chủ
            </Link>
            <h2 className="line-clamp-2 text-base font-extrabold leading-snug text-slate-900">{trip.title}</h2>
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-slate-500">
              <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{trip.destination}</span>
            </p>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="Các phần của chuyến đi">
            <SidebarNavButton icon={LayoutDashboard} label="Tổng quan" active={activeSection === 'overview'} onClick={() => handleScrollToSection('overview')} />

            <div>
              <div className="relative">
                <SidebarNavButton icon={CalendarDays} label="Lịch trình" active={activeSection === 'itinerary'} onClick={() => handleScrollToSection('itinerary')} />
                <button
                  type="button"
                  onClick={() => setIsItineraryExpanded((v) => !v)}
                  aria-label={isItineraryExpanded ? 'Thu gọn danh sách ngày' : 'Mở danh sách ngày'}
                  aria-expanded={isItineraryExpanded}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <ChevronDownIcon isOpen={isItineraryExpanded} />
                </button>
              </div>
              {isItineraryExpanded && (
                <ol className="ml-[21px] mt-1 space-y-0.5 border-l border-slate-200 pl-2.5">
                  {(trip.tripDays || []).length === 0 && <li className="px-3 py-1.5 text-xs text-slate-400">Chưa có ngày nào</li>}
                  {(trip.tripDays || []).map((day) => {
                    const isCurrent = activeSection === 'itinerary' && focusedDayId === day.id;
                    const count = (day.destinations || []).length;
                    return (
                      <li key={day.id}>
                        <button
                          type="button"
                          {...getDayDropProps(day)}
                          onClick={() => handleScrollToDay(day.id)}
                          aria-current={isCurrent ? 'true' : undefined}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors ${
                            dropDayId === day.id ? 'bg-indigo-50 font-bold text-indigo-700 ring-2 ring-indigo-300'
                            : isCurrent ? 'bg-red-50 font-bold text-[#FF5645]' : 'font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                          }`}
                        >
                          <span className="truncate">
                            Ngày {day.dayNumber}{droppingDayId === day.id ? ' · đang thêm…' : ''}
                            {formatDayDate(day.dayDate) && <span className={`ml-1.5 text-[11px] font-medium ${isCurrent ? 'text-[#FF5645]/70' : 'text-slate-400'}`}>{formatDayDate(day.dayDate)}</span>}
                          </span>
                          {count > 0 && (
                            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isCurrent ? 'bg-white text-[#FF5645]' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <SidebarNavButton icon={Wallet} label="Ngân sách" active={activeSection === 'budget'} onClick={() => handleScrollToSection('budget')} />
          </nav>

          {/* Tóm tắt nhanh */}
          <div className="border-t border-slate-100 p-3">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Tóm tắt</p>
              <p className="mt-1.5 text-xs font-semibold text-slate-600">
                {(trip.tripDays || []).length} ngày · {allDestinations.length} địa điểm
              </p>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">Đã chi</span>
                <span className="text-sm font-extrabold text-slate-900">{formatVND(expenseStats.spent)}</span>
              </div>
              {expenseStats.budget > 0 && (
                <>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full ${expenseStats.remaining < 0 ? 'bg-rose-500' : expenseStats.percent >= 80 ? 'bg-amber-400' : 'bg-indigo-500'}`}
                      style={{ width: `${Math.min(100, expenseStats.percent)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-slate-400">trên ngân sách {formatVND(expenseStats.budget)}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* 2. MAIN CONTENT */}
      <div ref={scrollRef} className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-y-auto scroll-smooth">
        
        {/* --- PHẦN 1: TỔNG QUAN --- */}
        <section id="section-overview" ref={(el) => { sectionRefs.current.overview = el; }} className="shrink-0 pb-12">
          <div>
            <div className="h-[300px] w-full relative bg-slate-800">
              <TripCoverImage trip={trip} width={1600} height={600} eager labelClassName="text-2xl" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 to-transparent" />
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setCoverPickerOpen(true)}
                  className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-2 text-sm font-bold text-slate-700 shadow-md backdrop-blur transition-colors hover:bg-white"
                >
                  <Camera className="w-4 h-4" /> Đổi ảnh bìa
                </button>
              )}
            </div>
            <div className="relative -mt-16 mx-auto max-w-4xl px-4 sm:px-8">
              <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-slate-100 flex flex-col gap-5">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">{trip.title}</h1>
                  <div className="flex items-center text-sm font-semibold text-slate-500 gap-2"><Calendar className="w-4 h-4 text-slate-400"/> {formatFullDate(trip.startDate)} — {trip.endDate ? formatFullDate(trip.endDate) : 'Chưa có ngày kết thúc'}</div>
                </div>
                {/* Thành viên: tối đa 3 avatar + "+N". Chủ chuyến đi / người chỉnh sửa bấm vào để xem thành viên và lịch sử thao tác */}
                <div className="flex flex-wrap items-center gap-3">
                  {isViewer && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">Chỉ xem</span>
                  )}
                  <TripMembersStack members={stackMembers} canOpen={canEdit} onOpen={() => setMembersDialogOpen(true)} />
                  {myRole === 'OWNER' && (
                    <button
                      type="button"
                      onClick={() => setShareModalView('share')}
                      className="flex items-center gap-1.5 rounded-full bg-[#FF5645] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#E04B3B]"
                    >
                      <Share2 className="w-4 h-4" /> Chia sẻ
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mx-auto max-w-4xl px-4 sm:px-8 mt-12">
              
              {/* === PHẦN 1: GHI CHÚ (NOTES) === */}
              <div className="mb-10">
                <div className="flex items-center justify-between mb-3 group cursor-pointer" onClick={() => setIsNoteExpanded(!isNoteExpanded)}>
                  <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                    <ChevronDownIcon isOpen={isNoteExpanded} /> Ghi chú
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
                      placeholder="Viết hoặc dán bất cứ điều gì ở đây: cách di chuyển, mẹo hay, lưu ý..."
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
            </div>
          </div>
        </section>

        {/* --- PHẦN 2: LỊCH TRÌNH --- */}
        <section id="section-itinerary" ref={(el) => { sectionRefs.current.itinerary = el; }} className="shrink-0 w-full bg-slate-50 border-t border-slate-200/70">
          <div className="w-full">
            {/* Lịch trình chiếm toàn bộ chiều rộng; AI được mở từ bong bóng nổi ở góc màn hình. */}
            <div className="w-full p-6 sm:p-8 relative">
              <div className="max-w-3xl mx-auto w-full">
                <h2 className="text-3xl font-extrabold text-slate-900 mb-8">Lịch trình</h2>
                <div className="space-y-8">
                  {trip.tripDays?.map((day) => (
                    <ItineraryDay key={day.id} day={day} dayRef={el => dayRefs.current[day.id] = el} {...itineraryDayProps} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- PHẦN 3: NGÂN SÁCH --- */}
        <section id="section-budget" ref={(el) => { sectionRefs.current.budget = el; }} className="shrink-0 min-h-[80vh] border-t border-slate-200/70">
          <div className="p-6 sm:p-10 max-w-3xl mx-auto">
            <div className="flex items-center justify-between gap-4 mb-6">
              <h2 className="text-4xl font-extrabold text-slate-900">Ngân sách</h2>
              {canEdit && (
                <button
                  onClick={() => openExpenseDialog()}
                  className="flex items-center gap-2 px-5 py-3 bg-[#FF5645] text-white font-bold text-sm rounded-full hover:bg-[#E04B3B] transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Thêm chi phí
                </button>
              )}
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
                {canEdit && (
                  <button
                    onClick={() => { setBudgetInput(expenseStats.budget > 0 ? String(expenseStats.budget) : ''); setBudgetDialogOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-200/70 hover:bg-slate-200 text-slate-800 font-bold text-sm rounded-full transition-colors"
                  >
                    <Pencil className="w-4 h-4" /> {expenseStats.budget > 0 ? 'Sửa ngân sách' : 'Đặt ngân sách'}
                  </button>
                )}
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
                    {canEdit && (
                      <button
                        onClick={() => deleteExpense(exp)}
                        aria-label="Xóa khoản chi"
                        className="shrink-0 h-8 w-8 rounded-full text-slate-300 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* ================= CỘT 3. BẢN ĐỒ VÀ PANEL CHI TIẾT ĐỊA ĐIỂM ================= */}
      <div
          className={`hidden md:block relative z-0 h-full min-h-0 overflow-hidden border-l border-slate-200 flex-shrink-0 ${isResizingMap ? '' : 'transition-[width] duration-200'}`}        style={{ width: `${mapPanelWidth}px`, flex: `0 0 ${mapPanelWidth}px` }}
      >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Kéo để thay đổi chiều rộng bản đồ"
            title="Kéo để thay đổi chiều rộng bản đồ · Nhấp đúp để đặt lại"
            onPointerDown={(event) => {
              event.preventDefault();
              mapResizeStartRef.current = { x: event.clientX, width: mapPanelWidth };
              setIsResizingMap(true);
            }}
            onDoubleClick={() => setMapPanelWidth(460)}
            className="absolute -left-[6px] top-0 bottom-0 z-[1300] w-3 cursor-col-resize touch-none flex items-center justify-center group"
          >
            <span className="h-20 w-1 rounded-full bg-slate-300 group-hover:bg-[#FF5645] group-active:bg-[#FF5645] transition-colors shadow-sm" />
          </div>
        {/* PANEL TRƯỢT (NỔI TRÊN BẢN ĐỒ) */}
        <PlaceInfoPanel
          activeDestination={activeDestination}
          isPanelOpen={isPanelOpen}
          coverImage={coverImage}
          setIsPanelOpen={setIsPanelOpen}
          setInfoTab={setInfoTab}
          infoTab={infoTab}
          placeReviews={placeReviews}
          placePosts={placePosts}
          placeInfo={placeInfo}
          reviewStats={reviewStats}
          showReviewForm={showReviewForm}
          setShowReviewForm={setShowReviewForm}
          setNewReviewRating={setNewReviewRating}
          newReviewRating={newReviewRating}
          newReviewText={newReviewText}
          setNewReviewText={setNewReviewText}
          newReviewFiles={newReviewFiles}
          setNewReviewFiles={setNewReviewFiles}
          isSubmittingReview={isSubmittingReview}
          submitReview={submitReview}
          uploadLabel={uploadLabel}
          visibleReviewsCount={visibleReviewsCount}
          toggleLikeReview={toggleLikeReview}
          setVisibleReviewsCount={setVisibleReviewsCount}
          onReportReview={openReviewReport}
          reportedReviewIds={reportedReviewIds}
        />

        <TripMap
          tripDays={trip.tripDays}
          activeDestination={activeDestination}
          isPanelOpen={isPanelOpen}
          setMapDayMode={setMapDayMode}
          mapDayMode={mapDayMode}
          mapDayId={mapDayId}
          dayHasStops={dayHasStops}
          setActiveDestination={setActiveDestination}
          savingOrder={savingOrder}
          directions={directions}
          setDirections={setDirections}
          openDirections={openDirections}
          directionStops={directionStops}
          isSidebarOpen={isSidebarOpen}
          hideHover={hideHover}
          mapStops={mapStops}
          boundsKey={boundsKey}
          routeDays={routeDays}
          routeData={routeData}
          hover={hover}
          selectDestination={selectDestination}
          showHover={showHover}
          destCovers={destCovers}
          placeActivity={placeActivity}
          keepHover={keepHover}
          handleDestinationClick={handleDestinationClick}
          unmappedDestinations={unmappedDestinations}
        />
      </div>

      <ExpenseDialogs
        expenseDialog={expenseDialog}
        closeExpenseDialog={closeExpenseDialog}
        setExpenseDialog={setExpenseDialog}
        expenseForm={expenseForm}
        updateExpenseForm={updateExpenseForm}
        selectedExpenseDest={selectedExpenseDest}
        selectedExpenseCategory={selectedExpenseCategory}
        expenseData={expenseData}
        toggleSplitUser={toggleSplitUser}
        splitShare={splitShare}
        expenseError={expenseError}
        submitExpense={submitExpense}
        isSavingExpense={isSavingExpense}
        allDestinations={allDestinations}
        showAllDests={showAllDests}
        setShowAllDests={setShowAllDests}
        budgetDialogOpen={budgetDialogOpen}
        isSavingBudget={isSavingBudget}
        setBudgetDialogOpen={setBudgetDialogOpen}
        budgetInput={budgetInput}
        setBudgetInput={setBudgetInput}
        saveBudget={saveBudget}
        balanceDialog={balanceDialog}
        setBalanceDialog={setBalanceDialog}
        breakdownOpen={breakdownOpen}
        setBreakdownOpen={setBreakdownOpen}
        categoryTotals={categoryTotals}
      />

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

      {membersDialogOpen && canEdit && (
        <TripMembersDialog
          trip={{ id: trip.id, title: trip.title }}
          members={stackMembers}
          myId={myId}
          isOwner={myRole === 'OWNER'}
          onManage={() => { setMembersDialogOpen(false); setShareModalView('manage'); }}
          onClose={() => setMembersDialogOpen(false)}
        />
      )}

      {coverPickerOpen && canEdit && (
        <CoverImagePicker
          tripId={trip.id}
          currentUrl={trip.coverImageUrl}
          onChanged={(patch) => setTrip((prev) => (prev ? { ...prev, ...patch } : prev))}
          onClose={() => setCoverPickerOpen(false)}
        />
      )}

      {shareModalView && myRole === 'OWNER' && (
        <ShareTripModal
          key={shareModalView}
          trip={{ id: trip.id, title: trip.title }}
          initialView={shareModalView}
          onChanged={() => setMembersReload((n) => n + 1)}
          onClose={() => { setShareModalView(null); setMembersReload((n) => n + 1); }}
        />
      )}

      <ReportDialog
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onReported={(t) => setReportedReviewIds((prev) => new Set(prev).add(t.id))}
      />

      {/* AI Travel Assistant dạng bong bóng nổi, dùng được ở mọi tab của TripDetail. */}
      {trip?.id && !isViewer && (
        <AiAssistantChat
          tripId={trip.id}
          trip={trip}
          onTripUpdated={fetchTripDetails}
          onAddPlaceToDay={addRecommendedPlaceToDay}
        />
      )}
    </div>
  );
};

const ChevronDownIcon = ({ isOpen }) => (
  <svg className={`w-4 h-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
);

export default TripDetail;