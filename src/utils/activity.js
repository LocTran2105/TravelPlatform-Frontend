// Ghép câu tiếng Việt cho lịch sử thao tác của chuyến đi.
// Backend chỉ trả về mã hành động + nhãn + chi tiết; mọi câu chữ nằm ở đây.

export const ROLE_NAME = { OWNER: 'chủ chuyến đi', EDITOR: 'người chỉnh sửa', VIEWER: 'người chỉ xem', MEMBER: 'người chỉnh sửa' };

const roleName = (role) => ROLE_NAME[role] || 'thành viên';

/** "150000" -> "150.000₫"; chuỗi không phải số (dữ liệu cũ) giữ nguyên. */
export const formatMoney = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return text;
  return `${Number(text).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}₫`;
};

// Backend lưu nhãn ngày dạng "Day 2": hiển thị tiếng Việt
const viDay = (text) => (text ? String(text).replace(/\bDay (\d+)\b/g, 'Ngày $1') : text);

const quote = (label) => (label ? `“${label}”` : 'một địa điểm');

/**
 * Trả về phần câu SAU tên người thực hiện, ví dụ "đã đổi giờ ghé thăm “Hồ Xuân Hương” thành 09:00 - 11:00".
 * Hành động lạ (backend thêm loại mới) vẫn trả về một câu chung chung thay vì để trống.
 */
export const describeActivity = (item) => {
  const { action, label, detail, actorId, targetId } = item;
  switch (action) {
    case 'DAY_ADDED':
      return `đã thêm ${viDay(label) || 'một ngày'}${detail ? ` (${detail})` : ''} vào lịch trình`;
    case 'DESTINATION_ADDED':
      return `đã thêm địa điểm ${quote(label)}${detail ? ` vào ${viDay(detail)}` : ''}`;
    case 'DESTINATION_TIME_CHANGED':
      return detail
        ? `đã đổi giờ ghé thăm ${quote(label)} thành ${detail}`
        : `đã xóa giờ ghé thăm của ${quote(label)}`;
    case 'DESTINATION_NOTE_CHANGED':
      return `đã cập nhật ghi chú của ${quote(label)}`;
    case 'DESTINATION_COST_CHANGED':
      return detail
        ? `đã đổi chi phí của ${quote(label)} thành ${formatMoney(detail)}`
        : `đã xóa chi phí của ${quote(label)}`;
    case 'DESTINATION_VISITED':
      return `đã đánh dấu ${quote(label)} là đã ghé thăm`;
    case 'DESTINATION_UNVISITED':
      return `đã bỏ đánh dấu đã ghé thăm ${quote(label)}`;
    case 'DESTINATION_MOVED':
      return `đã chuyển ${quote(label)}${detail ? ` sang ${viDay(detail)}` : ' sang ngày khác'}`;
    case 'ITINERARY_REORDERED':
      return detail && /^Day\s/i.test(detail)
        ? `đã sắp xếp lại thứ tự ${viDay(detail)}`
        : `đã sắp xếp lại lịch trình${detail ? ` (${detail})` : ''}`;
    case 'DESTINATION_REMOVED':
      return `đã xóa địa điểm ${quote(label)}${detail ? ` khỏi ${viDay(detail)}` : ''}`;
    case 'EXPENSE_ADDED':
      return `đã thêm khoản chi ${quote(label)}${detail ? ` (${formatMoney(detail)})` : ''}`;
    case 'EXPENSE_DELETED':
      return `đã xóa khoản chi ${quote(label)}${detail ? ` (${formatMoney(detail)})` : ''}`;
    case 'BUDGET_CHANGED':
      return `đã đặt ngân sách chuyến đi là ${formatMoney(detail) || 'trống'}`;
    case 'MEMBER_INVITED':
      return `đã mời ${label || 'một người'} làm ${roleName(detail)}`;
    case 'MEMBER_JOINED':
      return `đã tham gia chuyến đi (${roleName(detail)})`;
    case 'MEMBER_ROLE_CHANGED':
      return actorId != null && actorId === targetId
        ? `đã nâng quyền của mình lên ${roleName(detail)}`
        : `đã đổi quyền của ${label || 'một thành viên'} thành ${roleName(detail)}`;
    case 'MEMBER_REMOVED':
      return `đã xóa ${label || 'một thành viên'} khỏi chuyến đi`;
    case 'TRIP_COPIED':
      return `đã tạo chuyến đi bằng cách sao chép lịch trình ${label ? `“${label}”` : 'của người khác'}${detail ? ` của @${detail}` : ''}`;
    default:
      return 'đã thay đổi chuyến đi';
  }
};

export const actorLabel = (item, myId) => {
  if (item.actorId != null && myId != null && String(item.actorId) === String(myId)) return 'Bạn';
  return item.actorName || item.actorUsername || 'Một thành viên';
};

/** "vừa xong", "5 phút trước", "2 giờ trước", "3 ngày trước", sau đó là ngày giờ đầy đủ. */
export const timeAgo = (iso, nowMs) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, nowMs - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'vừa xong';
  if (min < 60) return `${min} phút trước`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} giờ trước`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day} ngày trước`;
  return new Date(t).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const fullTime = (iso) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? '' : new Date(t).toLocaleString('vi-VN');
};

/** Nhóm theo ngày ("Hôm nay", "Hôm qua", dd/mm/yyyy) để danh sách dễ quét. */
export const dayKey = (iso, nowMs) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const d = new Date(t);
  const today = new Date(nowMs);
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86400000);
  if (diffDays === 0) return 'Hôm nay';
  if (diffDays === 1) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};