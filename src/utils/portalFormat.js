// Định dạng dùng chung cho các trang Admin/Partner portal.

export const BUSINESS_TYPE_LABELS = {
  HOTEL: 'Khách sạn', HOMESTAY: 'Homestay', RESORT: 'Resort', HOSTEL: 'Hostel', APARTMENT: 'Căn hộ lưu trú',
  RESTAURANT: 'Nhà hàng', EATERY: 'Quán ăn', CAFE: 'Quán cà phê', COFFEE_SHOP: 'Cửa hàng cà phê',
  ATTRACTION: 'Điểm tham quan', TOURIST_SITE: 'Khu du lịch', SPA: 'Spa', SHOP: 'Cửa hàng', OTHER: 'Khác',
};
export const businessTypeLabel = (type) => BUSINESS_TYPE_LABELS[type] || type || 'Chưa phân loại';

const VN_TZ = 'Asia/Ho_Chi_Minh';
const vnHour = (date = new Date()) =>
  Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: VN_TZ }).format(date));

export const greeting = (date = new Date()) => {
  const hour = vnHour(date);
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 13) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
};

/** "12 phút", "3 giờ", "2 ngày" tính từ thời điểm ISO (giờ Việt Nam, không kèm múi giờ) tới nay. */
export const ageFrom = (iso, now = Date.now()) => {
  if (!iso) return '';
  const time = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}+07:00`).getTime();
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.round((now - time) / 60000));
  if (minutes < 60) return `${Math.max(1, minutes)} phút`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ`;
  return `${Math.round(hours / 24)} ngày`;
};

/** "27/11" từ "2026-11-27" */
export const shortDate = (isoDate) => {
  const [, m, d] = String(isoDate || '').split('-');
  return d && m ? `${Number(d)}/${Number(m)}` : '';
};

export const formatNumber = (value) => Number(value || 0).toLocaleString('vi-VN');

/** Trạng thái xác minh của địa điểm -> [nhãn, tone của portal-status] */
const BUSINESS_STATUS = {
  DRAFT: ['Bản nháp', 'neutral'],
  PENDING_REVIEW: ['Đang chờ duyệt', 'warning'],
  PENDING: ['Đang chờ duyệt', 'warning'],
  APPROVED: ['Đã xác minh', 'success'],
  VERIFIED: ['Đã xác minh', 'success'],
  REJECTED: ['Cần cập nhật', 'danger'],
};
export const businessStatus = (status) =>
  BUSINESS_STATUS[String(status || 'DRAFT').toUpperCase()] || [status || 'Chưa xác định', 'neutral'];

/** Trạng thái một lần gửi duyệt -> [nhãn, tone] */
export const submissionStatus = (status) => {
  switch (String(status || '').toUpperCase()) {
    case 'APPROVED': return ['Đã duyệt', 'success'];
    case 'REJECTED': return ['Từ chối', 'danger'];
    case 'CANCELLED': return ['Đã hủy', 'neutral'];
    default: return ['Đang chờ duyệt', 'warning'];
  }
};

/** Lời chào kèm tên nếu tên đủ ngắn (tên tài khoản kiểu "Đại diện Tiệm ..." làm tiêu đề quá dài). */
export const greetingWithName = (name, date = new Date()) => {
  const trimmed = String(name || '').trim();
  return trimmed && trimmed.length <= 18 ? `${greeting(date)}, ${trimmed}` : greeting(date);
};
