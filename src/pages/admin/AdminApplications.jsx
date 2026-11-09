import { useEffect, useState } from 'react';
import { Check, ClipboardCheck, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import { getApiError } from '../../api/axiosClient';

const listOf = (data) => Array.isArray(data) ? data : data?.content || data?.items || data?.data || [];
const statusMeta = (status) => {
  switch (String(status || '').toUpperCase()) {
    case 'APPROVED': return ['Đã duyệt', 'success'];
    case 'REJECTED': return ['Từ chối', 'danger'];
    default: return ['Chờ duyệt', 'warning'];
  }
};

export default function AdminApplications() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { setRows(listOf(await adminApi.getApplications(status ? { status } : {}))); }
    catch (err) { setError(getApiError(err, 'Không tải được danh sách đơn đăng ký Partner.')); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [status]);

  const review = async (application, action) => {
    let note = '';
    if (action === 'reject') {
      note = window.prompt('Nhập lý do từ chối đơn đăng ký:') || '';
      if (!note.trim()) return;
    } else {
      note = window.prompt('Ghi chú cho hồ sơ (không bắt buộc):') || '';
      if (!window.confirm(`Duyệt đơn đăng ký của ${application.displayName || application.contactPerson || 'đối tác này'}?`)) return;
    }
    setBusyId(application.id); setError(''); setNotice('');
    try {
      if (action === 'approve') await adminApi.approveApplication(application.id, note);
      else await adminApi.rejectApplication(application.id, note);
      setNotice(action === 'approve' ? 'Đã phê duyệt đơn đăng ký Partner.' : 'Đã từ chối đơn đăng ký.');
      await load();
    } catch (err) { setError(getApiError(err, 'Không xử lý được đơn đăng ký.')); }
    finally { setBusyId(null); }
  };

  return (
    <div className="portal-page">
      <div className="portal-page-heading"><div><div className="portal-eyebrow">PARTNER ONBOARDING</div><h1>Đơn đăng ký Partner</h1><p>Xác minh đơn vị cung cấp thông tin trước khi tài khoản được sử dụng Partner Portal.</p></div><button className="portal-secondary-button" onClick={load} disabled={loading}><RefreshCw size={16} /> Làm mới</button></div>
      {error && <div className="portal-alert error">{error}</div>}{notice && <div className="portal-alert success"><Check size={16} />{notice}</div>}
      <div className="portal-filter-row"><label>Trạng thái</label><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="PENDING">Chờ duyệt</option><option value="APPROVED">Đã duyệt</option><option value="REJECTED">Đã từ chối</option><option value="">Tất cả</option></select><span>{rows.length} hồ sơ</span></div>
      <section className="portal-panel portal-table-panel">
        {loading ? <div className="portal-empty"><LoaderCircle className="portal-spin" size={24} />Đang tải hồ sơ...</div> : rows.length === 0 ? <div className="portal-empty"><div className="portal-empty-icon"><ClipboardCheck size={26} /></div><strong>Không có đơn đăng ký</strong><span>Danh sách sẽ hiển thị các hồ sơ phù hợp với bộ lọc.</span></div> : (
          <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Đơn vị / Người liên hệ</th><th>Thông tin liên hệ</th><th>Địa chỉ</th><th>Ngày gửi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
            {rows.map((row) => { const [label, tone] = statusMeta(row.verificationStatus || row.status); return <tr key={row.id}><td><strong>{row.displayName || row.legalName || `Đơn #${row.id}`}</strong><small>{row.contactPerson || row.userFullName || row.user?.fullName || 'Chưa có người liên hệ'}</small></td><td>{row.contactEmail || row.email || row.userEmail || row.user?.email || '—'}<small>{row.contactPhone || row.phoneNumber || '—'}</small></td><td>{row.businessAddress || '—'}</td><td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString('vi-VN') : '—'}</td><td><span className={`portal-status ${tone}`}>{label}</span></td><td><div className="portal-row-actions">{String(row.verificationStatus || row.status).toUpperCase() === 'PENDING' && <><button className="portal-small-button accent" disabled={busyId === row.id} onClick={() => review(row, 'approve')} title="Duyệt"><Check size={15} /></button><button className="portal-small-button danger" disabled={busyId === row.id} onClick={() => review(row, 'reject')} title="Từ chối"><X size={15} /></button></>}</div></td></tr>; })}
          </tbody></table></div>
        )}
      </section>
    </div>
  );
}
