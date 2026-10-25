import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
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
  MoreHorizontal,
  Share2,
  Plus
} from 'lucide-react';

const FEATURES = [
  {
    icon: MapPin,
    title: 'Lộ trình theo từng ngày',
    description: 'Chia chuyến đi theo trục thời gian, ghim địa điểm lên bản đồ và nhân bản lịch trình từ cộng đồng.',
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
    description: 'Cảnh báo thời tiết, giao thông được cộng đồng xác thực trên bản đồ, và đặt phòng ngay trong hệ thống.',
    tint: 'bg-rose-50 text-rose-700',
    span: 'sm:col-span-2',
  },
];

const Home = () => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);
  
  // State lưu danh sách chuyến đi cá nhân
  const [myTrips, setMyTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        fetchMyTrips(); // Gọi API ngay khi có User
      } catch {
        setUser(null);
      }
    }
  }, []);

  const isLoggedIn = Boolean(user);

  // Hàm gọi API lấy danh sách chuyến đi của Tôi
  const fetchMyTrips = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setLoadingTrips(true);
    try {
      const response = await axios.get('http://localhost:8080/api/trips/my-trips', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Sắp xếp chuyến đi mới nhất lên đầu
      const sortedTrips = response.data.sort((a, b) => b.id - a.id);
      setMyTrips(sortedTrips);
    } catch (error) {
      console.error("Lỗi lấy danh sách chuyến đi:", error);
    } finally {
      setLoadingTrips(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setMyTrips([]);
    setMenuOpen(false);
    navigate('/');
  };

  // Hàm helper để render chữ cho ngày tháng đẹp hơn (VD: 3 Sep - 5 Sep)
  const formatDateRange = (start, end) => {
    if (!start) return 'No dates';
    const startDate = new Date(start);
    const startStr = startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    
    if (!end) return startStr;
    const endDate = new Date(end);
    const endStr = endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    
    return `${startStr} - ${endStr}`;
  };

  // Hàm đếm tổng số địa điểm trong 1 chuyến đi
  const countPlaces = (trip) => {
    if (!trip.tripDays) return 0;
    return trip.tripDays.reduce((total, day) => total + (day.destinations?.length || 0), 0);
  };

  return (
    <div className="min-h-screen w-full bg-white font-sans text-slate-900 antialiased">
      {/* ===================== HEADER ===================== */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex flex-shrink-0 items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF5645] text-white shadow-sm">
                <Compass className="h-5 w-5" />
              </div>
              <span className="text-lg font-extrabold tracking-tight text-slate-900">
                TravelPlatform
              </span>
            </Link>

            <nav className="hidden items-center gap-2 md:flex">
              <Link to="/" className="rounded-lg bg-red-50 px-3.5 py-2 text-sm font-semibold text-[#FF5645]">
                Home
              </Link>
              <Link to="/community" className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
                Community
              </Link>
            </nav>
          </div>

          <form className="hidden max-w-md flex-1 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 transition-colors focus-within:border-[#FF5645] focus-within:bg-white md:flex">
            <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
            <input
              type="text"
              placeholder="Search places or users..."
              className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
            />
          </form>

          <div className="ml-auto hidden items-center gap-3 md:flex">
            {isLoggedIn ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-full">
                  {user.fullName?.charAt(0).toUpperCase()}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-sm font-semibold text-slate-500 hover:text-red-500 transition-colors"
                >
                  Log out
                </button>
              </div>
            ) : (
              <>
                <Link to="/login" className="px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
                  Log in
                </Link>
                <Link to="/register" className="rounded-full bg-[#FF5645] px-5 py-2 text-sm font-bold text-white transition-all hover:bg-[#E04B3B] active:scale-95">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ===================== KHU VỰC CỦA NGƯỜI DÙNG (CÁC CHUYẾN ĐI) ===================== */}
      {isLoggedIn ? (
        <section className="mx-auto max-w-7xl px-4 pt-10 pb-6 sm:px-6 lg:px-8">
          
          {/* Banner Promo nhỏ */}
          <div className="mb-10 w-full rounded-2xl bg-gradient-to-r from-orange-50 to-rose-50 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between border border-orange-100 relative overflow-hidden">
            <div className="relative z-10 max-w-xl">
              <span className="inline-block px-2.5 py-1 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-md mb-3">
                New Feature
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">
                Discover local hidden gems
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Find the best spots recommended by locals and add them directly to your itinerary.
              </p>
              <button className="mt-5 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-full text-sm transition-colors">
                Explore places
              </button>
            </div>
            <div className="hidden sm:block absolute right-10 top-1/2 -translate-y-1/2 opacity-80">
              <MapPin className="w-32 h-32 text-orange-200" strokeWidth={1} />
            </div>
          </div>

          <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
            <h2 className="text-2xl font-extrabold text-slate-900">Recently viewed and upcoming</h2>
            <Link
              to="/plan"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#FF5645] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#E04B3B] transition-colors"
            >
              <Plus className="h-4 w-4" /> Plan new trip
            </Link>
          </div>

          {loadingTrips ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#FF5645]"></div>
            </div>
          ) : myTrips.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Compass className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-700">You haven't planned any trips yet</h3>
              <p className="text-slate-500 text-sm mt-1 mb-5">Start by picking a destination and dates.</p>
              <Link to="/plan" className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-slate-800">
                Plan a new trip
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {myTrips.map((trip) => (
                <div 
                  key={trip.id} 
                  onClick={() => navigate(`/trips/${trip.id}`)}
                  className="group relative flex flex-col bg-white rounded-2xl overflow-hidden transition-all hover:shadow-xl hover:shadow-slate-200/50 border border-slate-100 hover:border-slate-200 cursor-pointer"
                >
                  
                  {/* Ảnh bìa */}
                  <div className="h-36 sm:h-44 w-full bg-slate-200 relative overflow-hidden">
                    <img
                      src={`https://source.unsplash.com/800x600/?${trip.destination || 'travel'}`}
                      alt={trip.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop';
                      }}
                    />
                    
                    {/* Lớp phủ & Nút hành động (Có stopPropagation để ngăn click lan ra ngoài) */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-3 gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); /* Ngăn click mở trang */ }} 
                        className="h-8 w-8 rounded-full bg-white/90 backdrop-blur text-slate-700 flex items-center justify-center hover:bg-white hover:text-[#FF5645] transition-colors shadow-sm" 
                        title="Share trip"
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); /* Ngăn click mở trang */ }} 
                        className="h-8 w-8 rounded-full bg-white/90 backdrop-blur text-slate-700 flex items-center justify-center hover:bg-white transition-colors shadow-sm" 
                        title="Options"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Nội dung card */}
                  <div className="p-4">
                    <h3 className="font-extrabold text-slate-900 text-base line-clamp-1 mb-1 group-hover:text-[#FF5645] transition-colors">
                      {trip.title}
                    </h3>
                    
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="h-5 w-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                        {user.fullName?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex items-center text-xs text-slate-500 font-medium whitespace-nowrap">
                        <span>• {formatDateRange(trip.startDate, trip.endDate)}</span>
                        <span className="mx-1.5">•</span>
                        <span>{countPlaces(trip)} places</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        /* ===================== HERO (Chỉ hiện khi CHƯA ĐĂNG NHẬP) ===================== */
        <>
          <section className="mx-auto max-w-3xl px-6 pb-10 pt-16 text-center sm:pt-24">
            <h1 className="text-4xl font-extrabold leading-tight text-slate-900 sm:text-6xl tracking-tight">
              Tự lên lịch trình cho chuyến đi của riêng bạn
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-500">
              Ghim địa điểm lên bản đồ, chia tiền với bạn đồng hành và giữ lại
              từng chặng đường — tất cả trong một nơi.
            </p>
            <Link
              to="/plan"
              className="group mt-10 inline-flex items-center gap-2 rounded-full bg-[#FF5645] px-8 py-4 text-base font-bold text-white shadow-lg shadow-[#FF5645]/20 transition-all hover:bg-[#E04B3B] active:scale-[0.98]"
            >
              Start planning
              <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </section>

          <div className="mx-auto grid max-w-5xl grid-cols-3 gap-3 px-6 pb-24 sm:gap-4">
            <img src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop" alt="Đường mòn núi" className="h-40 w-full rounded-3xl object-cover sm:h-64 shadow-md" />
            <img src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?q=80&w=800&auto=format&fit=crop" alt="Cung đường ven biển" className="h-40 w-full translate-y-6 rounded-3xl object-cover sm:h-64 shadow-md" />
            <img src="https://images.unsplash.com/photo-1500835556837-99ac94a94552?q=80&w=800&auto=format&fit=crop" alt="Đỉnh núi lúc bình minh" className="h-40 w-full rounded-3xl object-cover sm:h-64 shadow-md" />
          </div>
        </>
      )}

      {/* ===================== TÍNH NĂNG CHUNG ===================== */}
      <section className="border-t border-slate-100 bg-[#F7F8F6]">
        <div className="mx-auto max-w-6xl px-6 py-24 sm:px-10">
          <div className="mb-14 max-w-2xl">
            <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl tracking-tight">
              Một hệ thống, đủ cho cả chuyến đi
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
              Từ lúc lên ý tưởng đến lúc quay về, mọi phần của chuyến đi đều nằm trong cùng một nơi.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, description, tint }) => (
              <div key={title} className={`rounded-3xl p-6 ${tint} border border-white/50 shadow-sm`}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm mb-5">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-700/80">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 px-6 py-10 text-center text-sm font-medium text-slate-400">
        © 2026 TravelPlatform. Khám phá thế giới theo cách của bạn.
      </footer>
    </div>
  );
};

export default Home;