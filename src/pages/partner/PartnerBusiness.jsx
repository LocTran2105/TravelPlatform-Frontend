import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle, Check, Edit3, EyeOff, LoaderCircle, MapPin, Plus, RefreshCw, Send,
  Store, X,
} from 'lucide-react';
import { getApiError } from '../../api/axiosClient';
import { partnerApi } from '../../api/partnerApi';

const BUSINESS_TYPES = [
  ['HOTEL', 'Khách sạn'], ['HOMESTAY', 'Homestay'], ['RESORT', 'Resort'],
  ['HOSTEL', 'Hostel'], ['APARTMENT', 'Căn hộ lưu trú'], ['RESTAURANT', 'Nhà hàng'],
  ['EATERY', 'Quán ăn'], ['CAFE', 'Quán cà phê'], ['COFFEE_SHOP', 'Cửa hàng cà phê'],
  ['ATTRACTION', 'Điểm tham quan / Khu vui chơi'], ['TOURIST_SITE', 'Khu du lịch'],
  ['SPA', 'Spa'], ['SHOP', 'Cửa hàng'], ['OTHER', 'Khác'],
];

const EMPTY_FORM = {
  name: '', businessType: 'ATTRACTION', shortDescription: '', description: '',
  address: '', ward: '', district: '', city: '', province: '', countryCode: 'VN',
  latitude: '', longitude: '', phoneNumber: '', email: '', websiteUrl: '',
  facebookUrl: '', instagramUrl: '', priceLevel: '', currency: 'VND',
};

const STATUS = {
  DRAFT: ['Bản nháp', 'neutral'],
  PENDING_REVIEW: ['Đang chờ duyệt', 'warning'],
  PENDING: ['Đang chờ duyệt', 'warning'],
  APPROVED: ['Đã xác minh', 'success'],
  VERIFIED: ['Đã xác minh', 'success'],
  REJECTED: ['Cần cập nhật', 'danger'],
};

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const displayStatus = (status) => STATUS[String(status || 'DRAFT').toUpperCase()] || [status || 'Chưa xác định', 'neutral'];
const businessTypeName = (type) => BUSINESS_TYPES.find(([key]) => key === type)?.[1] || type || 'Khác';

function toPayload(form) {
  const payload = { ...form };
  ['latitude', 'longitude'].forEach((key) => {
    payload[key] = payload[key] === '' ? null : Number(payload[key]);
  });
  payload.priceLevel = payload.priceLevel === '' ? null : Number(payload.priceLevel);
  Object.keys(payload).forEach((key) => {
    if (typeof payload[key] === 'string') payload[key] = payload[key].trim();
  });
  return payload;
}

function fromBusiness(item) {
  const form = { ...EMPTY_FORM };
  Object.keys(form).forEach((key) => {
    form[key] = item?.[key] ?? '';
  });
  form.businessType = item?.businessType || 'ATTRACTION';
  form.countryCode = item?.countryCode || 'VN';
  form.currency = item?.currency || 'VND';
  return form;
}

export default function PartnerBusinesses() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadBusinesses = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await partnerApi.getBusinesses();
      setBusinesses(unwrapList(result));
    } catch (err) {
      setError(getApiError(err, 'Không tải được danh sách địa điểm.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBusinesses(); }, []);

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      openCreate();
      setSearchParams({}, { replace: true });
    }
    // Only react to the one-time create query parameter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filteredBusinesses = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase('vi-VN');
    if (!query) return businesses;
    return businesses.filter((item) => [item.name, item.address, item.city, item.businessType]
      .some((value) => String(value || '').toLocaleLowerCase('vi-VN').includes(query)));
  }, [businesses, keyword]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setNotice('');
    setModalOpen(true);
  }

  function openEdit(item) {
    setEditingId(item.id);
    setForm(fromBusiness(item));
    setError('');
    setNotice('');
    setModalOpen(true);
  }

  const changeField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const saveBusiness = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = toPayload(form);
      if (editingId) await partnerApi.updateBusiness(editingId, payload);
      else await partnerApi.createBusiness(payload);
      setModalOpen(false);
      setNotice(editingId
        ? 'Đã lưu thay đổi. Địa điểm chuyển về bản nháp; hãy gửi Admin xét duyệt lại.'
        : 'Đã tạo địa điểm. Hãy kiểm tra thông tin và gửi Admin xét duyệt.');
      await loadBusinesses();
    } catch (err) {
      setError(getApiError(err, 'Không lưu được thông tin địa điểm.'));
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async (item) => {
    const confirmed = window.confirm(`Gửi địa điểm "${item.name}" cho Admin xét duyệt?`);
    if (!confirmed) return;
    setError('');
    setNotice('');
    try {
      await partnerApi.submitBusiness(item.id);
      setNotice(`Đã gửi "${item.name}" để xét duyệt.`);
      await loadBusinesses();
    } catch (err) {
      setError(getApiError(err, 'Không gửi được yêu cầu xét duyệt.'));
    }
  };

  const hideBusiness = async (item) => {
    const confirmed = window.confirm(`Ẩn địa điểm "${item.name}" khỏi danh sách quản lý?`);
    if (!confirmed) return;
    setError('');
    setNotice('');
    try {
      await partnerApi.hideBusiness(item.id);
      setNotice('Đã ẩn địa điểm.');
      await loadBusinesses();
    } catch (err) {
      setError(getApiError(err, 'Không thể ẩn địa điểm.'));
    }
  };

  return (
    <div className="portal-page">
      <div className="portal-page-heading">
        <div>
          <div className="portal-eyebrow">PLACE DIRECTORY</div>
          <h1>Địa điểm của tôi</h1>
          <p>Khai báo và cập nhật thông tin địa điểm để cung cấp dữ liệu chính xác cho khách du lịch.</p>
        </div>
        <button className="portal-primary-button" onClick={openCreate}><Plus size={17} /> Thêm địa điểm</button>
      </div>

      {error && <div className="portal-alert error"><AlertCircle size={17} />{error}</div>}
      {notice && <div className="portal-alert success"><Check size={17} />{notice}</div>}

      <div className="portal-toolbar">
        <div className="portal-search">
          <MapPin size={17} />
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm theo tên, địa chỉ hoặc loại địa điểm..." />
        </div>
        <button className="portal-secondary-button" onClick={loadBusinesses} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'portal-spin' : ''} /> Làm mới
        </button>
      </div>

      <div className="portal-panel portal-table-panel">
        <div className="portal-table-heading">
          <div><h2>Danh sách địa điểm</h2><p>{filteredBusinesses.length} địa điểm</p></div>
          <span className="portal-muted-label">Dữ liệu của tài khoản đang đăng nhập</span>
        </div>
        {loading ? (
          <div className="portal-empty"><LoaderCircle className="portal-spin" size={24} />Đang tải dữ liệu...</div>
        ) : filteredBusinesses.length === 0 ? (
          <div className="portal-empty">
            <div className="portal-empty-icon"><Store size={26} /></div>
            <strong>{keyword ? 'Không tìm thấy địa điểm phù hợp' : 'Bạn chưa khai báo địa điểm nào'}</strong>
            <span>Thêm khách sạn, homestay, nhà hàng, quán cà phê hoặc điểm tham quan mà bạn quản lý.</span>
            {!keyword && <button className="portal-primary-button" onClick={openCreate}><Plus size={16} /> Thêm địa điểm đầu tiên</button>}
          </div>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>Địa điểm</th><th>Loại hình</th><th>Địa chỉ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
              <tbody>
                {filteredBusinesses.map((item) => {
                  const [statusLabel, statusTone] = displayStatus(item.verificationStatus);
                  const published = item.publicationStatus === 'PUBLISHED';
                  return (
                    <tr key={item.id}>
                      <td><div className="portal-place-cell"><div className="portal-place-thumb"><MapPin size={18} /></div><div><strong>{item.name}</strong><small>ID: {item.id}</small></div></div></td>
                      <td>{businessTypeName(item.businessType)}</td>
                      <td><span className="portal-address-cell">{[item.address, item.city].filter(Boolean).join(', ') || 'Chưa cập nhật'}</span></td>
                      <td><span className={`portal-status ${statusTone}`}>{statusLabel}</span>{published && <small className="portal-published-note"> • Đang công khai</small>}</td>
                      <td>
                        <div className="portal-row-actions">
                          <button className="portal-small-button" onClick={() => openEdit(item)} title="Chỉnh sửa"><Edit3 size={15} /></button>
                          {item.verificationStatus !== 'PENDING_REVIEW' && item.verificationStatus !== 'APPROVED' && (
                            <button className="portal-small-button accent" onClick={() => submitForReview(item)} title="Gửi xét duyệt"><Send size={15} /></button>
                          )}
                          <button className="portal-small-button danger" onClick={() => hideBusiness(item)} title="Ẩn địa điểm"><EyeOff size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <form className="portal-modal portal-business-form" onSubmit={saveBusiness}>
            <div className="portal-modal-header">
              <div><div className="portal-eyebrow">PLACE INFORMATION</div><h2>{editingId ? 'Cập nhật địa điểm' : 'Thêm địa điểm mới'}</h2><p>Thông tin sẽ ở trạng thái bản nháp cho đến khi bạn gửi xét duyệt.</p></div>
              <button type="button" className="portal-icon-button" onClick={() => setModalOpen(false)} aria-label="Đóng"><X size={20} /></button>
            </div>
            <div className="portal-form-grid">
              <label className="portal-field full"><span>Tên địa điểm *</span><input name="name" required maxLength={255} value={form.name} onChange={changeField} placeholder="Ví dụ: Khu du lịch ..." /></label>
              <label className="portal-field"><span>Loại hình *</span><select name="businessType" value={form.businessType} onChange={changeField} required>{BUSINESS_TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label className="portal-field"><span>Mức giá tham khảo</span><select name="priceLevel" value={form.priceLevel} onChange={changeField}><option value="">Chưa xác định</option><option value="1">1 – Tiết kiệm</option><option value="2">2 – Trung bình</option><option value="3">3 – Khá</option><option value="4">4 – Cao</option></select></label>
              <label className="portal-field full"><span>Mô tả ngắn</span><input name="shortDescription" maxLength={500} value={form.shortDescription} onChange={changeField} placeholder="Điểm nổi bật của địa điểm..." /></label>
              <label className="portal-field full"><span>Mô tả chi tiết</span><textarea name="description" rows={3} value={form.description} onChange={changeField} placeholder="Thông tin hữu ích dành cho khách du lịch..." /></label>
              <label className="portal-field full"><span>Địa chỉ *</span><input name="address" required maxLength={500} value={form.address} onChange={changeField} placeholder="Số nhà, đường, khu vực..." /></label>
              <label className="portal-field"><span>Phường / Xã</span><input name="ward" value={form.ward} onChange={changeField} /></label>
              <label className="portal-field"><span>Quận / Huyện</span><input name="district" value={form.district} onChange={changeField} /></label>
              <label className="portal-field"><span>Thành phố *</span><input name="city" required value={form.city} onChange={changeField} placeholder="Đà Lạt" /></label>
              <label className="portal-field"><span>Tỉnh</span><input name="province" value={form.province} onChange={changeField} /></label>
              <label className="portal-field"><span>Latitude</span><input name="latitude" type="number" step="any" min="-90" max="90" value={form.latitude} onChange={changeField} placeholder="11.9404" /></label>
              <label className="portal-field"><span>Longitude</span><input name="longitude" type="number" step="any" min="-180" max="180" value={form.longitude} onChange={changeField} placeholder="108.4583" /></label>
              <label className="portal-field"><span>Số điện thoại</span><input name="phoneNumber" value={form.phoneNumber} onChange={changeField} /></label>
              <label className="portal-field"><span>Email liên hệ</span><input name="email" type="email" value={form.email} onChange={changeField} /></label>
              <label className="portal-field full"><span>Website</span><input name="websiteUrl" type="url" value={form.websiteUrl} onChange={changeField} placeholder="https://..." /></label>
              <label className="portal-field"><span>Facebook</span><input name="facebookUrl" type="url" value={form.facebookUrl} onChange={changeField} /></label>
              <label className="portal-field"><span>Instagram</span><input name="instagramUrl" type="url" value={form.instagramUrl} onChange={changeField} /></label>
            </div>
            <div className="portal-form-hint"><AlertCircle size={16} /> Giá chi tiết, giờ hoạt động và hình ảnh sẽ được bổ sung ở các bước tiếp theo. Không nhập giá ước đoán như giá đã xác minh.</div>
            <div className="portal-modal-actions">
              <button type="button" className="portal-secondary-button" onClick={() => setModalOpen(false)} disabled={saving}>Hủy</button>
              <button type="submit" className="portal-primary-button" disabled={saving}>{saving ? <LoaderCircle className="portal-spin" size={17} /> : <Check size={17} />}{saving ? 'Đang lưu...' : 'Lưu địa điểm'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
