import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Building2, ClipboardCheck, Flag, Inbox, MapPinned, RefreshCw } from 'lucide-react';
import { getApiError } from '../../api/axiosClient';
import { adminApi } from '../../api/adminApi';
import Button from '../../components/portal/Button';
import CountUp from '../../components/portal/CountUp';
import EmptyState from '../../components/portal/EmptyState';
import { Skeleton } from '../../components/portal/Skeleton';
import Sparkline from '../../components/portal/charts/Sparkline';
import ColumnChart from '../../components/portal/charts/ColumnChart';
import MiniMap from '../../components/portal/charts/MiniMap';
import { ageFrom, businessTypeLabel, formatNumber, greeting, shortDate } from '../../utils/portalFormat';

// Ba chỉ số chọn được: bấm ô số liệu để đổi biểu đồ cột (giống "pick a tile above to switch" trong video)
const METRICS = {
  submissions: { tone: 'sunset', title: 'Yêu cầu duyệt địa điểm', unit: 'yêu cầu' },
  applications: { tone: 'hydrangea', title: 'Đơn đăng ký đối tác', unit: 'đơn' },
  approvals: { tone: 'pine', title: 'Hồ sơ được duyệt', unit: 'hồ sơ' },
};

const readUser = () => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } };
const sum = (list, key) => list.reduce((total, item) => total + (Number(item[key]) || 0), 0);

function summarySentence(data) {
  const places = Number(data.pendingSubmissions) || 0;
  const partners = Number(data.pendingPartnerApplications) || 0;
  const oldest = data.queue?.[0];
  if (places + partners === 0) {
    return `Không có hồ sơ nào đang chờ. ${formatNumber(data.publishedBusinesses)} địa điểm đang hiển thị cho du khách.`;
  }
  const parts = [];
  if (places) parts.push(`${places} địa điểm`);
  if (partners) parts.push(`${partners} đơn đối tác`);
  const age = oldest ? `, hồ sơ cũ nhất đã chờ ${ageFrom(oldest.createdAt)}` : '';
  return `${parts.join(' và ')} đang chờ duyệt${age}.`;
}

function DashboardSkeleton() {
  return (
    <div className="portal-page" role="status" aria-label="Đang tải tổng quan">
      <div className="portal-panel dash-hero">
        <div className="dash-hero-copy" style={{ display: 'grid', gap: 14 }}>
          <Skeleton width="55%" height={34} />
          <Skeleton width="80%" height={16} />
          <Skeleton width="40%" height={40} radius={10} />
        </div>
        <Skeleton height="100%" style={{ minHeight: 220 }} radius={14} />
      </div>
      <div className="portal-stat-grid">
        {[0, 1, 2, 3].map((i) => (
          <div className="portal-stat-card" key={i} style={{ gap: 12 }}>
            <Skeleton width="60%" height={13} />
            <Skeleton width="35%" height={30} />
            <Skeleton width="100%" height={28} />
          </div>
        ))}
      </div>
      <div className="dash-grid-2">
        <div className="portal-panel"><Skeleton height={240} radius={12} /></div>
        <div className="portal-panel"><Skeleton height={240} radius={12} /></div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user] = useState(readUser);
  const [metric, setMetric] = useState('submissions');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await adminApi.getDashboard()); }
    catch (err) { setError(getApiError(err, 'Không tải được số liệu tổng quan.')); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- tải dữ liệu lần đầu
  useEffect(() => { load(); }, [load]);

  const activity = useMemo(() => data?.activity || [], [data]);
  const columns = useMemo(() => activity.map((day, i) => ({
    key: day.date,
    label: i === activity.length - 1 ? `Hôm nay, ${shortDate(day.date)}` : shortDate(day.date),
    axisLabel: i === activity.length - 1 ? 'Hôm nay' : (i % 2 === 0 ? shortDate(day.date) : ''),
    value: Number(day[metric]) || 0,
    details: [['Địa điểm', day.submissions], ['Đơn đối tác', day.applications], ['Đã duyệt', day.approvals]],
  })), [activity, metric]);

  if (!data && loading) return <DashboardSkeleton />;
  if (!data) {
    return (
      <div className="portal-page">
        <div className="portal-panel">
          <EmptyState icon={RefreshCw} title="Chưa tải được số liệu" action={<Button variant="primary" icon={RefreshCw} onClick={load}>Thử lại</Button>}>
            {error || 'Kiểm tra kết nối tới máy chủ rồi thử lại.'}
          </EmptyState>
        </div>
      </div>
    );
  }

  const mix = data.businessTypeMix || [];
  const mixMax = Math.max(1, ...mix.map((m) => m.count));
  const queue = data.queue || [];
  const name = user.fullName || user.displayName || '';

  const stats = [
    {
      metric: 'submissions', label: 'Địa điểm chờ duyệt', value: data.pendingSubmissions, icon: Building2, tone: 'sunset',
      note: `${formatNumber(sum(activity, 'submissions'))} yêu cầu nhận trong 14 ngày`,
      trend: activity.map((d) => d.submissions), trendLabel: 'Yêu cầu duyệt địa điểm mỗi ngày, 14 ngày qua',
    },
    {
      metric: 'applications', label: 'Đơn đối tác chờ duyệt', value: data.pendingPartnerApplications, icon: ClipboardCheck, tone: 'hydrangea',
      note: `${formatNumber(sum(activity, 'applications'))} đơn nhận trong 14 ngày`,
      trend: activity.map((d) => d.applications), trendLabel: 'Đơn đăng ký đối tác mỗi ngày, 14 ngày qua',
    },
    {
      metric: 'approvals', label: 'Địa điểm đang hiển thị', value: data.publishedBusinesses, icon: MapPinned, tone: 'pine',
      note: `trên tổng ${formatNumber(data.totalBusinesses)} địa điểm`,
      trend: activity.map((d) => d.approvals), trendLabel: 'Hồ sơ được duyệt mỗi ngày, 14 ngày qua',
    },
    {
      label: 'Báo cáo vi phạm chờ xử lý', value: data.pendingReports, icon: Flag, tone: 'rose',
      note: `${formatNumber(data.totalUsers)} tài khoản, ${formatNumber(data.lockedUsers)} đang bị khóa`,
    },
  ];

  return (
    <div className="portal-page" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity .2s' }}>
      {error && <div className="portal-alert error">{error}</div>}

      <section className="portal-panel dash-hero fx-border">
        <div className="fx-aurora" aria-hidden="true"><i /><i /><i /></div>
        <div className="dash-hero-copy">
          <h1>{greeting()}{name && name.length <= 18 ? `, ${name}` : null}</h1>
          <p>{summarySentence(data)}</p>
          <div className="portal-page-actions">
            <Button variant="primary" icon={Building2} to="/admin/submissions">Mở hàng chờ duyệt</Button>
            <Button variant="secondary" icon={ClipboardCheck} to="/admin/applications">Đơn đối tác</Button>
            <Button variant="ghost" icon={RefreshCw} onClick={load} loading={loading}>Làm mới</Button>
          </div>
        </div>
        <div className="dash-hero-map">
          <MiniMap points={data.mapPoints || []} onSelect={(p) => navigate(p.state === 'PENDING' ? '/admin/submissions' : '/admin/businesses')} />
          <div className="dash-legend">
            <span><i className="is-pending" />Đang chờ duyệt <b>{formatNumber((data.mapPoints || []).filter((p) => p.state === 'PENDING').length)}</b></span>
            <span><i />Đang hiển thị <b>{formatNumber((data.mapPoints || []).filter((p) => p.state === 'PUBLISHED').length)}</b></span>
          </div>
        </div>
      </section>

      <div className="portal-stat-grid">
        {stats.map(({ metric: key, label, value, icon: Icon, tone, note, trend, trendLabel }) => {
          const body = (
            <>
              <span className="dash-stat-top">
                <span className="portal-stat-label">{label}</span>
                <span className="portal-stat-icon"><Icon size={17} aria-hidden="true" /></span>
              </span>
              <span className="dash-stat-bottom">
                <span className="portal-stat-value dash-stat-value"><CountUp value={value} className="dash-proportional" /></span>
                {trend && <Sparkline values={trend} label={trendLabel} />}
              </span>
              <span className="dash-stat-note">{note}</span>
            </>
          );
          return key ? (
            <button type="button" key={label} className={`portal-stat-card dash-stat dash-tile tone-${tone}`}
              aria-pressed={metric === key} onClick={() => setMetric(key)} title="Xem biểu đồ của chỉ số này">
              {body}
            </button>
          ) : (
            <div className={`portal-stat-card dash-stat tone-${tone}`} key={label}>{body}</div>
          );
        })}
      </div>

      <div className="dash-grid-2">
        <section className="portal-panel">
          <div className="portal-panel-head">
            <div>
              <h2>{METRICS[metric].title}</h2>
              <p>Mỗi ngày trong 14 ngày qua. Bấm ô số liệu phía trên để đổi biểu đồ.</p>
            </div>
            <span className="dash-total"><CountUp value={sum(columns, 'value')} className="dash-proportional" /> {METRICS[metric].unit}</span>
          </div>
          <ColumnChart data={columns} tone={METRICS[metric].tone} valueLabel={METRICS[metric].title}
            caption={`${METRICS[metric].title} mỗi ngày trong 14 ngày qua`} />
        </section>

        <section className="portal-panel">
          <div className="portal-panel-head">
            <div>
              <h2>Cần xử lý</h2>
              <p>Hồ sơ chờ lâu nhất được xếp trước</p>
            </div>
          </div>
          {queue.length === 0 ? (
            <EmptyState icon={Inbox} title="Đã xử lý hết hồ sơ"
              action={<Button size="sm" to="/admin/businesses">Xem danh sách địa điểm</Button>}>
              Hồ sơ mới từ đối tác sẽ xuất hiện ở đây.
            </EmptyState>
          ) : (
            <ul className="dash-queue">
              {queue.map((item) => (
                <li key={`${item.type}-${item.id}`}>
                  <Link to={item.type === 'SUBMISSION' ? '/admin/submissions' : '/admin/applications'}>
                    <span className="dash-queue-icon">
                      {item.type === 'SUBMISSION' ? <Building2 size={16} /> : <ClipboardCheck size={16} />}
                    </span>
                    <span className="dash-queue-main">
                      <strong>{item.name || 'Chưa đặt tên'}</strong>
                      <small>{item.type === 'SUBMISSION' ? 'Duyệt địa điểm' : 'Đơn đăng ký đối tác'}</small>
                    </span>
                    <span className="dash-queue-age">{ageFrom(item.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="dash-grid-2 dash-grid-even">
        <section className="portal-panel">
          <div className="portal-panel-head">
            <div>
              <h2>Loại hình địa điểm</h2>
              <p>Số địa điểm theo loại hình đối tác đăng ký</p>
            </div>
          </div>
          {mix.length === 0 ? (
            <EmptyState icon={MapPinned} title="Chưa có địa điểm">Địa điểm do đối tác tạo sẽ được thống kê ở đây.</EmptyState>
          ) : (
            <ul className="dash-bars">
              {mix.map((m, i) => (
                <li key={m.type || 'none'}>
                  <span className="dash-bars-label">{businessTypeLabel(m.type)}</span>
                  <span className="dash-bars-track">
                    <motion.span className="dash-bars-fill" style={{ width: `${(m.count / mixMax) * 100}%`, transformOrigin: 'left' }}
                      initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, delay: 0.2 + i * 0.05 }} />
                  </span>
                  <b className="portal-tnum">{formatNumber(m.count)}</b>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="portal-panel">
          <div className="portal-panel-head">
            <div>
              <h2>Tài khoản</h2>
              <p>Người dùng theo vai trò và trạng thái</p>
            </div>
          </div>
          <dl className="dash-facts">
            <div><dt>Du khách</dt><dd className="portal-tnum">{formatNumber(data.totalTravellers)}</dd></div>
            <div><dt>Đối tác</dt><dd className="portal-tnum">{formatNumber(data.totalPartners)}</dd></div>
            <div><dt>Hồ sơ đối tác đã duyệt</dt><dd className="portal-tnum">{formatNumber(data.approvedPartnerProfiles)}</dd></div>
            <div><dt>Đang hoạt động</dt><dd className="portal-tnum">{formatNumber(data.activeUsers)}</dd></div>
            <div><dt>Bị khóa</dt><dd className="portal-tnum">{formatNumber(data.lockedUsers)}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}
