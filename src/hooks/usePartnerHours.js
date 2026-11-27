import { useEffect, useRef, useState } from 'react';
import { getPartnerHours } from '../api/placeApi';
import { getDestPlaceId } from '../utils/place';

/**
 * Giờ mở cửa của các địa điểm có Partner đã xác minh trong chuyến đi: { "placeId": [slot, ...] }.
 * Mỗi placeId chỉ được hỏi một lần (giống usePlaceCovers); địa điểm không có Partner không có trong kết quả.
 */
export default function usePartnerHours(trip) {
  const [hours, setHours] = useState({});
  const requestedRef = useRef(new Set());
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const idsKey = [...new Set((trip?.tripDays || [])
    .flatMap(day => (day.destinations || []).map(getDestPlaceId))
    .filter(id => id != null))].join(',');

  useEffect(() => {
    if (!idsKey || !localStorage.getItem('token')) return;
    const pending = idsKey.split(',').filter(id => !requestedRef.current.has(id));
    if (pending.length === 0) return;
    pending.forEach(id => requestedRef.current.add(id));
    getPartnerHours(pending.map(Number))
      .then(data => { if (aliveRef.current) setHours(prev => ({ ...prev, ...data })); })
      .catch(() => pending.forEach(id => requestedRef.current.delete(id))); // thử lại ở lần đổi lịch trình sau
  }, [idsKey]);

  return hours;
}
