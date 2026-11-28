import { useEffect, useRef } from 'react';
import { MapContainer, Marker, useMap, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Navigation } from 'lucide-react';
import { MapHoverPreview, getDestPlaceId } from './PlaceHoverPreview';
import ResilientTileLayer from './ResilientTileLayer';
import DirectionsPanel from './DirectionsPanel';
import TripVehicles from './TripVehicles';
import { DAY_COLORS } from '../utils/tripDetail';

// Phần bản đồ của TripDetail (chip ngày, chỉ đường, Leaflet, cảnh báo thiếu tọa độ). Chỉ hiển thị.

// ================= COMPONENT HỖ TRỢ BẢN ĐỒ =================
// boundsKey / activeKey là chuỗi/số ổn định: bản đồ chỉ di chuyển khi tập điểm hoặc điểm được chọn THẬT SỰ đổi,
// không bị giật mỗi lần sửa ghi chú, "Đã đi", giờ... (những thao tác làm đổi tham chiếu mảng nhưng không đổi toạ độ)
function MapBounds({ points, boundsKey, activePoint, activeKey }) {
  const map = useMap();
  const pointsRef = useRef(points);
  const activePointRef = useRef(activePoint);
  pointsRef.current = points;
  activePointRef.current = activePoint;

  // Leaflet cần đo lại kích thước sau khi đổi tab hoặc kéo thanh chia panel.
  useEffect(() => {
    let frame1 = 0;
    let frame2 = 0;
    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
        map.invalidateSize({ pan: false, debounceMoveend: true });
        if (activePointRef.current) {
          map.flyTo(activePointRef.current, 15, { animate: true, duration: 0.8 });
        } else if (activeKey) {
          return;
        } else if (pointsRef.current.length === 1) {
          map.setView(pointsRef.current[0], 15, { animate: true });
        } else if (pointsRef.current.length > 1) {
          map.fitBounds(L.latLngBounds(pointsRef.current), {
            padding: [44, 44], maxZoom: 15, animate: true,
          });
        }
      });
    });
    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
    };
  }, [boundsKey, activeKey, map]);

  return null;
}

// Chưa có địa điểm nào: tìm tọa độ của điểm đến (Photon) rồi bay tới, để bản đồ không mở ra cả khu vực.
function DestinationFocus({ destination, hasStops }) {
  const map = useMap();
  useEffect(() => {
    const q = String(destination || '').trim();
    if (hasStops || q.length < 2) return undefined;
    const controller = new AbortController();
    const params = new URLSearchParams({ q, limit: '1', lat: '16.047', lon: '108.206' });
    fetch(`https://photon.komoot.io/api/?${params}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const c = data?.features?.[0]?.geometry?.coordinates;
        if (Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])) map.flyTo([c[1], c[0]], 12, { duration: 1.2 });
      })
      .catch(() => { /* không tìm được: giữ khung nhìn mặc định */ });
    return () => controller.abort();
  }, [destination, hasStops, map]);
  return null;
}

// Bấm vào vùng trống của bản đồ -> bỏ ghim thẻ xem nhanh.
function MapBackgroundClick({ onClick }) {
  useMapEvents({ click: onClick });
  return null;
}

function MapSizeObserver({ resizeKey }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observedElement = container.parentElement || container;
    let frame = 0;
    const invalidate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        map.invalidateSize({ pan: false, debounceMoveend: true });
      });
    };

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(invalidate);
      observer.observe(observedElement);
    }
    window.addEventListener('resize', invalidate);
    invalidate();

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', invalidate);
    };
  }, [map, resizeKey]);

  return null;
}

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
      html: `<div class="tp-marker-pop" style="background-color: ${color}; color: white; width: ${size}px; height: ${size}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: ${isActive ? '16px' : '12px'}; border: ${border}; box-shadow: ${shadow}; transition: all 0.3s ease;">${number}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    }));
  }
  return markerIconCache.get(key);
};

const TripMap = ({
  tripDays, activeDestination, isPanelOpen, setMapDayMode, mapDayMode, mapDayId, dayHasStops,
  setActiveDestination, savingOrder, directions, setDirections, openDirections, directionStops,
  isSidebarOpen, hideHover, mapStops, boundsKey, routeDays, routeData, hover, selectDestination,
  showHover, destCovers, placeActivity, keepHover, handleDestinationClick, unmappedDestinations, destination
}) => {
  // Lộ trình của các ngày đang hiện trên bản đồ (nối các đoạn đường + các điểm dừng) cho xe chạy
  const vehicleRoutes = routeDays
    .filter(d => !mapDayId || d.id === mapDayId)
    .map(d => ({
      id: d.id,
      color: d.color,
      positions: (routeData[d.id]?.segments || []).flatMap(seg => seg.positions || []),
      stops: d.stops.map(s => ({ lat: s.lat, lng: s.lng, name: s.dest?.placeName || 'Địa điểm' })),
    }))
    .filter(r => r.positions.length >= 2);
  return (
    <>
      {/* Chọn ngày hiển thị trên bản đồ (không cần cuộn danh sách) */}
      {(tripDays || []).length > 0 && !(activeDestination && isPanelOpen) && (
        <div className="absolute left-3 top-3 z-[950] flex max-w-[calc(100%-150px)] items-center gap-1.5 overflow-x-auto rounded-2xl bg-white/95 p-1.5 shadow-lg ring-1 ring-black/5 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { key: 'auto', label: 'Theo cuộn', title: 'Bản đồ đi theo ngày đang xem trong danh sách' },
            { key: 'all', label: 'Cả chuyến', title: 'Hiện mọi ngày, mỗi ngày một màu' },
          ].map(option => (
            <button key={option.key} type="button" title={option.title} onClick={() => setMapDayMode(option.key)}
              className={`shrink-0 rounded-xl px-2.5 py-1 text-xs font-bold transition ${mapDayMode === option.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {option.label}
            </button>
          ))}
          {(tripDays || []).map((day, i) => {
            const color = DAY_COLORS[i % DAY_COLORS.length];
            const selected = mapDayMode === day.id || (mapDayMode === 'auto' && mapDayId === day.id);
            const empty = !dayHasStops(day.id);
            return (
              <button key={day.id} type="button" disabled={empty}
                title={empty ? `Ngày ${day.dayNumber} chưa có địa điểm trên bản đồ` : `Xem lộ trình Ngày ${day.dayNumber}`}
                onClick={() => { setMapDayMode(day.id); setActiveDestination(null); }}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${selected ? 'text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                style={selected ? { backgroundColor: color } : undefined}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: selected ? '#fff' : color }} />
                N{day.dayNumber}
              </button>
            );
          })}
          {savingOrder && <span className="shrink-0 px-1 text-[11px] font-semibold text-slate-400">Đang lưu…</span>}
          <span className="mx-0.5 h-5 w-px shrink-0 bg-slate-200" />
          <button type="button" onClick={() => (directions ? setDirections(null) : openDirections())}
            className={`flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${directions ? 'bg-[#FF5645] text-white' : 'text-[#FF5645] hover:bg-red-50'}`}>
            <Navigation className="h-3.5 w-3.5" /> Chỉ đường
          </button>
        </div>
      )}

      {directions && !(activeDestination && isPanelOpen) && (
        <DirectionsPanel
          stops={directionStops}
          value={directions}
          onChange={setDirections}
          onClose={() => setDirections(null)}
        />
      )}

      {/* BẢN ĐỒ LEAFLET CHÍNH */}
      <MapContainer center={[16.047079, 108.206230]} zoom={5} style={{ height: '100%', width: '100%' }} zoomControl={false}>
        {/* Nền Google giống trang Home (như TripDetail cũ); mạng chặn Google thì tự chuyển sang nền OSM */}
        <ResilientTileLayer preset="google" />
        <MapSizeObserver resizeKey={isSidebarOpen} />
        <MapBackgroundClick onClick={() => hideHover(null, { force: true })} />
        <DestinationFocus destination={destination} hasStops={mapStops.length > 0} />
        <TripVehicles routes={vehicleRoutes} />
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
          .filter(d => !mapDayId || d.id === mapDayId)
          .map(d => (routeData[d.id]?.segments || []).map((seg, i) => (
            <Polyline
              key={`${d.id}-${i}-${seg.approx ? 'approx' : 'road'}-${d.color}`}
              positions={seg.positions}
              color={d.color}
              weight={4}
              opacity={0.8}
              dashArray={seg.approx ? '8 10' : undefined}
              className={seg.approx ? undefined : 'tp-route-line'}
            />
          )))}

        {/* Cắm cờ các điểm đến (số thứ tự khớp với danh sách trong từng ngày) */}
        {mapStops.map((s) => (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={getMarkerIcon(
              s.number,
              activeDestination?.id === s.id || (hover?.source !== 'map' && hover?.id === s.id),
              s.color
            )}
            eventHandlers={{
              click: () => selectDestination(s.dest, s.number - 1),
              mouseover: () => showHover(s.id, 'map'),
              mouseout: () => hideHover(s.id, { delayMs: 250 }),
            }}
          />
        ))}

        {/* Card ảnh + tên khi lia chuột vào địa điểm (từ danh sách hoặc marker) */}
        {(() => {
          // Không hiện card cho địa điểm đang mở sẵn trong panel chi tiết (panel đã có ảnh + tên).
          const isShownInPanel = isPanelOpen && activeDestination?.id === hover?.id;
          const hoveredStop = hover && !isShownInPanel ? mapStops.find(s => s.id === hover.id) : null;
          return (
            <MapHoverPreview
              stop={hoveredStop || null}
              coverUrl={hoveredStop ? destCovers[String(getDestPlaceId(hoveredStop.dest))] : null}
              activity={hoveredStop ? placeActivity[String(hoveredStop.dest?.placeName || '').trim()] : null}
              onCardEnter={keepHover}
              onCardLeave={() => hideHover(hover?.id, { delayMs: 200 })}
              onCardClick={(stop) => handleDestinationClick(stop.dest, stop.number - 1)}
              onDirectionsFrom={(stop) => { hideHover(null, { force: true }); openDirections({ originId: stop.id }); }}
              onDirectionsTo={(stop) => { hideHover(null, { force: true }); openDirections({ destinationId: stop.id }); }}
            />
          );
        })()}
      </MapContainer>
      {unmappedDestinations.length > 0 && (
        <div className="absolute left-4 right-4 bottom-4 z-[900] rounded-xl bg-white/95 border border-amber-200 shadow-lg px-3 py-2 text-xs text-amber-800">
          <strong>{unmappedDestinations.length} địa điểm chưa xác định được tọa độ:</strong>{' '}
          {unmappedDestinations.slice(0, 3).join(', ')}
          {unmappedDestinations.length > 3 ? '…' : ''}
        </div>
      )}
    </>
  );
};

export default TripMap;
