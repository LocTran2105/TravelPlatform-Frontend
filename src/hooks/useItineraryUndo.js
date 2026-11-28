import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { toast } from '../utils/toast';

/**
 * Hoàn tác (Ctrl+Z) và đặt lại các thao tác trên lịch trình trong phiên làm việc.
 *
 * Mỗi thao tác lưu một bản ghi đủ để làm ngược lại:
 *   order  : thứ tự mọi ngày TRƯỚC khi kéo thả/chuyển ngày/tối ưu (+ các giờ tối ưu vừa điền)
 *   time   : giờ ghé cũ/mới của một điểm
 *   add    : id điểm vừa thêm (hoàn tác = xóa)
 *   delete : dữ liệu điểm vừa xóa + thứ tự ngày đó (hoàn tác = thêm lại đúng vị trí)
 * Lưu ở sessionStorage: tải lại trang vẫn hoàn tác được, đóng tab thì hết.
 * Trước mỗi bước hoàn tác đều tải lại chuyến đi từ server, nên thay đổi của thành viên khác không bị ghi đè mù quáng.
 */

const STORAGE_KEY = 'trip-itinerary-undo';
const MAX_ENTRIES = 40;

const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
const apiError = (e, fallback) => (typeof e?.response?.data === 'string' && e.response.data ? e.response.data : e?.message || fallback);

const readStack = () => {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
};

/** Thứ tự hiện tại của mọi ngày. */
export const orderSnapshot = (trip) => (trip?.tripDays || []).map((d) => ({
  dayId: d.id,
  destinationIds: (d.destinations || []).map((x) => x.id),
}));

// Sau khi thêm lại một điểm đã xóa, id mới thay cho id cũ trong các bản ghi còn lại.
const remapEntry = (entry, remap) => {
  if (!remap || Object.keys(remap).length === 0) return entry;
  const map = (id) => (remap[String(id)] ?? id);
  return {
    ...entry,
    destId: entry.destId != null ? map(entry.destId) : entry.destId,
    days: entry.days?.map((d) => ({ ...d, destinationIds: d.destinationIds.map(map) })),
    orderIds: entry.orderIds?.map(map),
    filledTimes: entry.filledTimes
      ? Object.fromEntries(Object.entries(entry.filledTimes).map(([id, t]) => [String(map(id)), t]))
      : entry.filledTimes,
  };
};

const patchDest = (id, field, value) =>
  axios.patch(`${API_BASE_URL}/api/trips/days/destinations/${id}`, { field, value }, authConfig());

/** Làm ngược một bản ghi trên dữ liệu chuyến đi mới nhất. Trả về {idCũ: idMới} nếu có điểm được tạo lại. */
async function revert(entry, trip) {
  const days = trip?.tripDays || [];
  const destById = new Map(days.flatMap((d) => (d.destinations || []).map((x) => [String(x.id), x])));
  const dayIds = new Set(days.map((d) => String(d.id)));

  switch (entry.kind) {
    case 'order': {
      // Bỏ ngày/điểm đã bị xóa; điểm mới thêm sau đó được backend giữ ở cuối ngày.
      const order = (entry.days || [])
        .filter((d) => dayIds.has(String(d.dayId)))
        .map((d) => ({ dayId: d.dayId, destinationIds: d.destinationIds.filter((id) => destById.has(String(id))) }));
      if (order.length > 0) await axios.put(`${API_BASE_URL}/api/trips/days/order`, { days: order }, authConfig());
      // Chỉ xóa giờ do tối ưu điền vào mà người dùng chưa sửa lại.
      const clears = Object.entries(entry.filledTimes || {})
        .filter(([id, time]) => (destById.get(String(id))?.timeRange || '') === time);
      await Promise.all(clears.map(([id]) => patchDest(id, 'time', '')));
      return {};
    }
    case 'time': {
      const current = destById.get(String(entry.destId));
      // Điểm đã bị xóa, hoặc giờ đã được sửa tiếp sau đó: không ghi đè.
      if (!current || (current.timeRange || '') !== (entry.next || '')) return {};
      await patchDest(entry.destId, 'time', entry.prev || '');
      return {};
    }
    case 'add': {
      if (!destById.has(String(entry.destId))) return {};
      await axios.delete(`${API_BASE_URL}/api/trips/days/destinations/${entry.destId}`, authConfig());
      return {};
    }
    case 'delete': {
      if (!dayIds.has(String(entry.dayId))) throw new Error('Ngày chứa địa điểm này đã bị xóa.');
      const d = entry.dest || {};
      const res = await axios.post(`${API_BASE_URL}/api/trips/days/${entry.dayId}/destinations`, {
        placeId: d.placeId ?? null,
        placeName: d.placeName,
        latitude: d.latitude ?? null,
        longitude: d.longitude ?? null,
        note: d.note ?? null,
        estimatedCost: d.estimatedCost ?? null,
        itemType: d.itemType ?? null,
      }, authConfig());
      const newId = res.data?.id;
      if (newId == null) return {};
      if (d.timeRange) await patchDest(newId, 'time', d.timeRange);
      if (d.isVisited) await patchDest(newId, 'isVisited', true);
      // Đưa về đúng vị trí cũ trong ngày.
      const ids = (entry.orderIds || [])
        .map((id) => (String(id) === String(d.id) ? newId : id))
        .filter((id) => id === newId || destById.has(String(id)));
      if (ids.length > 1) {
        await axios.put(`${API_BASE_URL}/api/trips/days/order`, { days: [{ dayId: entry.dayId, destinationIds: ids }] }, authConfig());
      }
      return { [String(d.id)]: newId };
    }
    default:
      return {};
  }
}

export default function useItineraryUndo({ tripId, canEdit, onReload }) {
  const [stack, setStack] = useState(readStack);
  const [busy, setBusy] = useState(false);
  const stackRef = useRef(stack);
  const actionsRef = useRef(null);

  useEffect(() => {
    stackRef.current = stack;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack)); } catch { /* bộ nhớ đầy: bỏ qua */ }
  }, [stack]);

  const mine = stack.filter((e) => String(e.tripId) === String(tripId));

  /** Ghi một thao tác vừa làm (gọi TRƯỚC khi đổi dữ liệu với 'order', SAU khi server xác nhận với add/delete). */
  const push = useCallback((entry) => {
    setStack((prev) => [...prev, {
      ...entry,
      tripId: String(tripId),
      at: Date.now(),
      uid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    }].slice(-MAX_ENTRIES));
  }, [tripId]);

  const run = useCallback(async (all) => {
    const entries = stackRef.current.filter((e) => String(e.tripId) === String(tripId));
    if (!canEdit || entries.length === 0) return;
    const targets = all ? [...entries].reverse() : [entries[entries.length - 1]];
    setBusy(true);
    let done = 0;
    let remap = {};
    try {
      for (const original of targets) {
        const entry = remapEntry(original, remap);
        const { data: trip } = await axios.get(`${API_BASE_URL}/api/trips/${tripId}`, authConfig());
        const changed = await revert(entry, trip);
        remap = { ...remap, ...changed };
        done += 1;
        setStack((prev) => prev.filter((e) => e.uid !== original.uid).map((e) => remapEntry(e, changed)));
      }
      toast.success(all ? `Đã đặt lại lịch trình (${done} thao tác).` : `Đã hoàn tác: ${targets[0].label}.`);
    } catch (e) {
      toast.error(`${done > 0 ? `Đã hoàn tác ${done} thao tác. ` : ''}Không hoàn tác tiếp được: ${apiError(e, 'lỗi máy chủ')}`);
    } finally {
      setBusy(false);
      onReload?.();
    }
  }, [canEdit, tripId, onReload]);

  // Ctrl+Z / Cmd+Z: hoàn tác bước gần nhất, trừ khi đang gõ trong ô nhập.
  useEffect(() => {
    actionsRef.current = { available: canEdit && !busy && mine.length > 0, undo: () => run(false) };
  });
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || String(e.key).toLowerCase() !== 'z') return;
      if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (!actionsRef.current?.available) return;
      e.preventDefault();
      actionsRef.current.undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return {
    count: mine.length,
    last: mine[mine.length - 1] || null,
    busy,
    push,
    undo: () => run(false),
    reset: () => run(true),
  };
}
