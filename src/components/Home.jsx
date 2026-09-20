import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Compass,
  Search,
  Users,
  MapPin,
  Receipt,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
} from 'lucide-react';

/**
 * Home.jsx — Trang chủ chính của hệ thống.
 *
 * Dùng chung cho cả người dùng đã đăng nhập và chưa đăng nhập:
 * - Header (logo, nav, thanh tìm kiếm, khu vực tài khoản) luôn giữ nguyên.
 * - Chỉ phần hero ở giữa đổi nội dung tùy theo trạng thái đăng nhập
 *   (đọc từ 'user' trong localStorage, giống cách Login.jsx đang lưu).
 * - Phần tính năng & cộng đồng bên dưới hiển thị cho mọi người.
 */

const FEATURES = [
  {
    icon: MapPin,
    title: 'Lộ trình theo từng ngày',
    description:
      'Chia chuyến đi theo trục thời gian, ghim địa điểm lên bản đồ và nhân bản lịch trình từ cộng đồng.',
    tint: 'bg-emerald-50 text-emerald-700',
    span: 'sm:col-span-2',
  },
  {
    icon: Receipt,
    title: 'Chia tiền nhóm tự động',
    description: 'Ghi lại từng khoản chi, hệ thống tự tính toán ai nợ ai.',
    tint: 'bg-amber-50 text-amber-700',
  },
  {
    icon: Users,
    title: 'Cộng đồng du lịch',
    description: 'Theo dõi, đánh giá, bình luận và chia sẻ hành trình của bạn.',
    tint: 'bg-sky-50 text-sky-700',
  },
  {
    icon: ShieldCheck,
    title: 'Cảnh báo an toàn & lưu trú',
    description:
      'Cảnh báo thời tiết, giao thông được cộng đồng xác thực trên bản đồ, và đặt phòng ngay trong hệ thống.',
    tint: 'bg-rose-50 text-rose-700',
    span: 'sm:col-span-2',
  },
];

// Dữ liệu minh hoạ cho khu vực "Cộng đồng chia sẻ" — thay bằng dữ liệu thật khi có API
const COMMUNITY_TRIPS = [
  {
    image:
      'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?q=80&w=800&auto=format&fit=crop',
    title: 'Trekking Tà Năng - Phan Dũng, 3 ngày 2 đêm',
    author: 'Minh Anh',
  },
  {
    image:
      'https://images.unsplash.com/photo-1500835556837-99ac94a94552?q=80&w=800&auto=format&fit=crop',
    title: 'Săn mây Tà Xùa cuối tuần',
    author: 'Gia Bảo',
  },
  {
    image:
      'https://images.unsplash.com/photo-1518684079-3c830dcef090?q=80&w=800&auto=format&fit=crop',
    title: 'Đảo Phú Quý tự túc 4 ngày',
    author: 'Thuỳ Trang',
  },
];

const Home = () => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        setUser(null);
      }
    }
  }, []);

  const isLoggedIn = Boolean(user);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setMenuOpen(false);
    navigate('/');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    // TODO: nối tới API tìm địa điểm khi backend có endpoint tương ứng
    console.log('Tìm địa điểm:', searchTerm);
  };

  return (
    <div className="min-h-screen w-full bg-white font-sans text-[#16241F] antialiased">
      {/* ===================== HEADER ===================== */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          {/* Logo + nav trái */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex flex-shrink-0 items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 text-white">
                <Compass className="h-4.5 w-4.5" />
              </div>
              <span className="text-base font-bold tracking-tight text-slate-900">
                TravelPlatform
              </span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              <Link
                to="/"
                className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
              >
                Trang chủ
              </Link>
              <Link
                to="/community"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                Cộng đồng
              </Link>
            </nav>
          </div>

          {/* Thanh tìm kiếm */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden max-w-md flex-1 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 transition-colors focus-within:border-emerald-400 focus-within:bg-white md:flex"
          >
            <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm địa điểm, thành phố..."
              className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
            />
          </form>

          {/* Khu vực tài khoản (desktop) */}
          <div className="ml-auto hidden items-center gap-3 md:flex">
            {isLoggedIn ? (
              <>
                <span className="text-sm font-medium text-slate-600">
                  Xin chào, {user.fullName || 'bạn'}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100"
                >
                  <LogOut className="h-4 w-4" /> Đăng xuất
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition-all hover:from-emerald-700 hover:to-teal-700"
                >
                  Đăng ký
                </Link>
              </>
            )}
          </div>

          {/* Nút menu mobile */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="ml-auto p-1.5 text-slate-600 md:hidden"
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Menu mobile xổ xuống: nav + search + auth gộp lại */}
        {menuOpen && (
          <div className="border-t border-slate-100 px-4 py-4 md:hidden">
            <form
              onSubmit={handleSearchSubmit}
              className="mb-3 flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2"
            >
              <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm địa điểm, thành phố..."
                className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
              />
            </form>

            <div className="flex flex-col gap-1">
              <Link
                to="/"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700"
              >
                Trang chủ
              </Link>
              <Link
                to="/community"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cộng đồng
              </Link>

              <div className="mt-2 border-t border-slate-100 pt-3">
                {isLoggedIn ? (
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-600"
                  >
                    <LogOut className="h-4 w-4" /> Đăng xuất
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <Link
                      to="/login"
                      onClick={() => setMenuOpen(false)}
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-center text-sm font-medium text-slate-700"
                    >
                      Đăng nhập
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setMenuOpen(false)}
                      className="flex-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-2.5 text-center text-sm font-semibold text-white"
                    >
                      Đăng ký
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ===================== HERO — nội dung đổi theo trạng thái đăng nhập ===================== */}
      <section className="mx-auto max-w-3xl px-6 pb-10 pt-16 text-center sm:pt-24">
        {isLoggedIn ? (
          <>
            <h1 className="text-3xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
              Chào mừng trở lại, {user.fullName?.split(' ').slice(-1)[0] || 'bạn'}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
              Tiếp tục chuyến đi đang lên kế hoạch, hoặc bắt đầu một hành
              trình hoàn toàn mới.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
              Tự lên lịch trình cho chuyến đi của riêng bạn
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
              Ghim địa điểm lên bản đồ, chia tiền với bạn đồng hành và giữ lại
              từng chặng đường — tất cả trong một nơi.
            </p>
          </>
        )}

        <Link
          to="/plan"
          className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] sm:text-base"
        >
          Bắt đầu lập kế hoạch
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </section>

      {/* Dải ảnh du lịch — so le nhẹ để không phẳng lì, gợi cảm giác "đang khám phá" */}
      <div className="mx-auto grid max-w-5xl grid-cols-3 gap-3 px-6 pb-20 sm:gap-4">
        <img
          src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop"
          alt="Đường mòn núi"
          className="h-36 w-full rounded-2xl object-cover sm:h-56"
        />
        <img
          src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=800&auto=format&fit=crop"
          alt="Cung đường ven biển"
          className="h-36 w-full translate-y-4 rounded-2xl object-cover sm:h-56"
        />
        <img
          src="https://images.unsplash.com/photo-1500835556837-99ac94a94552?q=80&w=800&auto=format&fit=crop"
          alt="Đỉnh núi lúc bình minh"
          className="h-36 w-full rounded-2xl object-cover sm:h-56"
        />
      </div>

      {/* ===================== TÍNH NĂNG ===================== */}
      <section className="border-t border-slate-100 bg-[#F7F8F6]">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:px-10">
          <div className="mb-10 max-w-lg">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Một hệ thống, đủ cho cả chuyến đi
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-500 sm:text-base">
              Từ lúc lên ý tưởng đến lúc quay về, mọi phần của chuyến đi đều
              nằm trong cùng một nơi.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description, tint, span }) => (
              <div
                key={title}
                className={`rounded-2xl p-6 ${tint} ${span || ''}`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/70">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== CỘNG ĐỒNG ===================== */}
      <section className="mx-auto max-w-5xl px-6 py-20 sm:px-10">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Chuyến đi từ cộng đồng
            </h2>
            <p className="mt-2 text-sm text-slate-500 sm:text-base">
              Lấy cảm hứng từ những hành trình người dùng khác đã chia sẻ.
            </p>
          </div>
          <Link
            to="/community"
            className="hidden flex-shrink-0 text-sm font-semibold text-emerald-700 hover:text-emerald-800 sm:block"
          >
            Xem tất cả
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {COMMUNITY_TRIPS.map((trip) => (
            <div key={trip.title} className="group cursor-pointer">
              <div className="overflow-hidden rounded-2xl">
                <img
                  src={trip.image}
                  alt={trip.title}
                  className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-900">
                {trip.title}
              </h3>
              <p className="mt-1 text-xs text-slate-500">Bởi {trip.author}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-100 px-6 py-8 text-center text-xs text-slate-400 sm:px-10">
        © 2026 TravelPlatform
      </footer>
    </div>
  );
};

export default Home;
