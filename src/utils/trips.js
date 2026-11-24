import { Globe, Users, UserCheck, Lock } from 'lucide-react';

// Các mức quyền hiển thị của chuyến đi (khớp với backend: PUBLIC / FOLLOWERS / FRIENDS / PRIVATE)
export const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Công khai', desc: 'Mọi người đều có thể xem', Icon: Globe },
  { value: 'FOLLOWERS', label: 'Người theo dõi', desc: 'Những người đang theo dõi bạn', Icon: Users },
  { value: 'FRIENDS', label: 'Bạn bè', desc: 'Những người bạn theo dõi lẫn nhau', Icon: UserCheck },
  { value: 'PRIVATE', label: 'Riêng tư', desc: 'Chỉ bạn và bạn đồng hành', Icon: Lock },
];

/** Thông tin hiển thị của một quyền. Giá trị lạ hoặc trống được coi là Riêng tư (mặc định của hệ thống). */
export function visibilityInfo(value) {
  return VISIBILITY_OPTIONS.find((o) => o.value === value) || VISIBILITY_OPTIONS[3];
}

const parseDate = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return m ? { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) } : null;
};
const two = (n) => String(n).padStart(2, '0');
const fmt = (p, withYear) => `${two(p.d)}/${two(p.mo)}${withYear ? `/${p.y}` : ''}`;

/** '2026-12-01','2026-12-03' -> '01/12 - 03/12/2026' (không lệch múi giờ vì không đi qua Date). */
export function formatDateRange(start, end) {
  const s = parseDate(start);
  if (!s) return 'Chưa chọn ngày';
  const e = parseDate(end);
  if (!e) return fmt(s, true);
  return `${fmt(s, s.y !== e.y)} - ${fmt(e, true)}`;
}

/** Số địa điểm của chuyến đi: ưu tiên placeCount (API tóm tắt), nếu không thì cộng từ các ngày. */
export function countPlaces(trip) {
  if (typeof trip?.placeCount === 'number') return trip.placeCount;
  if (!Array.isArray(trip?.tripDays)) return 0;
  return trip.tripDays.reduce((total, day) => total + (day?.destinations?.length || 0), 0);
}
