// Giữ cùng danh sách từ chung với PlaceNameMatcher.java ở backend.
const GENERIC_WORDS = /\b(tiem|quan an|quan|ca phe|caphe|cafe|coffee|coffe|nha hang|restaurant|khach san|hotel|homestay|resort|the|da lat|dalat)\b/g;

/** Bỏ dấu, chữ thường, bỏ từ chung: "Cafe Tùng" và "Tùng Coffee" đều thành "tung". */
export const normalizePlaceName = (name) => String(name || '')
  .normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase()
  .replace(/[^a-z0-9 ]+/g, ' ').replace(GENERIC_WORDS, ' ').replace(/\s+/g, ' ').trim();

/** Tên chuẩn hóa trùng, hoặc tên này chứa tên kia và phần ngắn dài ít nhất một nửa phần dài. */
export const namesSimilar = (a, b) => {
  const x = normalizePlaceName(a);
  const y = normalizePlaceName(b);
  if (x.length < 3 || y.length < 3) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return long.includes(short) && short.length * 2 >= long.length;
};

export const distanceMeters = (lat1, lon1, lat2, lon2) => {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};

/** "N"/"W"/"R" + id của Photon -> "node/123" như providerPlaceId của Place OSM trong DB. */
export const photonOsmRef = (osmType, osmId) => {
  const type = { N: 'node', W: 'way', R: 'relation' }[String(osmType || '').toUpperCase()];
  return type && osmId != null ? `${type}/${osmId}` : null;
};

/**
 * Gộp gợi ý: DB trước (đã xác minh / đã lưu), rồi Photon. Bỏ kết quả Photon trùng với một Place trong DB:
 * cùng mã OSM, hoặc tên gần giống và cách dưới 150 m, hoặc tên chuẩn hóa giống hệt và cách dưới 5 km.
 */
export const mergeSuggestions = (fromDb, fromPhoton, max = 8) => {
  const dbRefs = new Set(fromDb.map(p => p.osmRef).filter(Boolean));
  const near = (a, b, meters) => [a.lat, a.lon, b.lat, b.lon].every(Number.isFinite)
    && distanceMeters(a.lat, a.lon, b.lat, b.lon) <= meters;
  const isDuplicate = (ph) => (ph.osmRef && dbRefs.has(ph.osmRef))
    || fromDb.some(db => (namesSimilar(db.name, ph.name) && near(db, ph, 150))
      || (normalizePlaceName(db.name) === normalizePlaceName(ph.name) && near(db, ph, 5000)));
  return [...fromDb, ...fromPhoton.filter(p => !isDuplicate(p))].slice(0, max);
};

/** placeId (bảng places) của một điểm đến trong lịch trình; null nếu điểm đến không gắn Place. */
export const getDestPlaceId = (dest) => {
  const n = Number(dest?.placeId ?? dest?.place?.id ?? null);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};
