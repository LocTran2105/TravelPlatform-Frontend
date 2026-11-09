import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  Globe2,
  LoaderCircle,
  MapPin,
  Send,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
} from 'lucide-react';
import http, { getApiError } from '../../api/axiosClient';

const EMPTY_FORM = {
  displayName: '',
  legalName: '',
  taxCode: '',
  contactPerson: '',
  contactEmail: '',
  contactPhone: '',
  businessAddress: '',
  description: '',
};

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return data ? [data] : [];
};

function getStatus(status) {
  const value = String(status || '').toUpperCase();
  if (value === 'APPROVED') return { label: 'Đã được duyệt', tone: 'success' };
  if (value === 'REJECTED') return { label: 'Cần bổ sung / bị từ chối', tone: 'danger' };
  if (['PENDING', 'PENDING_REVIEW', 'SUBMITTED'].includes(value)) {
    return { label: 'Đang chờ xét duyệt', tone: 'warning' };
  }
  return { label: status || 'Chưa xác định', tone: 'neutral' };
}

function formatDate(value) {
  if (!value) return 'Chưa có thông tin';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có thông tin';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function PartnerApplication() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadApplications = async () => {
    setLoading(true);
    try {
      const response = await http.get('/api/partner-applications/mine');
      setApplications(unwrapList(response.data));
    } catch (err) {
      // Một số Backend có thể trả 404 khi người dùng chưa từng gửi hồ sơ.
      if (err?.response?.status !== 404) {
        setError(getApiError(err, 'Không tải được lịch sử đăng ký.'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
    // Chỉ tải hồ sơ một lần khi trang được mở.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const normalizedStatus = (item) =>
    String(item.verificationStatus || item.status || '').toUpperCase();

  const hasPending = applications.some((item) =>
    ['PENDING', 'PENDING_REVIEW', 'SUBMITTED'].includes(normalizedStatus(item))
  );

  const submitApplication = async (event) => {
    event.preventDefault();
    if (hasPending) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([key, value]) => [key, value.trim() || null])
      );

      await http.post('/api/partner-applications', payload);
      setSuccess('Hồ sơ đã được gửi thành công. Bạn có thể theo dõi tiến độ xét duyệt ở phần bên dưới.');
      setForm(EMPTY_FORM);
      await loadApplications();
    } catch (err) {
      setError(getApiError(err, 'Không gửi được hồ sơ đăng ký. Vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="portal-page partner-application-page partner-application-refresh">
      <section className="partner-app-hero">
        <div className="partner-app-hero-copy">
          <div className="partner-app-kicker">
            <Sparkles size={15} /> TRAVEL PARTNER NETWORK
          </div>
          <h1>Trở thành đối tác<br /><span>cùng phát triển du lịch</span></h1>
          <p>
            Chia sẻ thông tin cơ sở kinh doanh và địa điểm của bạn để cộng đồng
            Traveller có thêm dữ liệu hữu ích, rõ ràng và đáng tin cậy khi lên kế hoạch.
          </p>
          <div className="partner-app-hero-points">
            <span><ShieldCheck size={16} /> Hồ sơ được xác minh</span>
            <span><MapPin size={16} /> Hiện diện trên bản đồ du lịch</span>
          </div>
        </div>
        <div className="partner-app-hero-art" aria-hidden="true">
          <div className="partner-app-art-glow" />
          <div className="partner-app-art-card partner-app-art-card-back">
            <div className="partner-app-art-mini-icon"><MapPin size={18} /></div>
            <span>Địa điểm địa phương</span>
            <strong>Khám phá gần bạn</strong>
            <div className="partner-app-art-lines"><i /><i /><i /></div>
          </div>
          <div className="partner-app-art-card partner-app-art-card-front">
            <div className="partner-app-art-main-icon"><Store size={29} /></div>
            <div>
              <strong>Đối tác du lịch</strong>
              <span>Kết nối cùng Traveller</span>
            </div>
            <div className="partner-app-art-check"><BadgeCheck size={19} /></div>
          </div>
          <div className="partner-app-art-orbit partner-app-art-orbit-one" />
          <div className="partner-app-art-orbit partner-app-art-orbit-two" />
        </div>
      </section>

      {error && (
        <div className="partner-app-feedback is-error" role="alert">
          <span className="partner-app-feedback-icon">!</span>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="partner-app-feedback is-success" role="status">
          <CheckCircle2 size={20} />
          <span>{success}</span>
        </div>
      )}

      {hasPending && (
        <div className="partner-app-pending-banner">
          <div className="partner-app-pending-icon"><Clock3 size={21} /></div>
          <div>
            <strong>Hồ sơ của bạn đang được xét duyệt</strong>
            <p>Bạn đã có hồ sơ chờ xử lý. Vui lòng đợi Admin phản hồi trước khi gửi hồ sơ mới.</p>
          </div>
        </div>
      )}

      <div className="partner-app-layout">
        <section className="partner-app-form-card">
          <div className="partner-app-card-heading">
            <div className="partner-app-heading-icon"><FileText size={22} /></div>
            <div>
              <div className="partner-app-section-kicker">APPLICATION FORM</div>
              <h2>Thông tin đăng ký</h2>
              <p>Điền thông tin cơ bản của đơn vị để Admin xác minh hồ sơ.</p>
            </div>
            <span className="partner-app-required-note"><i /> Bắt buộc</span>
          </div>

          <form onSubmit={submitApplication} className="partner-app-form">
            <div className="partner-app-form-section">
              <div className="partner-app-form-section-title">
                <span>01</span>
                <div>
                  <h3>Thông tin đơn vị</h3>
                  <p>Thông tin nhận diện cơ sở hoặc doanh nghiệp của bạn.</p>
                </div>
              </div>
              <div className="partner-app-fields">
                <label className="partner-app-field partner-app-field-full">
                  <span>Tên đơn vị / tên hiển thị <b>*</b></span>
                  <input
                    name="displayName"
                    required
                    maxLength={255}
                    value={form.displayName}
                    onChange={changeField}
                    placeholder="Ví dụ: Dalat Green Garden Homestay"
                    autoComplete="organization"
                  />
                  <small>Tên sẽ được dùng để nhận diện hồ sơ của bạn.</small>
                </label>
                <label className="partner-app-field">
                  <span>Tên pháp lý</span>
                  <input
                    name="legalName"
                    maxLength={255}
                    value={form.legalName}
                    onChange={changeField}
                    placeholder="Tên trên giấy phép kinh doanh"
                    autoComplete="organization"
                  />
                </label>
                <label className="partner-app-field">
                  <span>Mã số thuế</span>
                  <input
                    name="taxCode"
                    maxLength={50}
                    value={form.taxCode}
                    onChange={changeField}
                    placeholder="Nhập mã số thuế nếu có"
                  />
                </label>
                <label className="partner-app-field partner-app-field-full">
                  <span>Địa chỉ đơn vị <b>*</b></span>
                  <div className="partner-app-input-with-icon">
                    <MapPin size={18} />
                    <input
                      name="businessAddress"
                      required
                      maxLength={500}
                      value={form.businessAddress}
                      onChange={changeField}
                      placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                      autoComplete="street-address"
                    />
                  </div>
                </label>
              </div>
            </div>

            <div className="partner-app-form-divider" />

            <div className="partner-app-form-section">
              <div className="partner-app-form-section-title">
                <span>02</span>
                <div>
                  <h3>Thông tin liên hệ</h3>
                  <p>Admin có thể liên hệ khi cần xác minh thông tin.</p>
                </div>
              </div>
              <div className="partner-app-fields">
                <label className="partner-app-field">
                  <span>Người liên hệ</span>
                  <div className="partner-app-input-with-icon">
                    <UserRound size={18} />
                    <input
                      name="contactPerson"
                      maxLength={150}
                      value={form.contactPerson}
                      onChange={changeField}
                      placeholder="Họ tên người phụ trách"
                      autoComplete="name"
                    />
                  </div>
                </label>
                <label className="partner-app-field">
                  <span>Số điện thoại</span>
                  <input
                    name="contactPhone"
                    type="tel"
                    maxLength={20}
                    value={form.contactPhone}
                    onChange={changeField}
                    placeholder="Ví dụ: 0901 234 567"
                    autoComplete="tel"
                  />
                </label>
                <label className="partner-app-field partner-app-field-full">
                  <span>Email liên hệ</span>
                  <div className="partner-app-input-with-icon">
                    <Globe2 size={18} />
                    <input
                      type="email"
                      name="contactEmail"
                      maxLength={255}
                      value={form.contactEmail}
                      onChange={changeField}
                      placeholder="contact@example.com"
                      autoComplete="email"
                    />
                  </div>
                </label>
              </div>
            </div>

            <div className="partner-app-form-divider" />

            <div className="partner-app-form-section">
              <div className="partner-app-form-section-title">
                <span>03</span>
                <div>
                  <h3>Giới thiệu đơn vị</h3>
                  <p>Giúp Admin hiểu rõ hơn về hoạt động của bạn.</p>
                </div>
              </div>
              <label className="partner-app-field partner-app-field-full">
                <span>Mô tả / giới thiệu</span>
                <textarea
                  name="description"
                  rows={5}
                  maxLength={2000}
                  value={form.description}
                  onChange={changeField}
                  placeholder="Giới thiệu về đơn vị, loại hình kinh doanh và những thông tin địa điểm bạn mong muốn cung cấp cho Traveller..."
                />
                <small>{form.description.length}/2000 ký tự</small>
              </label>
            </div>

            <div className="partner-app-form-footnote">
              <ShieldCheck size={18} />
              <span>Thông tin được sử dụng để xét duyệt tư cách đối tác. Vui lòng cung cấp dữ liệu chính xác và có thể xác minh.</span>
            </div>

            <div className="partner-app-submit-row">
              <span className="partner-app-submit-caption">Các trường có dấu * là bắt buộc.</span>
              <button className="partner-app-submit-button" type="submit" disabled={submitting || hasPending}>
                {submitting ? <LoaderCircle size={19} className="portal-spin" /> : <Send size={18} />}
                {submitting ? 'Đang gửi hồ sơ...' : hasPending ? 'Đang chờ xét duyệt' : 'Gửi hồ sơ xét duyệt'}
                {!submitting && !hasPending && <ArrowRight size={18} />}
              </button>
            </div>
          </form>
        </section>

        <aside className="partner-app-aside">
          <section className="partner-app-aside-card partner-app-process-card">
            <div className="partner-app-aside-title">
              <div className="partner-app-aside-icon"><FileCheck2 size={20} /></div>
              <div><h3>Quy trình xét duyệt</h3><p>3 bước đơn giản để bắt đầu</p></div>
            </div>
            <ol className="partner-app-process-list">
              <li>
                <span className="partner-app-process-number">1</span>
                <div><strong>Gửi thông tin</strong><p>Hoàn thành biểu mẫu và gửi hồ sơ đăng ký.</p></div>
              </li>
              <li>
                <span className="partner-app-process-number">2</span>
                <div><strong>Admin xác minh</strong><p>Đội ngũ quản trị kiểm tra thông tin đơn vị.</p></div>
              </li>
              <li>
                <span className="partner-app-process-number">3</span>
                <div><strong>Bắt đầu đóng góp</strong><p>Sau khi được duyệt, bạn có thể quản lý thông tin địa điểm.</p></div>
              </li>
            </ol>
          </section>

          <section className="partner-app-aside-card partner-app-benefit-card">
            <div className="partner-app-benefit-icon"><Building2 size={21} /></div>
            <div className="partner-app-section-kicker">PARTNER WORKSPACE</div>
            <h3>Không chỉ là một hồ sơ kinh doanh</h3>
            <p>Partner Portal giúp bạn chủ động cập nhật thông tin địa điểm, gửi dữ liệu để xác minh và theo dõi phản hồi từ quản trị viên.</p>
            <div className="partner-app-benefit-foot"><BadgeCheck size={17} /> Dữ liệu được xét duyệt trước khi công khai</div>
          </section>
        </aside>
      </div>

      <section className="partner-app-history-card">
        <div className="partner-app-history-heading">
          <div className="partner-app-heading-icon"><Clock3 size={21} /></div>
          <div>
            <div className="partner-app-section-kicker">APPLICATION TRACKING</div>
            <h2>Lịch sử đăng ký</h2>
            <p>Theo dõi trạng thái và phản hồi từ Admin.</p>
          </div>
          <span className="partner-app-history-count">{applications.length} hồ sơ</span>
        </div>

        {loading ? (
          <div className="partner-app-history-state">
            <LoaderCircle size={23} className="portal-spin" />
            <span>Đang tải lịch sử đăng ký...</span>
          </div>
        ) : applications.length === 0 ? (
          <div className="partner-app-history-empty">
            <div><FileText size={25} /></div>
            <strong>Bạn chưa có hồ sơ đăng ký</strong>
            <p>Sau khi gửi biểu mẫu, trạng thái xử lý sẽ được hiển thị tại đây.</p>
          </div>
        ) : (
          <div className="partner-app-history-list">
            {applications.map((item) => {
              const status = getStatus(item.verificationStatus || item.status);
              return (
                <article className="partner-app-history-item" key={item.id}>
                  <div className="partner-app-history-item-icon"><Building2 size={20} /></div>
                  <div className="partner-app-history-item-main">
                    <div className="partner-app-history-item-topline">
                      <strong>{item.displayName || item.legalName || 'Hồ sơ Partner'}</strong>
                      <span className={`partner-app-status ${status.tone}`}>{status.label}</span>
                    </div>
                    <span className="partner-app-history-date">Ngày gửi: {formatDate(item.createdAt)}</span>
                    <p>{item.adminNote || item.reviewNote || 'Chưa có phản hồi từ Admin.'}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
