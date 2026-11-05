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
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:8080';
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
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const sendingRef = useRef(false);

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

  const appendAssistantMessage = (text, recommendations = []) => {
    setMessages((previous) => [...previous, {
      sender: 'ai',
      text: text || 'Mình đã nhận được yêu cầu. Bạn muốn tiếp tục bước nào?',
      recommendations,
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
      appendAssistantMessage(
        aiData.assistantMessage || aiData.message || 'Mình đã xử lý xong yêu cầu.',
        normalizeRecommendations(aiData)
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
        await axios.post(
          `${API_BASE_URL}/api/trips/days/${selectedDayId}/destinations`,
          {
            placeName,
            latitude: Number.isFinite(coordinates.latitude) ? coordinates.latitude : null,
            longitude: Number.isFinite(coordinates.longitude) ? coordinates.longitude : null,
            note: place.address || '',
            estimatedCost: getPlacePrice(place),
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
    };
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(PLACE_MIME_TYPE, JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
  };

  const openChat = () => setIsOpen(true);

  return (
    <>
      {isOpen && (
        <section
          role="dialog"
          aria-label="Trợ lý AI du lịch"
          aria-modal="false"
          className="fixed bottom-24 right-5 z-[5000] flex h-[min(780px,calc(100vh-120px))] w-[min(540px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 max-sm:bottom-20 max-sm:right-2 max-sm:h-[calc(100dvh-100px)] max-sm:w-[calc(100vw-16px)]"
        >
          <header className="flex shrink-0 items-center justify-between bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-3.5 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">Trợ lý AI du lịch</p>
                <p className="truncate text-[11px] text-white/70">{trip?.destination || 'Đồng hành cùng chuyến đi của bạn'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Thu nhỏ trợ lý"
              className="rounded-full p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
            >
              <Minus className="h-5 w-5" />
            </button>
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
                      const isAdding = addingPlaceId === String(placeKey);

                      return (
                        <article
                          key={placeKey}
                          draggable={Boolean(placeName)}
                          onDragStart={(event) => handleRecommendationDragStart(event, place)}
                          className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md active:cursor-grabbing"
                          title="Kéo thẻ này và thả vào một ngày trong Itinerary"
                        >
                          <div className="flex items-start gap-3 p-3">
                            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                              <MapPin className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-900">{placeName}</p>
                                  {place?.category && <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-500">{String(place.category).replaceAll('_', ' ')}</p>}
                                </div>
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-400 group-hover:text-slate-600">
                                  <GripVertical className="h-3.5 w-3.5" /> Kéo
                                </span>
                              </div>
                              {(place?.address || place?.formattedAddress) && (
                                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{place.address || place.formattedAddress}</p>
                              )}
                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-1">
                                  <Star className="h-3 w-3 text-amber-400" />
                                  {rating != null ? `${Number(rating).toFixed(1)}${place.userRatingsTotal ? ` (${place.userRatingsTotal})` : ''}` : 'Chưa có rating'}
                                </span>
                                <span>{price != null ? `${formatVND(price)}${place?.priceType === 'REFERENCE' ? ' · tham khảo' : ''}` : 'Chưa có dữ liệu giá'}</span>
                                {distanceKm != null && <span className="inline-flex items-center gap-1"><Route className="h-3 w-3" />{distanceKm.toFixed(1)} km từ trung tâm</span>}
                                {Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude) && <span>Đã có tọa độ</span>}
                              </div>
                              {place?.matchReason && <p className="mt-2 text-xs leading-5 text-emerald-700">Vì sao đề xuất: {place.matchReason}</p>}
                              {place?.attribution && <p className="mt-1 text-[10px] text-slate-400">{place.attribution}</p>}
                              <button
                                type="button"
                                disabled={!targetDayId || addingPlaceId != null || tripDays.length === 0}
                                onClick={() => handleAddRecommendation(place)}
                                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isAdding ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                {tripDays.length ? 'Thêm vào ngày đã chọn' : 'Trip chưa có ngày để thêm'}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                    <p className="px-1 text-[10px] text-slate-400">
                      Dữ liệu địa điểm từ nguồn OpenStreetMap khi có attribution: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">© OpenStreetMap contributors · ODbL</a>
                    </p>
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
                <LoaderCircle className="h-4 w-4 animate-spin" /> AI đang phân tích Trip và tìm dữ liệu...
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
