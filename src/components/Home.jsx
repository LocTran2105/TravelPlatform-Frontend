import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'motion/react';
import { ChevronRight, Compass, Plus } from 'lucide-react';
import SiteHeader from './site/SiteHeader';
import TakeoffPlane from './site/TakeoffPlane';
import { HomeGreeting, HomeHero, JourneySteps, SiteFooter } from './site/HomeSections';
import PendingInvitations from './PendingInvitations';
import TripCard from './TripCard';
import HomePlaceMap from './HomePlaceMap';
import useTripActions from './useTripActions';
import { API_BASE_URL } from '../config/api';

// Trang chủ chỉ hiện tối đa ngần này chuyến đi, còn lại xem ở trang cá nhân
const MAX_HOME_TRIPS = 4;

const Home = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  // Máy bay đỏ cất cánh mỗi lần mở trang chủ
  const [showTakeoff, setShowTakeoff] = useState(true);

  // Danh sách chuyến đi của tôi (chủ chuyến đi + chuyến đi tôi tham gia)
  const [myTrips, setMyTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);

  const fetchMyTrips = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setLoadingTrips(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/trips/my-trips`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Sắp xếp chuyến đi mới nhất lên đầu
      const sortedTrips = [...response.data].sort((a, b) => b.id - a.id);
      setMyTrips(sortedTrips);
    } catch (error) {
      console.error("Lỗi lấy danh sách chuyến đi:", error);
    } finally {
      setLoadingTrips(false);
    }
  };

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

  // Chia sẻ / đổi quyền hiển thị / xóa chuyến đi (dùng chung với trang cá nhân)
  const tripActions = useTripActions({
    onDeleted: (id) => setMyTrips((prev) => prev.filter((t) => t.id !== id)),
    onVisibilityChanged: (id, visibility) =>
      setMyTrips((prev) => prev.map((t) => (t.id === id ? { ...t, visibility } : t))),
    onShareChanged: fetchMyTrips,
  });

  // Chủ chuyến đi mới được chia sẻ / đổi quyền / xóa; tripmate chỉ thấy nhãn quyền của mình
  const isTripOwner = (trip) => {
    if (!user || !trip?.user) return false;
    if (user.id != null && trip.user.id != null) return user.id === trip.user.id;
    return Boolean(user.email) && String(trip.user.email || '').toLowerCase() === user.email.toLowerCase();
  };
  const myRoleLabel = (trip) => {
    const mine = (trip.members || []).find(
      (m) => m.status === 'ACCEPTED' && String(m.user?.email || '').toLowerCase() === String(user?.email || '').toLowerCase()
    );
    return mine?.role === 'VIEWER' ? 'Chỉ xem' : 'Bạn đồng hành';
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setMyTrips([]);
    navigate('/');
  };

  const scrollToMap = () => {
    document.getElementById('home-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Trang chủ chỉ hiện tối đa 4 thẻ; nhiều hơn thì có nút "Xem tất cả"
  const visibleTrips = myTrips.slice(0, MAX_HOME_TRIPS);
  const hasMoreTrips = myTrips.length > MAX_HOME_TRIPS;

  return (
    <div className="tp-site min-h-screen w-full antialiased">
      <SiteHeader user={user} onLogout={handleLogout} />
      {showTakeoff && <TakeoffPlane onDone={() => setShowTakeoff(false)} />}

      {isLoggedIn ? (
        <>
          <section className="mx-auto max-w-7xl px-4 pt-8 pb-6 sm:px-6 lg:px-8">
            {/* Lời mời tham gia chuyến đi (chỉ hiện khi có) */}
            <PendingInvitations onJoined={fetchMyTrips} />

            <HomeGreeting user={user} trips={myTrips} loading={loadingTrips} onExplore={scrollToMap} />

            <div className="mt-12 mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Chuyến đi của bạn</h2>
                <p className="mt-1 text-sm text-slate-500">Gần đây và sắp tới, gồm cả chuyến bạn được mời tham gia.</p>
              </div>
              {hasMoreTrips && (
                <Link
                  to="/profile"
                  className="tp-btn-ghost px-4 py-2 text-sm"
                >
                  Xem tất cả {myTrips.length} chuyến <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>

            {loadingTrips ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-label="Đang tải chuyến đi">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="overflow-hidden rounded-2xl border border-slate-100">
                    <div className="tp-skeleton h-40 rounded-none" />
                    <div className="space-y-2 p-4"><div className="tp-skeleton h-4 w-3/4" /><div className="tp-skeleton h-3 w-1/2" /></div>
                  </div>
                ))}
              </div>
            ) : myTrips.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-[var(--tp-paper)] py-14 text-center">
                <Compass className="mx-auto mb-4 h-11 w-11 text-slate-300" />
                <h3 className="text-lg font-bold text-slate-800">Bạn chưa có chuyến đi nào</h3>
                <p className="mt-1 mb-5 text-sm text-slate-500">Chọn điểm đến và ngày đi, phần còn lại sắp xếp sau.</p>
                <Link to="/plan" className="tp-btn-primary px-6 py-2.5 text-sm">
                  <Plus className="h-4 w-4" /> Lên kế hoạch chuyến đầu tiên
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {visibleTrips.map((trip, i) => {
                  const owner = isTripOwner(trip);
                  return (
                    <motion.div
                      key={trip.id}
                      className="tp-trip-card rounded-2xl"
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 * i, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
                      whileHover={{ y: -4 }}
                    >
                      <TripCard
                        trip={trip}
                        canManage={owner}
                        roleLabel={owner ? null : myRoleLabel(trip)}
                        ownerInitial={owner ? user.fullName : trip.user?.fullName}
                        busy={tripActions.busyOf(trip.id)}
                        onOpen={() => navigate(`/trips/${trip.id}`)}
                        onShare={() => tripActions.openShare(trip)}
                        onChangeVisibility={(value) => tripActions.changeVisibility(trip, value)}
                        onDelete={() => tripActions.askDelete(trip)}
                      />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ===================== BẢN ĐỒ TRA CỨU ĐỊA ĐIỂM ===================== */}
          <HomePlaceMap />
        </>
      ) : (
        <HomeHero />
      )}

      <JourneySteps />
      <SiteFooter />

      {/* Hộp thoại xác nhận xóa / báo lỗi và modal chia sẻ */}
      {tripActions.dialogs}
    </div>
  );
};

export default Home;