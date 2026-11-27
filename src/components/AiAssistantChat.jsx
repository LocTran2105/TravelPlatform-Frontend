import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  Bot,
  CalendarDays,
  GripVertical,
  MapPin,
  MessageCircle,
  Minus,
  Send,
  Sparkles,
  X,
  Wallet,
  LoaderCircle,
  Plus,
  Star,
  Route,
  BadgeCheck,
  Map as MapIcon,
  Info,
  Search,
  Maximize2,
  Minimize2,
  GripHorizontal,
} from 'lucide-react';
import { API_BASE_URL } from '../config/api';

const PLACE_MIME_TYPE = 'application/x-travel-place';

const formatVND = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return `${amount.toLocaleString('vi-VN')} ₫`;
};

const getPlaceCoordinates = (place) => {
  const latitude = place?.latitude ?? place?.lat ?? place?.location?.latitude ?? null;
  const longitude = place?.longitude ?? place?.lon ?? place?.lng ?? place?.location?.longitude ?? null;
  return {
    latitude: latitude === null ? null : Number(latitude),
    longitude: longitude === null ? null : Number(longitude),
  };
};

const normalizeRecommendations = (data) => {
  const raw = data?.recommendations ?? data?.places ?? data?.results ?? [];
  const items = Array.isArray(raw)
    ? raw.flatMap((item) => Array.isArray(item) ? item : [item])
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.places)
        ? raw.places
        : [];

  const seen = new Set();
  return items.filter((place) => {
    if (!place || typeof place !== 'object') return false;
    const name = place.name || place.placeName;
    if (!name) return false;
    const key = place.placeId != null
      ? `id:${place.placeId}`
      : `${String(name).trim().toLocaleLowerCase()}|${place.latitude ?? ''}|${place.longitude ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const makeGreeting = (trip) => {
  const destination = trip?.destination?.trim();
  const budget = formatVND(trip?.totalBudget);
  const dateText = trip?.startDate
    ? `${trip.startDate}${trip?.endDate ? ` đến ${trip.endDate}` : ''}`
    : 'chưa xác định ngày đi';

  if (destination) {
    return `Chào bạn! Mình thấy chuyến đi hiện tại của bạn là ${destination} (${dateText}${budget ? `, ngân sách ${budget}` : ''}). Mình sẽ sử dụng thông tin Trip này để tìm địa điểm thực tế và hỗ trợ sắp xếp lịch trình. Bạn có thể kéo thẻ địa điểm vào từng ngày trong Itinerary.`;
  }
  return 'Chào bạn! Chuyến đi hiện chưa có điểm đến. Hãy cho mình biết thành phố hoặc khu vực muốn khám phá nhé.';
};

// Nhãn độ tin cậy do backend gắn (trustLevel). Dữ liệu cũ chưa có trustLevel thì suy ra từ provider.
const getTrustLevel = (place) => {
  if (place?.trustLevel) return place.trustLevel;
  if (String(place?.provider || '').toUpperCase() === 'PARTNER') return 'VERIFIED';
  return Number(place?.placeId ?? place?.id) > 0 ? 'MAP_DATA' : 'AI_REFERENCE';
};

const TRUST_STYLES = {
  VERIFIED: { label: 'Đã xác minh', Icon: BadgeCheck, className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  MAP_DATA: { label: 'Có trên bản đồ', Icon: MapIcon, className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  AI_REFERENCE: { label: 'Tham khảo · chưa xác minh vị trí', Icon: Info, className: 'bg-amber-50 text-amber-800 ring-amber-200' },
};

// ================= KHUNG CHAT KÉO THẢ / ĐỔI KÍCH THƯỚC =================
// Vị trí + kích thước được nhớ trong localStorage để lần sau mở lại đúng chỗ người dùng đã đặt.
const WINDOW_KEY = 'travel.aiChatWindow';
const MIN_W = 340;
const MIN_H = 420;
const EDGE = 8;           // lề tối thiểu với mép màn hình
const COMPACT_BREAKPOINT = 640; // màn hình nhỏ hơn: khung chat cố định toàn màn hình như cũ

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value));

const clampWindow = (win) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = clampNumber(win.w, Math.min(MIN_W, vw - EDGE * 2), vw - EDGE * 2);
  const h = clampNumber(win.h, Math.min(MIN_H, vh - EDGE * 2), vh - EDGE * 2);
  return {
    w,
    h,
    x: clampNumber(win.x, EDGE, vw - w - EDGE),
    y: clampNumber(win.y, EDGE, vh - h - EDGE),
  };
};

// Mặc định giống vị trí cũ: góc dưới bên phải, phía trên nút bong bóng.
const defaultWindow = () => {
  const w = Math.min(540, window.innerWidth - 32);
  const h = Math.min(780, window.innerHeight - 120);
  return clampWindow({ w, h, x: window.innerWidth - w - 20, y: window.innerHeight - h - 96 });
};

const readWindow = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(WINDOW_KEY) || 'null');
    if (saved && ['x', 'y', 'w', 'h'].every((key) => Number.isFinite(saved[key]))) return clampWindow(saved);
  } catch {
    // localStorage hỏng hoặc bị chặn: dùng vị trí mặc định
  }
  return defaultWindow();
};

const saveWindow = (win) => {
  try { localStorage.setItem(WINDOW_KEY, JSON.stringify(win)); } catch { /* bỏ qua */ }
};

const getPlaceName = (place) => place?.name || place?.placeName || place?.displayName?.text || '';
const getPlacePrice = (place) => place?.estimatedPrice ?? place?.estimatedCostMin ?? place?.estimatedCost ?? place?.price ?? null;
const getPlaceDistanceKm = (place) => {
  if (place?.distanceKm != null && Number.isFinite(Number(place.distanceKm))) return Number(place.distanceKm);
  if (place?.distanceMeters != null && Number.isFinite(Number(place.distanceMeters))) return Number(place.distanceMeters) / 1000;
  return null;
};

export default function AiAssistantChat({ tripId, trip, onTripUpdated, onAddPlaceToDay }) {
  const tripDays = Array.isArray(trip?.tripDays) ? trip.tripDays : [];
  const firstDayId = tripDays[0]?.id != null ? String(tripDays[0].id) : '';

  const [isOpen, setIsOpen] = useState(false);
  const [win, setWin] = useState(readWindow);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isCompact, setIsCompact] = useState(() => window.innerWidth < COMPACT_BREAKPOINT);
  const [interaction, setInteraction] = useState(null); // null | 'move' | 'resize-se' | 'resize-nw'
  const interactionRef = useRef(null); // { mode, startX, startY, startWin }

  // Màn hình đổi kích thước: giữ khung chat trong màn hình, chuyển chế độ gọn trên điện thoại.
  useEffect(() => {
    const onResize = () => {
      setIsCompact(window.innerWidth < COMPACT_BREAKPOINT);
      setWin((current) => clampWindow(current));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Kéo tiêu đề để di chuyển, kéo góc để đổi kích thước.
  useEffect(() => {
    if (!interaction) return undefined;
    const onMove = (event) => {
      const state = interactionRef.current;
      if (!state) return;
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      const start = state.startWin;
      let next;
      if (state.mode === 'move') {
        next = { ...start, x: start.x + dx, y: start.y + dy };
      } else if (state.mode === 'resize-se') {
        next = { ...start, w: start.w + dx, h: start.h + dy };
      } else {
        // Góc trên-trái: kéo lên/sang trái để phóng to, cạnh dưới-phải đứng yên.
        const w = clampNumber(start.w - dx, MIN_W, start.x + start.w - EDGE);
        const h = clampNumber(start.h - dy, MIN_H, start.y + start.h - EDGE);
        next = { w, h, x: start.x + start.w - w, y: start.y + start.h - h };
      }
      setWin(clampWindow(next));
    };
    const onUp = () => {
      interactionRef.current = null;
      setInteraction(null);
      setWin((current) => { saveWindow(current); return current; });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = interaction === 'move' ? 'grabbing' : 'nwse-resize';
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [interaction]);

  const startInteraction = (event, mode) => {
    if (isCompact || isMaximized || event.button !== 0) return;
    if (mode === 'move' && event.target.closest('button, a, input, select, textarea')) return;
    event.preventDefault();
    interactionRef.current = { mode, startX: event.clientX, startY: event.clientY, startWin: win };
    setInteraction(mode);
  };

  const resetWindow = () => {
    const next = defaultWindow();
    setIsMaximized(false);
    setWin(next);
    saveWindow(next);
  };

  const windowStyle = isCompact
    ? undefined
    : isMaximized
      ? { left: 16, top: 16, width: 'calc(100vw - 32px)', height: 'calc(100vh - 32px)' }
      : { left: win.x, top: win.y, width: win.w, height: win.h };
  const [messages, setMessages] = useState(() => [{
    sender: 'ai',
    text: makeGreeting(trip),
    recommendations: [],
  }]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [targetDayId, setTargetDayId] = useState(firstDayId);
  const [addingPlaceId, setAddingPlaceId] = useState(null);
  const [placeCoverImages, setPlaceCoverImages] = useState({});
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const sendingRef = useRef(false);
  const requestedCoverIdsRef = useRef(new Set());

  useEffect(() => {
    let active = true;
    setMessages([{ sender: 'ai', text: makeGreeting(trip), recommendations: [] }]);
    setConversationId(null);
    setTargetDayId(firstDayId);

    const token = localStorage.getItem('token');
    if (tripId && token) {
      axios.get(`${API_BASE_URL}/api/v1/trips/${tripId}/ai/history`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(({ data }) => {
        if (!active || !data) return;
        if (data.conversationId != null) setConversationId(data.conversationId);
        if (Array.isArray(data.history) && data.history.length > 0) {
          setMessages(data.history.map((item) => ({
            sender: item.sender === 'user' ? 'user' : 'ai',
            text: item.text || '',
            recommendations: normalizeRecommendations({ recommendations: item.recommendations }),
          })));
        }
      }).catch((error) => {
        // A first-time conversation legitimately has no saved history.
        if (error.response?.status !== 404) console.warn('Không tải được lịch sử AI Chat:', error);
      });
    }

    return () => { active = false; };
  }, [tripId, trip?.destination, firstDayId]);

  useEffect(() => {
    if (!targetDayId && firstDayId) setTargetDayId(firstDayId);
  }, [firstDayId, targetDayId]);

  // Fetch all recommendation cover images in one request (no N+1 calls).
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const allIds = [...new Set(messages.flatMap((message) =>
      (message.recommendations || [])
        .map((place) => place?.placeId ?? place?.id)
        .filter((id) => id != null && Number.isSafeInteger(Number(id)) && Number(id) > 0)
        .map((id) => String(Number(id)))
    ))];
    const pendingIds = allIds.filter((id) => !requestedCoverIdsRef.current.has(id));
    if (pendingIds.length === 0) return;

    pendingIds.forEach((id) => requestedCoverIdsRef.current.add(id));
    axios.get(`${API_BASE_URL}/api/v1/places/covers`, {
      params: { placeIds: pendingIds.join(',') },
      headers: { Authorization: `Bearer ${token}` },
    }).then(({ data }) => {
      if (data && typeof data === 'object') {
        setPlaceCoverImages((previous) => ({ ...previous, ...data }));
      }
    }).catch((error) => {
      pendingIds.forEach((id) => requestedCoverIdsRef.current.delete(id));
      console.warn('Không tải được ảnh đại diện địa điểm:', error);
    });
  }, [messages]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // TripDetail emits this event after a card has been dropped on a Day zone.
  useEffect(() => {
    const onPlaceAdded = (event) => {
      const detail = event?.detail || {};
      if (String(detail.tripId) !== String(tripId)) return;
      setMessages((previous) => [...previous, {
        sender: 'ai',
        text: `Đã thêm ${detail.placeName || 'địa điểm'} vào Day ${detail.dayNumber || ''} trong lịch trình.`,
        recommendations: [],
      }]);
    };
    window.addEventListener('travel-ai-place-added', onPlaceAdded);
    return () => window.removeEventListener('travel-ai-place-added', onPlaceAdded);
  }, [tripId]);

  const appendAssistantMessage = (text, recommendations = [], focus = {}) => {
    setMessages((previous) => [...previous, {
      sender: 'ai',
      text: text || 'Mình đã nhận được yêu cầu. Bạn muốn tiếp tục bước nào?',
      recommendations,
      targetDayNumber: focus.targetDayNumber ?? null,
      anchorName: focus.anchorName ?? null,
    }]);
  };

  const handleSend = async (messageOverride) => {
    const message = String(messageOverride ?? inputText).trim();
    if (!message || sendingRef.current || !tripId) return;

    sendingRef.current = true;
    setMessages((previous) => [...previous, { sender: 'user', text: message, recommendations: [] }]);
    setInputText('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');

      const response = await axios.post(
        `${API_BASE_URL}/api/v1/trips/${tripId}/ai/chat`,
        {
          // GeminiAiService.processChat() reads tripId from AiChatRequest.
          // Backend still reloads the canonical Trip from DB and checks permission.
          tripId: Number(tripId),
          conversationId,
          userMessage: message,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const aiData = response.data || {};
      if (aiData.conversationId != null) setConversationId(aiData.conversationId);
      // Người dùng hỏi cho "ngày N": chọn sẵn ngày đó cho nút "Thêm vào ngày đã chọn".
      if (aiData.targetDayId != null && tripDays.some((day) => String(day.id) === String(aiData.targetDayId))) {
        setTargetDayId(String(aiData.targetDayId));
      }
      appendAssistantMessage(
        aiData.assistantMessage || aiData.message || 'Mình đã xử lý xong yêu cầu.',
        normalizeRecommendations(aiData),
        { targetDayNumber: aiData.targetDayNumber ?? null, anchorName: aiData.anchorName ?? null }
      );
    } catch (error) {
      console.error('Lỗi AI Chat:', error);
      const messageText = error.response?.data?.message
        || (typeof error.response?.data === 'string' ? error.response.data : null)
        || error.message
        || 'Hệ thống AI đang bận, vui lòng thử lại sau.';
      appendAssistantMessage(`Mình chưa xử lý được yêu cầu: ${messageText}`);
    } finally {
      sendingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleAddRecommendation = async (place, selectedDayId = targetDayId) => {
    if (!selectedDayId || addingPlaceId != null) return;
    const placeName = getPlaceName(place);
    if (!placeName) return;

    const placeKey = place?.placeId ?? place?.id ?? placeName;
    setAddingPlaceId(String(placeKey));
    try {
      if (typeof onAddPlaceToDay === 'function') {
        await onAddPlaceToDay(place, selectedDayId);
      } else {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Bạn cần đăng nhập để thêm địa điểm.');
        const coordinates = getPlaceCoordinates(place);
        const placeIdValue = place?.placeId ?? place?.id ?? null;
        const placeId = Number(placeIdValue);
        if (!Number.isSafeInteger(placeId) || placeId <= 0) {
          throw new Error('Địa điểm đề xuất chưa có Place ID hợp lệ nên chưa thể liên kết vào bản đồ.');
        }

        const selectedDay = tripDays.find((day) => String(day.id) === String(selectedDayId));
        const orderIndex = Array.isArray(selectedDay?.destinations)
          ? selectedDay.destinations.length
          : 0;

        const rawCategory = String(place?.category || place?.placeType || 'ATTRACTION').toUpperCase();
        const itemType = rawCategory === 'CAFE'
          ? 'RESTAURANT'
          : ['ACCOMMODATION', 'RESTAURANT', 'TRANSPORT', 'ACTIVITY', 'OTHER'].includes(rawCategory)
            ? rawCategory
            : 'ATTRACTION';

        await axios.post(
          `${API_BASE_URL}/api/trips/days/${selectedDayId}/destinations`,
          {
            placeId,
            placeName,
            latitude: Number.isFinite(coordinates.latitude) ? coordinates.latitude : null,
            longitude: Number.isFinite(coordinates.longitude) ? coordinates.longitude : null,
            itemType,
            note: place.address || '',
            estimatedCost: getPlacePrice(place),
            orderIndex,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        await onTripUpdated?.();
      }

      const selectedDay = tripDays.find((day) => String(day.id) === String(selectedDayId));
      appendAssistantMessage(`Đã thêm ${placeName} vào Day ${selectedDay?.dayNumber || ''} của chuyến đi.`);
    } catch (error) {
      console.error('Lỗi thêm địa điểm vào Trip:', error);
      const messageText = error.response?.data?.message
        || (typeof error.response?.data === 'string' ? error.response.data : null)
        || error.message
        || 'Không thể thêm địa điểm vào lịch trình. Vui lòng thử lại.';
      appendAssistantMessage(messageText);
    } finally {
      setAddingPlaceId(null);
    }
  };

  const handleDiscoverPlaces = () => {
    if (!trip?.destination?.trim()) {
      handleSend('Chuyến đi hiện chưa có điểm đến. Hãy hỏi mình điểm đến muốn khám phá.');
      return;
    }
    // Use the existing secured chat endpoint; do not call a made-up discover endpoint.
    handleSend(`Hãy tìm và đề xuất các địa điểm tham quan thực tế tại ${trip.destination} phù hợp với chuyến đi hiện tại của tôi.`);
  };

  const quickPrompts = [
    { label: 'Khám phá địa điểm', action: handleDiscoverPlaces },
    { label: 'Tìm chỗ ở', text: 'Tìm khách sạn hoặc homestay phù hợp với ngày đi, số khách, ngân sách và vị trí các điểm tham quan của chuyến đi này.' },
    { label: 'Tìm quán ăn', text: 'Tìm nhà hàng và quán ăn thực tế phù hợp tại điểm đến của chuyến đi này.' },
    ...(tripDays.length > 1 ? [{ label: `Ngày ${tripDays[1].dayNumber} nên đi đâu?`, text: `Ngày ${tripDays[1].dayNumber} mình nên đi đâu? Ưu tiên các địa điểm thuận đường.` }] : []),
    { label: 'Lên lịch trình', text: 'Phân tích những địa điểm đã có trong itinerary và đề xuất cách sắp xếp theo từng ngày để giảm quãng đường di chuyển.' },
  ];

  const handleRecommendationDragStart = (event, place) => {
    const payload = {
      placeId: place?.placeId ?? place?.id ?? null,
      name: getPlaceName(place),
      address: place?.address ?? null,
      category: place?.category ?? place?.placeType ?? null,
      latitude: getPlaceCoordinates(place).latitude,
      longitude: getPlaceCoordinates(place).longitude,
      estimatedPrice: getPlacePrice(place),
      rating: place?.rating ?? null,
      provider: place?.provider ?? null,
      providerPlaceId: place?.providerPlaceId ?? null,
      trustLevel: getTrustLevel(place),
    };
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(PLACE_MIME_TYPE, JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
  };

  // Thẻ Tham khảo: nhờ TripDetail mở ô tìm kiếm của ngày đang chọn, điền sẵn tên + khu vực.
  const handleSearchReference = (place) => {
    window.dispatchEvent(new CustomEvent('travel-ai-reference-search', {
      detail: { tripId, dayId: targetDayId, place: { name: getPlaceName(place), address: place?.address ?? null } },
    }));
  };

  const openChat = () => setIsOpen(true);

  return (
    <>
      {isOpen && (
        <section
          role="dialog"
          aria-label="Trợ lý AI du lịch"
          aria-modal="false"
          style={windowStyle}
          className={`fixed z-[5000] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 ${
            isCompact ? 'bottom-20 right-2 h-[calc(100dvh-100px)] w-[calc(100vw-16px)]' : ''
          } ${interaction ? 'select-none' : ''}`}
        >
          <header
            onPointerDown={(event) => startInteraction(event, 'move')}
            onDoubleClick={(event) => { if (!isCompact && !event.target.closest('button')) setIsMaximized((value) => !value); }}
            title={isCompact ? undefined : 'Kéo để di chuyển · Nhấp đúp để phóng to/thu nhỏ'}
            className={`flex shrink-0 items-center justify-between bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-3.5 text-white ${
              isCompact || isMaximized ? '' : interaction === 'move' ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">Trợ lý AI du lịch</p>
                <p className="truncate text-[11px] text-white/70">{trip?.destination || 'Đồng hành cùng chuyến đi của bạn'}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!isCompact && (
                <>
                  {!isMaximized && <GripHorizontal className="mr-1 h-4 w-4 text-white/40" aria-hidden="true" />}
                  <button
                    type="button"
                    onClick={resetWindow}
                    title="Đưa khung chat về vị trí mặc định"
                    className="rounded-full px-2 py-1 text-[11px] font-semibold text-white/70 transition hover:bg-white/15 hover:text-white"
                  >
                    Về góc
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMaximized((value) => !value)}
                    aria-label={isMaximized ? 'Thu nhỏ khung chat' : 'Phóng to khung chat'}
                    title={isMaximized ? 'Thu nhỏ' : 'Phóng to'}
                    className="rounded-full p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
                  >
                    {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Ẩn trợ lý"
                title="Ẩn (bấm bong bóng chat để mở lại)"
                className="rounded-full p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
              >
                <Minus className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="shrink-0 border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600">
              {trip?.destination && <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200"><MapPin className="h-3 w-3" />{trip.destination}</span>}
              {(trip?.startDate || trip?.endDate) && <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200"><CalendarDays className="h-3 w-3" />{trip.startDate || '?'} – {trip.endDate || '?'}</span>}
              {formatVND(trip?.totalBudget) && <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200"><Wallet className="h-3 w-3" />{formatVND(trip.totalBudget)}</span>}
            </div>
            {tripDays.length > 0 && (
              <p className="mt-2 text-[10px] text-slate-400">Kéo thẻ địa điểm vào Day tương ứng trong Itinerary hoặc chọn ngày rồi nhấn Thêm.</p>
            )}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/80 p-4">
            {messages.map((message, index) => (
              <div key={`${index}-${message.sender}`} className={`flex flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${message.sender === 'user' ? 'rounded-br-md bg-slate-900 text-white' : 'rounded-bl-md border border-slate-100 bg-white text-slate-700'}`}>
                  {message.text}
                </div>

                {message.recommendations?.length > 0 && (
                  <div className="mt-3 w-full space-y-2.5">
                    {(message.targetDayNumber || message.anchorName) && (
                      <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                        {message.targetDayNumber && (
                          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-white">Gợi ý cho Ngày {message.targetDayNumber}</span>
                        )}
                        {message.anchorName && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-slate-600 ring-1 ring-slate-200">
                            <Route className="h-3 w-3" /> Ưu tiên gần {message.anchorName}
                          </span>
                        )}
                      </div>
                    )}
                    {tripDays.length > 0 && (
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        Thêm nhanh vào:
                        <select
                          value={targetDayId}
                          onChange={(event) => setTargetDayId(event.target.value)}
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-slate-400"
                        >
                          {tripDays.map((day) => <option key={day.id} value={String(day.id)}>Day {day.dayNumber}</option>)}
                        </select>
                      </label>
                    )}

                    {message.recommendations.map((place, placeIndex) => {
                      const placeName = getPlaceName(place) || 'Địa điểm';
                      const price = getPlacePrice(place);
                      const rating = place?.rating ?? null;
                      const distanceKm = getPlaceDistanceKm(place);
                      const coordinates = getPlaceCoordinates(place);
                      const placeKey = place?.placeId ?? place?.id ?? `${placeName}-${placeIndex}`;
                      const coverImageUrl = place?.coverImageUrl
                        || placeCoverImages[String(place?.placeId ?? place?.id ?? '')]
                        || null;
                      const isAdding = addingPlaceId === String(placeKey);
                      const trustLevel = getTrustLevel(place);
                      const isReference = trustLevel === 'AI_REFERENCE';
                      const trust = TRUST_STYLES[trustLevel] || TRUST_STYLES.MAP_DATA;
                      const trustLabel = place?.trustLabel || trust.label;

                      return (
                        <article
                          key={placeKey}
                          draggable={Boolean(placeName)}
                          onDragStart={(event) => handleRecommendationDragStart(event, place)}
                          className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md active:cursor-grabbing"
                          title={isReference
                            ? 'Địa điểm tham khảo: thả vào một ngày để mở ô tìm kiếm địa chỉ'
                            : 'Kéo thẻ này và thả vào một ngày trong Itinerary'}
                        >
                          <div className="flex items-start gap-3 p-3">
                            {coverImageUrl ? (
                              <img
                                src={coverImageUrl}
                                alt={placeName}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="mt-0.5 h-16 w-20 shrink-0 rounded-xl bg-slate-100 object-cover"
                                onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}
                              />
                            ) : (
                              <div className="mt-0.5 flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                                <MapPin className="h-5 w-5" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-900">{placeName}</p>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                    {place?.category && <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">{String(place.category).replaceAll('_', ' ')}</span>}
                                    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ${trust.className}`}>
                                      <trust.Icon className="h-3 w-3" />{trustLabel}
                                    </span>
                                  </div>
                                </div>
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-400 group-hover:text-slate-600">
                                  <GripVertical className="h-3.5 w-3.5" /> Kéo
                                </span>
                              </div>
                              {(place?.address || place?.formattedAddress) && (
                                <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                                  {isReference && <span className="font-semibold">Khu vực (theo AI): </span>}
                                  {place.address || place.formattedAddress}
                                </p>
                              )}
                              {!isReference && (
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                  <span className="inline-flex items-center gap-1">
                                    <Star className="h-3 w-3 text-amber-400" />
                                    {rating != null
                                      ? `${Number(rating).toFixed(1)}${place.userRatingsTotal ? ` (${place.userRatingsTotal}${place?.ratingSource === 'COMMUNITY' ? ' đánh giá cộng đồng' : ''})` : ''}`
                                      : 'Chưa có đánh giá'}
                                  </span>
                                  {price != null && <span>{`${formatVND(price)}${place?.priceType === 'REFERENCE' ? ' · tham khảo' : ''}`}</span>}
                                  {place?.distanceFromAnchorMeters != null && place?.anchorName ? (
                                    <span className="inline-flex items-center gap-1" title="Khoảng cách đường chim bay tới địa điểm đầu tiên trong lịch trình">
                                      <Route className="h-3 w-3" />
                                      {place.distanceFromAnchorMeters < 1000
                                        ? `${Math.round(place.distanceFromAnchorMeters)} m`
                                        : `${(place.distanceFromAnchorMeters / 1000).toFixed(1)} km`} từ {place.anchorName}
                                    </span>
                                  ) : distanceKm != null && (
                                    <span className="inline-flex items-center gap-1"><Route className="h-3 w-3" />{distanceKm.toFixed(1)} km từ trung tâm</span>
                                  )}
                                  {place?.notable && <span className="font-semibold text-violet-600">Nổi tiếng</span>}
                                  {Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude) && <span>Đã có tọa độ</span>}
                                </div>
                              )}
                              {place?.matchReason && <p className="mt-2 text-xs leading-5 text-emerald-700">Vì sao đề xuất: {place.matchReason}</p>}
                              {place?.attribution && <p className="mt-1 text-[10px] text-slate-400">{place.attribution}</p>}
                              {isReference ? (
                                <>
                                  <p className="mt-2 text-[11px] leading-4 text-amber-700">
                                    Vị trí chưa có trên bản đồ của hệ thống. Kéo thẻ vào một ngày hoặc bấm nút dưới để tìm địa chỉ rồi tự thêm.
                                  </p>
                                  <button
                                    type="button"
                                    disabled={!targetDayId || tripDays.length === 0}
                                    onClick={() => handleSearchReference(place)}
                                    className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <Search className="h-3.5 w-3.5" /> Tìm địa chỉ cho ngày đã chọn
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!targetDayId || addingPlaceId != null || tripDays.length === 0}
                                  onClick={() => handleAddRecommendation(place)}
                                  className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isAdding ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                  {tripDays.length ? 'Thêm vào ngày đã chọn' : 'Trip chưa có ngày để thêm'}
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                    {message.recommendations.some((place) => String(place?.provider || '').toUpperCase() === 'OSM') && (
                      <p className="px-1 text-[10px] text-slate-400">
                        Một phần dữ liệu địa điểm từ <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap contributors · ODbL</a>
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {messages.length === 1 && !isLoading && (
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    onClick={() => prompt.action ? prompt.action() : handleSend(prompt.text)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
                  >
                    <Sparkles className="mr-1 inline h-3 w-3" />{prompt.label}
                  </button>
                ))}
              </div>
            )}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <LoaderCircle className="h-4 w-4 animate-spin" /> Đang tìm dữ liệu đã xác minh và hỏi AI...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={(event) => { event.preventDefault(); handleSend(); }}
            className="flex shrink-0 items-center gap-2 border-t border-slate-100 bg-white p-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              placeholder={trip?.destination ? `Hỏi về chuyến đi ${trip.destination}...` : 'Nhập điểm đến hoặc yêu cầu...'}
              disabled={isLoading}
              className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              aria-label="Gửi tin nhắn"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>

          {/* Tay nắm đổi kích thước: góc dưới-phải và góc trên-trái */}
          {!isCompact && !isMaximized && (
            <>
              <div
                role="separator"
                aria-label="Kéo để đổi kích thước khung chat"
                onPointerDown={(event) => startInteraction(event, 'resize-se')}
                className="absolute bottom-1 right-1 h-4 w-4 cursor-nwse-resize touch-none"
                style={{ background: 'linear-gradient(135deg, transparent 55%, rgba(100,116,139,.55) 55%, rgba(100,116,139,.55) 62%, transparent 62%, transparent 72%, rgba(100,116,139,.55) 72%, rgba(100,116,139,.55) 79%, transparent 79%)' }}
              />
              <div
                aria-hidden="true"
                onPointerDown={(event) => startInteraction(event, 'resize-nw')}
                className="absolute left-0 top-0 h-4 w-4 cursor-nwse-resize touch-none"
              />
            </>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? 'Đóng trợ lý AI' : 'Mở trợ lý AI'}
        aria-expanded={isOpen}
        className="fixed bottom-5 right-5 z-[5001] flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl shadow-slate-900/25 transition hover:-translate-y-1 hover:bg-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-300"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!isOpen && <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400" />}
      </button>
    </>
  );
}