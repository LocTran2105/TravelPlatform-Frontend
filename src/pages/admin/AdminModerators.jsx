import { useEffect, useState } from 'react';
import { Check, LoaderCircle, RefreshCw, Search, ShieldAlert, UserMinus, UserPlus, X } from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import { getApiError } from '../../api/axiosClient';
import useAsyncData from '../../utils/useAsyncData';
import '../../styles/admin-moderators.css';

const MIN_KEYWORD = 2;
const DEBOUNCE_MS = 300;

const initialOf = (user) => (user.fullName || user.username || user.email || 'U').trim().slice(0, 1).toUpperCase();
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : '—');

function Avatar({ user }) {
  return user.avatar
    ? <img className="adm-mod-avatar" src={user.avatar} alt="" />
    : <span className="adm-mod-avatar">{initialOf(user)}</span>;
}

function Identity({ user }) {
  return (
    <div className="adm-mod-identity">
      <Avatar user={user} />
      <div>
        <strong>{user.fullName || user.username || `Người dùng #${user.id}`}</strong>
        <small>{user.username ? `@${user.username}` : '—'} · {user.email}</small>
      </div>
    </div>
  );
}

function ConfirmDialog({ action, busy, onCancel, onConfirm }) {
  const { type, user } = action;
  const isGrant = type === 'grant';
  const name = user.fullName || user.username || user.email;

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape' && !busy) onCancel(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  return (
    <div className="portal-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
      <div className="portal-modal adm-mod-dialog" role="dialog" aria-modal="true" aria-labelledby="adm-mod-dialog-title">
        <div className="portal-modal-header">
          <div>
            <div className="portal-eyebrow">{isGrant ? 'CẤP QUYỀN' : 'THU HỒI QUYỀN'}</div>
            <h2 id="adm-mod-dialog-title">{isGrant ? `Cấp quyền kiểm duyệt cho ${name}?` : `Thu hồi quyền kiểm duyệt của ${name}?`}</h2>
          </div>
        </div>
        <Identity user={user} />
        <p className="adm-mod-dialog-text">
          {isGrant
            ? 'Kiểm duyệt viên xử lý báo cáo: ẩn, khôi phục hoặc bỏ qua báo cáo với bài viết, bình luận và đánh giá địa điểm. Không có quyền xóa nội dung và không vào được trang quản trị.'
            : 'Tài khoản sẽ trở về người dùng thường và không còn truy cập được Khu kiểm duyệt. Lịch sử xử lý trước đây vẫn được giữ lại.'}
        </p>
        <div className="portal-modal-actions">
          <button type="button" className="portal-secondary-button" onClick={onCancel} disabled={busy}>Hủy</button>
          <button type="button" className={isGrant ? 'portal-primary-button' : 'portal-primary-button adm-mod-danger'} onClick={onConfirm} disabled={busy}>
            {busy ? <LoaderCircle className="portal-spin" size={16} /> : isGrant ? <UserPlus size={16} /> : <UserMinus size={16} />}
            {isGrant ? 'Cấp quyền' : 'Thu hồi quyền'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminModerators() {
  const [query, setQuery] = useState('');
  const [keyword, setKeyword] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Chỉ gọi API tìm kiếm sau khi người dùng ngừng gõ một lúc.
  useEffect(() => {
    const timer = setTimeout(() => setKeyword(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const moderators = useAsyncData(() => adminApi.getModerators(), 'moderators');
  const candidates = useAsyncData(
    () => (keyword.length >= MIN_KEYWORD ? adminApi.searchModeratorCandidates(keyword) : []),
    `candidates|${keyword}`
  );

  const typed = query.trim();
  const searching = typed.length >= MIN_KEYWORD && (typed !== keyword || candidates.loading);
  const tooShort = typed.length < MIN_KEYWORD;
  const candidateRows = tooShort || typed !== keyword ? [] : candidates.data || [];
  const moderatorRows = moderators.data || [];

  const refresh = () => { moderators.reload(); candidates.reload(); };

  const runAction = async () => {
    if (!confirm || busy) return;
    const { type, user } = confirm;
    const name = user.fullName || user.username || user.email;
    setBusy(true); setError(''); setNotice('');
    try {
      if (type === 'grant') await adminApi.grantModerator(user.id);
      else await adminApi.revokeModerator(user.id);
      setNotice(type === 'grant'
        ? `Đã cấp quyền kiểm duyệt cho ${name}. Họ cần tải lại trang (hoặc đăng nhập lại) để thấy Khu kiểm duyệt.`
        : `Đã thu hồi quyền kiểm duyệt của ${name}.`);
      setConfirm(null);
      refresh();
    } catch (err) {
      setError(getApiError(err, type === 'grant' ? 'Không cấp được quyền kiểm duyệt.' : 'Không thu hồi được quyền kiểm duyệt.'));
      setConfirm(null);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="portal-page">
      <div className="portal-page-heading">
        <div>
          <div className="portal-eyebrow">PHÂN QUYỀN</div>
          <h1>Kiểm duyệt viên</h1>
          <p>Cấp quyền cho người dùng xử lý báo cáo vi phạm nội dung cộng đồng. Mỗi tài khoản chỉ giữ một vai trò nên chỉ cấp được cho người dùng thường đang hoạt động.</p>
        </div>
        <button type="button" className="portal-secondary-button" onClick={refresh} disabled={moderators.loading}>
          <RefreshCw size={16} /> Làm mới
        </button>
      </div>

      {error && <div className="portal-alert error" role="alert">{error}</div>}
      {notice && <div className="portal-alert success" role="status"><Check size={16} />{notice}</div>}

      <section className="portal-panel">
        <h3>Cấp quyền kiểm duyệt</h3>
        <label className="portal-search adm-mod-search">
          <Search size={17} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo họ tên, tên đăng nhập hoặc email…"
            aria-label="Tìm người dùng để cấp quyền"
            maxLength={50}
          />
        </label>

        <div className="adm-mod-results" aria-live="polite">
          {tooShort ? (
            <p className="adm-mod-hint">Nhập ít nhất {MIN_KEYWORD} ký tự để tìm người dùng.</p>
          ) : searching ? (
            <p className="adm-mod-hint"><LoaderCircle className="portal-spin" size={15} /> Đang tìm…</p>
          ) : candidates.error ? (
            <p className="adm-mod-hint adm-mod-hint-error">{candidates.error}</p>
          ) : candidateRows.length === 0 ? (
            <p className="adm-mod-hint">Không có người dùng phù hợp. Chỉ hiển thị người dùng thường đang hoạt động (không gồm đối tác, quản trị viên và kiểm duyệt viên hiện tại).</p>
          ) : (
            <ul className="adm-mod-list">
              {candidateRows.map((user) => (
                <li key={user.id}>
                  <Identity user={user} />
                  <button type="button" className="portal-small-button accent adm-mod-wide" onClick={() => setConfirm({ type: 'grant', user })}>
                    <UserPlus size={15} /> Cấp quyền
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="portal-panel portal-table-panel">
        <div className="portal-table-heading">
          <div>
            <h2>Kiểm duyệt viên hiện tại</h2>
            <p>{moderators.data ? `${moderatorRows.length} tài khoản` : 'Đang tải danh sách…'}</p>
          </div>
        </div>
        {moderators.loading && !moderators.data ? (
          <div className="portal-empty"><LoaderCircle className="portal-spin" size={24} />Đang tải danh sách...</div>
        ) : moderators.error && !moderators.data ? (
          <div className="portal-empty"><strong>Không tải được danh sách</strong><span>{moderators.error}</span>
            <button type="button" className="portal-secondary-button" onClick={moderators.reload}>Thử lại</button>
          </div>
        ) : moderatorRows.length === 0 ? (
          <div className="portal-empty">
            <div className="portal-empty-icon"><ShieldAlert size={26} /></div>
            <strong>Chưa có kiểm duyệt viên nào</strong>
            <span>Tìm người dùng ở phần trên để cấp quyền kiểm duyệt.</span>
          </div>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead><tr><th>Người dùng</th><th>Trạng thái</th><th>Ngày tạo tài khoản</th><th>Thao tác</th></tr></thead>
              <tbody>
                {moderatorRows.map((user) => {
                  const active = String(user.status || '').toUpperCase() === 'ACTIVE';
                  return (
                    <tr key={user.id}>
                      <td><Identity user={user} /></td>
                      <td>
                        <span className={`portal-status ${active ? 'success' : 'danger'}`}>{active ? 'Hoạt động' : 'Bị khóa'}</span>
                        {!active && <small>Không dùng được quyền khi tài khoản bị khóa.</small>}
                      </td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>
                        <button type="button" className="portal-small-button danger adm-mod-wide" onClick={() => setConfirm({ type: 'revoke', user })} title="Thu hồi quyền kiểm duyệt">
                          <X size={15} /> Thu hồi
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {confirm && <ConfirmDialog action={confirm} busy={busy} onCancel={() => !busy && setConfirm(null)} onConfirm={runAction} />}
    </div>
  );
}
