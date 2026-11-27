// Hằng số và hàm dùng chung cho khu kiểm duyệt nội dung (/moderation).
// Mã loại / lý do / hành động khớp với backend (ModerationTargets, ReportService, ModerationAction).

export const TARGET_TYPES = [
  { key: 'POST', label: 'Bài viết' },
  { key: 'POST_COMMENT', label: 'Bình luận' },
  { key: 'PLACE_REVIEW', label: 'Đánh giá địa điểm' },
];

const TYPE_LABELS = Object.fromEntries(TARGET_TYPES.map((t) => [t.key, t.label]));
export const typeLabel = (type) => TYPE_LABELS[type] || type || 'Nội dung';

export const REASON_LABELS = {
  SPAM: 'Spam / quảng cáo',
  HARASSMENT: 'Quấy rối, xúc phạm',
  SENSITIVE: 'Nhạy cảm / bạo lực',
  MISINFORMATION: 'Thông tin sai sự thật',
  OTHER: 'Lý do khác',
};
export const reasonLabel = (code) => REASON_LABELS[code] || REASON_LABELS.OTHER;

export const ACTION_LABELS = {
  HIDE: 'Ẩn nội dung',
  RESTORE: 'Khôi phục',
  DISMISS: 'Bỏ qua báo cáo',
};
export const actionLabel = (action) => ACTION_LABELS[action] || action;

export const REPORT_STATUS_LABELS = {
  PENDING: 'Đang chờ',
  RESOLVED: 'Đã xử lý',
  REJECTED: 'Đã bỏ qua',
};

export const ROLE_LABELS = {
  ROLE_ADMIN: 'Quản trị viên',
  ROLE_MODERATOR: 'Kiểm duyệt viên',
  ROLE_PARTNER: 'Đối tác',
  ROLE_TRAVELLER: 'Người dùng',
};
export const roleLabel = (role) => ROLE_LABELS[role] || 'Người dùng';

export const MAX_REASON_LENGTH = 500; // khớp ModerationService.MAX_REASON_LENGTH
export const PAGE_SIZE = 20;

export const detailPath = (type, id) => `/moderation/content/${encodeURIComponent(type)}/${encodeURIComponent(id)}`;

export const formatDateTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Thời gian tương đối ngắn gọn: "vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước", sau 7 ngày thì hiện ngày giờ.
export const formatRelative = (value, now = Date.now()) => {
  if (!value) return '';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, now - t);
  const minute = 60 * 1000;
  if (diff < minute) return 'vừa xong';
  if (diff < 60 * minute) return `${Math.floor(diff / minute)} phút trước`;
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))} giờ trước`;
  if (diff < 7 * 24 * 60 * minute) return `${Math.floor(diff / (24 * 60 * minute))} ngày trước`;
  return formatDateTime(value);
};

// Backend trả lỗi dạng chuỗi (400/403/404/409); các trường hợp khác dùng thông báo mặc định.
export const getApiMessage = (error, fallback = 'Có lỗi xảy ra. Vui lòng thử lại.') => {
  const status = error?.response?.status;
  const data = error?.response?.data;
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (typeof data === 'string' && data.trim()) return data;
  if (data && typeof data.message === 'string' && data.message) return data.message;
  if (!error?.response) return 'Không kết nối được máy chủ.';
  return fallback;
};

export const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};
