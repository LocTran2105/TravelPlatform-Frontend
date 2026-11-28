import { useState } from 'react';
import {
  Check, Eye, EyeOff, ImagePlus, Inbox, LoaderCircle, Lock, Megaphone, Pencil, Plus, RefreshCw, Send, Star,
  StarOff, Trash2, UserCheck, X,
} from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import { getApiError } from '../../api/axiosClient';
import useAsyncData from '../../utils/useAsyncData';
import { refreshPortalCounts } from '../../utils/portalEvents';
import Modal from '../../components/portal/Modal';
import '../../styles/admin-moderators.css';
import '../../styles/admin-recruitments.css';

// Giới hạn khớp ModeratorRecruitmentService ở backend
const MAX_TITLE = 255;
const MAX_SUMMARY = 500;
const MAX_CONTENT = 20000;

const STATUS = {
  DRAFT: { label: 'Nháp', tone: 'neutral' },
  PUBLISHED: { label: 'Đang đăng', tone: 'success' },
  HIDDEN: { label: 'Tạm ẩn', tone: 'warning' },
  CLOSED: { label: 'Đã đóng', tone: 'info' },
};

const APP_STATUS = {
  PENDING: { label: 'Chờ xét', tone: 'warning' },
  APPROVED: { label: 'Đã duyệt', tone: 'success' },
  REJECTED: { label: 'Từ chối', tone: 'danger' },
  WITHDRAWN: { label: 'Đã rút', tone: 'neutral' },
};

const APP_TABS = [
  { value: 'PENDING', label: 'Chờ xét' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Từ chối' },
  { value: 'WITHDRAWN', label: 'Đã rút' },
  { value: '', label: 'Tất cả' },
];

const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
};

/** "2026-12-20T23:59:00" -> "2026-12-20T23:59" cho ô datetime-local */
const toInputDateTime = (value) => (value ? String(value).slice(0, 16) : '');

const initialOf = (user) => (user.fullName || user.username || user.email || 'U').trim().slice(0, 1).toUpperCase();

function Identity({ user }) {
  return (
    <div className="adm-mod-identity">
      {user.avatar ? <img className="adm-mod-avatar" src={user.avatar} alt="" /> : <span className="adm-mod-avatar">{initialOf(user)}</span>}
      <div>
        <strong>{user.fullName || user.username || `Người dùng #${user.id}`}</strong>
        <small>{user.username ? `@${user.username}` : '—'} · {user.email}</small>
      </div>
    </div>
  );
}

function StatusBadge({ item }) {
  const expired = item.status === 'PUBLISHED' && !item.accepting;
  const info = expired ? { label: 'Hết hạn nộp', tone: 'warning' } : STATUS[item.status] || STATUS.DRAFT;
  return <span className={`portal-status ${info.tone}`}>{info.label}</span>;
}

// ---------------------------------------------------------------------------
// Tạo / sửa bài tuyển
// ---------------------------------------------------------------------------

const EMPTY_FORM = { title: '', summary: '', content: '', coverImageUrl: '', slots: '', deadline: '' };

function EditorModal({ editing, onClose, onSaved }) {
  const isNew = !editing?.id;
  const [form, setForm] = useState(() => (isNew ? EMPTY_FORM : {
    title: editing.title || '',
    summary: editing.summary || '',
    content: editing.content || '',
    coverImageUrl: editing.coverImageUrl || '',
    slots: editing.slots ?? '',
    deadline: toInputDateTime(editing.deadline),
  }));
  const [busy, setBusy] = useState('');       // '' | 'draft' | 'publish' | 'save'
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const uploadCover = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Ảnh bìa phải là tệp ảnh.'); return; }
    setUploading(true); setError('');
    try {
      const url = await adminApi.uploadImage(file);
      if (!/^https:\/\//i.test(url)) throw new Error('URL ảnh không hợp lệ.');
      setForm((f) => ({ ...f, coverImageUrl: url }));
    } catch (err) {
      setError(getApiError(err, 'Không tải được ảnh bìa.'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (mode) => {
    if (busy) return;
    if (!form.title.trim()) { setError('Vui lòng nhập tiêu đề.'); return; }
    if (!form.content.trim()) { setError('Vui lòng nhập nội dung bài tuyển.'); return; }
    if (mode === 'publish' && !window.confirm('Đăng bài tuyển? Mọi người dùng sẽ nhận được thông báo (chỉ gửi một lần).')) return;

    const body = {
      title: form.title.trim(),
      summary: form.summary.trim() || null,
      content: form.content.trim(),
      coverImageUrl: form.coverImageUrl || null,
      slots: form.slots === '' ? null : Number(form.slots),
      deadline: form.deadline || null,
      publish: mode === 'publish',
    };
    setBusy(mode); setError('');
    try {
      const saved = isNew ? await adminApi.createRecruitment(body) : await adminApi.updateRecruitment(editing.id, body);
      onSaved(saved, mode);
    } catch (err) {
      setError(getApiError(err, 'Không lưu được bài tuyển.'));
    } finally {
      setBusy('');
    }
  };

  const footer = isNew ? (
    <>
      <button type="button" className="portal-secondary-button" onClick={onClose} disabled={Boolean(busy)}>Hủy</button>
      <button type="button" className="portal-secondary-button" onClick={() => submit('draft')} disabled={Boolean(busy) || uploading}>
        {busy === 'draft' ? <LoaderCircle className="portal-spin" size={16} /> : <Pencil size={16} />} Lưu nháp
      </button>
      <button type="button" className="portal-primary-button" onClick={() => submit('publish')} disabled={Boolean(busy) || uploading}>
        {busy === 'publish' ? <LoaderCircle className="portal-spin" size={16} /> : <Send size={16} />} Đăng và thông báo
      </button>
    </>
  ) : (
    <>
      <button type="button" className="portal-secondary-button" onClick={onClose} disabled={Boolean(busy)}>Hủy</button>
      <button type="button" className="portal-primary-button" onClick={() => submit('save')} disabled={Boolean(busy) || uploading}>
        {busy === 'save' ? <LoaderCircle className="portal-spin" size={16} /> : <Check size={16} />} Lưu thay đổi
      </button>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      busy={Boolean(busy)}
      width={760}
      title={isNew ? 'Tạo bài tuyển kiểm duyệt viên' : 'Sửa bài tuyển'}
      description="Nội dung hiển thị dạng văn bản thuần, giữ nguyên xuống dòng."
      footer={footer}
    >
      {error && <div className="portal-alert error" role="alert">{error}</div>}
      <div className="portal-form-grid">
        <label className="portal-field full">
          <span>Tiêu đề *</span>
          <input value={form.title} onChange={set('title')} maxLength={MAX_TITLE} placeholder="VD: Tuyển kiểm duyệt viên cộng đồng đợt 1" />
        </label>
        <label className="portal-field full">
          <span>Mô tả ngắn (hiện trên banner và thông báo)</span>
          <input value={form.summary} onChange={set('summary')} maxLength={MAX_SUMMARY} placeholder="VD: Cùng giữ cộng đồng du lịch sạch và an toàn" />
        </label>
        <label className="portal-field full">
          <span>Nội dung *</span>
          <textarea
            value={form.content}
            onChange={set('content')}
            maxLength={MAX_CONTENT}
            rows={9}
            placeholder={'Công việc, yêu cầu, quyền lợi, thời gian làm việc...'}
          />
          <small className="adm-rc-counter">{form.content.length.toLocaleString('vi-VN')}/{MAX_CONTENT.toLocaleString('vi-VN')}</small>
        </label>
        <label className="portal-field">
          <span>Số lượng cần tuyển (để trống = không giới hạn)</span>
          <input type="number" min={1} max={1000} value={form.slots} onChange={set('slots')} />
        </label>
        <label className="portal-field">
          <span>Hạn nộp đơn (để trống = không có hạn)</span>
          <input type="datetime-local" value={form.deadline} onChange={set('deadline')} />
        </label>
        <div className="portal-field full">
          <span>Ảnh bìa</span>
          <div className="adm-rc-cover">
            {form.coverImageUrl && <img src={form.coverImageUrl} alt="Ảnh bìa" />}
            <label className="portal-secondary-button" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
              {uploading ? <LoaderCircle className="portal-spin" size={16} /> : <ImagePlus size={16} />}
              {form.coverImageUrl ? 'Đổi ảnh' : 'Tải ảnh lên'}
              <input type="file" accept="image/*" hidden onChange={uploadCover} disabled={uploading} />
            </label>
            {form.coverImageUrl && (
              <button type="button" className="portal-ghost-button" onClick={() => setForm((f) => ({ ...f, coverImageUrl: '' }))}>
                <X size={16} /> Bỏ ảnh
              </button>
            )}
          </div>
        </div>
      </div>
      {isNew && (
        <p className="portal-form-hint">
          "Đăng và thông báo" sẽ gửi thông báo tới mọi người dùng thường đang hoạt động. Thông báo chỉ gửi ở lần đăng đầu tiên.
        </p>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Đơn ứng tuyển của một bài tuyển
// ---------------------------------------------------------------------------

function ApplicationCard({ app, onReviewed }) {
  const [mode, setMode] = useState('');   // '' | 'approve' | 'reject'
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const status = APP_STATUS[app.status] || APP_STATUS.PENDING;
  const pending = app.status === 'PENDING';

  const submit = async () => {
    if (busy) return;
    if (mode === 'reject' && !note.trim()) { setError('Vui lòng nhập lý do từ chối.'); return; }
    setBusy(true); setError('');
    try {
      const updated = mode === 'approve'
        ? await adminApi.approveModeratorApplication(app.id, note.trim())
        : await adminApi.rejectModeratorApplication(app.id, note.trim());
      setMode(''); setNote('');
      onReviewed(updated, mode);
    } catch (err) {
      setError(getApiError(err, mode === 'approve' ? 'Không duyệt được đơn.' : 'Không từ chối được đơn.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="adm-rc-app">
      <div className="adm-rc-app-head">
        <Identity user={app.applicant} />
        <span className={`portal-status ${status.tone}`}>{status.label}</span>
      </div>
      <div className="adm-rc-app-meta">
        <span>Nộp lúc {formatDateTime(app.submittedAt)}</span>
        {app.weeklyHours && <span>{app.weeklyHours} giờ/tuần</span>}
        {app.contactPhone && <span>SĐT: {app.contactPhone}</span>}
        <span>Tham gia từ {formatDateTime(app.applicant.joinedAt)}</span>
        {app.applicant.role !== 'ROLE_TRAVELLER' && <span className="adm-rc-pending">Hiện là {app.applicant.role}</span>}
      </div>
      <h4>Lý do ứng tuyển</h4>
      <p>{app.motivation}</p>
      {app.experience && (<><h4>Kinh nghiệm</h4><p>{app.experience}</p></>)}
      {app.adminNote && !pending && (
        <div className="adm-rc-app-note">
          {app.status === 'REJECTED' ? 'Lý do từ chối' : 'Ghi chú'}: {app.adminNote}
          {app.reviewedByName && ` · ${app.reviewedByName}`}{app.reviewedAt && ` · ${formatDateTime(app.reviewedAt)}`}
        </div>
      )}

      {pending && (
        <div className="adm-rc-review">
          {mode && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              placeholder={mode === 'reject' ? 'Lý do từ chối (người ứng tuyển sẽ thấy) *' : 'Ghi chú (không bắt buộc)'}
              autoFocus
            />
          )}
          {error && <div className="portal-alert error" role="alert">{error}</div>}
          <div className="adm-rc-review-actions">
            {mode ? (
              <>
                <button type="button" className="portal-secondary-button" onClick={() => { setMode(''); setNote(''); setError(''); }} disabled={busy}>Hủy</button>
                <button type="button" className={mode === 'approve' ? 'portal-primary-button' : 'portal-primary-button adm-mod-danger'} onClick={submit} disabled={busy}>
                  {busy ? <LoaderCircle className="portal-spin" size={16} /> : mode === 'approve' ? <UserCheck size={16} /> : <X size={16} />}
                  {mode === 'approve' ? 'Xác nhận duyệt và cấp quyền' : 'Xác nhận từ chối'}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="portal-small-button danger adm-mod-wide" onClick={() => setMode('reject')}>
                  <X size={15} /> Từ chối
                </button>
                <button type="button" className="portal-small-button accent adm-mod-wide" onClick={() => setMode('approve')}>
                  <UserCheck size={15} /> Duyệt
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

function ApplicationsModal({ recruitment, onClose, onChanged }) {
  const [tab, setTab] = useState(recruitment.pendingCount > 0 ? 'PENDING' : '');
  const apps = useAsyncData(() => adminApi.getRecruitmentApplications(recruitment.id, tab), `apps|${recruitment.id}|${tab}`);
  const [notice, setNotice] = useState('');
  const rows = apps.data || [];

  const handleReviewed = (updated, mode) => {
    const name = updated.applicant.fullName || updated.applicant.username || updated.applicant.email;
    setNotice(mode === 'approve'
      ? `Đã duyệt và cấp quyền kiểm duyệt cho ${name}. Hệ thống đã gửi thông báo và email cho người này.`
      : `Đã từ chối đơn của ${name}. Hệ thống đã gửi thông báo và email kèm lý do cho người này.`);
    apps.reload();
    onChanged();
    refreshPortalCounts();
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={820}
      title={`Đơn ứng tuyển: ${recruitment.title}`}
      description={recruitment.slots
        ? `Đã nhận ${recruitment.approvedCount}/${recruitment.slots} kiểm duyệt viên.`
        : `Đã nhận ${recruitment.approvedCount} kiểm duyệt viên.`}
    >
      <div className="adm-rc-tabs" role="group" aria-label="Lọc theo trạng thái">
        {APP_TABS.map((t) => (
          <button key={t.value || 'all'} type="button" className="adm-rc-tab" aria-pressed={tab === t.value} onClick={() => setTab(t.value)}>
            {t.label}
          </button>
        ))}
      </div>
      {notice && <div className="portal-alert success" role="status"><Check size={16} />{notice}</div>}
      {apps.loading && !apps.data ? (
        <div className="portal-empty"><LoaderCircle className="portal-spin" size={22} />Đang tải đơn...</div>
      ) : apps.error && !apps.data ? (
        <div className="portal-empty"><strong>Không tải được đơn</strong><span>{apps.error}</span>
          <button type="button" className="portal-secondary-button" onClick={apps.reload}>Thử lại</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="portal-empty"><div className="portal-empty-icon"><Inbox size={22} /></div><strong>Không có đơn nào</strong></div>
      ) : (
        <div className="adm-rc-apps">
          {rows.map((app) => <ApplicationCard key={`${app.id}-${app.status}`} app={app} onReviewed={handleReviewed} />)}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Trang
// ---------------------------------------------------------------------------

export default function AdminRecruitments() {
  const list = useAsyncData(() => adminApi.getRecruitments(), 'recruitments');
  const [editing, setEditing] = useState(null);         // null | {} (tạo mới) | bài đang sửa
  const [viewing, setViewing] = useState(null);         // bài đang xem đơn
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const rows = list.data || [];

  const replaceRow = (updated) => {
    list.setData((list.data || []).some((r) => r.id === updated.id)
      ? (list.data || []).map((r) => (r.id === updated.id ? updated : r))
      : [updated, ...(list.data || [])]);
  };

  const act = async (item, action) => {
    if (busyId) return;
    const confirmText = {
      publish: item.publishedAt
        ? 'Hiển thị lại bài tuyển? (Không gửi lại thông báo.)'
        : 'Đăng bài tuyển? Mọi người dùng sẽ nhận được thông báo (chỉ gửi một lần).',
      hide: 'Tạm ẩn bài tuyển? Người dùng sẽ không xem được và không nộp đơn được. Các đơn đã nộp vẫn được giữ.',
      close: 'Đóng nhận đơn? Bài vẫn hiển thị nhưng người dùng không nộp đơn mới được.',
      delete: 'Xóa bài nháp này?',
    }[action];
    if (confirmText && !window.confirm(confirmText)) return;

    setBusyId(item.id); setError(''); setNotice('');
    try {
      if (action === 'delete') {
        await adminApi.deleteRecruitment(item.id);
        list.setData((list.data || []).filter((r) => r.id !== item.id));
        setNotice('Đã xóa bài nháp.');
      } else if (action === 'feature' || action === 'unfeature') {
        replaceRow(await adminApi.setRecruitmentFeatured(item.id, action === 'feature'));
        setNotice(action === 'feature'
          ? 'Đã bật ưu tiên: bài sẽ hiện thành banner ở trang chủ và Cộng đồng (banner lấy bài ưu tiên mới nhất).'
          : 'Đã tắt ưu tiên.');
      } else {
        const status = { publish: 'PUBLISHED', hide: 'HIDDEN', close: 'CLOSED' }[action];
        const updated = await adminApi.setRecruitmentStatus(item.id, status);
        replaceRow(updated);
        setNotice({
          publish: item.publishedAt ? 'Đã hiển thị lại bài tuyển.' : 'Đã đăng bài tuyển và gửi thông báo tới người dùng.',
          hide: 'Đã tạm ẩn bài tuyển.',
          close: 'Đã đóng nhận đơn.',
        }[action]);
      }
    } catch (err) {
      setError(getApiError(err, 'Thao tác không thành công.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleSaved = (saved, mode) => {
    replaceRow(saved);
    setEditing(null);
    setNotice(mode === 'publish'
      ? 'Đã đăng bài tuyển và gửi thông báo tới người dùng.'
      : mode === 'draft' ? 'Đã lưu nháp.' : 'Đã lưu thay đổi.');
  };

  return (
    <div className="portal-page">
      <div className="portal-page-heading">
        <div>
          <div className="portal-eyebrow">PHÂN QUYỀN</div>
          <h1>Tuyển kiểm duyệt viên</h1>
          <p>Đăng bài tuyển để người dùng ứng tuyển. Duyệt đơn sẽ cấp quyền kiểm duyệt ngay cho người nộp. Bài ưu tiên hiện thành banner ở trang chủ và Cộng đồng.</p>
        </div>
        <div className="adm-rc-actions">
          <button type="button" className="portal-secondary-button" onClick={list.reload} disabled={list.loading}>
            <RefreshCw size={16} /> Làm mới
          </button>
          <button type="button" className="portal-primary-button" onClick={() => setEditing({})}>
            <Plus size={16} /> Tạo bài tuyển
          </button>
        </div>
      </div>

      {error && <div className="portal-alert error" role="alert">{error}</div>}
      {notice && <div className="portal-alert success" role="status"><Check size={16} />{notice}</div>}

      <section className="portal-panel portal-table-panel">
        <div className="portal-table-heading">
          <div>
            <h2>Bài tuyển</h2>
            <p>{list.data ? `${rows.length} bài` : 'Đang tải…'}</p>
          </div>
        </div>
        {list.loading && !list.data ? (
          <div className="portal-empty"><LoaderCircle className="portal-spin" size={24} />Đang tải danh sách...</div>
        ) : list.error && !list.data ? (
          <div className="portal-empty"><strong>Không tải được danh sách</strong><span>{list.error}</span>
            <button type="button" className="portal-secondary-button" onClick={list.reload}>Thử lại</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="portal-empty">
            <div className="portal-empty-icon"><Megaphone size={24} /></div>
            <strong>Chưa có bài tuyển nào</strong>
            <span>Tạo bài tuyển đầu tiên để người dùng ứng tuyển làm kiểm duyệt viên.</span>
          </div>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>Bài tuyển</th><th>Hạn nộp</th><th>Đơn ứng tuyển</th><th>Thao tác</th></tr></thead>
              <tbody>
                {rows.map((item) => {
                  const busy = busyId === item.id;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="adm-rc-title">
                          {item.coverImageUrl ? <img className="adm-rc-thumb" src={item.coverImageUrl} alt="" /> : <span className="adm-rc-thumb" />}
                          <div>
                            <strong>{item.title}</strong>
                            {item.summary && <small>{item.summary}</small>}
                            <div className="adm-rc-badges">
                              <StatusBadge item={item} />
                              {item.featured && <span className="adm-rc-featured"><Star size={11} /> Ưu tiên</span>}
                            </div>
                            <small>{item.publishedAt ? `Đăng lần đầu ${formatDateTime(item.publishedAt)}` : `Tạo ${formatDateTime(item.createdAt)}`}{item.createdByName ? ` · ${item.createdByName}` : ''}</small>
                          </div>
                        </div>
                      </td>
                      <td>{item.deadline ? formatDateTime(item.deadline) : 'Không có hạn'}</td>
                      <td>
                        <div className="adm-rc-count">
                          <span>Đã nhận <b>{item.approvedCount}{item.slots ? `/${item.slots}` : ''}</b></span>
                          {item.pendingCount > 0 && <span className="adm-rc-pending">{item.pendingCount} đơn chờ xét</span>}
                          <small>{item.totalCount} đơn</small>
                        </div>
                      </td>
                      <td>
                        <div className="adm-rc-actions">
                          {item.status !== 'DRAFT' && (
                            <button type="button" className="portal-small-button adm-mod-wide" onClick={() => setViewing(item)}>
                              <Inbox size={15} /> Đơn{item.pendingCount > 0 ? ` (${item.pendingCount})` : ''}
                            </button>
                          )}
                          <button type="button" className="portal-small-button adm-mod-wide" onClick={() => setEditing(item)} disabled={busy}>
                            <Pencil size={15} /> Sửa
                          </button>
                          {item.status !== 'PUBLISHED' && (
                            <button type="button" className="portal-small-button accent adm-mod-wide" onClick={() => act(item, 'publish')} disabled={busy}>
                              {item.status === 'DRAFT' ? <><Send size={15} /> Đăng</> : <><Eye size={15} /> {item.status === 'CLOSED' ? 'Mở lại' : 'Hiện lại'}</>}
                            </button>
                          )}
                          {item.status === 'PUBLISHED' && (
                            <button type="button" className="portal-small-button adm-mod-wide" onClick={() => act(item, item.featured ? 'unfeature' : 'feature')} disabled={busy}>
                              {item.featured ? <><StarOff size={15} /> Bỏ ưu tiên</> : <><Star size={15} /> Ưu tiên</>}
                            </button>
                          )}
                          {item.status === 'PUBLISHED' && (
                            <button type="button" className="portal-small-button adm-mod-wide" onClick={() => act(item, 'hide')} disabled={busy}>
                              <EyeOff size={15} /> Tạm ẩn
                            </button>
                          )}
                          {(item.status === 'PUBLISHED' || item.status === 'HIDDEN') && (
                            <button type="button" className="portal-small-button adm-mod-wide" onClick={() => act(item, 'close')} disabled={busy}>
                              <Lock size={15} /> Đóng nhận đơn
                            </button>
                          )}
                          {item.status === 'DRAFT' && (
                            <button type="button" className="portal-small-button danger adm-mod-wide" onClick={() => act(item, 'delete')} disabled={busy}>
                              <Trash2 size={15} /> Xóa
                            </button>
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

      {editing && <EditorModal editing={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
      {viewing && (
        <ApplicationsModal
          recruitment={rows.find((r) => r.id === viewing.id) || viewing}
          onClose={() => setViewing(null)}
          onChanged={list.reload}
        />
      )}
    </div>
  );
}
