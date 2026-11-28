import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { mergeSuggestions, photonOsmRef } from './place';

// Tâm Việt Nam: ưu tiên kết quả Photon trong nước khi không có điểm neo nào khác.
export const VIETNAM_CENTER = { lat: 16.0471, lng: 108.2062 };

/**
 * Tìm địa điểm dùng chung cho mọi ô tìm kiếm (thêm điểm vào chuyến đi, gắn địa điểm cho bài đăng...):
 *  1) DB của hệ thống trước (Place của đối tác đã xác minh + POI OSM đã lưu): cùng tên, cùng tọa độ ở mọi trang;
 *  2) Photon/OSM sau, ưu tiên gần điểm neo; bỏ kết quả trùng với Place đã có trong DB.
 * Trả về [{ key, source: 'db'|'photon', placeId?, verified?, osmRef, name, address, lat, lon }].
 */
export async function searchPlaces({ q, destination = '', anchor = null, signal, limit = 5 }) {
  const query = String(q || '').trim();
  if (query.length < 2) return [];
  const token = localStorage.getItem('token');

  const dbRequest = axios.get(`${API_BASE_URL}/api/v1/places/search`, {
    params: { q: query, destination, limit },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  }).then((res) => (Array.isArray(res.data) ? res.data : []).map((p) => ({
    key: `db-${p.id}`,
    source: 'db',
    placeId: p.id,
    verified: Boolean(p.verified),
    osmRef: p.provider === 'OSM' ? p.providerPlaceId : null,
    name: p.name,
    address: p.address || p.destination || '',
    lat: Number(p.latitude),
    lon: Number(p.longitude),
  })));

  const photonParams = new URLSearchParams({ q: query, limit: String(limit) });
  const center = anchor || VIETNAM_CENTER;
  photonParams.set('lat', String(center.lat));
  photonParams.set('lon', String(center.lng));
  const photonRequest = fetch(`https://photon.komoot.io/api/?${photonParams.toString()}`, { signal })
    .then((res) => (res.ok ? res.json() : { features: [] }))
    .then((data) => (data.features || []).map((f) => {
      const p = f.properties || {};
      return {
        key: `osm-${p.osm_type || ''}${p.osm_id}`,
        source: 'photon',
        osmRef: photonOsmRef(p.osm_type, p.osm_id),
        name: p.name || p.street || p.city,
        address: [p.street && p.name ? p.street : null, p.city, p.country].filter(Boolean).join(', '),
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
      };
    }).filter((p) => p.name));

  const [dbResult, photonResult] = await Promise.allSettled([dbRequest, photonRequest]);
  if (signal?.aborted) return [];
  const fromDb = dbResult.status === 'fulfilled' ? dbResult.value : [];
  const fromPhoton = photonResult.status === 'fulfilled' ? photonResult.value : [];
  return mergeSuggestions(fromDb, fromPhoton);
}
