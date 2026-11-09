import { useEffect, useState } from 'react';
import { Check, FileCheck2, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { adminApi } from '../../api/adminApi';
import { getApiError } from '../../api/axiosClient';

const listOf = (data) => Array.isArray(data) ? data : data?.content || data?.items || data?.data || [];
const statusMeta = (status) => String(status || '').toUpperCase() === 'APPROVED'
  ? ['Đã duyệt', 'success']
  : String(status || '').toUpperCase() === 'REJECTED'
    ? ['Từ chối', 'danger']
    : ['Chờ duyệt', 'warning'];

export default function AdminSubmissions() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { setRows(listOf(await adminApi.getBusinessSubmissions(status ? { status } : {}))); }
    catch (err) { setError(getApiError(err, 'Không tải được hàng chờ xác minh địa điểm.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [status]);

  const review = async (row, action) => {
    let note = '';
    if (action === 'reject') {
      note = window.prompt('Nhập lý do từ chối / thông tin cần đối tác cập nhật:') || '';
      if (!note.trim()) return;
    } else if (!window.confirm(`Xác minh và công khai địa điểm "${row.businessName || row.business?.name || `#${row.businessId || row.id}`}"?`)) {
      return;
    }
    setBusyId(row.id); setError(''); setNotice('');
    try {
      if (action === 'approve') await adminApi.approveBusinessSubmission(row.id, note);
      else await adminApi.rejectBusinessSubmission(row.id, note);
      setNotice(action === 'approve' ? 'Đã phê duyệt thông tin địa điểm.' : 'Đã từ chối và gửi phản hồi cho Partner.');
      await load();
    } catch (err) { setError(getApiError(err, 'Không xử lý được yêu cầu xác minh.')); }
    finally { setBusyId(null); }
  };

  return (
    <div className="portal-page">
      <div className="portal-page-heading"><div><div className="portal-eyebrow">PLACE VERIFICATION</div><h1>Duyệt thông tin địa điểm</h1><p>Kiểm tra nội dung Partner gửi lên trước khi đưa vào nguồn dữ liệu công khai.</p></div><button className="portal-secondary-button" onClick={load} disabled={loading}><RefreshCw size={16} /> Làm mới</button></div>
      {error && <div className="portal-alert error">{error}</div>}{notice && <div className="portal-alert success"><Check size={16} />{notice}</div>}
      <div className="portal-review-guidance"><strong>Checklist xác minh:</strong><span>Tên và loại địa điểm</span><span>Địa chỉ và tọa độ</span><span>Thông tin liên hệ</span><span>Giá / thời gian áp dụng (nếu có)</span></div>
      <div className="portal-filter-row"><label>Trạng thái</label><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="PENDING">Chờ duyệt</option><option value="APPROVED">Đã duyệt</option><option value="REJECTED">Đã từ chối</option><option value="">Tất cả</option></select><span>{rows.length} yêu cầu</span></div>
      <section className="portal-panel portal-table-panel">
        {loading ? <div className="portal-empty"><LoaderCircle className="portal-spin" size={24} />Đang tải yêu cầu...</div> : rows.length === 0 ? <div className="portal-empty"><div className="portal-empty-icon"><FileCheck2 size={26} /></div><strong>Không có yêu cầu xét duyệt</strong><span>Chưa có địa điểm nào cần xử lý theo bộ lọc.</span></div> : (
          <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Địa điểm</th><th>Partner</th><th>Loại yêu cầu</th><th>Ngày gửi</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
            {rows.map((row) => { const [label, tone] = statusMeta(row.status); return <tr key={row.id}><td><strong>{row.businessName || row.business?.name || `Địa điểm #${row.businessId || '—'}`}</strong><small>Submission #{row.id}</small></td><td>{row.partnerName || row.partner?.displayName || row.submittedByName || '—'}</td><td>{row.submissionType || row.targetType || row.actionType || 'BUSINESS'}</td><td>{row.submittedAt || row.createdAt ? new Date(row.submittedAt || row.createdAt).toLocaleString('vi-VN') : '—'}</td><td><span className={`portal-status ${tone}`}>{label}</span></td><td><div className="portal-row-actions">{String(row.status || '').toUpperCase() === 'PENDING' && <><button className="portal-small-button accent" disabled={busyId === row.id} onClick={() => review(row, 'approve')} title="Phê duyệt"><Check size={15} /></button><button className="portal-small-button danger" disabled={busyId === row.id} onClick={() => review(row, 'reject')} title="Từ chối"><X size={15} /></button></>}</div></td></tr>; })}
          </tbody></table></div>
        )}
      </section>
    </div>
  );
}
