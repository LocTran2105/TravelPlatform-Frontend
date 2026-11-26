import { Plane, Bed, Car, Train, Utensils, Wine, Landmark, Ticket, ShoppingBag, Fuel, ShoppingCart, Receipt } from 'lucide-react';

// Hằng số và hàm định dạng dùng chung giữa TripDetail và các component con của nó.

// Mỗi ngày một màu (ngày 1 giữ màu thương hiệu) để phân biệt các ngày khi xem toàn bộ chuyến đi
export const DAY_COLORS = ['#FF5645', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

// '2026-12-01' -> 'Thứ ba, 01/12/2026'
const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
export const formatFullDate = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  if (!m) return d || '';
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${WEEKDAYS[date.getDay()]}, ${m[3]}/${m[2]}/${m[1]}`;
};

export const formatVND = (n) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`;

// Danh mục chi phí (key khớp với backend: ExpenseService.CATEGORIES)
export const EXPENSE_CATEGORIES = [
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
export const CATEGORY_MAP = Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c.key, c]));
