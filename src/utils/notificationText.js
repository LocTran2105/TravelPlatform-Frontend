/**
 * Hiển thị thông báo: nội dung, kiểu biểu tượng, thời gian, đường dẫn an toàn.
 * Thuần hàm - không phụ thuộc React để dễ kiểm thử.
 */

const TARGET_LABELS = {
  POST: 'Bài viết',
  POST_COMMENT: 'Bình luận',
  PLACE_REVIEW: 'Đánh giá địa điểm',
};

export const targetLabel = (targetType) => TARGET_LABELS[targetType] || 'Nội dung';

/** Tên hiển thị của người thực hiện (người dùng đã bị xóa -> "Một người dùng"). */
export const actorName = (item) =>
  item?.actor?.fullName?.trim() || item?.actor?.username || 'Một người dùng';

/**
 * Trả về { icon, tone, name, text, detail }:
 *   icon   khóa biểu tượng: follow | like | comment | reply | hidden | restored | report
 *   tone   màu nhấn: emerald | rose | amber | sky | slate
 *   name   phần in đậm đứng đầu (tên người thực hiện), có thể rỗng
 *   text   phần còn lại của câu
 *   detail dòng phụ (lý do kiểm duyệt), có thể rỗng
 */
export function describeNotification(item) {
  const name = actorName(item);
  const others = Math.max(0, (Number(item?.actorCount) || 1) - 1);
  const label = targetLabel(item?.targetType);
  const reason = (item?.message || '').trim();

  switch (item?.type) {
    case 'FOLLOW':
      return { icon: 'follow', tone: 'emerald', name, text: ' đã bắt đầu theo dõi bạn', detail: '' };
    case 'POST_LIKE':
      return {
        icon: 'like', tone: 'rose', name,
        text: others > 0
          ? ` và ${others} người khác đã thích bài viết của bạn`
          : ' đã thích bài viết của bạn',
        detail: '',
      };
    case 'POST_COMMENT':
      return { icon: 'comment', tone: 'sky', name, text: ' đã bình luận về bài viết của bạn', detail: '' };
    case 'COMMENT_REPLY':
      return { icon: 'reply', tone: 'sky', name, text: ' đã trả lời bình luận của bạn', detail: '' };
    case 'TRIP_COPIED': {
      // targetType POST: sao chép từ lịch trình trong bài viết; TRIP: sao chép trực tiếp chuyến đi
      const what = item?.targetType === 'POST' ? 'lịch trình trong bài viết của bạn' : 'lịch trình của bạn';
      return {
        icon: 'copy', tone: 'emerald', name,
        text: others > 0
          ? ` và ${others} người khác đã sao chép ${what}`
          : ` đã sao chép ${what}`,
        detail: reason ? `“${reason}”` : '',
      };
    }
    case 'CONTENT_HIDDEN':
      return {
        icon: 'hidden', tone: 'amber', name: '',
        text: `${label} của bạn đã bị ẩn do vi phạm quy định cộng đồng.`,
        detail: reason ? `Lý do: ${reason}` : '',
      };
    case 'CONTENT_RESTORED':
      return {
        icon: 'restored', tone: 'emerald', name: '',
        text: `${label} của bạn đã được khôi phục.`,
        detail: reason ? `Ghi chú: ${reason}` : '',
      };
    case 'REPORT_REVIEWED':
      return {
        icon: 'report', tone: 'slate', name: '',
        text: 'Báo cáo của bạn đã được đội ngũ kiểm duyệt xem xét. Cảm ơn bạn đã giúp cộng đồng an toàn hơn.',
        detail: '',
      };
    default:
      return { icon: 'comment', tone: 'slate', name: '', text: 'Bạn có thông báo mới.', detail: '' };
  }
}

/** Chỉ cho phép đường dẫn nội bộ ("/..." nhưng không phải "//..."), tránh chuyển hướng ra ngoài. */
export function safeInternalLink(link) {
  if (typeof link !== 'string') return null;
  const value = link.trim();
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  return value;
}

/** "vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước", sau 7 ngày: dd/MM/yyyy. */
export function timeAgo(value, now = Date.now()) {
  if (!value) return '';
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '';
  const seconds = Math.max(0, Math.floor((now - time) / 1000));
  if (seconds < 60) return 'vừa xong';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(time).toLocaleDateString('vi-VN');
}

/** Hiển thị số trên huy hiệu chuông. */
export const badgeText = (count) => (count > 99 ? '99+' : String(count));
