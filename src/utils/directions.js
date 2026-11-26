// Chỉ đường bằng Google Maps URLs (không cần API key):
// https://developers.google.com/maps/documentation/urls/get-started
export const CURRENT_LOCATION = 'current';

// Google Maps URLs: tối đa 9 điểm dừng (trình duyệt trên điện thoại chỉ nhận 3).
export const MAX_WAYPOINTS = 9;
export const MAX_WAYPOINTS_MOBILE = 3;


export const isMobileBrowser = () => typeof window !== 'undefined'
  && window.matchMedia?.('(pointer: coarse)')?.matches;

const coordText = (stop) => `${Number(stop.lat).toFixed(6)},${Number(stop.lng).toFixed(6)}`;

export const haversineKm = (a, b) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

/** Tạo đường dẫn Google Maps chỉ đường. Bỏ trống origin = Google dùng vị trí hiện tại của thiết bị. */
export const buildGoogleMapsUrl = ({ origin, destination, waypoints = [], mode }) => {
  const params = new URLSearchParams({ api: '1' });
  if (origin) params.set('origin', coordText(origin));
  else params.set('dir_action', 'navigate'); // đi từ vị trí hiện tại: vào thẳng chế độ dẫn đường
  params.set('destination', coordText(destination));
  if (waypoints.length > 0) params.set('waypoints', waypoints.map(coordText).join('|'));
  if (mode) params.set('travelmode', mode);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

/** Lộ trình gợi sẵn cho một ngày: điểm đầu -> điểm cuối, các điểm giữa làm điểm dừng theo thứ tự. */
export const presetForDay = (stopsOfDay) => {
  if (!stopsOfDay || stopsOfDay.length === 0) return null;
  if (stopsOfDay.length === 1) {
    return { originId: CURRENT_LOCATION, destinationId: stopsOfDay[0].id, waypointIds: [] };
  }
  return {
    originId: stopsOfDay[0].id,
    destinationId: stopsOfDay[stopsOfDay.length - 1].id,
    waypointIds: stopsOfDay.slice(1, -1).slice(0, MAX_WAYPOINTS).map((s) => s.id),
  };
};