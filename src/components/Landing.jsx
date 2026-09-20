import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Compass,
  MapPin,
  Receipt,
  Users,
  ShieldCheck,
  ArrowUpRight,
  Menu,
  X,
} from 'lucide-react';

/**
 * Landing.jsx — Trang giới thiệu công khai (chưa đăng nhập).
 *
 * Font chữ: trang này dùng "Fraunces" cho tiêu đề lớn để tạo cảm giác
 * "sổ tay hành trình". Thêm dòng sau vào <head> của index.html (hoặc
 * import trong index.css) để font hiển thị đúng:
 *
 *   <link rel="preconnect" href="https://fonts.googleapis.com">
 *   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
 *   <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap" rel="stylesheet">
 *
 * Nếu không muốn thêm font ngoài, có thể xoá class "font-serif-display"
 * và trang sẽ rơi về font sans mặc định — bố cục không đổi.
 */

const FEATURES = [
  {
    icon: MapPin,
    title: 'Lộ trình theo từng ngày',
    description:
      'Chia chuyến đi theo trục thời gian, ghim địa điểm lên bản đồ và nhân bản lịch trình từ cộng đồng chỉ với một cú chạm.',
  },
  {
    icon: Receipt,
    title: 'Chia tiền nhóm tự động',
    description:
      'Ghi lại từng khoản chi trong chuyến đi, hệ thống tự tính toán ai nợ ai — không còn phải ngồi cộng trừ thủ công.',
  },
  {
    icon: Users,
    title: 'Cộng đồng du lịch',
    description:
      'Theo dõi những người đi trước, đọc đánh giá thật, bình luận và chia sẻ hành trình của chính bạn.',
  },
  {
    icon: ShieldCheck,
    title: 'Cảnh báo an toàn & lưu trú',
    description:
      'Xem cảnh báo thời tiết, giao thông được cộng đồng xác thực trên bản đồ, và đặt phòng ngay trong cùng một nơi.',
  },
];

const Landing = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-white font-sans text-[#1F2A27] antialiased">
      {/* ============== HERO (nền tối, đường đồng mức) ============== */}
      <div className="relative overflow-hidden bg-[#0B1B17]">
        {/* Hoa văn đường đồng mức mờ — gợi bản đồ địa hình, không phải blob gradient */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]"
          viewBox="0 0 1200 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          aria-hidden="true"
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={i}
              d={`M -100 ${140 + i * 90} C 200 ${40 + i * 90}, 400 ${240 + i * 90}, 650 ${120 + i * 90} S 1100 ${60 + i * 90}, 1300 ${180 + i * 90}`}
              stroke="#E8B65A"
              strokeWidth="1"
            />
          ))}
        </svg>

        {/* ---------- Thanh điều hướng ---------- */}
        <header className="relative z-10">
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/20">
                <Compass className="h-5 w-5" />
              </div>
              <span className="text-lg font-semibold tracking-tight text-white">
                TravelPlatform
              </span>
            </div>

            {/* Desktop: đăng nhập / đăng ký */}
            <div className="hidden items-center gap-3 sm:flex">
              <Link
                to="/login"
                className="px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:text-white"
              >
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                Đăng ký
              </Link>
            </div>

            {/* Mobile: nút mở menu */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="sm:hidden text-slate-200 p-1.5"
              aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </nav>

          {menuOpen && (
            <div className="sm:hidden relative z-10 mx-6 mb-4 flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 p-2 backdrop-blur-sm">
              <Link
                to="/login"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/10"
              >
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-white hover:bg-white/10"
              >
                Đăng ký
              </Link>
            </div>
          )}
        </header>

        {/* ---------- Nội dung trung tâm ---------- */}
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 pb-28 pt-16 text-center sm:pb-36 sm:pt-24">
          <h1 className="font-serif-display text-4xl leading-[1.15] text-white sm:text-5xl md:text-6xl">
            Tự lên lịch trình cho chuyến đi của riêng bạn
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Ghim địa điểm lên bản đồ, chia tiền với bạn đồng hành và giữ lại
            từng chặng đường — tất cả trong một nơi, không cần lịch trình
            đóng gói sẵn.
          </p>

          <Link
            to="/plan"
            className="group mt-10 inline-flex items-center gap-2 rounded-xl bg-[#E8B65A] px-7 py-3.5 text-sm font-semibold text-[#231705] shadow-lg shadow-[#E8B65A]/20 transition-all hover:bg-[#f0c576] active:scale-[0.98] sm:text-base"
          >
            Bắt đầu lập kế hoạch
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>

          <p className="mt-4 text-xs text-slate-400">
            Miễn phí khi bắt đầu — chưa cần tài khoản để xem thử.
          </p>
        </div>
      </div>

      {/* ============== TÍNH NĂNG — trình bày như các mục trong sổ hành trình ============== */}
      <div className="mx-auto max-w-5xl px-6 py-20 sm:px-10 sm:py-28">
        <div className="mb-14 max-w-lg">
          <h2 className="font-serif-display text-2xl text-[#12211D] sm:text-3xl">
            Một hệ thống, đủ cho cả chuyến đi
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#5C6B66] sm:text-base">
            Từ lúc lên ý tưởng đến lúc quay về, mọi phần của chuyến đi đều nằm
            trong cùng một nơi.
          </p>
        </div>

        <div className="divide-y divide-[#E4E7E3] border-y border-[#E4E7E3]">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col gap-4 py-7 sm:flex-row sm:items-start sm:gap-8"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Icon className="h-5 w-5" />
              </div>
              <div className="sm:flex sm:flex-1 sm:items-baseline sm:justify-between sm:gap-8">
                <h3 className="text-base font-semibold text-[#12211D] sm:w-56 sm:flex-shrink-0">
                  {title}
                </h3>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#5C6B66] sm:mt-0">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ============== DẢI KÊU GỌI HÀNH ĐỘNG CUỐI TRANG ============== */}
      <div className="border-t border-[#E4E7E3] bg-[#F6F7F5]">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 py-16 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h3 className="font-serif-display text-xl text-[#12211D] sm:text-2xl">
              Chuyến đi tiếp theo bắt đầu từ đây
            </h3>
            <p className="mt-2 text-sm text-[#5C6B66]">
              Tạo lộ trình đầu tiên của bạn trong vài phút.
            </p>
          </div>
          <Link
            to="/plan"
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-[#0B1B17] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#12251F]"
          >
            Bắt đầu lập kế hoạch
          </Link>
        </div>
      </div>

      <footer className="border-t border-[#E4E7E3] px-6 py-8 text-center text-xs text-[#8A968F] sm:px-10">
        © 2026 TravelPlatform
      </footer>

      {/* Font phụ trợ cho tiêu đề — bỏ khối này nếu không muốn tải font ngoài */}
      <style>{`
        .font-serif-display {
          font-family: 'Fraunces', ui-serif, Georgia, serif;
          font-weight: 500;
          letter-spacing: -0.01em;
        }
      `}</style>
    </div>
  );
};

export default Landing;
