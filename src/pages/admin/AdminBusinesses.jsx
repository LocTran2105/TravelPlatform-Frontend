import { useEffect, useState } from 'react';
import {
  Check, Eye, EyeOff, MapPinned, RefreshCw, Search, Store, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { SkeletonTable } from '../../components/portal/Skeleton';
import { adminApi } from '../../api/adminApi';
import { getApiError } from '../../api/axiosClient';

// Quản lý các địa điểm Partner đã có: tìm/lọc, ẩn hoặc hiện, trạng thái hoạt động, sửa vị trí.

const PAGE_SIZE = 20;

const TYPE_LABELS = {
  CAFE: 'Cà phê', RESTAURANT: 'Nhà hàng', HOTEL: 'Khách sạn', HOMESTAY: 'Homestay', RESORT: 'Resort',
  ATTRACTION: 'Tham quan', OTHER: 'Khác',
};
const VERIFICATION = {
  APPROVED: ['Đã duyệt', 'success'], PENDING_REVIEW: ['Chờ duyệt', 'warning'],
  REJECTED: ['Từ chối', 'danger'], DRAFT: ['Nháp', 'neutral'],
};
const PUBLICATION = { PUBLISHED: ['Công khai', 'success'], HIDDEN: ['Đang ẩn', 'danger'], DRAFT: ['Chưa công khai', 'neutral'] };
const OPERATING = { OPEN: 'Đang hoạt động', TEMPORARILY_CLOSED: 'Tạm ngưng', CLOSED_PERMANENTLY: 'Ngừng hẳn' };

const chip = (map, value) => {
  const [label, tone] = map[String(value || '').toUpperCase()] || [value || '—', 'neutral'];
  return <span className={`portal-status ${tone}`}>{label}</span>;
};

const osmUrl = (ref) => (ref && /^(node|way|relation)\/\d+$/.test(ref) ? `https://www.openstreetmap.org/${ref}` : null);
const mapsUrl = (lat, lng) => (lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null);

const LinkedPlace = ({ row }) => {
  if (!row.placeId) return <span className="portal-status neutral">Chưa liên kết</span>;
  if (row.placeProvider === 'OSM') {
    const url = osmUrl(row.providerPlaceId);
    return <span>OSM #{row.placeId}<small>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{row.providerPlaceId}</a> : row.providerPlaceId}</small></span>;
  }
  return <span>PARTNER #{row.placeId}<small>Tọa độ do Admin xác nhận</small></span>;
};

export default function AdminBusinesses() {
  const [filters, setFilters] = useState({ keyword: '', verificationStatus: '', publicationStatus: '', businessType: '', page: 0 });
  const [keywordInput, setKeywordInput] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState({ key: null, page: null, error: '' });
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [editing, setEditing] = useState(null); // { row, form }

  const requestKey = `${JSON.stringify(filters)}#${reloadToken}`;
  const loading = result.key !== requestKey;
  const rows = result.page?.content || [];
  const totalPages = result.page?.totalPages || 0;

  useEffect(() => {
    const params = { page: filters.page, size: PAGE_SIZE };
    ['keyword', 'verificationStatus', 'publicationStatus', 'businessType'].forEach((k) => { if (filters[k]) params[k] = filters[k]; });
    let cancelled = false;
    adminApi.getBusinesses(params)
      .then((page) => { if (!cancelled) setResult({ key: requestKey, page, error: '' }); })
      .catch((err) => { if (!cancelled) setResult({ key: requestKey, page: null, error: getApiError(err, 'Không tải được danh sách địa điểm.') }); });
    return () => { cancelled = true; };
  }, [requestKey]); // eslint-disable-line react-hooks/exhaustive-deps -- requestKey đã gồm filters + reloadToken

  const setFilter = (name, value) => setFilters((f) => ({ ...f, [name]: value, page: 0 }));
  const replaceRow = (updated) => setResult((r) => (r.page
    ? { ...r, page: { ...r.page, content: r.page.content.map((row) => (row.id === updated.id ? updated : row)) } }
    : r));

  const runAction = async (row, action, successText) => {
    setBusyId(row.id); setActionError(''); setNotice('');
    try {
      replaceRow(await action());
      setNotice(successText);
      return true;
    } catch (err) {
      setActionError(getApiError(err, 'Không cập nhật được địa điểm.'));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const toggleVisibility = (row) => {
    const hide = row.publicationStatus === 'PUBLISHED';
    if (hide && !window.confirm(`Ẩn "${row.name}"? Địa điểm sẽ không còn hiện trên bản đồ và trong tìm kiếm.`)) return;
    runAction(row, () => adminApi.updateBusinessVisibility(row.id, hide ? 'HIDDEN' : 'PUBLISHED'),
      hide ? `Đã ẩn "${row.name}".` : `"${row.name}" đã hiển thị trở lại.`);
  };

  const changeOperating = (row, value) => {
    if (value === row.operatingStatus) return;
    runAction(row, () => adminApi.updateBusinessOperatingStatus(row.id, value),
      `Đã đổi trạng thái hoạt động của "${row.name}" thành "${OPERATING[value]}".`);
  };

  const openLocation = (row) => setEditing({
    row,
    form: {
      address: row.address || '', ward: row.ward || '', district: row.district || '', city: row.city || '',
      province: row.province || '', latitude: row.latitude ?? '', longitude: row.longitude ?? '',
    },
  });

  const saveLocation = async (e) => {
    e.preventDefault();
    const { row, form } = editing;
    const lat = form.latitude === '' ? null : Number(form.latitude);
    const lng = form.longitude === '' ? null : Number(form.longitude);
    if ((lat == null) !== (lng == null) || (lat != null && (!Number.isFinite(lat) || !Number.isFinite(lng)))) {
      setActionError('Latitude và longitude phải là số và nhập cùng nhau.');
      return;
    }
    const saved = await runAction(row, () => adminApi.updateBusinessLocation(row.id, {
      address: form.address.trim(), ward: form.ward.trim() || null, district: form.district.trim() || null,
      city: form.city.trim(), province: form.province.trim() || null, latitude: lat, longitude: lng,
    }), `Đã cập nhật vị trí "${row.name}".`);
    if (saved) setEditing(null); // lỗi thì giữ form để sửa tiếp
  };

  const field = (name, label, props = {}) => (
    <label className={`portal-field${props.full ? ' full' : ''}`}>
      <span>{label}</span>
      <input
        value={editing.form[name]}
        onChange={(e) => setEditing((ed) => ({ ...ed, form: { ...ed.form, [name]: e.target.value } }))}
        required={props.required}
        inputMode={props.numeric ? 'decimal' : undefined}
        disabled={busyId === editing.row.id}
      />
    </label>
  );

  const error = actionError || result.error;

  return (
    <div className="portal-page">
      <div className="portal-page-heading">
        <div>
          <h1>Quản lý địa điểm</h1>
          <p>Ẩn địa điểm trùng hoặc sai, cập nhật trạng thái hoạt động và chỉnh lại vị trí đã duyệt.</p>
        </div>
        <button className="portal-secondary-button" onClick={() => setReloadToken((t) => t + 1)} disabled={loading}>
          <RefreshCw size={16} /> Làm mới
        </button>
      </div>

      {error && <div className="portal-alert error">{error}</div>}
      {notice && <div className="portal-alert success"><Check size={16} />{notice}</div>}

      <form className="portal-search" onSubmit={(e) => { e.preventDefault(); setFilter('keyword', keywordInput.trim()); }}>
        <Search size={16} />
        <input value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)} placeholder="Tìm theo tên địa điểm, địa chỉ… (Enter)" />
      </form>

      <div className="portal-filter-row">
        <label>Duyệt</label>
        <select value={filters.verificationStatus} onChange={(e) => setFilter('verificationStatus', e.target.value)}>
          <option value="">Tất cả</option><option value="APPROVED">Đã duyệt</option><option value="PENDING_REVIEW">Chờ duyệt</option>
          <option value="REJECTED">Từ chối</option><option value="DRAFT">Nháp</option>
        </select>
        <label>Hiển thị</label>
        <select value={filters.publicationStatus} onChange={(e) => setFilter('publicationStatus', e.target.value)}>
          <option value="">Tất cả</option><option value="PUBLISHED">Công khai</option><option value="HIDDEN">Đang ẩn</option><option value="DRAFT">Chưa công khai</option>
        </select>
        <label>Loại</label>
        <select value={filters.businessType} onChange={(e) => setFilter('businessType', e.target.value)}>
          <option value="">Tất cả</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <span>{result.page?.totalElements ?? 0} địa điểm</span>
      </div>

      <section className="portal-panel portal-table-panel">
        {loading ? (
          <SkeletonTable rows={5} columns={7} label="Đang tải địa điểm" />
        ) : rows.length === 0 ? (
          <div className="portal-empty">
            <div className="portal-empty-icon"><Store size={26} /></div>
            <strong>Không có địa điểm</strong><span>Thử đổi bộ lọc hoặc từ khóa tìm kiếm.</span>
          </div>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr><th>Địa điểm</th><th>Loại</th><th>Địa chỉ</th><th>Place liên kết</th><th>Trạng thái</th><th>Hoạt động</th><th>Thao tác</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const busy = busyId === row.id;
                  const map = mapsUrl(row.latitude, row.longitude);
                  const canPublish = row.verificationStatus === 'APPROVED';
                  return (
                    <tr key={row.id}>
                      <td><strong>{row.name}</strong><small>{row.partnerEmail || row.partnerName || '—'}</small></td>
                      <td>{TYPE_LABELS[row.businessType] || row.businessType}</td>
                      <td>
                        {[row.address, row.ward].filter(Boolean).join(', ') || '—'}
                        <small>{map ? <a href={map} target="_blank" rel="noopener noreferrer">{row.latitude}, {row.longitude}</a> : 'Chưa có tọa độ'}</small>
                      </td>
                      <td><LinkedPlace row={row} /></td>
                      <td><div style={{ display: 'grid', gap: 4 }}>{chip(VERIFICATION, row.verificationStatus)}{chip(PUBLICATION, row.publicationStatus)}</div></td>
                      <td>
                        <select value={row.operatingStatus || 'OPEN'} disabled={busy} onChange={(e) => changeOperating(row, e.target.value)}>
                          {Object.entries(OPERATING).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </td>
                      <td>
                        <div className="portal-row-actions">
                          {row.publicationStatus === 'PUBLISHED' ? (
                            <button className="portal-small-button danger" disabled={busy} onClick={() => toggleVisibility(row)} title="Ẩn địa điểm"><EyeOff size={15} /></button>
                          ) : (
                            <button className="portal-small-button accent" disabled={busy || !canPublish} onClick={() => toggleVisibility(row)}
                              title={canPublish ? 'Hiển thị lại' : 'Chỉ địa điểm đã duyệt mới được công khai'}><Eye size={15} /></button>
                          )}
                          <button className="portal-small-button" disabled={busy} onClick={() => openLocation(row)} title="Sửa vị trí"><MapPinned size={15} /></button>
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

      {totalPages > 1 && (
        <div className="portal-filter-row" style={{ justifyContent: 'flex-end' }}>
          <button className="portal-small-button" disabled={loading || filters.page === 0}
            onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))} title="Trang trước"><ChevronLeft size={15} /></button>
          <span>Trang {filters.page + 1} / {totalPages}</span>
          <button className="portal-small-button" disabled={loading || filters.page >= totalPages - 1}
            onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))} title="Trang sau"><ChevronRight size={15} /></button>
        </div>
      )}

      {editing && (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busyId) setEditing(null); }}>
          <form className="portal-modal" style={{ width: 'min(640px, 96vw)' }} onSubmit={saveLocation}>
            <div className="portal-modal-header">
              <div>
                <div className="portal-eyebrow">Sửa vị trí</div>
                <h2>{editing.row.name}</h2>
                <p>
                  {editing.row.placeProvider === 'OSM'
                    ? 'Địa điểm đang liên kết với một POI OSM: chỉ thông tin địa điểm thay đổi, tọa độ của POI OSM giữ nguyên.'
                    : 'Place PARTNER trên bản đồ và trong tìm kiếm sẽ được cập nhật theo tọa độ mới.'}
                </p>
              </div>
              <button type="button" className="portal-icon-button" onClick={() => setEditing(null)} aria-label="Đóng"><X size={16} /></button>
            </div>
            {actionError && <div className="portal-alert error">{actionError}</div>}
            <div className="portal-form-grid">
              {field('address', 'Địa chỉ *', { full: true, required: true })}
              {field('ward', 'Phường / Xã')}
              {field('district', 'Quận / Huyện')}
              {field('city', 'Thành phố *', { required: true })}
              {field('province', 'Tỉnh')}
              {field('latitude', 'Latitude', { numeric: true })}
              {field('longitude', 'Longitude', { numeric: true })}
            </div>
            {mapsUrl(editing.form.latitude, editing.form.longitude) && (
              <p style={{ marginTop: 12, fontSize: 12 }}>
                <a href={mapsUrl(editing.form.latitude, editing.form.longitude)} target="_blank" rel="noopener noreferrer">Kiểm tra tọa độ trên Google Maps →</a>
              </p>
            )}
            <div className="portal-modal-actions">
              <button type="button" className="portal-secondary-button" onClick={() => setEditing(null)} disabled={busyId === editing.row.id}>Hủy</button>
              <button type="submit" className="portal-primary-button" disabled={busyId === editing.row.id}>
                {busyId === editing.row.id ? 'Đang lưu…' : 'Lưu vị trí'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
