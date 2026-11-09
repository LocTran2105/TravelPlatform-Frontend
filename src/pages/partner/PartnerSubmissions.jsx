import { useEffect, useState } from 'react';
import { Clock3, FileClock, LoaderCircle, RefreshCw } from 'lucide-react';
import { getApiError } from '../../api/axiosClient';
import { partnerApi } from '../../api/partnerApi';

const listOf = (data) => Array.isArray(data) ? data : data?.content || data?.items || data?.data || [];
const statusMeta = (status) => {
  switch (String(status || '').toUpperCase()) {
    case 'APPROVED': return ['Đã duyệt', 'success'];
    case 'REJECTED': return ['Từ chối', 'danger'];
    case 'CANCELLED': return ['Đã hủy', 'neutral'];
    default: return ['Đang chờ duyệt', 'warning'];
  }
};

export default function PartnerSubmissions() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const businesses = listOf(await partnerApi.getBusinesses());
      const histories = await Promise.all(businesses.map(async (business) => {
        try {
          const submissions = listOf(await partnerApi.getSubmissions(business.id));
          return submissions.map((submission) => ({ ...submission, businessName: business.name }));
        } catch {
          return [];
        }
      }));
      setRows(histories.flat().sort((a, b) => new Date(b.submittedAt || b.createdAt || 0) - new Date(a.submittedAt || a.createdAt || 0)));
    } catch (err) {
      setError(getApiError(err, 'Không tải được lịch sử gửi duyệt.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="portal-page">
      <div className="portal-page-heading">
        <div><div className="portal-eyebrow">REVIEW TRACKING</div><h1>Lịch sử xét duyệt</h1><p>Theo dõi kết quả các yêu cầu gửi thông tin địa điểm đến Admin.</p></div>
        <button className="portal-secondary-button" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? 'portal-spin' : ''} /> Làm mới</button>
      </div>
      {error && <div className="portal-alert error">{error}</div>}
      <section className="portal-panel portal-table-panel">
        <div className="portal-table-heading"><div><h2>Các yêu cầu đã gửi</h2><p>{rows.length} yêu cầu</p></div></div>
        {loading ? <div className="portal-empty"><LoaderCircle className="portal-spin" size={24} />Đang tải lịch sử...</div> : rows.length === 0 ? (
          <div className="portal-empty"><div className="portal-empty-icon"><FileClock size={26} /></div><strong>Chưa có yêu cầu xét duyệt</strong><span>Hãy gửi một địa điểm từ trang “Địa điểm của tôi” để bắt đầu.</span></div>
        ) : (
          <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>Địa điểm</th><th>Loại dữ liệu</th><th>Ngày gửi</th><th>Trạng thái</th><th>Phản hồi Admin</th></tr></thead><tbody>
            {rows.map((row) => {
              const [label, tone] = statusMeta(row.status);
              return <tr key={row.id}><td><strong>{row.businessName || row.business?.name || `Địa điểm #${row.businessId || ''}`}</strong><small>Yêu cầu #{row.id}</small></td><td>{row.targetType || row.submissionType || 'BUSINESS'}</td><td>{row.submittedAt || row.createdAt ? new Date(row.submittedAt || row.createdAt).toLocaleString('vi-VN') : '—'}</td><td><span className={`portal-status ${tone}`}><Clock3 size={13} />{label}</span></td><td>{row.reviewNote || row.adminNote || 'Chưa có phản hồi'}</td></tr>;
            })}
          </tbody></table></div>
        )}
      </section>
    </div>
  );
}
