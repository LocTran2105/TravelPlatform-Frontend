import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Sparkles, X, Minimize2, Send, MapPin, Star, Plus, Check, ExternalLink, Loader2
} from 'lucide-react';

const API_BASE = 'http:' + '//localhost:8080';
const OSM_COPYRIGHT_URL = 'https:' + '//www.openstreetmap.org/copyright';

const formatCurrency = (val) => {
  if (val === null || val === undefined || Number.isNaN(Number(val)) || Number(val) <= 0) {
    return null;
  }
  return `${Number(val).toLocaleString('vi-VN')} VNĐ`;
};

export default function AiAssistantChat({ trip, onDestinationAdded }) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState('');

  const [selectedDays, setSelectedDays] = useState({});
  const [addingStatus, setAddingStatus] = useState({});

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const defaultDayId = useMemo(() => {
    return trip?.tripDays && trip.tripDays.length > 0 ? trip.tripDays[0].id : null;
  }, [trip]);

  const initialGreeting = useMemo(() => {
    if (!trip?.destination) {
      return 'Chào bạn! Mình là trợ lý AI du lịch. Mình có thể giúp bạn tìm địa điểm tham quan, ăn uống và sắp xếp lịch trình.';
    }
    const datePart = trip.startDate
      ? ` từ ${trip.startDate}${trip.endDate ? ` đến ${trip.endDate}` : ''}`
      : '';
    const budgetPart = trip.totalBudget && Number(trip.totalBudget) > 0
      ? `, ngân sách ${Number(trip.totalBudget).toLocaleString('vi-VN')} VNĐ`
      : '';
    return `Chào bạn! Mình thấy bạn đang chuẩn bị chuyến đi ${trip.destination}${datePart}${budgetPart}. Mình có thể tìm địa điểm nổi bật, quán ăn, cà phê tại ${trip.destination} hoặc giúp bạn sắp xếp lịch trình.`;
  }, [trip]);

  const buildTripContextPayload = () => {
    if (!trip) return null;
    return {
      tripId: trip.id,
      title: trip.title,
      destination: trip.destination,
      startDate: trip.startDate || null,
      endDate: trip.endDate || null,
      memberCount: trip.memberCount || 1,
      totalBudget: trip.totalBudget || 0,
      tripDays: (trip.tripDays || []).map((d) => ({
        dayId: d.id,
        dayNumber: d.dayNumber,
        dayDate: d.dayDate,
        existingPlaces: (d.destinations || []).map((dest) => dest.placeName),
      })),
    };
  };

  useEffect(() => {
    if (!trip?.id) return;
    let isCancelled = false;

    const loadHistory = async () => {
      setConversationId(null);
      setErrorBanner('');
      setAddingStatus({});

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setMessages([{ id: 'greeting', sender: 'ai', text: initialGreeting, recommendations: [] }]);
          return;
        }
        const res = await axios.get(`${API_BASE}/api/v1/trips/${trip.id}/ai/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isCancelled) return;

        const data = res.data;
        if (data?.conversationId) {
          setConversationId(data.conversationId);
        }
        if (Array.isArray(data?.history) && data.history.length > 0) {
          setMessages([
            { id: 'greeting', sender: 'ai', text: initialGreeting, recommendations: [] },
            ...data.history,
          ]);
        } else {
          setMessages([{ id: 'greeting', sender: 'ai', text: initialGreeting, recommendations: [] }]);
        }
      } catch (err) {
        if (!isCancelled) {
          setMessages([{ id: 'greeting', sender: 'ai', text: initialGreeting, recommendations: [] }]);
        }
      }
    };

    loadHistory();
    return () => {
      isCancelled = true;
    };
  }, [trip?.id, initialGreeting]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [messages, isOpen]);

  const handleSend = async (customPrompt) => {
    const textToSend = (customPrompt ?? inputText).trim();
    if (!textToSend || isLoading || !trip?.id) return;

    const userMsg = { id: `user-${Date.now()}`, sender: 'user', text: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInputText('');
    setIsLoading(true);
    setErrorBanner('');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE}/api/v1/trips/${trip.id}/ai/chat`,
        {
          conversationId: conversationId,
          userMessage: textToSend,
          tripContext: buildTripContextPayload(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const aiData = response.data;
      if (aiData?.conversationId) {
        setConversationId(aiData.conversationId);
      }

      const rawRecs = Array.isArray(aiData?.recommendations) ? aiData.recommendations.flat() : [];

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: aiData?.assistantMessage || 'Mình đã tìm thấy một số địa điểm phù hợp cho chuyến đi của bạn.',
          recommendations: rawRecs,
        },
      ]);
    } catch (error) {
      console.error('Lỗi AI Chat:', error);
      setErrorBanner('Không thể kết nối tới Trợ lý AI. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPlaceToDay = async (place, cardKey) => {
    const targetDayId = selectedDays[cardKey] || defaultDayId;
    if (!targetDayId) {
      alert('Chuyến đi của bạn chưa có ngày nào trong lịch trình.');
      return;
    }
    if (addingStatus[cardKey] === 'loading' || addingStatus[cardKey] === 'added') return;

    setAddingStatus((prev) => ({ ...prev, [cardKey]: 'loading' }));
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE}/api/trips/days/${targetDayId}/destinations`,
        {
          placeName: place.name,
          latitude: place.latitude,
          longitude: place.longitude,
          note: place.address || place.matchReason || '',
          estimatedCost: place.estimatedPrice != null ? Number(place.estimatedPrice) : 0,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setAddingStatus((prev) => ({ ...prev, [cardKey]: 'added' }));
      if (typeof onDestinationAdded === 'function') {
        await onDestinationAdded();
      }
    } catch (err) {
      console.error('Lỗi thêm địa điểm từ AI:', err);
      setAddingStatus((prev) => ({ ...prev, [cardKey]: undefined }));
      alert('Không thể thêm địa điểm vào lịch trình. Vui lòng thử lại.');
    }
  };

  if (!trip) return null;

  const widgetContent = (
    <div className="fixed bottom-5 right-5 z-[3500] font-sans">
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Mở Trợ lý AI Du lịch"
          className="group flex items-center gap-2.5 bg-[#FF5645] hover:bg-[#E04B3B] text-white font-bold px-5 py-3.5 rounded-full shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Sparkles className="w-5 h-5 animate-pulse" />
          <span className="text-sm sm:text-base">Trợ lý AI • {trip.destination}</span>
        </button>
      )}

      {isOpen && (
        <div
          role="dialog"
          aria-label="Cửa sổ Trợ lý AI Du lịch"
          className="w-[calc(100vw-2rem)] sm:w-[410px] h-[78vh] sm:h-[620px] max-h-[calc(100vh-3rem)] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#FF5645] to-[#ff7668] text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm sm:text-base truncate">
                  Trợ lý AI • {trip.destination}
                </h3>
                <p className="text-[11px] text-white/90 truncate">
                  Đề xuất địa điểm thực tế & Lịch trình
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Thu nhỏ cửa sổ chat"
                className="h-8 w-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                title="Thu nhỏ"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Đóng cửa sổ chat"
                className="h-8 w-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Gợi ý nhanh */}
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex gap-2 overflow-x-auto flex-shrink-0">
            {[
              'Gợi ý địa điểm nổi bật cho mình',
              `Quán ăn ngon ở ${trip.destination}`,
              `Quán cà phê đẹp ở ${trip.destination}`,
              'Phân bổ ngân sách chuyến đi',
            ].map((promptText, i) => (
              <button
                key={i}
                type="button"
                disabled={isLoading}
                onClick={() => handleSend(promptText)}
                className="text-xs font-semibold bg-white hover:bg-orange-50 text-slate-700 hover:text-[#FF5645] border border-slate-200 hover:border-[#FF5645]/40 px-3 py-1.5 rounded-full whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50"
              >
                {promptText}
              </button>
            ))}
          </div>

          {/* Nội dung hội thoại */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/60">
            {messages.map((msg, index) => (
              <div
                key={msg.id || index}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-[#FF5645] text-white font-medium'
                      : 'bg-white text-slate-800 border border-slate-100'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Danh sách Card đề xuất địa điểm */}
                {Array.isArray(msg.recommendations) && msg.recommendations.length > 0 && (
                  <div className="mt-3 w-full space-y-2.5">
                    {msg.recommendations.map((place, idx) => {
                      if (!place || !place.name) return null;
                      const cardKey = `${msg.id || index}-${place.providerPlaceId || place.placeId || idx}`;
                      const status = addingStatus[cardKey];
                      const chosenDayId = selectedDays[cardKey] || defaultDayId || '';
                      const formattedPrice = formatCurrency(place.estimatedPrice);

                      return (
                        <div
                          key={cardKey}
                          className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-sm hover:border-slate-300 transition-all"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-50 text-[#FF5645] mb-1">
                                {place.category || 'ĐỊA ĐIỂM'}
                              </span>
                              <h4 className="font-bold text-slate-900 text-sm leading-snug">
                                {place.name}
                              </h4>
                            </div>
                            {place.sourceUrl && (
                              <a
                                href={place.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Xem trên OpenStreetMap"
                                className="text-slate-400 hover:text-slate-700 p-1 shrink-0"
                                title="Xem nguồn trên OpenStreetMap"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>

                          {place.address && (
                            <p className="text-xs text-slate-500 mt-1 flex items-start gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                              <span>{place.address}</span>
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-slate-600">
                            {place.rating != null && Number(place.rating) > 0 && (
                              <span className="flex items-center gap-1 font-semibold text-amber-600">
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                {place.rating}
                                {place.userRatingsTotal ? ` (${place.userRatingsTotal})` : ''}
                              </span>
                            )}
                            <span>
                              {formattedPrice
                                ? `Giá tham khảo: ${formattedPrice}`
                                : 'Chưa có dữ liệu giá'}
                            </span>
                          </div>

                          {place.matchReason && (
                            <p className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg mt-2">
                              {place.matchReason}
                            </p>
                          )}

                          {trip.tripDays && trip.tripDays.length > 0 && (
                            <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100">
                              <select
                                aria-label="Chọn ngày trong lịch trình"
                                value={chosenDayId}
                                onChange={(e) =>
                                  setSelectedDays((prev) => ({
                                    ...prev,
                                    [cardKey]: Number(e.target.value),
                                  }))
                                }
                                disabled={status === 'loading' || status === 'added'}
                                className="text-xs font-bold text-slate-700 bg-slate-100 rounded-xl px-2.5 py-2 outline-none cursor-pointer border border-slate-200"
                              >
                                {trip.tripDays.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    Day {d.dayNumber} {d.dayDate ? `(${d.dayDate})` : ''}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                disabled={status === 'loading' || status === 'added'}
                                onClick={() => handleAddPlaceToDay(place, cardKey)}
                                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 px-3 rounded-xl transition-colors ${
                                  status === 'added'
                                    ? 'bg-emerald-100 text-emerald-700 cursor-default'
                                    : 'bg-[#FF5645] hover:bg-[#E04B3B] text-white cursor-pointer disabled:opacity-60'
                                }`}
                              >
                                {status === 'loading' ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang thêm...
                                  </>
                                ) : status === 'added' ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" /> Đã thêm
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3.5 h-3.5" /> Thêm vào ngày này
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                            <span>Nguồn: {place.provider || 'OpenStreetMap'}</span>
                            <a
                              href={OSM_COPYRIGHT_URL}
                              target="_blank"
                              rel="noreferrer"
                              className="underline hover:text-slate-600"
                            >
                              © OpenStreetMap contributors
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium px-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#FF5645]" />
                <span>AI đang tra cứu dữ liệu tại {trip.destination}...</span>
              </div>
            )}

            {errorBanner && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-600 font-medium">
                {errorBanner}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Ô nhập chat */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 flex-shrink-0">
            <input
              ref={inputRef}
              type="text"
              disabled={isLoading}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Hỏi về ${trip.destination || 'chuyến đi'}...`}
              aria-label="Nhập tin nhắn cho trợ lý AI"
              className="flex-1 text-sm bg-slate-100 focus:bg-white px-4 py-2.5 rounded-full outline-none border border-transparent focus:border-slate-300 transition-colors disabled:opacity-60"
            />
            <button
              type="button"
              disabled={isLoading || !inputText.trim()}
              onClick={() => handleSend()}
              aria-label="Gửi tin nhắn"
              className="h-10 w-10 rounded-full bg-[#FF5645] hover:bg-[#E04B3B] text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(widgetContent, document.body);
}