import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle, Check, Clock3, Edit3, EyeOff, ImagePlus, LoaderCircle,
  MapPin, Plus, RefreshCw, Send, Store, Trash2, X,
} from 'lucide-react';
import axiosClient, { getApiError } from '../../api/axiosClient';
import { partnerApi } from '../../api/partnerApi';

const BUSINESS_TYPES = [
  ['HOTEL', 'Khách sạn'], ['HOMESTAY', 'Homestay'], ['RESORT', 'Resort'],
  ['HOSTEL', 'Hostel'], ['APARTMENT', 'Căn hộ lưu trú'], ['RESTAURANT', 'Nhà hàng'],
  ['EATERY', 'Quán ăn'], ['CAFE', 'Quán cà phê'], ['COFFEE_SHOP', 'Cửa hàng cà phê'],
  ['ATTRACTION', 'Điểm tham quan / Khu vui chơi'], ['TOURIST_SITE', 'Khu du lịch'],
  ['SPA', 'Spa'], ['SHOP', 'Cửa hàng'], ['OTHER', 'Khác'],
];

const DAYS = [
  [1, 'Thứ 2'], [2, 'Thứ 3'], [3, 'Thứ 4'], [4, 'Thứ 5'],
  [5, 'Thứ 6'], [6, 'Thứ 7'], [7, 'Chủ nhật'],
];

const BUSINESS_BASE = '/api/partner/businesses';

const EMPTY_FORM = {
  name: '', businessType: 'ATTRACTION', shortDescription: '', description: '',
  address: '', ward: '', district: '', city: '', province: '', countryCode: 'VN',
  latitude: '', longitude: '', phoneNumber: '', email: '', websiteUrl: '',
  facebookUrl: '', instagramUrl: '', priceLevel: '', currency: 'VND',
};

const EMPTY_MEDIA_FORM = { caption: '', cover: false };
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const EMPTY_NOTE_FORM = { title: '', content: '', noteType: 'TRAVEL_TIP' };

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
const isPendingReview = (status) => String(status || '').toUpperCase() === 'PENDING_REVIEW';

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

function defaultHours() {
  return DAYS.map(([dayOfWeek]) => ({
    dayOfWeek,
    openTime: '08:00',
    closeTime: '17:00',
    closed: true,
  }));
}

function normalizeHours(data) {
  const source = unwrapList(data);
  const byDay = new Map(source.map((item) => [Number(item.dayOfWeek), item]));
  return DAYS.map(([dayOfWeek]) => {
    const item = byDay.get(dayOfWeek);
    return {
      dayOfWeek,
      openTime: item?.openTime ? String(item.openTime).slice(0, 5) : '08:00',
      closeTime: item?.closeTime ? String(item.closeTime).slice(0, 5) : '17:00',
      closed: item ? Boolean(item.closed) : true,
    };
  });
}

function Field({ label, name, value, onChange, ...props }) {
  return (
    <label className="portal-field">
      <span>{label}</span>
      <input name={name} value={value ?? ''} onChange={onChange} {...props} />
    </label>
  );
}

export default function PartnerBusiness() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingStatus, setEditingStatus] = useState('DRAFT');
  const [form, setForm] = useState(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState('info');

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [childSaving, setChildSaving] = useState(false);
  const [childNotice, setChildNotice] = useState('');
  const [media, setMedia] = useState([]);
  const [mediaForm, setMediaForm] = useState(EMPTY_MEDIA_FORM);
  const [selectedMediaFile, setSelectedMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState('');
  const [hours, setHours] = useState(defaultHours);
  const [notes, setNotes] = useState([]);
  const [noteForm, setNoteForm] = useState(EMPTY_NOTE_FORM);
  const [editingNoteId, setEditingNoteId] = useState(null);

  useEffect(() => {
    if (!selectedMediaFile) {
      setMediaPreviewUrl('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(selectedMediaFile);
    setMediaPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedMediaFile]);

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

  function resetChildForms() {
    setMedia([]);
    setMediaForm(EMPTY_MEDIA_FORM);
    setSelectedMediaFile(null);
    setHours(defaultHours());
    setNotes([]);
    setNoteForm(EMPTY_NOTE_FORM);
    setEditingNoteId(null);
    setDetailsError('');
    setChildNotice('');
  }

  function openCreate() {
    setEditingId(null);
    setEditingStatus('DRAFT');
    setForm({ ...EMPTY_FORM });
    setActiveTab('info');
    resetChildForms();
    setError('');
    setNotice('');
    setModalOpen(true);
  }

  async function loadBusinessDetails(businessId) {
    setDetailsLoading(true);
    setDetailsError('');
    const requests = await Promise.allSettled([
      axiosClient.get(`${BUSINESS_BASE}/${businessId}/media`),
      axiosClient.get(`${BUSINESS_BASE}/${businessId}/hours`),
      axiosClient.get(`${BUSINESS_BASE}/${businessId}/notes`),
    ]);

    const labels = ['hình ảnh', 'giờ hoạt động', 'ghi chú'];
    const failures = [];
    if (requests[0].status === 'fulfilled') setMedia(unwrapList(requests[0].value.data));
    else failures.push(`${labels[0]}: ${getApiError(requests[0].reason, 'không tải được')}`);

    if (requests[1].status === 'fulfilled') setHours(normalizeHours(requests[1].value.data));
    else failures.push(`${labels[1]}: ${getApiError(requests[1].reason, 'không tải được')}`);

    if (requests[2].status === 'fulfilled') setNotes(unwrapList(requests[2].value.data));
    else failures.push(`${labels[2]}: ${getApiError(requests[2].reason, 'không tải được')}`);

    if (failures.length) setDetailsError(`Một số dữ liệu phụ chưa tải được. ${failures.join(' | ')}`);
    setDetailsLoading(false);
  }

  function openEdit(item) {
    setEditingId(item.id);
    setEditingStatus(item.verificationStatus || 'DRAFT');
    setForm(fromBusiness(item));
    setActiveTab('info');
    resetChildForms();
    setError('');
    setNotice('');
    setModalOpen(true);
    loadBusinessDetails(item.id);
  }

  const changeField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const saveBusiness = async (event) => {
    event.preventDefault();
    if (isPendingReview(editingStatus)) {
      setError('Địa điểm đang chờ Admin xét duyệt nên không thể chỉnh sửa.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = toPayload(form);
      if (editingId) {
        await partnerApi.updateBusiness(editingId, payload);
        setModalOpen(false);
        setNotice('Đã lưu thay đổi. Địa điểm chuyển về bản nháp; hãy gửi Admin xét duyệt lại.');
        await loadBusinesses();
      } else {
        const createdBusiness = await partnerApi.createBusiness(payload);
        await loadBusinesses();

        // Business phải có ID trước khi có thể lưu media/hours/notes.
        // Mở tiếp màn chỉnh sửa để Partner hoàn thiện hồ sơ ngay, không cần quay lại danh sách.
        if (createdBusiness?.id) {
          openEdit(createdBusiness);
          setActiveTab('media');
          setChildNotice('Đã tạo bản nháp. Tiếp tục tải ảnh lên Cloudinary, khai báo giờ hoạt động và ghi chú trước khi gửi duyệt.');
        } else {
          setModalOpen(false);
          setNotice('Đã tạo bản nháp. Hãy mở địa điểm vừa tạo để bổ sung ảnh, giờ hoạt động và ghi chú.');
        }
      }
    } catch (err) {
      setError(getApiError(err, 'Không lưu được thông tin địa điểm.'));
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async (item) => {
    const confirmed = window.confirm(
      `Gửi địa điểm "${item.name}" cho Admin xét duyệt? Hãy đảm bảo địa chỉ, tọa độ, ảnh và thông tin dành cho khách du lịch đã chính xác.`
    );
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
    if (isPendingReview(item.verificationStatus)) {
      setError('Địa điểm đang chờ Admin xét duyệt. Không thể ẩn trong thời gian này.');
      return;
    }
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

  const addMedia = async (event) => {
    event.preventDefault();
    if (!editingId) return;
    if (isPendingReview(editingStatus)) {
      setDetailsError('Hồ sơ đang chờ duyệt nên không thể chỉnh sửa ảnh.');
      return;
    }
    if (!selectedMediaFile) {
      setDetailsError('Vui lòng chọn một ảnh trước khi tải lên.');
      return;
    }
    if (!selectedMediaFile.type.startsWith('image/')) {
      setDetailsError('File tải lên phải là hình ảnh.');
      return;
    }
    if (selectedMediaFile.size > MAX_IMAGE_SIZE_BYTES) {
      setDetailsError('Ảnh không được vượt quá 10 MB.');
      return;
    }

    setChildSaving(true);
    setDetailsError('');
    setChildNotice('');
    try {
      // Upload multipart lên endpoint Cloudinary đã có sẵn ở Backend.
      const uploadData = new FormData();
      uploadData.append('file', selectedMediaFile);
      const uploadResponse = await axiosClient.post('/api/upload/image', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      // FileUploadController hiện trả ResponseEntity.ok(imageUrl) dạng chuỗi.
      const mediaUrl = typeof uploadResponse.data === 'string'
        ? uploadResponse.data.trim()
        : (uploadResponse.data?.secureUrl || uploadResponse.data?.imageUrl || uploadResponse.data?.url || '').trim();

      if (!mediaUrl || !/^https:\/\//i.test(mediaUrl)) {
        throw new Error('Backend không trả về URL ảnh Cloudinary hợp lệ.');
      }

      // URL Cloudinary được lưu vào bảng partner_business_media như trước.
      await axiosClient.post(`${BUSINESS_BASE}/${editingId}/media`, {
        mediaType: 'IMAGE',
        mediaUrl,
        thumbnailUrl: null,
        caption: mediaForm.caption.trim() || null,
        cover: Boolean(mediaForm.cover) || media.length === 0,
        sortOrder: media.length,
      });

      setMediaForm(EMPTY_MEDIA_FORM);
      setSelectedMediaFile(null);
      await loadBusinessDetails(editingId);
      setChildNotice('Đã tải ảnh lên Cloudinary và lưu vào hồ sơ địa điểm. Địa điểm cần gửi Admin xét duyệt lại.');
      await loadBusinesses();
      setEditingStatus('DRAFT');
    } catch (err) {
      const message = err?.response
        ? getApiError(err, 'Không tải ảnh lên Cloudinary được.')
        : (err?.message || 'Không tải ảnh lên Cloudinary được.');
      setDetailsError(message);
    } finally {
      setChildSaving(false);
    }
  };

  const handleMediaFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setDetailsError('Chỉ chấp nhận file hình ảnh.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setDetailsError('Ảnh không được vượt quá 10 MB.');
      return;
    }
    setDetailsError('');
    setSelectedMediaFile(file);
  };

  const deleteMedia = async (mediaItem) => {
    if (!window.confirm('Xóa ảnh này khỏi hồ sơ địa điểm?')) return;
    setChildSaving(true);
    setDetailsError('');
    setChildNotice('');
    try {
      await axiosClient.delete(`${BUSINESS_BASE}/${editingId}/media/${mediaItem.id}`);
      await loadBusinessDetails(editingId);
      setChildNotice('Đã xóa ảnh. Địa điểm cần gửi Admin xét duyệt lại.');
      await loadBusinesses();
      setEditingStatus('DRAFT');
    } catch (err) {
      setDetailsError(getApiError(err, 'Không xóa được ảnh.'));
    } finally {
      setChildSaving(false);
    }
  };

  const saveHours = async (event) => {
    event.preventDefault();
    if (!editingId) return;
    setChildSaving(true);
    setDetailsError('');
    setChildNotice('');
    try {
      const payload = hours.map((item) => ({
        dayOfWeek: item.dayOfWeek,
        openTime: item.closed ? null : item.openTime,
        closeTime: item.closed ? null : item.closeTime,
        closed: Boolean(item.closed),
      }));
      await axiosClient.put(`${BUSINESS_BASE}/${editingId}/hours`, payload);
      await loadBusinessDetails(editingId);
      setChildNotice('Đã lưu giờ hoạt động. Địa điểm cần gửi Admin xét duyệt lại.');
      await loadBusinesses();
      setEditingStatus('DRAFT');
    } catch (err) {
      setDetailsError(getApiError(err, 'Không lưu được giờ hoạt động.'));
    } finally {
      setChildSaving(false);
    }
  };

  const saveNote = async (event) => {
    event.preventDefault();
    if (!editingId) return;
    setChildSaving(true);
    setDetailsError('');
    setChildNotice('');
    try {
      const payload = {
        title: noteForm.title.trim(),
        content: noteForm.content.trim(),
        noteType: noteForm.noteType,
        active: true,
      };
      if (editingNoteId) {
        await axiosClient.put(`${BUSINESS_BASE}/${editingId}/notes/${editingNoteId}`, payload);
      } else {
        await axiosClient.post(`${BUSINESS_BASE}/${editingId}/notes`, payload);
      }
      setNoteForm(EMPTY_NOTE_FORM);
      setEditingNoteId(null);
      await loadBusinessDetails(editingId);
      setChildNotice('Đã lưu ghi chú. Địa điểm cần gửi Admin xét duyệt lại.');
      await loadBusinesses();
      setEditingStatus('DRAFT');
    } catch (err) {
      setDetailsError(getApiError(err, 'Không lưu được ghi chú.'));
    } finally {
      setChildSaving(false);
    }
  };

  const editNote = (note) => {
    setEditingNoteId(note.id);
    setNoteForm({
      title: note.title || '',
      content: note.content || '',
      noteType: note.noteType || 'TRAVEL_TIP',
    });
  };

  const deleteNote = async (note) => {
    if (!window.confirm(`Ẩn ghi chú "${note.title}"?`)) return;
    setChildSaving(true);
    setDetailsError('');
    setChildNotice('');
    try {
      await axiosClient.delete(`${BUSINESS_BASE}/${editingId}/notes/${note.id}`);
      await loadBusinessDetails(editingId);
      setChildNotice('Đã ẩn ghi chú. Địa điểm cần gửi Admin xét duyệt lại.');
      await loadBusinesses();
      setEditingStatus('DRAFT');
    } catch (err) {
      setDetailsError(getApiError(err, 'Không ẩn được ghi chú.'));
    } finally {
      setChildSaving(false);
    }
  };

  const updateHour = (dayOfWeek, field, value) => {
    setHours((current) => current.map((item) => item.dayOfWeek === dayOfWeek
      ? { ...item, [field]: value }
      : item));
  };

  const pending = isPendingReview(editingStatus);

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
                  const itemPending = isPendingReview(item.verificationStatus);
                  return (
                    <tr key={item.id}>
                      <td><div className="portal-place-cell"><div className="portal-place-thumb"><MapPin size={18} /></div><div><strong>{item.name}</strong><small>ID: {item.id}</small></div></div></td>
                      <td>{businessTypeName(item.businessType)}</td>
                      <td><span className="portal-address-cell">{[item.address, item.city].filter(Boolean).join(', ') || 'Chưa cập nhật'}</span></td>
                      <td><span className={`portal-status ${statusTone}`}>{statusLabel}</span>{published && <small className="portal-published-note"> • Đang công khai</small>}</td>
                      <td>
                        <div className="portal-row-actions">
                          <button className="portal-small-button" onClick={() => openEdit(item)} title={itemPending ? 'Đang chờ Admin xét duyệt' : 'Chỉnh sửa'} disabled={itemPending}><Edit3 size={15} /></button>
                          {!itemPending && item.verificationStatus !== 'APPROVED' && (
                            <button className="portal-small-button accent" onClick={() => submitForReview(item)} title="Gửi xét duyệt"><Send size={15} /></button>
                          )}
                          <button className="portal-small-button danger" onClick={() => hideBusiness(item)} title="Ẩn địa điểm" disabled={itemPending}><EyeOff size={15} /></button>
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
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving && !childSaving) setModalOpen(false); }}>
          <div className="portal-modal portal-business-form" style={{ width: 'min(980px, 96vw)', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="portal-modal-header">
              <div>
                <div className="portal-eyebrow">PLACE INFORMATION</div>
                <h2>{editingId ? 'Quản lý địa điểm' : 'Thêm địa điểm mới'}</h2>
                <p>{pending ? 'Hồ sơ đang chờ Admin xét duyệt và được khóa chỉnh sửa.' : 'Hoàn thiện thông tin, ảnh, giờ hoạt động và ghi chú trước khi gửi duyệt.'}</p>
              </div>
              <button type="button" className="portal-icon-button" onClick={() => setModalOpen(false)} aria-label="Đóng" disabled={saving || childSaving}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18, borderBottom: '1px solid #e5e7eb', paddingBottom: 12 }}>
              {[
                ['info', 'Thông tin cơ bản'], ['media', 'Hình ảnh'], ['hours', 'Giờ hoạt động'], ['notes', 'Ghi chú & giá'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={activeTab === key ? 'portal-primary-button' : 'portal-secondary-button'}
                  onClick={() => setActiveTab(key)}
                  disabled={!editingId && key !== 'info'}
                >{label}</button>
              ))}
            </div>

            {pending && <div className="portal-alert warning"><Clock3 size={16} /> Đang chờ duyệt. Partner không thể thay đổi dữ liệu cho đến khi Admin xử lý yêu cầu.</div>}
            {detailsError && <div className="portal-alert error"><AlertCircle size={16} />{detailsError}</div>}
            {childNotice && <div className="portal-alert success"><Check size={16} />{childNotice}</div>}

            {activeTab === 'info' && (
              <form onSubmit={saveBusiness}>
                <div className="portal-form-grid">
                  <label className="portal-field full"><span>Tên địa điểm *</span><input name="name" required maxLength={255} value={form.name} onChange={changeField} placeholder="Ví dụ: Đồi chè Cầu Đất" disabled={pending} /></label>
                  <label className="portal-field"><span>Loại hình *</span><select name="businessType" value={form.businessType} onChange={changeField} required disabled={pending}>{BUSINESS_TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                  <label className="portal-field"><span>Mức giá tham khảo</span><select name="priceLevel" value={form.priceLevel} onChange={changeField} disabled={pending}><option value="">Chưa xác định</option><option value="1">1 – Tiết kiệm</option><option value="2">2 – Trung bình</option><option value="3">3 – Khá</option><option value="4">4 – Cao</option></select></label>
                  <label className="portal-field full"><span>Mô tả ngắn</span><input name="shortDescription" maxLength={500} value={form.shortDescription} onChange={changeField} placeholder="Điểm nổi bật của địa điểm..." disabled={pending} /></label>
                  <label className="portal-field full"><span>Mô tả chi tiết</span><textarea name="description" rows={3} value={form.description} onChange={changeField} placeholder="Thông tin hữu ích dành cho khách du lịch..." disabled={pending} /></label>
                  <label className="portal-field full"><span>Địa chỉ *</span><input name="address" required maxLength={500} value={form.address} onChange={changeField} placeholder="Số nhà, đường, khu vực..." disabled={pending} /></label>
                  <Field label="Phường / Xã" name="ward" value={form.ward} onChange={changeField} disabled={pending} />
                  <Field label="Quận / Huyện" name="district" value={form.district} onChange={changeField} disabled={pending} />
                  <Field label="Thành phố *" name="city" required value={form.city} onChange={changeField} placeholder="Đà Lạt" disabled={pending} />
                  <Field label="Tỉnh" name="province" value={form.province} onChange={changeField} disabled={pending} />
                  <Field label="Latitude" name="latitude" type="number" step="any" min="-90" max="90" value={form.latitude} onChange={changeField} placeholder="11.9404" disabled={pending} />
                  <Field label="Longitude" name="longitude" type="number" step="any" min="-180" max="180" value={form.longitude} onChange={changeField} placeholder="108.4583" disabled={pending} />
                  {form.latitude !== '' && form.longitude !== '' && Number.isFinite(Number(form.latitude)) && Number.isFinite(Number(form.longitude)) && (
                    <div className="portal-field full">
                      <span>Kiểm tra vị trí trên bản đồ</span>
                      <a className="portal-inline-link" href={`https://www.openstreetmap.org/?mlat=${encodeURIComponent(form.latitude)}&mlon=${encodeURIComponent(form.longitude)}#map=17/${encodeURIComponent(form.latitude)}/${encodeURIComponent(form.longitude)}`} target="_blank" rel="noreferrer">
                        <MapPin size={15} /> Mở tọa độ hiện tại trên OpenStreetMap
                      </a>
                      <small>Đây là vị trí do Partner cung cấp để Admin đối chiếu; việc ghép OSM chỉ do Admin xác nhận.</small>
                    </div>
                  )}
                  <Field label="Số điện thoại" name="phoneNumber" value={form.phoneNumber} onChange={changeField} disabled={pending} />
                  <Field label="Email liên hệ" name="email" type="email" value={form.email} onChange={changeField} disabled={pending} />
                  <Field label="Website" name="websiteUrl" type="url" value={form.websiteUrl} onChange={changeField} placeholder="https://..." disabled={pending} />
                  <Field label="Facebook" name="facebookUrl" type="url" value={form.facebookUrl} onChange={changeField} disabled={pending} />
                  <Field label="Instagram" name="instagramUrl" type="url" value={form.instagramUrl} onChange={changeField} disabled={pending} />
                </div>
                <div className="portal-form-hint"><AlertCircle size={16} /> Tọa độ nên là vị trí khách có thể đến (ưu tiên cổng vào/điểm đón khách). Mức giá 1–4 chỉ là phân loại tham khảo, không phải giá vé/phòng đã xác minh.</div>
                <div className="portal-modal-actions">
                  <button type="button" className="portal-secondary-button" onClick={() => setModalOpen(false)} disabled={saving}>Đóng</button>
                  <button type="submit" className="portal-primary-button" disabled={saving || pending}>{saving ? <LoaderCircle className="portal-spin" size={17} /> : <Check size={17} />}{saving ? 'Đang lưu...' : 'Lưu thông tin'}</button>
                </div>
              </form>
            )}

            {activeTab === 'media' && (
              <section>
                <p className="portal-muted-label" style={{ marginBottom: 14 }}>Ảnh được tải trực tiếp lên Cloudinary qua Backend. URL bảo mật sau khi upload sẽ được lưu vào hồ sơ địa điểm để Admin kiểm tra.</p>
                {detailsLoading ? <div className="portal-empty"><LoaderCircle className="portal-spin" size={22} />Đang tải ảnh...</div> : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
                      {media.map((item) => (
                        <div key={item.id} className="portal-panel" style={{ padding: 10 }}>
                          <img src={item.thumbnailUrl || item.mediaUrl} alt={item.caption || 'Ảnh địa điểm'} style={{ width: '100%', height: 125, objectFit: 'cover', borderRadius: 10, background: '#f3f4f6' }} />
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                            <span style={{ fontSize: 13, overflowWrap: 'anywhere' }}>{item.caption || 'Ảnh địa điểm'}{item.cover ? ' · Ảnh đại diện' : ''}</span>
                            <button type="button" className="portal-small-button danger" onClick={() => deleteMedia(item)} disabled={childSaving || pending} title="Xóa ảnh"><Trash2 size={14} /></button>
                          </div>
                        </div>
                      ))}
                      {media.length === 0 && <div className="portal-empty" style={{ gridColumn: '1 / -1' }}>Chưa có ảnh nào. Thêm ảnh đại diện và ảnh không gian thực tế của địa điểm.</div>}
                    </div>
                    <form onSubmit={addMedia} className="portal-panel" style={{ padding: 16 }}>
                      <h3 style={{ marginTop: 0 }}>Tải ảnh lên Cloudinary</h3>
                      <div className="portal-form-grid">
                        <label className="portal-field full">
                          <span>Chọn ảnh địa điểm *</span>
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleMediaFileChange} disabled={pending || childSaving} />
                          <small className="portal-muted-label">JPG, PNG, WEBP hoặc GIF · Tối đa 10 MB</small>
                        </label>
                        {mediaPreviewUrl && (
                          <div className="portal-field full">
                            <span>Xem trước</span>
                            <img src={mediaPreviewUrl} alt="Ảnh đang chọn" style={{ maxWidth: '100%', width: 260, maxHeight: 180, objectFit: 'cover', borderRadius: 10, border: '1px solid #e5e7eb' }} />
                            <small className="portal-muted-label">{selectedMediaFile?.name}</small>
                          </div>
                        )}
                        <label className="portal-field"><span>Mô tả ảnh</span><input value={mediaForm.caption} onChange={(e) => setMediaForm((current) => ({ ...current, caption: e.target.value }))} placeholder="Toàn cảnh địa điểm" disabled={pending || childSaving} /></label>
                        <label className="portal-field" style={{ alignSelf: 'end' }}><span>Ảnh đại diện</span><input type="checkbox" checked={mediaForm.cover} onChange={(e) => setMediaForm((current) => ({ ...current, cover: e.target.checked }))} disabled={pending || childSaving} /></label>
                      </div>
                      <div className="portal-modal-actions"><button type="submit" className="portal-primary-button" disabled={childSaving || pending || !selectedMediaFile}>{childSaving ? <LoaderCircle className="portal-spin" size={16} /> : <ImagePlus size={16} />} {childSaving ? 'Đang tải ảnh...' : 'Tải ảnh lên và lưu'}</button></div>
                    </form>
                  </>
                )}
              </section>
            )}

            {activeTab === 'hours' && (
              <form onSubmit={saveHours}>
                <p className="portal-muted-label" style={{ marginBottom: 14 }}>Giờ hoạt động theo ngày trong tuần. Chọn “Nghỉ” nếu địa điểm đóng cửa cả ngày.</p>
                {detailsLoading ? <div className="portal-empty"><LoaderCircle className="portal-spin" size={22} />Đang tải giờ hoạt động...</div> : (
                  <div className="portal-panel" style={{ padding: 12 }}>
                    {hours.map((item) => {
                      const dayLabel = DAYS.find(([day]) => day === item.dayOfWeek)?.[1] || `Ngày ${item.dayOfWeek}`;
                      return (
                        <div key={item.dayOfWeek} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 1fr) minmax(110px, 1fr) minmax(110px, 1fr) auto', gap: 12, alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid #eef0f2' }}>
                          <strong>{dayLabel}</strong>
                          <label className="portal-field"><span>Mở cửa</span><input type="time" value={item.openTime || ''} onChange={(e) => updateHour(item.dayOfWeek, 'openTime', e.target.value)} disabled={pending || item.closed} /></label>
                          <label className="portal-field"><span>Đóng cửa</span><input type="time" value={item.closeTime || ''} onChange={(e) => updateHour(item.dayOfWeek, 'closeTime', e.target.value)} disabled={pending || item.closed} /></label>
                          <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 18 }}><input type="checkbox" checked={Boolean(item.closed)} onChange={(e) => updateHour(item.dayOfWeek, 'closed', e.target.checked)} disabled={pending} /> Nghỉ</label>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="portal-modal-actions"><button type="submit" className="portal-primary-button" disabled={childSaving || pending || detailsLoading}>{childSaving ? <LoaderCircle className="portal-spin" size={16} /> : <Check size={16} />} Lưu giờ hoạt động</button></div>
              </form>
            )}

            {activeTab === 'notes' && (
              <section>
                <p className="portal-muted-label" style={{ marginBottom: 14 }}>Ghi chú dành cho khách du lịch, bao gồm lưu ý tham quan, quy định và thông tin giá. Với giá vé/giá dịch vụ, ghi rõ đơn vị, đối tượng áp dụng và thời gian hiệu lực trong nội dung.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(280px, .9fr)', gap: 16 }}>
                  <div>
                    {detailsLoading ? <div className="portal-empty"><LoaderCircle className="portal-spin" size={22} />Đang tải ghi chú...</div> : notes.filter((item) => item.active !== false).map((item) => (
                      <div key={item.id} className="portal-panel" style={{ padding: 14, marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start' }}>
                          <div><strong>{item.title}</strong><div className="portal-muted-label">{item.noteType || 'TRAVEL_TIP'}</div></div>
                          <div className="portal-row-actions">
                            <button type="button" className="portal-small-button" title="Sửa ghi chú" onClick={() => editNote(item)} disabled={pending || childSaving}><Edit3 size={14} /></button>
                            <button type="button" className="portal-small-button danger" title="Ẩn ghi chú" onClick={() => deleteNote(item)} disabled={pending || childSaving}><EyeOff size={14} /></button>
                          </div>
                        </div>
                        <p style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{item.content}</p>
                      </div>
                    ))}
                    {!detailsLoading && notes.filter((item) => item.active !== false).length === 0 && <div className="portal-empty">Chưa có ghi chú đang hiển thị.</div>}
                  </div>
                  <form onSubmit={saveNote} className="portal-panel" style={{ padding: 16, alignSelf: 'start' }}>
                    <h3 style={{ marginTop: 0 }}>{editingNoteId ? 'Cập nhật ghi chú' : 'Thêm ghi chú'}</h3>
                    <label className="portal-field"><span>Loại ghi chú</span><select value={noteForm.noteType} onChange={(e) => setNoteForm((current) => ({ ...current, noteType: e.target.value }))} disabled={pending}><option value="TRAVEL_TIP">Mẹo du lịch</option><option value="PRICE_INFO">Thông tin giá</option><option value="ACCESS">Di chuyển / tiếp cận</option><option value="IMPORTANT">Lưu ý quan trọng</option></select></label>
                    <label className="portal-field"><span>Tiêu đề *</span><input required maxLength={255} value={noteForm.title} onChange={(e) => setNoteForm((current) => ({ ...current, title: e.target.value }))} disabled={pending} /></label>
                    <label className="portal-field"><span>Nội dung *</span><textarea required rows={6} value={noteForm.content} onChange={(e) => setNoteForm((current) => ({ ...current, content: e.target.value }))} placeholder={noteForm.noteType === 'PRICE_INFO' ? 'Ví dụ: Vé người lớn: 50.000 VND/người. Giá áp dụng từ 01/11/2026 đến 31/12/2026. Vui lòng kiểm tra lại trước chuyến đi.' : 'Thông tin cần thiết dành cho khách du lịch...'} disabled={pending} /></label>
                    <div className="portal-modal-actions">
                      {editingNoteId && <button type="button" className="portal-secondary-button" onClick={() => { setEditingNoteId(null); setNoteForm(EMPTY_NOTE_FORM); }} disabled={childSaving}>Hủy sửa</button>}
                      <button type="submit" className="portal-primary-button" disabled={childSaving || pending}>{childSaving ? <LoaderCircle className="portal-spin" size={16} /> : <Check size={16} />} {editingNoteId ? 'Cập nhật' : 'Thêm ghi chú'}</button>
                    </div>
                  </form>
                </div>
              </section>
            )}

            {activeTab !== 'info' && (
              <div className="portal-modal-actions" style={{ marginTop: 18 }}>
                <button type="button" className="portal-secondary-button" onClick={() => setModalOpen(false)} disabled={childSaving}>Đóng</button>
                {editingId && <span className="portal-muted-label">Trạng thái hiện tại: {displayStatus(editingStatus)[0]}</span>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
