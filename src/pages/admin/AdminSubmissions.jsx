import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Check, Eye, FileCheck2, Image as ImageIcon, LoaderCircle,
  MapPin, RefreshCw, X, Search, LocateFixed, ExternalLink,
} from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import { getApiError } from '../../api/axiosClient';

const listOf = (data) => Array.isArray(data)
  ? data
  : data?.content || data?.items || data?.data || [];

const statusMeta = (status) => String(status || '').toUpperCase() === 'APPROVED'
  ? ['Đã duyệt', 'success']
  : String(status || '').toUpperCase() === 'REJECTED'
    ? ['Từ chối', 'danger']
    : ['Chờ duyệt', 'warning'];

const formatDate = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('vi-VN');
};

const safeSnapshot = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const valueOrDash = (value) => value === null || value === undefined || value === '' ? '—' : String(value);
const dayName = (day) => ({ 1: 'Thứ 2', 2: 'Thứ 3', 3: 'Thứ 4', 4: 'Thứ 5', 5: 'Thứ 6', 6: 'Thứ 7', 7: 'Chủ nhật' })[Number(day)] || `Ngày ${day}`;
const typeName = (type) => ({
  HOTEL: 'Khách sạn', HOMESTAY: 'Homestay', RESORT: 'Resort', HOSTEL: 'Hostel', APARTMENT: 'Căn hộ lưu trú',
  RESTAURANT: 'Nhà hàng', EATERY: 'Quán ăn', CAFE: 'Quán cà phê', COFFEE_SHOP: 'Cửa hàng cà phê',
  ATTRACTION: 'Điểm tham quan', TOURIST_SITE: 'Khu du lịch', SPA: 'Spa', SHOP: 'Cửa hàng', OTHER: 'Khác',
})[type] || type || '—';

const makePin = (letter, color) => L.divIcon({
  className: 'admin-map-div-icon',
  html: `<div style="width:28px;height:28px;border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};box-shadow:0 2px 8px #0005;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:11px"><span style="transform:rotate(45deg)">${letter}</span></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});
const partnerPin = makePin('P', '#2563eb');
const osmPin = makePin('O', '#7c3aed');

function MapClickPicker({ enabled, onPick }) {
  useMapEvents({
    click(event) {
      if (enabled) onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function AdminDecisionMap({
  center, partnerPosition, candidates,
  placeMode, onSelectOsm, onPickPartner,
}) {
  return (
    <MapContainer center={center} zoom={15} scrollWheelZoom style={{ width: '100%', height: 360, borderRadius: 12, zIndex: 0 }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickPicker enabled={placeMode === 'PARTNER'} onPick={onPickPartner} />
      {partnerPosition && (
        <Marker position={partnerPosition} icon={partnerPin}>
          <Popup>Vị trí Partner gửi / vị trí Admin xác nhận</Popup>
        </Marker>
      )}
      {candidates.map((candidate) => {
        const lat = Number(candidate.latitude);
        const lng = Number(candidate.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return (
          <Marker key={candidate.id} position={[lat, lng]} icon={osmPin}
            eventHandlers={{ click: () => onSelectOsm(candidate.id) }}>
            <Popup>
              <strong>{candidate.name}</strong><br />
              {candidate.address || 'Chưa có địa chỉ'}<br />
              <button type="button" onClick={() => onSelectOsm(candidate.id)} style={{ marginTop: 6, color: '#4f46e5', fontWeight: 700 }}>
                Chọn POI này
              </button>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

function DetailField({ label, value }) {
  return (
    <div style={{ minWidth: 0, padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 10 }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, overflowWrap: 'anywhere' }}>{valueOrDash(value)}</div>
    </div>
  );
}

export default function AdminSubmissions() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [osmCandidates, setOsmCandidates] = useState([]);
  const [osmLoading, setOsmLoading] = useState(false);
  const [osmError, setOsmError] = useState('');
  const [placeMode, setPlaceMode] = useState('');
  const [selectedOsmPlaceId, setSelectedOsmPlaceId] = useState('');
  const [partnerLatitude, setPartnerLatitude] = useState('');
  const [partnerLongitude, setPartnerLongitude] = useState('');

  const selectedSnapshot = useMemo(() => safeSnapshot(selected?.submissionData), [selected]);
  const selectedStatus = String(selected?.status || '').toUpperCase();
  const snapshotMedia = Array.isArray(selectedSnapshot.media) ? selectedSnapshot.media : [];
  const snapshotHours = Array.isArray(selectedSnapshot.hours) ? selectedSnapshot.hours : [];
  const snapshotNotes = Array.isArray(selectedSnapshot.notes) ? selectedSnapshot.notes : [];
  const snapshotIsDetailed = Number(selectedSnapshot.snapshotVersion || 1) >= 2;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setRows(listOf(await adminApi.getBusinessSubmissions(status ? { status } : {})));
    } catch (err) {
      setError(getApiError(err, 'Không tải được hàng chờ xác minh địa điểm.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [status]);

  const loadOsmCandidates = async (submissionId) => {
    setOsmLoading(true);
    setOsmError('');
    setOsmCandidates([]);
    setSelectedOsmPlaceId('');
    try {
      const result = await adminApi.getOsmCandidates(submissionId, { radiusMeters: 2000 });
      setOsmCandidates(listOf(result));
    } catch (err) {
      setOsmError(getApiError(err, 'Không tìm được POI OSM quanh vị trí này. Admin vẫn có thể xác nhận vị trí PARTNER.'));
    } finally {
      setOsmLoading(false);
    }
  };

  const openDetail = (row) => {
    const snapshot = safeSnapshot(row.submissionData);
    setSelected(row);
    setReviewNote(row.reviewNote || '');
    setPartnerLatitude(snapshot.latitude == null ? '' : String(snapshot.latitude));
    setPartnerLongitude(snapshot.longitude == null ? '' : String(snapshot.longitude));
    setPlaceMode('');
    setSelectedOsmPlaceId('');
    setOsmCandidates([]);
    setOsmError('');
    setError('');
    setNotice('');
    if (String(row.status || '').toUpperCase() === 'PENDING') {
      loadOsmCandidates(row.id);
    }
  };

  const review = async (row, action) => {
    const note = reviewNote.trim();
    if (action === 'reject' && !note) {
      setError('Vui lòng nhập lý do từ chối hoặc nội dung cần Partner cập nhật.');
      return;
    }

    let approvalDecision = null;
    if (action === 'approve') {
      if (placeMode !== 'OSM' && placeMode !== 'PARTNER') {
        setError('Admin phải chủ động chọn Liên kết OSM hoặc Tạo Place PARTNER trước khi phê duyệt.');
        return;
      }
      if (placeMode === 'OSM') {
        if (!selectedOsmPlaceId) {
          setError('Hãy chọn một POI OSM trên bản đồ hoặc chuyển sang xác nhận vị trí PARTNER.');
          return;
        }
        approvalDecision = {
          note,
          placeProvider: 'OSM',
          placeId: Number(selectedOsmPlaceId),
          latitude: null,
          longitude: null,
        };
      } else {
        const lat = Number(partnerLatitude);
        const lng = Number(partnerLongitude);
        if (!partnerLatitude || !partnerLongitude || !Number.isFinite(lat) || !Number.isFinite(lng)
            || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          setError('Vị trí PARTNER cần latitude và longitude hợp lệ. Nhấn lên bản đồ để xác nhận vị trí.');
          return;
        }
        approvalDecision = {
          note,
          placeProvider: 'PARTNER',
          placeId: null,
          latitude: lat,
          longitude: lng,
        };
      }
    }

    const title = row.businessName || selectedSnapshot.name || `#${row.businessId || row.id}`;
    const confirmation = placeMode === 'OSM'
      ? `Liên kết với OSM POI đã chọn và phê duyệt địa điểm "${title}"?`
      : `Tạo Place PARTNER tại tọa độ đã xác nhận và phê duyệt địa điểm "${title}"?`;
    if (action === 'approve' && !window.confirm(confirmation)) return;
    if (action === 'reject' && !window.confirm(`Từ chối hồ sơ "${title}" và gửi phản hồi cho Partner?`)) return;

    setBusyId(row.id);
    setError('');
    setNotice('');
    try {
      if (action === 'approve') {
        await adminApi.approveBusinessSubmission(row.id, approvalDecision);
      } else {
        await adminApi.rejectBusinessSubmission(row.id, note);
      }
      setNotice(action === 'approve'
        ? (approvalDecision.placeProvider === 'OSM'
          ? 'Đã xác nhận liên kết OSM, duyệt Business và duyệt ảnh trong hồ sơ.'
          : 'Đã tạo Place PARTNER tại vị trí Admin xác nhận, duyệt Business và duyệt ảnh trong hồ sơ.')
        : 'Đã từ chối và gửi phản hồi cho Partner.');
      setSelected(null);
      await load();
    } catch (err) {
      setError(getApiError(err, 'Không xử lý được yêu cầu xác minh.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="portal-page">
      <div className="portal-page-heading">
        <div>
          <div className="portal-eyebrow">PLACE VERIFICATION</div>
          <h1>Duyệt thông tin địa điểm</h1>
          <p>Kiểm tra hồ sơ Partner gửi lên, đối chiếu thông tin thực tế trước khi đưa vào nguồn dữ liệu công khai.</p>
        </div>
        <button className="portal-secondary-button" onClick={load} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'portal-spin' : ''} /> Làm mới
        </button>
      </div>

      {error && <div className="portal-alert error">{error}</div>}
      {notice && <div className="portal-alert success"><Check size={16} />{notice}</div>}

      <div className="portal-review-guidance">
        <strong>Checklist xác minh:</strong>
        <span>Tên và loại địa điểm</span>
        <span>Địa chỉ và tọa độ</span>
        <span>Ảnh thực tế</span>
        <span>Giờ hoạt động / lưu ý</span>
        <span>Giá và thời gian áp dụng (nếu có)</span>
      </div>

      <div className="portal-filter-row">
        <label>Trạng thái</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Đã duyệt</option>
          <option value="REJECTED">Đã từ chối</option>
          <option value="">Tất cả</option>
        </select>
        <span>{rows.length} yêu cầu</span>
      </div>

      <section className="portal-panel portal-table-panel">
        {loading ? (
          <div className="portal-empty"><LoaderCircle className="portal-spin" size={24} />Đang tải yêu cầu...</div>
        ) : rows.length === 0 ? (
          <div className="portal-empty">
            <div className="portal-empty-icon"><FileCheck2 size={26} /></div>
            <strong>Không có yêu cầu xét duyệt</strong>
            <span>Chưa có địa điểm nào cần xử lý theo bộ lọc.</span>
          </div>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>Địa điểm</th><th>Partner</th><th>Loại yêu cầu</th><th>Ngày gửi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>
                {rows.map((row) => {
                  const [label, tone] = statusMeta(row.status);
                  const snapshot = safeSnapshot(row.submissionData);
                  const businessName = row.businessName || snapshot.name || `Địa điểm #${row.businessId || row.id}`;
                  return (
                    <tr key={row.id}>
                      <td><strong>{businessName}</strong><small>Submission #{row.id}</small></td>
                      <td>{row.partnerName || row.partner?.displayName || row.submittedByName || row.submittedByEmail || '—'}</td>
                      <td>{row.submissionType || row.targetType || row.actionType || 'BUSINESS_PROFILE'}</td>
                      <td>{formatDate(row.submittedAt || row.createdAt)}</td>
                      <td><span className={`portal-status ${tone}`}>{label}</span></td>
                      <td>
                        <div className="portal-row-actions">
                          <button className="portal-small-button" onClick={() => openDetail(row)} title="Xem hồ sơ"><Eye size={15} /></button>
                          {String(row.status || '').toUpperCase() === 'PENDING' && (
                            <>
                              <button className="portal-small-button accent" disabled={busyId === row.id} onClick={() => { openDetail(row); setReviewNote(''); }} title="Xem và phê duyệt"><Check size={15} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busyId) setSelected(null); }}>
          <div className="portal-modal" style={{ width: 'min(1050px, 96vw)', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="portal-modal-header">
              <div>
                <div className="portal-eyebrow">SUBMISSION #{selected.id}</div>
                <h2>{selectedSnapshot.name || selected.businessName || `Địa điểm #${selected.businessId}`}</h2>
                <p>Partner gửi lúc {formatDate(selected.submittedAt)} · {selected.submittedByEmail || 'Không có email người gửi'}</p>
              </div>
              <button type="button" className="portal-icon-button" onClick={() => setSelected(null)} disabled={Boolean(busyId)} aria-label="Đóng"><X size={20} /></button>
            </div>

            {!snapshotIsDetailed && (
              <div className="portal-alert warning" style={{ marginBottom: 16 }}>
                Hồ sơ này được gửi trước khi snapshot có ảnh, giờ hoạt động và ghi chú. Admin chỉ có thể xem các trường cơ bản đã được lưu trong lần gửi đó.
              </div>
            )}

            <section style={{ marginBottom: 22 }}>
              <h3>Thông tin địa điểm</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
                <DetailField label="Tên địa điểm" value={selectedSnapshot.name || selected.businessName} />
                <DetailField label="Loại hình" value={typeName(selectedSnapshot.businessType || selected.businessType)} />
                <DetailField label="Mô tả ngắn" value={selectedSnapshot.shortDescription} />
                <DetailField label="Mức giá tham khảo" value={selectedSnapshot.priceLevel ? `${selectedSnapshot.priceLevel}/4` : 'Chưa khai báo'} />
                <DetailField label="Địa chỉ" value={[
                  selectedSnapshot.address, selectedSnapshot.ward, selectedSnapshot.district,
                  selectedSnapshot.city, selectedSnapshot.province,
                ].filter(Boolean).join(', ')} />
                <DetailField label="Tọa độ" value={selectedSnapshot.latitude != null && selectedSnapshot.longitude != null
                  ? `${selectedSnapshot.latitude}, ${selectedSnapshot.longitude}` : 'Chưa khai báo'} />
                <DetailField label="Điện thoại" value={selectedSnapshot.phoneNumber} />
                <DetailField label="Email" value={selectedSnapshot.email} />
                <DetailField label="Website" value={selectedSnapshot.websiteUrl} />
                <DetailField label="Facebook" value={selectedSnapshot.facebookUrl} />
                <DetailField label="Instagram" value={selectedSnapshot.instagramUrl} />
                <DetailField label="Trạng thái vận hành" value={selectedSnapshot.operatingStatus} />
              </div>
              {selectedSnapshot.description && <div style={{ marginTop: 10, padding: 12, background: '#f8fafc', borderRadius: 10 }}><strong>Mô tả chi tiết</strong><p style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{selectedSnapshot.description}</p></div>}
              {selectedSnapshot.latitude != null && selectedSnapshot.longitude != null && (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${encodeURIComponent(selectedSnapshot.latitude)}&mlon=${encodeURIComponent(selectedSnapshot.longitude)}#map=17/${encodeURIComponent(selectedSnapshot.latitude)}/${encodeURIComponent(selectedSnapshot.longitude)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="portal-inline-link"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10 }}
                ><MapPin size={15} /> Kiểm tra tọa độ trên OpenStreetMap</a>
              )}
            </section>

            <section style={{ marginBottom: 22, padding: 16, border: '1px solid #dbe3f0', borderRadius: 14, background: '#fbfcff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ marginBottom: 5 }}>Kiểm tra bản đồ và xác nhận Place</h3>
                  <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>
                    Admin chọn POI OSM đúng với Business; nếu OSM không có địa điểm, xác nhận tọa độ Partner để tạo Place PARTNER.
                  </p>
                </div>
                <button type="button" className="portal-secondary-button" onClick={() => loadOsmCandidates(selected.id)} disabled={osmLoading}>
                  <Search size={15} /> {osmLoading ? 'Đang tìm OSM...' : 'Tìm lại POI OSM'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', margin: '14px 0' }}>
                <button type="button" className={placeMode === 'OSM' ? 'portal-primary-button' : 'portal-secondary-button'}
                  onClick={() => setPlaceMode('OSM')}>
                  <MapPin size={15} /> Liên kết OSM
                </button>
                <button type="button" className={placeMode === 'PARTNER' ? 'portal-primary-button' : 'portal-secondary-button'}
                  onClick={() => { setPlaceMode('PARTNER'); setSelectedOsmPlaceId(''); }}>
                  <LocateFixed size={15} /> Tạo Place PARTNER
                </button>
              </div>

              {osmError && <div className="portal-alert warning" style={{ marginBottom: 12 }}>{osmError}</div>}
              {placeMode === 'OSM' && (
                <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: '#f4f0ff', color: '#5b21b6', fontSize: 13 }}>
                  Chọn đúng địa điểm OSM bên dưới hoặc bấm marker màu tím trên bản đồ. Chỉ POI được Admin chọn mới được liên kết.
                </div>
              )}
              {placeMode === 'PARTNER' && (
                <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: '#eff6ff', color: '#1e40af', fontSize: 13 }}>
                  Tọa độ ban đầu lấy từ Partner/Google Maps. Nhấn trực tiếp lên bản đồ để chỉnh và xác nhận vị trí thực tế; dữ liệu sẽ được lưu với provider = PARTNER, không giả làm OSM.
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, .85fr) minmax(0, 1.4fr)', gap: 14, alignItems: 'start' }}>
                <div style={{ minWidth: 0 }}>
                  {placeMode === 'OSM' ? (
                    <>
                      <strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>POI OSM tìm được ({osmCandidates.length})</strong>
                      {osmLoading ? <div className="portal-empty" style={{ minHeight: 100 }}>Đang truy vấn Overpass...</div>
                        : osmCandidates.length === 0 ? <div className="portal-alert warning">Không tìm thấy POI OSM phù hợp trong bán kính tìm kiếm. Chuyển sang “Tạo Place PARTNER” để dùng vị trí Admin xác nhận.</div>
                          : <div style={{ display: 'grid', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
                            {osmCandidates.map((candidate) => {
                              const active = String(selectedOsmPlaceId) === String(candidate.id);
                              return (
                                <button key={candidate.id} type="button" onClick={() => { setSelectedOsmPlaceId(String(candidate.id)); setPlaceMode('OSM'); }}
                                  style={{ textAlign: 'left', padding: 11, borderRadius: 11, border: active ? '2px solid #6d4bd1' : '1px solid #e2e8f0', background: active ? '#f6f2ff' : '#fff', cursor: 'pointer' }}>
                                  <strong style={{ display: 'block', color: '#1f2937', fontSize: 13 }}>{candidate.name}</strong>
                                  <span style={{ display: 'block', color: '#64748b', fontSize: 11, marginTop: 3 }}>{candidate.address || 'Không có địa chỉ trong OSM'}</span>
                                  <span style={{ display: 'block', color: '#7c3aed', fontSize: 11, marginTop: 5 }}>
                                    {candidate.providerPlaceId} · {candidate.distanceMeters == null ? 'Không rõ khoảng cách' : `${Math.round(candidate.distanceMeters)} m`}
                                  </span>
                                  {active && <span style={{ display: 'block', marginTop: 5, color: '#6d28d9', fontWeight: 800, fontSize: 11 }}>Đang chọn</span>}
                                </button>
                              );
                            })}
                          </div>}
                    </>
                  ) : placeMode === 'PARTNER' ? (
                    <>
                      <strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>Tọa độ Admin xác nhận</strong>
                      <label className="portal-field" style={{ marginBottom: 9 }}>
                        <span>Latitude</span>
                        <input type="number" step="any" min="-90" max="90" value={partnerLatitude}
                          onChange={(event) => setPartnerLatitude(event.target.value)} placeholder="Latitude" />
                      </label>
                      <label className="portal-field" style={{ marginBottom: 9 }}>
                        <span>Longitude</span>
                        <input type="number" step="any" min="-180" max="180" value={partnerLongitude}
                          onChange={(event) => setPartnerLongitude(event.target.value)} placeholder="Longitude" />
                      </label>
                      <p style={{ color: '#64748b', fontSize: 11, lineHeight: 1.5 }}>
                        Nhấn lên bản đồ để đặt lại marker. Tọa độ này sẽ được lưu trên Place PARTNER; tọa độ OSM không bị sửa.
                      </p>
                    </>
                  ) : (
                    <div className="portal-empty" style={{ minHeight: 180, border: '1px dashed #cbd5e1', borderRadius: 12 }}>
                      Chọn một trong hai phương án ở phía trên để xác nhận nguồn Place trước khi duyệt.
                    </div>
                  )}
                </div>

                <div style={{ minWidth: 0 }}>
                  {(() => {
                    const lat = Number(partnerLatitude);
                    const lng = Number(partnerLongitude);
                    const partnerValid = partnerLatitude !== '' && partnerLongitude !== ''
                      && Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
                    const firstCandidate = osmCandidates.find((item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)));
                    const center = partnerValid ? [lat, lng]
                      : firstCandidate ? [Number(firstCandidate.latitude), Number(firstCandidate.longitude)] : null;
                    return center ? (
                      <>
                        <AdminDecisionMap
                          key={`${selected.id}-${center[0]}-${center[1]}`}
                          center={center}
                          partnerPosition={partnerValid ? [lat, lng] : null}
                          candidates={osmCandidates}
                          placeMode={placeMode}
                          onSelectOsm={(id) => { setSelectedOsmPlaceId(String(id)); setPlaceMode('OSM'); }}
                          onPickPartner={(pickedLat, pickedLng) => {
                            setPartnerLatitude(pickedLat.toFixed(7));
                            setPartnerLongitude(pickedLng.toFixed(7));
                          }}
                        />
                        {partnerValid && (
                          <a className="portal-inline-link" style={{ marginTop: 8 }} target="_blank" rel="noreferrer"
                            href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`}>
                            <ExternalLink size={14} /> Mở vị trí Partner trên OpenStreetMap
                          </a>
                        )}
                      </>
                    ) : <div className="portal-empty" style={{ minHeight: 260, border: '1px dashed #cbd5e1', borderRadius: 12 }}>Hồ sơ chưa có tọa độ. Nhập latitude/longitude để hiển thị bản đồ và tìm POI OSM.</div>;
                  })()}
                </div>
              </div>
              <p style={{ margin: '10px 0 0', color: '#94a3b8', fontSize: 10 }}>
                Bản đồ nền © OpenStreetMap contributors. Việc tìm ứng viên dùng Overpass; không tìm thấy OSM không đồng nghĩa địa điểm không tồn tại ngoài thực tế.
              </p>
            </section>

            <section style={{ marginBottom: 22 }}>
              <h3><ImageIcon size={17} style={{ verticalAlign: 'middle', marginRight: 6 }} />Hình ảnh ({snapshotMedia.length})</h3>
              {snapshotMedia.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                  {snapshotMedia.map((item, index) => (
                    <div key={item.id || index} className="portal-panel" style={{ padding: 10 }}>
                      <a href={item.mediaUrl} target="_blank" rel="noreferrer">
                        <img src={item.thumbnailUrl || item.mediaUrl} alt={item.caption || 'Ảnh địa điểm'} style={{ width: '100%', height: 135, objectFit: 'cover', borderRadius: 9, background: '#f3f4f6' }} />
                      </a>
                      <div style={{ fontSize: 13, marginTop: 7 }}>{item.caption || 'Ảnh địa điểm'}{item.cover ? ' · Ảnh đại diện' : ''}</div>
                    </div>
                  ))}
                </div>
              ) : <p className="portal-muted-label">Chưa có ảnh trong snapshot gửi duyệt.</p>}
            </section>

            <section style={{ marginBottom: 22 }}>
              <h3>Giờ hoạt động ({snapshotHours.length} ngày)</h3>
              {snapshotHours.length ? (
                <div className="portal-panel" style={{ padding: 12 }}>
                  {snapshotHours.map((item, index) => (
                    <div key={item.id || item.dayOfWeek || index} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 4px', borderBottom: '1px solid #eef0f2' }}>
                      <strong>{dayName(item.dayOfWeek)}</strong>
                      <span>{item.closed ? 'Đóng cửa' : `${String(item.openTime || '').slice(0, 5)} – ${String(item.closeTime || '').slice(0, 5)}`}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="portal-muted-label">Partner chưa khai báo giờ hoạt động trong snapshot.</p>}
            </section>

            <section style={{ marginBottom: 22 }}>
              <h3>Ghi chú và thông tin giá ({snapshotNotes.length})</h3>
              {snapshotNotes.length ? snapshotNotes.map((item, index) => (
                <div key={item.id || index} className="portal-panel" style={{ padding: 13, marginBottom: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <strong>{item.title || 'Ghi chú'}</strong>
                    <span className="portal-status neutral">{item.noteType || 'TRAVEL_TIP'}</span>
                  </div>
                  <p style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>{item.content || '—'}</p>
                  {item.active === false && <small className="portal-muted-label">Ghi chú đã được Partner ẩn tại thời điểm gửi.</small>}
                </div>
              )) : <p className="portal-muted-label">Chưa có ghi chú trong snapshot.</p>}
            </section>

            {selected.reviewNote && (
              <div className="portal-alert warning" style={{ marginBottom: 16 }}>
                <strong>Phản hồi trước đó:</strong> {selected.reviewNote}
              </div>
            )}

            {selectedStatus === 'PENDING' ? (
              <section style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                <label className="portal-field full">
                  <span>Ghi chú cho Partner (không bắt buộc khi duyệt, bắt buộc khi từ chối)</span>
                  <textarea rows={3} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Nhập phản hồi hoặc yêu cầu cập nhật thông tin..." />
                </label>
                <div className="portal-modal-actions">
                  <button type="button" className="portal-secondary-button" onClick={() => setSelected(null)} disabled={Boolean(busyId)}>Đóng</button>
                  <button type="button" className="portal-secondary-button" onClick={() => review(selected, 'reject')} disabled={Boolean(busyId)}>
                    {busyId === selected.id ? <LoaderCircle className="portal-spin" size={16} /> : <X size={16} />} Từ chối
                  </button>
                  <button type="button" className="portal-primary-button" onClick={() => review(selected, 'approve')} disabled={Boolean(busyId)}>
                    {busyId === selected.id ? <LoaderCircle className="portal-spin" size={16} /> : <Check size={16} />} Xác nhận Place & phê duyệt
                  </button>
                </div>
              </section>
            ) : (
              <div className="portal-modal-actions"><button type="button" className="portal-secondary-button" onClick={() => setSelected(null)}>Đóng</button></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
