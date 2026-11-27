// Giờ mở cửa của Partner: dayOfWeek 1 = Thứ 2 ... 7 = Chủ nhật, giờ dạng "HH:mm".

export const DAY_LABELS = {
  1: 'Thứ 2', 2: 'Thứ 3', 3: 'Thứ 4', 4: 'Thứ 5', 5: 'Thứ 6', 6: 'Thứ 7', 7: 'Chủ nhật',
};

const toMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Date (hoặc chuỗi yyyy-mm-dd) -> 1..7 theo quy ước Thứ 2 = 1. */
export const isoWeekday = (date) => {
  const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T00:00:00`) : date;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return d.getDay() === 0 ? 7 : d.getDay();
};

export const slotsForDay = (hours, dayOfWeek) => (hours || []).filter(h => h.dayOfWeek === dayOfWeek);

/** "07:30 – 21:30", "Đóng cửa" hoặc null nếu Partner chưa khai báo ngày đó. */
export const formatDayHours = (hours, dayOfWeek) => {
  const slots = slotsForDay(hours, dayOfWeek);
  if (slots.length === 0) return null;
  const open = slots.filter(s => !s.closed && s.openTime && s.closeTime);
  if (open.length === 0) return 'Đóng cửa';
  return open.map(s => `${s.openTime} – ${s.closeTime}${s.closesNextDay ? ' (hôm sau)' : ''}`).join(', ');
};

/** true khi Partner có khai báo ngày đó và cả ngày đều đóng cửa. */
export const isClosedAllDay = (hours, dayOfWeek) => {
  const slots = slotsForDay(hours, dayOfWeek);
  return slots.length > 0 && slots.every(s => s.closed || !s.openTime || !s.closeTime);
};

/**
 * Cảnh báo cho một điểm trong lịch trình: ngoài giờ mở cửa (khi đã đặt giờ) hoặc quán nghỉ cả ngày.
 * null khi không có gì cần cảnh báo hoặc không đủ dữ liệu.
 */
export const visitWarning = (hours, dayDate, timeRange) => {
  const weekday = isoWeekday(dayDate);
  if (!hours || !weekday) return null;
  const [start = '', end = ''] = String(timeRange || '').split(' - ').map(s => s.trim());
  const check = start ? checkVisitTime(hours, weekday, start, end) : null;
  if (check && !check.ok) return check.reason;
  if (!start && isClosedAllDay(hours, weekday)) return `Quán đóng cửa vào ${DAY_LABELS[weekday]}.`;
  return null;
};

/**
 * Kiểm tra khung giờ [start, end] (HH:mm) của một ngày có nằm trong giờ mở cửa không.
 * Trả về null khi không đủ dữ liệu để kết luận (không có giờ mở cửa hoặc không có giờ đến).
 * Ngược lại trả về { ok, reason } với reason là câu cảnh báo tiếng Việt.
 */
export const checkVisitTime = (hours, dayOfWeek, start, end) => {
  const startMin = toMinutes(start);
  if (startMin == null || !dayOfWeek) return null;
  const slots = slotsForDay(hours, dayOfWeek);
  if (slots.length === 0) return null;
  const endMin = toMinutes(end);
  const open = slots.filter(s => !s.closed && s.openTime && s.closeTime);
  const label = DAY_LABELS[dayOfWeek];
  if (open.length === 0) return { ok: false, reason: `Quán đóng cửa vào ${label}.` };

  const fits = open.some((s) => {
    const o = toMinutes(s.openTime);
    const c = s.closesNextDay ? 24 * 60 : toMinutes(s.closeTime);
    if (startMin < o || startMin >= c) return false;
    return endMin == null || endMin <= c;
  });
  if (fits) return { ok: true, reason: null };
  return { ok: false, reason: `Ngoài giờ mở cửa (${label}: ${formatDayHours(hours, dayOfWeek)}).` };
};

export const PRICE_LEVEL_LABELS = { 1: 'Bình dân', 2: 'Trung bình', 3: 'Khá cao', 4: 'Cao cấp' };

const OPERATING_LABELS = { TEMPORARILY_CLOSED: 'Tạm ngưng hoạt động', CLOSED_PERMANENTLY: 'Đã ngừng hoạt động' };

/** Nhãn trạng thái mở cửa của hồ sơ Partner; null khi chưa đủ dữ liệu. */
export const openStatusOf = (profile) => {
  if (!profile) return null;
  if (OPERATING_LABELS[profile.operatingStatus]) return { open: false, label: OPERATING_LABELS[profile.operatingStatus] };
  if (profile.openNow === true) return { open: true, label: 'Đang mở cửa' };
  if (profile.openNow === false) return { open: false, label: 'Đang đóng cửa' };
  return null;
};
