import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, ClipboardCheck, FileCheck2, RefreshCw, Users } from 'lucide-react';
import { getApiError } from '../../api/axiosClient';
import { adminApi } from '../../api/adminApi';

const firstValue = (data, keys) => {
  for (const key of keys) if (data?.[key] !== undefined && data?.[key] !== null) return data[key];
  return null;
};
const fmt = (value) => value === null ? '—' : Number(value || 0).toLocaleString('vi-VN');

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try { setData(await adminApi.getDashboard()); }
    catch (err) { setError(getApiError(err, 'Không tải được thống kê quản trị.')); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const stats = [
    { label: 'Tổng người dùng', value: firstValue(data, ['totalUsers', 'userCount']), icon: Users, tone: 'blue' },
    { label: 'Đơn Partner chờ duyệt', value: firstValue(data, ['pendingApplications', 'pendingPartnerApplications']), icon: ClipboardCheck, tone: 'amber' },
    { label: 'Tổng địa điểm', value: firstValue(data, ['totalBusinesses', 'businessCount']), icon: Building2, tone: 'violet' },
    { label: 'Yêu cầu địa điểm chờ duyệt', value: firstValue(data, ['pendingSubmissions', 'pendingBusinessSubmissions']), icon: FileCheck2, tone: 'green' },
  ];

  return (
    <div className="portal-page">
      <div className="portal-page-heading">
        <div><div className="portal-eyebrow">SYSTEM OVERVIEW</div><h1>Tổng quan quản trị</h1><p>Kiểm soát chất lượng dữ liệu địa điểm được cung cấp cho hệ thống du lịch.</p></div>
        <button className="portal-secondary-button" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? 'portal-spin' : ''} /> Làm mới</button>
      </div>
      {error && <div className="portal-alert error">{error}</div>}
      <div className="portal-stat-grid">
        {stats.map(({ label, value, icon: Icon, tone }) => <div className="portal-stat-card" key={label}><div className={`portal-stat-icon ${tone}`}><Icon size={20} /></div><div className="portal-stat-label">{label}</div><div className="portal-stat-value">{loading ? '...' : fmt(value)}</div></div>)}
      </div>
      <section className="portal-panel portal-welcome-panel">
        <div className="portal-welcome-icon"><FileCheck2 size={24} /></div>
        <div className="portal-welcome-copy"><h2>Ưu tiên xác minh dữ liệu du lịch</h2><p>Chỉ phê duyệt địa điểm khi tên, địa chỉ, tọa độ, thông tin liên hệ và dữ liệu giá/giờ hoạt động có cơ sở kiểm tra. Thông tin thiếu căn cứ nên được yêu cầu cập nhật thay vì tự suy đoán.</p><Link className="portal-inline-link" to="/admin/submissions">Mở hàng chờ duyệt địa điểm <span>→</span></Link></div>
      </section>
      <div className="portal-info-grid">
        <Link className="portal-action-card" to="/admin/applications"><div className="portal-action-icon"><ClipboardCheck size={21} /></div><div><strong>Duyệt đơn đăng ký Partner</strong><p>Xác minh thông tin đơn vị trước khi cấp quyền Partner.</p></div><span>→</span></Link>
        <Link className="portal-action-card" to="/admin/submissions"><div className="portal-action-icon"><Building2 size={21} /></div><div><strong>Kiểm duyệt địa điểm</strong><p>Kiểm tra và duyệt hồ sơ địa điểm do đối tác gửi lên.</p></div><span>→</span></Link>
      </div>
    </div>
  );
}
