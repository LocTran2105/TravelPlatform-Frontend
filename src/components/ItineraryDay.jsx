import { Fragment } from 'react';
import {
  MapPin, Plus, Search, X, Car, CheckSquare, Clock, Trash2, ArrowUp, ArrowDown, CornerDownRight, Navigation
} from 'lucide-react';
import { formatFullDate, formatVND } from '../utils/tripDetail';

// Khối một ngày trong phần Lịch trình của TripDetail. Chỉ hiển thị: state và handler nằm ở TripDetail.

// 48 mốc giờ: 00:00, 00:30, ... 23:30
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) =>
  `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`
);

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

const ItineraryDay = ({
  day, dayRef, tripDays, getDayDropProps, dropDayId, focusedDayId, droppingDayId, dayHasStops,
  openDayDirections, draggingDestId, reorderTarget, activeDestination, getDestRowDragProps,
  showHover, hideHover, selectDestination, canEdit, destMenuId, setDestMenuId, savingOrder,
  moveDestination, deletingDestId, handleDeleteDestination, handleUpdateDestProperty,
  handleToggleVisited, openTimePicker, activeTimePickerDestId, setActiveTimePickerDestId, timeDraft,
  setTimeDraft, pickTimeSlot, saveTime, expenseStats, openExpenseDialog, routeData, addingDayId,
  searchRef, searchNotice, searchQuery, setSearchQuery, setAddingDayId, setSearchNotice,
  visibleSuggestions, handleAddDestination
}) => {
  return (
    <div data-day-id={day.id} ref={dayRef} {...getDayDropProps(day)} className={`bg-white border rounded-3xl p-6 shadow-sm transition-all ${dropDayId === day.id ? 'border-indigo-400 ring-4 ring-indigo-100 bg-indigo-50/30' : focusedDayId === day.id ? 'border-[#FF5645] ring-4 ring-[#FF5645]/10' : 'border-slate-200'}`}>
      <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-3 mb-6"><span className="bg-slate-900 text-white text-xs px-3 py-1 rounded-md uppercase tracking-wider">Ngày {day.dayNumber}</span><span className="text-slate-500">{formatFullDate(day.dayDate)}</span>
        {dropDayId === day.id && <span className="ml-auto text-xs font-bold text-indigo-600">Thả để thêm vào Ngày {day.dayNumber}</span>}
        {droppingDayId === day.id && <span className="ml-auto text-xs font-bold text-slate-500">Đang thêm địa điểm…</span>}
        {dropDayId !== day.id && droppingDayId !== day.id && dayHasStops(day.id) && (
          <button
            type="button"
            onClick={() => openDayDirections(day.id)}
            title="Mở chỉ đường cho cả ngày trên Google Maps"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold normal-case text-slate-600 transition hover:border-[#FF5645] hover:text-[#FF5645]"
          >
            <Navigation className="h-3.5 w-3.5" /> Chỉ đường
          </button>
        )}
      </h3>
      
      <div className="space-y-4 mb-4">
        {(!day.destinations || day.destinations.length === 0) ? (
          <div className={`text-center py-6 border-2 border-dashed rounded-2xl ${draggingDestId != null && reorderTarget?.dayId === day.id ? 'border-[#FF5645] bg-red-50/40' : 'border-slate-100'}`}>
            <CheckSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">Bạn chưa thêm địa điểm nào.</p>
          </div>
        ) : (
          day.destinations.map((dest, idx) => {
            const isActive = activeDestination?.id === dest.id;
            const isVisited = dest.isVisited || false; 

            const showDropLineBefore = draggingDestId != null && reorderTarget?.dayId === day.id && reorderTarget.index === idx;
            return (
              <Fragment key={dest.id}>
              {showDropLineBefore && <div className="ml-10 h-1 rounded-full bg-[#FF5645]" />}
              <div 
                {...getDestRowDragProps(day, dest, idx)}
                onMouseEnter={() => showHover(dest.id, 'list', 120)}
                onMouseLeave={() => hideHover(dest.id, { delayMs: 450 })}
                onClick={(e) => {
                  if (e.target.closest('button') || e.target.closest('input')) return;
                  selectDestination(dest, idx);
                }} 
                title={canEdit ? 'Kéo để sắp xếp lại hoặc chuyển sang ngày khác' : undefined}
                className={`flex gap-3 items-start group cursor-pointer p-2 -ml-2 rounded-xl transition-all ${draggingDestId === dest.id ? 'opacity-40' : ''} ${isActive ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'hover:bg-slate-50'}`}
              >
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
                  
                  {idx !== day.destinations.length - 1 && (
                    <div className="w-[1.5px] h-full bg-slate-200 border-l border-dashed border-slate-300 mt-2 min-h-[30px]"></div>
                  )}
                </div>

                <div className={`flex-1 p-3 rounded-2xl transition-all ${isActive ? 'bg-slate-50/80' : 'bg-transparent'}`}>
                  
                  <div className="flex items-center justify-between mb-1">
                    <h4 className={`font-bold text-[15px] transition-colors ${isActive ? 'text-slate-900' : (isVisited ? 'text-slate-600' : 'text-slate-800')}`}>
                      {dest.placeName}
                    </h4>
                    {canEdit && (
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        aria-label={`Tùy chọn cho ${dest.placeName}`}
                        aria-haspopup="menu"
                        aria-expanded={destMenuId === dest.id}
                        onClick={(e) => { e.stopPropagation(); setDestMenuId(id => (id === dest.id ? null : dest.id)); }}
                        className={`rounded-md p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 focus:opacity-100 ${isActive || destMenuId === dest.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM20 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM20 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM20 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"></path></svg>
                      </button>
                      {destMenuId === dest.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setDestMenuId(null); }} />
                          <div role="menu" className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-slate-100 bg-white p-1 shadow-xl" onClick={(e) => e.stopPropagation()}>
                            {/* Sắp xếp không cần kéo thả (dùng được trên điện thoại) */}
                            <button type="button" role="menuitem" disabled={idx === 0 || savingOrder}
                              onClick={() => { setDestMenuId(null); moveDestination(dest.id, day.id, idx - 1); }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">
                              <ArrowUp className="w-4 h-4" /> Di chuyển lên
                            </button>
                            <button type="button" role="menuitem" disabled={idx === day.destinations.length - 1 || savingOrder}
                              onClick={() => { setDestMenuId(null); moveDestination(dest.id, day.id, idx + 2); }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">
                              <ArrowDown className="w-4 h-4" /> Di chuyển xuống
                            </button>
                            {(tripDays || []).filter(d => d.id !== day.id).map(other => (
                              <button key={other.id} type="button" role="menuitem" disabled={savingOrder}
                                onClick={() => { setDestMenuId(null); moveDestination(dest.id, other.id, (other.destinations || []).length); }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40">
                                <CornerDownRight className="w-4 h-4" /> Chuyển sang Ngày {other.dayNumber}
                              </button>
                            ))}
                            <div className="my-1 border-t border-slate-100" />
                            <button
                              type="button"
                              role="menuitem"
                              disabled={deletingDestId === dest.id}
                              onClick={() => handleDeleteDestination(day, dest)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              {deletingDestId === dest.id ? 'Đang xóa…' : 'Xóa khỏi lịch trình'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    )}
                  </div>

                  {isActive ? (
                    <input 
                      type="text" 
                      defaultValue={dest.note || ''} 
                      readOnly={!canEdit}
                      onBlur={(e) => { if (canEdit) handleUpdateDestProperty(day.id, dest.id, 'note', e.target.value); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                      placeholder={canEdit ? 'Thêm ghi chú...' : 'Chưa có ghi chú'} 
                      className="w-full bg-transparent text-sm text-slate-700 outline-none mb-3 placeholder:text-slate-400 border-b border-transparent focus:border-slate-300 pb-1"
                    />
                  ) : (
                    dest.note && <p className="text-[13px] text-slate-600 mb-2 line-clamp-2">{dest.note}</p>
                  )}

                  {isActive && canEdit && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 pt-2 border-t border-slate-200 relative">
                      
                      <button 
                        onClick={() => handleToggleVisited(day, dest, isVisited)}
                        className={`flex items-center gap-1.5 text-[13px] font-bold transition-colors ${isVisited ? 'text-slate-400 hover:text-slate-600' : 'text-indigo-600 hover:text-indigo-800'}`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        {isVisited ? 'Bỏ đánh dấu' : 'Đã đi'}
                      </button>

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

                        {activeTimePickerDestId === dest.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={(e) => { e.stopPropagation(); setActiveTimePickerDestId(null); }}
                            />
                            <div
                              className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 p-3 flex flex-col gap-3 animate-fade-in"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`flex-1 bg-slate-50 rounded-lg p-2 border transition-colors ${timeDraft.focus === 'start' ? 'border-indigo-400' : 'border-slate-100'}`}>
                                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Giờ bắt đầu</span>
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
                                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Giờ kết thúc</span>
                                  <input
                                    type="time"
                                    value={timeDraft.end}
                                    onFocus={() => setTimeDraft(d => ({ ...d, focus: 'end' }))}
                                    onChange={(e) => setTimeDraft(d => ({ ...d, end: e.target.value }))}
                                    className="w-full bg-transparent outline-none text-sm font-bold text-slate-700"
                                  />
                                </div>
                              </div>

                              <div
                                className="h-32 overflow-y-auto border border-slate-100 rounded-lg py-1 custom-scrollbar"
                                ref={(el) => {
                                  if (el && !el.dataset.ready) {
                                    el.dataset.ready = '1';
                                    const idx = TIME_OPTIONS.indexOf(timeDraft[timeDraft.focus]);
                                    el.scrollTop = (idx >= 0 ? idx : 16) * 32; 
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

                  {(!isActive || !canEdit) && (dest.timeRange || (expenseStats.byDest[dest.id] || 0) > 0) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {dest.timeRange && dest.timeRange.trim() !== '' && <span className="bg-indigo-50 px-2 py-1 rounded-md text-[11px] font-bold text-indigo-700">{dest.timeRange}</span>}
                      {(expenseStats.byDest[dest.id] || 0) > 0 && <span className="bg-indigo-50 px-2 py-1 rounded-md text-[11px] font-bold text-indigo-700">{formatVND(expenseStats.byDest[dest.id])}</span>}
                    </div>
                  )}

                  <LegChip leg={routeData[day.id]?.legByFrom?.[dest.id]} />

                </div>
              </div>
              </Fragment>
            )
          })
        )}
        {draggingDestId != null && reorderTarget?.dayId === day.id
          && reorderTarget.index === (day.destinations || []).length
          && (day.destinations || []).length > 0 && (
          <div className="ml-10 h-1 rounded-full bg-[#FF5645]" />
        )}
      </div>

      {addingDayId === day.id ? (
        <div ref={searchRef} className="relative mt-4 pl-12">
          {searchNotice?.dayId === day.id && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-5 text-amber-800">
              <p className="font-bold">“{searchNotice.name}” là gợi ý tham khảo của AI</p>
              <p className="mt-0.5">
                Địa điểm chưa được xác nhận nên vị trí cụ thể chưa có trên bản đồ của chúng tôi;
                tên và khu vực chỉ dựa trên thông tin từ Internet. Hãy kiểm tra kết quả tìm kiếm bên dưới,
                nếu đúng địa điểm bạn muốn thì chọn để tự thêm vào ngày này.
              </p>
            </div>
          )}
          <div className="flex items-center border border-[#FF5645] rounded-xl px-4 py-3 bg-white shadow-sm ring-4 ring-[#FF5645]/10">
            <Search className="w-5 h-5 text-[#FF5645] mr-3" />
            <input type="text" autoFocus placeholder="Tìm quán ăn, khách sạn..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 outline-none text-base bg-transparent font-medium" />
            <button onClick={() => { setAddingDayId(null); setSearchQuery(''); setSearchNotice(null); }} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
          </div>
          
          {visibleSuggestions.length > 0 && (
            <div className="absolute top-full left-12 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden">
              {visibleSuggestions.map((place, idx) => (
                <div key={place.key || idx} onClick={() => handleAddDestination(place, day.id)} className="px-5 py-4 hover:bg-orange-50 cursor-pointer border-b border-slate-50 last:border-0 flex items-start gap-3">
                  <MapPin className={`w-5 h-5 mt-0.5 flex-shrink-0 ${place.source === 'db' ? 'text-emerald-600' : 'text-[#FF5645]'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                      {place.name}
                      {place.source === 'db' && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${place.verified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {place.verified ? 'Đối tác đã xác minh' : 'Có trong hệ thống'}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-slate-500 truncate max-w-[420px]">{place.address}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        canEdit && <div className="pl-12 mt-2">
          <button onClick={() => setAddingDayId(day.id)} className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 text-sm font-bold hover:border-[#FF5645] hover:text-[#FF5645] hover:bg-orange-50/50 transition-colors flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> Thêm địa điểm vào Ngày {day.dayNumber}</button>
        </div>
      )}
    </div>
  );
};

export default ItineraryDay;
