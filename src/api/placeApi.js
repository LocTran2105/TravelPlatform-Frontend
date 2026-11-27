import axiosClient from './axiosClient';

/**
 * Hồ sơ Partner đã xác minh của một Place (giờ mở cửa, ghi chú, ảnh, liên hệ).
 * Trả về null khi Place không có Partner công khai (backend trả 204).
 */
export async function getPartnerProfile(placeId, { signal } = {}) {
  const res = await axiosClient.get(`/api/v1/places/${placeId}/partner-profile`, { signal });
  return res.status === 204 || !res.data ? null : res.data;
}

/** { placeId: [{ dayOfWeek, openTime, closeTime, closed, closesNextDay }] } cho các Place có Partner. */
export async function getPartnerHours(placeIds, { signal } = {}) {
  const ids = [...new Set((placeIds || []).filter(id => Number.isSafeInteger(id) && id > 0))].slice(0, 100);
  if (ids.length === 0) return {};
  const res = await axiosClient.get('/api/v1/places/partner-hours', {
    params: { placeIds: ids.join(',') },
    signal,
  });
  return res.data || {};
}
