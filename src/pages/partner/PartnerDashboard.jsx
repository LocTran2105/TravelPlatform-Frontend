import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, MapPinned, Plus, Store } from 'lucide-react';
import { getApiError } from '../../api/axiosClient';
import { partnerApi } from '../../api/partnerApi';

const numberText = (value) => Number(value || 0).toLocaleString('vi-VN');

export default function PartnerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    partnerApi.getDashboard()
      .then((result) => { if (active) setData(result); })
      .catch((err) => { if (active) setError(getApiError(err, 'Không tải được dữ liệu tổng quan.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const stats = [
    { label: 'Tổng địa điểm', value: data?.totalBusinesses, icon: Store, tone: 'blue' },
    { label: 'Chờ xác minh', value: data?.businessesPendingReview, icon: Clock3, tone: 'amber' },
    { label: 'Đang hiển thị', value: data?.publishedBusinesses, icon: CheckCircle2, tone: 'green' },
    { label: 'Yêu cầu chờ duyệt', value: data?.pendingSubmissions, icon: MapPinned, tone: 'violet' },
  ];

  return (
    <div className="portal-page">
      <div className="portal-page-heading">
        <div>
          <div className="portal-eyebrow">PARTNER WORKSPACE</div>
          <h1>Tổng quan</h1>
          <p>Quản lý và duy trì thông tin địa điểm để khách du lịch có thể lên kế hoạch chính xác hơn.</p>
        </div>
        <Link className="portal-primary-button" to="/partner/businesses?create=1">
          <Plus size={17} /> Thêm địa điểm
        </Link>
      </div>

      {error && <div className="portal-alert error">{error}</div>}

      <div className="portal-stat-grid">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <div className="portal-stat-card" key={label}>
            <div className={`portal-stat-icon ${tone}`}><Icon size={20} /></div>
            <div className="portal-stat-label">{label}</div>
            <div className="portal-stat-value">{loading ? '...' : numberText(value)}</div>
          </div>
        ))}
      </div>

      <section className="portal-panel portal-welcome-panel">
        <div className="portal-welcome-icon"><MapPinned size={24} /></div>
        <div className="portal-welcome-copy">
          <h2>Cùng xây dựng dữ liệu du lịch đáng tin cậy</h2>
          <p>Cập nhật vị trí, thông tin liên hệ, mô tả, mức giá tham khảo và giờ hoạt động. Thông tin chỉ được đưa vào nguồn dữ liệu công khai sau khi được Admin xét duyệt.</p>
          <Link className="portal-inline-link" to="/partner/businesses">Quản lý địa điểm của tôi <ArrowRight size={16} /></Link>
        </div>
      </section>

      <div className="portal-info-grid">
        <section className="portal-panel">
          <h3>Quy trình cập nhật dữ liệu</h3>
          <ol className="portal-steps">
            <li><span>1</span><div><strong>Khai báo địa điểm</strong><small>Nhập tên, loại hình, địa chỉ và thông tin cơ bản.</small></div></li>
            <li><span>2</span><div><strong>Gửi Admin xét duyệt</strong><small>Kiểm tra lại nội dung trước khi gửi yêu cầu xác minh.</small></div></li>
            <li><span>3</span><div><strong>Theo dõi kết quả</strong><small>Chỉnh sửa theo góp ý nếu hồ sơ bị yêu cầu cập nhật.</small></div></li>
          </ol>
        </section>
        <section className="portal-panel portal-note-panel">
          <div className="portal-note-icon"><Clock3 size={19} /></div>
          <div>
            <h3>Thông tin giá cần có thời hạn</h3>
            <p>Khi khai báo giá tham khảo, hãy ghi rõ đơn vị tính và thời gian áp dụng. Giá cũ cần được cập nhật để tránh gây nhầm lẫn cho khách du lịch.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
