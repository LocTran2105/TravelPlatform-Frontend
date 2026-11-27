import { useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Check, Clock3, Eye, FileClock, Hourglass, ImageIcon, MapPinned, Plus, RefreshCw, Store } from 'lucide-react';
import { getApiError } from '../../api/axiosClient';
import { partnerApi } from '../../api/partnerApi';
import { API_BASE_URL } from '../../config/api';
import Button from '../../components/portal/Button';
import CountUp from '../../components/portal/CountUp';
import EmptyState from '../../components/portal/EmptyState';
import { Skeleton } from '../../components/portal/Skeleton';
import { ageFrom, businessStatus, businessTypeLabel, greeting, submissionStatus } from '../../utils/portalFormat';

const readUser = () => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } };
const mediaUrl = (url) => (!url ? '' : /^https?:\/\//.test(url) ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`);

// 5 phần của một hồ sơ địa điểm tốt; `tab` là tab cần mở trong trang Địa điểm của tôi
const CHECKS = [
  { key: 'description', label: 'Mô tả địa điểm', tab: 'info', done: (b) => b.hasDescription },
  { key: 'contact', label: 'Số điện thoại hoặc email', tab: 'info', done: (b) => b.hasContact },
  { key: 'hours', label: 'Giờ mở cửa đủ 7 ngày', tab: 'hours', done: (b) => b.hoursDays >= 7, detail: (b) => `${b.hoursDays}/7 ngày` },
  { key: 'media', label: 'Ít nhất 3 ảnh thực tế', tab: 'media', done: (b) => b.mediaCount >= 3, detail: (b) => `${b.mediaCount} ảnh` },
  { key: 'notes', label: 'Ghi chú cho du khách', tab: 'notes', done: (b) => b.notesCount >= 1, detail: (b) => `${b.notesCount} ghi chú` },
];
const completeness = (b) => CHECKS.filter((c) => c.done(b)).length / CHECKS.length;

function Ring({ value, size = 64 }) {
  const gradientId = useId();
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Hoàn thiện ${Math.round(value * 100)}%`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          {value >= 1
            ? <><stop offset="0" stopColor="#0f7d68" /><stop offset="1" stopColor="#1b9b74" /></>
            : <><stop offset="0" stopColor="#ff5645" /><stop offset="1" stopColor="#ffa53b" /></>}
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--p-sunken)" strokeWidth={stroke} />
      <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${gradientId})`}
        strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value) }} transition={{ duration: 0.8, delay: 0.2, ease: [0.2, 0.7, 0.2, 1] }} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="var(--p-ink)" fontSize="15" fontWeight="700">
        {Math.round(value * 100)}%
      </text>
    </svg>
  );
}

function summarySentence(data) {
  const list = data.businesses || [];
  if (list.length === 0) return 'Bạn chưa có địa điểm nào. Thêm địa điểm đầu tiên để du khách tìm thấy bạn trên bản đồ.';
  if (list.length === 1) {
    const b = list[0];
    const missing = CHECKS.filter((c) => !c.done(b)).map((c) => c.label.toLowerCase());
    const state = b.publicationStatus === 'PUBLISHED' ? 'đang hiển thị cho du khách' : businessStatus(b.verificationStatus)[0].toLowerCase();
    return missing.length
      ? `${b.name} ${state}. Còn thiếu: ${missing.join(', ')}.`
      : `${b.name} ${state} và hồ sơ đã đầy đủ.`;
  }
  return `${list.length} địa điểm, ${data.publishedBusinesses} đang hiển thị cho du khách, ${data.businessesPendingReview} đang chờ duyệt.`;
}

function PartnerSkeleton() {
  return (
    <div className="portal-page" role="status" aria-label="Đang tải tổng quan">
      <div className="portal-panel dash-hero">
        <div className="dash-hero-copy" style={{ display: 'grid', gap: 14 }}>
          <Skeleton width="55%" height={34} /><Skeleton width="85%" height={16} /><Skeleton width="40%" height={40} radius={10} />
        </div>
        <Skeleton height={240} radius={14} />
      </div>
      <div className="portal-panel"><Skeleton height={160} radius={12} /></div>
    </div>
  );
}

export default function PartnerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user] = useState(readUser);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await partnerApi.getDashboard()); }
    catch (err) { setError(getApiError(err, 'Không tải được tổng quan đối tác.')); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- tải dữ liệu lần đầu
  useEffect(() => { load(); }, [load]);

  if (!data && loading) return <PartnerSkeleton />;
  if (!data) {
    return (
      <div className="portal-page">
        <div className="portal-panel">
          <EmptyState icon={RefreshCw} title="Chưa tải được tổng quan" action={<Button variant="primary" icon={RefreshCw} onClick={load}>Thử lại</Button>}>
            {error || 'Kiểm tra kết nối tới máy chủ rồi thử lại.'}
          </EmptyState>
        </div>
      </div>
    );
  }

  const businesses = data.businesses || [];
  const featured = businesses.find((b) => b.coverUrl) || businesses[0];
  const recent = data.recentSubmissions || [];
  const name = user.fullName || user.displayName || '';
  const photos = businesses.reduce((total, b) => total + (b.mediaCount || 0), 0);

  const stats = [
    { label: 'Địa điểm', value: data.totalBusinesses, note: 'đang quản lý', icon: Store, tone: 'sunset' },
    { label: 'Đang hiển thị', value: data.publishedBusinesses, note: 'du khách tìm thấy được', icon: Eye, tone: 'pine' },
    { label: 'Đang chờ duyệt', value: data.businessesPendingReview, note: 'thường xử lý trong 1–2 ngày', icon: Hourglass, tone: 'hydrangea' },
    { label: 'Ảnh đã đăng', value: photos, note: 'trên tất cả địa điểm', icon: ImageIcon, tone: 'rose' },
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
            <Button variant="primary" icon={Plus} to="/partner/businesses?create=1">Thêm địa điểm</Button>
            <Button variant="secondary" icon={MapPinned} to="/partner/businesses">Địa điểm của tôi</Button>
            <Button variant="ghost" icon={RefreshCw} onClick={load} loading={loading}>Làm mới</Button>
          </div>
        </div>
        {featured ? (
          <Link className="pd-cover" to={`/partner/businesses?edit=${featured.id}&tab=media`} aria-label={`Ảnh của ${featured.name}`}>
            {featured.coverUrl
              ? <motion.img src={mediaUrl(featured.coverUrl)} alt="" initial={{ scale: 1.06 }} animate={{ scale: 1 }} transition={{ duration: 1.2, ease: [0.2, 0.7, 0.2, 1] }} />
              : <span className="pd-cover-empty"><ImageIcon size={28} /><span>Thêm ảnh bìa để du khách nhận ra quán</span></span>}
            <span className="pd-cover-caption">
              <span className={`portal-status ${businessStatus(featured.verificationStatus)[1]}`}>{businessStatus(featured.verificationStatus)[0]}</span>
              <strong>{featured.name}</strong>
              <small>{businessTypeLabel(featured.businessType)}{featured.address ? `, ${featured.address}` : ''}</small>
            </span>
          </Link>
        ) : (
          <div className="pd-cover pd-cover-empty"><Store size={28} /><span>Địa điểm của bạn sẽ hiện ở đây</span></div>
        )}
      </section>

      <div className="portal-stat-grid">
        {stats.map((s) => (
          <div className={`portal-stat-card dash-stat tone-${s.tone}`} key={s.label}>
            <span className="dash-stat-top">
              <span className="portal-stat-label">{s.label}</span>
              <span className="portal-stat-icon"><s.icon size={17} aria-hidden="true" /></span>
            </span>
            <div className="portal-stat-value dash-stat-value"><CountUp value={s.value} className="dash-proportional" /></div>
            <div className="dash-stat-note">{s.note}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid-2">
        <section className="portal-panel">
          <div className="portal-panel-head">
            <div>
              <h2>Hồ sơ địa điểm</h2>
              <p>Hồ sơ càng đầy đủ, du khách càng dễ chọn ghé quán</p>
            </div>
          </div>
          {businesses.length === 0 ? (
            <EmptyState icon={Store} title="Chưa có địa điểm" action={<Button variant="primary" icon={Plus} to="/partner/businesses?create=1">Thêm địa điểm</Button>}>
              Điền tên, địa chỉ và vị trí trên bản đồ rồi gửi duyệt.
            </EmptyState>
          ) : (
            <div className="pd-list">
              {businesses.map((b, i) => {
                const [statusLabel, tone] = businessStatus(b.verificationStatus);
                const pending = String(b.verificationStatus).toUpperCase() === 'PENDING_REVIEW';
                return (
                  <motion.article className="pd-business" key={b.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                    <div className="pd-business-head">
                      <Ring value={completeness(b)} />
                      <div className="pd-business-title">
                        <strong>{b.name}</strong>
                        <small>{businessTypeLabel(b.businessType)}</small>
                        <span className="pd-badges">
                          <span className={`portal-status ${tone}`}>{statusLabel}</span>
                          {b.publicationStatus === 'PUBLISHED' && <span className="portal-status info">Đang hiển thị</span>}
                        </span>
                      </div>
                    </div>
                    <ul className="pd-checks">
                      {CHECKS.map((c) => {
                        const done = c.done(b);
                        return (
                          <li key={c.key} className={done ? 'is-done' : ''}>
                            <span className="pd-check-icon" aria-hidden="true">{done ? <Check size={13} strokeWidth={3} /> : null}</span>
                            <span className="pd-check-label">{c.label}{c.detail ? <em>{c.detail(b)}</em> : null}</span>
                            {!done && !pending && <Link to={`/partner/businesses?edit=${b.id}&tab=${c.tab}`}>Bổ sung</Link>}
                          </li>
                        );
                      })}
                    </ul>
                    {b.lastSubmissionStatus && (
                      <p className="pd-last">
                        <Clock3 size={14} aria-hidden="true" />
                        Lần gửi duyệt gần nhất: {submissionStatus(b.lastSubmissionStatus)[0].toLowerCase()}
                        {b.lastSubmissionAt ? `, ${ageFrom(b.lastSubmissionAt)} trước` : ''}
                        {b.lastReviewNote && String(b.lastSubmissionStatus).toUpperCase() === 'REJECTED' ? `. Ghi chú: ${b.lastReviewNote}` : ''}
                      </p>
                    )}
                  </motion.article>
                );
              })}
            </div>
          )}
        </section>

        <section className="portal-panel">
          <div className="portal-panel-head">
            <div>
              <h2>Xét duyệt gần đây</h2>
              <p>Kết quả các lần gửi hồ sơ</p>
            </div>
            <Button size="sm" variant="ghost" icon={FileClock} to="/partner/submissions">Xem tất cả</Button>
          </div>
          {recent.length === 0 ? (
            <EmptyState icon={FileClock} title="Chưa gửi hồ sơ nào">Sau khi gửi duyệt, kết quả sẽ hiện ở đây.</EmptyState>
          ) : (
            <ol className="pd-timeline">
              {recent.map((s) => {
                const [label, tone] = submissionStatus(s.status);
                return (
                  <li key={s.id}>
                    <span className={`pd-dot ${tone}`} aria-hidden="true" />
                    <div>
                      <strong>{s.businessName}</strong>
                      <span className={`portal-status ${tone}`}>{label}</span>
                      <small>{s.at ? `${ageFrom(s.at)} trước` : ''}</small>
                      {s.reviewNote && <p>{s.reviewNote}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
