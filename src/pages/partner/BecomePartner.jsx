import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  FileCheck2,
  FileText,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Store,
  UserRound,
} from 'lucide-react';
import { getStoredUser, normalizeRole } from '../../utils/auth.jsx';
import { withRedirect } from '../../utils/redirect';
import SiteHeader from '../../components/site/SiteHeader';

// Trang giới thiệu CÔNG KHAI cho đơn vị kinh doanh muốn trở thành đối tác.
// Ai cũng xem được; việc lọc đơn vị hợp lệ (mã số thuế, giấy phép, địa chỉ) nằm ở khâu Admin xét duyệt.
const APPLICATION_PATH = '/partner-application';

const REQUIREMENTS = [
  {
    icon: FileText,
    title: 'Mã số thuế hợp lệ',
    text: 'Doanh nghiệp, chi nhánh hoặc hộ kinh doanh đã đăng ký, có mã số thuế còn hoạt động.',
  },
  {
    icon: Building2,
    title: 'Tên pháp lý',
    text: 'Tên đúng như trên giấy chứng nhận đăng ký kinh doanh để Admin đối chiếu.',
  },
  {
    icon: MapPin,
    title: 'Địa chỉ thực tế',
    text: 'Địa chỉ cơ sở đang hoạt động, đủ chi tiết để xác minh vị trí trên bản đồ.',
  },
  {
    icon: Phone,
    title: 'Người liên hệ',
    text: 'Họ tên và số điện thoại người phụ trách để Admin liên hệ khi cần bổ sung.',
  },
];

const BENEFITS = [
  {
    icon: BadgeCheck,
    title: 'Nhãn "Đối tác đã xác minh"',
    text: 'Địa điểm của bạn được ưu tiên trong gợi ý của trợ lý AI và hiển thị kèm nhãn xác minh.',
  },
  {
    icon: MapPin,
    title: 'Có mặt trên bản đồ chuyến đi',
    text: 'Traveller có thể kéo địa điểm của bạn thẳng vào lịch trình với vị trí chính xác.',
  },
  {
    icon: CalendarClock,
    title: 'Tự quản lý thông tin',
    text: 'Cập nhật thông tin địa điểm và theo dõi kết quả xét duyệt ngay trong Partner Portal.',
  },
];

const STEPS = [
  { title: 'Đăng nhập', text: 'Dùng tài khoản Traveller hiện có hoặc tạo tài khoản mới.' },
  { title: 'Gửi hồ sơ đơn vị', text: 'Điền thông tin pháp lý, địa chỉ và người liên hệ.' },
  { title: 'Admin xác minh', text: 'Đối chiếu mã số thuế, tên pháp lý và địa chỉ. Kết quả hiện ở mục Lịch sử đăng ký.' },
  { title: 'Thêm địa điểm', text: 'Vào Partner Portal để tạo địa điểm và gửi duyệt trước khi công khai.' },
];

// Nút hành động chính thay đổi theo trạng thái đăng nhập và vai trò hiện tại.
function getPrimaryAction(user) {
  if (!user || !localStorage.getItem('token')) {
    return {
      to: withRedirect('/login', APPLICATION_PATH),
      label: 'Đăng nhập để đăng ký',
      secondary: { to: withRedirect('/register', APPLICATION_PATH), label: 'Chưa có tài khoản? Tạo tài khoản' },
    };
  }
  const role = normalizeRole(user.role);
  if (role === 'ROLE_PARTNER') {
    return { to: '/partner', label: 'Vào Partner Portal', note: 'Tài khoản của bạn đã là đối tác.' };
  }
  if (role === 'ROLE_ADMIN') {
    return { to: '/admin/applications', label: 'Xem hồ sơ chờ duyệt', note: 'Bạn đang đăng nhập bằng tài khoản quản trị.' };
  }
  return { to: APPLICATION_PATH, label: 'Đăng ký trở thành đối tác' };
}

export default function BecomePartner() {
  const user = getStoredUser();
  const action = getPrimaryAction(user);

  return (
    <div className="tp-site min-h-screen w-full antialiased">
      <SiteHeader />

      {/* Hero */}
      <section className="overflow-hidden bg-gradient-to-b from-orange-50 to-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_1fr] md:items-center md:py-20">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#FF5645] shadow-sm ring-1 ring-orange-100">
              <Sparkles className="h-3.5 w-3.5" /> Dành cho đơn vị kinh doanh du lịch
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Đưa cơ sở của bạn đến với
              <span className="block text-[#FF5645]">người đi du lịch tự túc</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">
              Quán ăn, quán cà phê, homestay, khách sạn hay điểm tham quan đều có thể đăng ký làm đối tác.
              Sau khi được xác minh, địa điểm của bạn xuất hiện trên bản đồ và trong gợi ý lịch trình của Traveller.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={action.to}
                className="tp-btn-primary px-6 py-3 text-sm"
              >
                {action.label} <ArrowRight className="h-4 w-4" />
              </Link>
              {action.secondary && (
                <Link to={action.secondary.to} className="text-sm font-semibold text-slate-600 hover:text-slate-900">
                  {action.secondary.label}
                </Link>
              )}
            </div>
            {action.note && <p className="mt-3 text-sm text-slate-500">{action.note}</p>}

            <p className="mt-6 flex items-start gap-2 text-sm text-slate-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              Chỉ đơn vị có mã số thuế mới được duyệt. Thông tin chỉ dùng để xác minh tư cách đối tác.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-sm" aria-hidden="true">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-orange-200/40 blur-2xl" />
            <div className="relative rounded-3xl border border-slate-100 bg-white p-6 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#FF5645]">
                  <Store className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-extrabold">Tiệm cà phê của bạn</p>
                  <p className="text-xs text-slate-500">Đà Lạt · Quán cà phê</p>
                </div>
              </div>
              <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                <BadgeCheck className="h-3.5 w-3.5" /> Đối tác đã xác minh
              </span>
              <div className="mt-4 space-y-2">
                <div className="h-2.5 w-full rounded-full bg-slate-100" />
                <div className="h-2.5 w-4/5 rounded-full bg-slate-100" />
                <div className="h-2.5 w-3/5 rounded-full bg-slate-100" />
              </div>
              <div className="mt-5 flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600">
                <MapPin className="h-4 w-4 text-[#FF5645]" /> Đã thêm vào lịch trình · Ngày 2
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Điều kiện */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-extrabold sm:text-3xl">Bạn cần chuẩn bị</h2>
        <p className="mt-2 text-slate-500">Hồ sơ đủ các thông tin dưới đây sẽ được xét duyệt nhanh hơn.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {REQUIREMENTS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-700">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{text}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Cá nhân chưa đăng ký kinh doanh chưa thể trở thành đối tác. Bạn vẫn có thể chia sẻ địa điểm hay qua bài đăng
          và đánh giá trong cộng đồng.
        </p>
      </section>

      {/* Lợi ích */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Đối tác nhận được gì</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-[#FF5645]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quy trình */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
          <FileCheck2 className="h-7 w-7 text-[#FF5645]" /> Quy trình đăng ký
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative rounded-3xl border border-slate-100 p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-extrabold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 font-bold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{step.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl bg-slate-900 px-6 py-10 text-center text-white">
          <UserRound className="h-8 w-8 text-orange-300" />
          <h3 className="text-2xl font-extrabold">Sẵn sàng gửi hồ sơ?</h3>
          <p className="max-w-lg text-sm text-slate-300">
            Mỗi tài khoản gửi được một hồ sơ tại một thời điểm. Nếu hồ sơ cần bổ sung, phản hồi của Admin sẽ hiện ở mục Lịch sử đăng ký.
          </p>
          <Link
            to={action.to}
            className="tp-btn-primary px-6 py-3 text-sm"
          >
            {action.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-100 px-6 py-10 text-center text-sm font-medium text-slate-400">
        © 2026 TravelPlatform. Khám phá thế giới theo cách của bạn.
      </footer>
    </div>
  );
}