import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Compass, Pencil, FileText, Share2, MapPin } from 'lucide-react';
import UserMenu from './UserMenu';
import FollowButton from './FollowButton';
import FollowListModal from './FollowListModal';

// Biểu tượng + nhãn quyền hiển thị của bài viết
const VISIBILITY_INFO = {
  PUBLIC: { icon: '🌎', label: 'Công khai' },
  FOLLOWERS: { icon: '👥', label: 'Người theo dõi' },
  FRIENDS: { icon: '🤝', label: 'Bạn bè' },
  PRIVATE: { icon: '🔒', label: 'Chỉ mình tôi' },
};

const PublicProfile = () => {
  const [posts, setPosts] = useState([]); // Khai báo state (post)
  const { username } = useParams(); // URL có thể là /profile hoặc /profile/loctran
  const navigate = useNavigate();
  
  const [currentUser, setCurrentUser] = useState(null); 
  const [profileUser, setProfileUser] = useState(null); 
  
  const [activeTab, setActiveTab] = useState('trips');
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
  const [modalType, setModalType] = useState('followers'); 
  // Quan hệ giữa người đang xem và hồ sơ này (lấy từ API follow-info)
  const [relation, setRelation] = useState({ followedByMe: false, followingMe: false });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const loadData = async () => {
      setLoading(true);
      try {
        let loggedInUser = null;

        // 1. GỌI API LẤY THÔNG TIN USER ĐANG ĐĂNG NHẬP (Thay vì dùng localStorage)
        if (token) {
          try {
            const resCurrentUser = await axios.get('http://localhost:8080/api/users/profile', { headers });
            loggedInUser = resCurrentUser.data;
            setCurrentUser(loggedInUser);
          } catch (err) {
            console.error("Lỗi xác thực, token có thể đã hết hạn", err);
            localStorage.removeItem('token'); // Clear token nếu lỗi
          }
        }

        // 2. ĐIỀU HƯỚNG NẾU URL TRỐNG USERNAME
        let targetUsername = username ? username.toLowerCase() : username;
        if (!targetUsername) {
          if (loggedInUser && loggedInUser.username) {
            navigate(`/profile/${loggedInUser.username}`, { replace: true });
            return; // Dừng thực thi để chạy lại useEffect với URL mới
          } else {
            navigate('/login');
            return;
          }
        }

        // 3. TẢI HỒ SƠ ĐANG XEM (bắt buộc phải có) - luôn gửi kèm headers
        let profile;
        try {
          const userRes = await axios.get(
            `http://localhost:8080/api/users/${encodeURIComponent(targetUsername)}`,
            { headers }
          );
          profile = userRes.data;
        } catch (error) {
          console.error('Không tải được hồ sơ người dùng', error);
          setProfileUser(null);
          return;
        }
        setProfileUser(profile);

        // 4. CÁC PHẦN PHỤ: lỗi một phần không được làm hỏng cả trang
        // Mọi hồ sơ (kể cả của chính mình) dùng chung một endpoint: chỉ liệt kê chuyến đi
        // do người đó làm chủ, backend tự lọc theo quyền hiển thị của người xem.
        // (/my-trips gồm cả chuyến đi mình chỉ là bạn đồng hành nên không dùng ở đây.)
        const tripsUrl = `http://localhost:8080/api/trips/user/${encodeURIComponent(targetUsername)}`;

        const postsUrl = `http://localhost:8080/api/posts/user/${encodeURIComponent(targetUsername)}`; // URL BÀI ĐĂNG

        const [followerRes, followingRes, tripsRes, infoRes, postsRes] = await Promise.allSettled([ // THÊM postsRes
          axios.get(`http://localhost:8080/api/social/users/${encodeURIComponent(targetUsername)}/followers`, { headers }),
          axios.get(`http://localhost:8080/api/social/users/${encodeURIComponent(targetUsername)}/following`, { headers }),
          axios.get(tripsUrl, { headers }),
          axios.get(`http://localhost:8080/api/social/users/${encodeURIComponent(targetUsername)}/follow-info`, { headers }),
          axios.get(postsUrl, { headers }) // GỌI API BÀI ĐĂNG
        ]);

        
        // XỬ LÝ BÀI ĐĂNG (tách riêng, không nằm trong readPage nữa)
        if (postsRes.status === 'fulfilled') {
          const postsData = postsRes.value.data;
          setPosts(Array.isArray(postsData) ? postsData : postsData?.content ?? []);
        } else {
          console.error('Không tải được bài đăng', postsRes.reason);
          setPosts([]);
        }

        // Nếu request lỗi thì result.value không tồn tại → phải kiểm tra trước,
        // nếu không sẽ ném TypeError và làm hỏng cả trang
        const readPage = (result) => {
          if (result.status !== 'fulfilled') return { items: [], total: 0 };
          const data = result.value.data || {};
          const items = Array.isArray(data) ? data : data.content || [];
          return { items, total: data.totalElements ?? data.page?.totalElements ?? items.length };
        };

        const followerPage = readPage(followerRes);
        const followingPage = readPage(followingRes);
        setFollowers(followerPage.items);
        setFollowerCount(followerPage.total);
        setFollowing(followingPage.items);
        setFollowingCount(followingPage.total);

        // Số đếm và trạng thái follow lấy từ server (follow-info); nếu lỗi thì dùng dữ liệu dự phòng
        if (infoRes.status === 'fulfilled') {
          const info = infoRes.value.data;
          setFollowerCount(info.followersCount);
          setFollowingCount(info.followingCount);
          setRelation({ followedByMe: Boolean(info.followedByMe), followingMe: Boolean(info.followingMe) });
        } else {
          console.error('Không tải được follow-info', infoRes.reason);
          setRelation({ followedByMe: Boolean(profile.followedByMe), followingMe: Boolean(profile.followingMe) });
        }

        if (tripsRes.status === 'fulfilled') {
          const tripsData = tripsRes.value.data;
          const tripList = Array.isArray(tripsData) ? tripsData : tripsData?.content ?? [];
          setTrips([...tripList].sort((a, b) => b.id - a.id));
        } else {
          console.error('Không tải được danh sách chuyến đi', tripsRes.reason);
          setTrips([]);
        }

      } catch (error) {
        console.error("Lỗi tải trang profile", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [username, navigate]);

  const openFollowModal = (type) => {
    setModalType(type);
    setIsFollowModalOpen(true);
  };

  const isMyProfile = currentUser && profileUser && currentUser.username === profileUser.username;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#FF5645]"></div></div>;
  if (!profileUser) return <div className="text-center mt-20 font-bold text-xl">Không tìm thấy người dùng.</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <Compass className="h-6 w-6 text-[#FF5645]" />
            <span className="text-xl font-black">TravelPlatform</span>
          </Link>
          <div className="ml-auto">
             {currentUser ? <UserMenu user={currentUser} onLogout={() => { localStorage.clear(); navigate('/login'); }} /> : <Link to="/login" className="font-bold text-[#FF5645]">Đăng nhập</Link>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex flex-col md:flex-row gap-8">
        
        <aside className="w-full md:w-[280px] shrink-0 h-fit rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-slate-100 border border-slate-200">
            {profileUser.avatar ? (
              <img src={profileUser.avatar} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl font-bold text-slate-400">{profileUser.fullName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <h1 className="mt-4 text-xl font-black">{profileUser.fullName}</h1>
          <p className="text-sm font-medium text-slate-500 mb-6">@{profileUser.username}</p>

          <div className="flex justify-center gap-8 mb-6 border-y border-slate-100 py-4">
            <div className="cursor-pointer group" onClick={() => openFollowModal('followers')}>
              <div className="text-lg font-black group-hover:text-[#FF5645] transition-colors">{followerCount}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Followers</div>
            </div>
            <div className="cursor-pointer group" onClick={() => openFollowModal('following')}>
              <div className="text-lg font-black group-hover:text-[#FF5645] transition-colors">{followingCount}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Following</div>
            </div>
          </div>

          {isMyProfile ? (
            <Link to="/settings" className="flex items-center justify-center gap-2 w-full rounded-full bg-slate-100 py-3 text-sm font-bold text-slate-800 hover:bg-slate-200 transition-colors">
              <Pencil className="h-4 w-4" /> Edit Profile
            </Link>
          ) : (
            <div className="w-full">
              <FollowButton
                 key={profileUser.username}
                 targetUsername={profileUser.username}
                 // JSON trả về dùng chữ thường: followedByMe / followingMe
                 initialIsFollowing={relation.followedByMe}
                 isFollowingMe={relation.followingMe}
                 onFollowChange={(isNowFollowing, info) => {
                   setRelation((prev) => ({ ...prev, followedByMe: isNowFollowing }));
                   if (info && typeof info.followersCount === 'number') {
                     setFollowerCount(info.followersCount); // số đếm thật từ server
                   } else {
                     setFollowerCount((prev) => (isNowFollowing ? prev + 1 : Math.max(prev - 1, 0)));
                   }
                   if (currentUser) {
                     setFollowers((prev) => {
                       const others = prev.filter((f) => f.id !== currentUser.id);
                       return isNowFollowing
                         ? [{
                             id: currentUser.id,
                             username: currentUser.username,
                             fullName: currentUser.fullName,
                             avatar: currentUser.avatar || '',
                             followedByMe: false,
                             followingMe: false
                           }, ...others]
                         : others;
                     });
                   }
                 }}
              />
            </div>
          )}
        </aside>

        <section className="flex-1">
          <div className="mb-6 flex gap-8 border-b-2 border-slate-100 pb-1">
            <button 
              className={`flex items-center gap-2 pb-3 font-bold transition-all relative ${activeTab === 'trips' ? 'text-[#FF5645]' : 'text-slate-500 hover:text-slate-800'}`}
              onClick={() => setActiveTab('trips')}
            >
              <Compass className="h-4.5 w-4.5" /> Trip plans
              {activeTab === 'trips' && <div className="absolute -bottom-[2px] left-0 right-0 h-[2px] bg-[#FF5645]" />}
            </button>
            <button 
              className={`flex items-center gap-2 pb-3 font-bold transition-all relative ${activeTab === 'posts' ? 'text-[#FF5645]' : 'text-slate-500 hover:text-slate-800'}`}
              onClick={() => setActiveTab('posts')}
            >
              <FileText className="h-4.5 w-4.5" /> Journals
              {activeTab === 'posts' && <div className="absolute -bottom-[2px] left-0 right-0 h-[2px] bg-[#FF5645]" />}
            </button>
          </div>

          {activeTab === 'trips' ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {trips.length === 0 ? (
                    <div className="col-span-full py-20 text-center">
                        <p className="text-slate-500 font-medium">Chưa có chuyến đi nào.</p>
                    </div>
                ) : (
                    trips.map(trip => (
                        <div key={trip.id} onClick={() => navigate(`/trips/${trip.id}`)} className="group cursor-pointer rounded-2xl bg-white overflow-hidden border border-slate-200 hover:shadow-lg transition-all">
                            <div className="h-40 relative flex items-center justify-center bg-gradient-to-br from-orange-100 via-red-50 to-slate-100">
                                <div className="flex items-center gap-2 px-4 text-[#FF5645]">
                                    <MapPin className="w-6 h-6 shrink-0" />
                                    <span className="text-lg font-extrabold truncate">{trip.destination || 'Chuyến đi'}</span>
                                </div>
                                <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md rounded-full px-3 py-1 text-xs font-bold text-white flex items-center gap-1">
                                    <Share2 className="w-3 h-3" /> Share
                                </div>
                            </div>
                            <div className="p-4">
                                <h3 className="font-bold text-slate-900 group-hover:text-[#FF5645] truncate">{trip.title}</h3>
                                <p className="mt-1 text-xs text-slate-500">
                                    {trip.startDate
                                        ? `${new Date(trip.startDate).toLocaleDateString('vi-VN')}${trip.endDate ? ' - ' + new Date(trip.endDate).toLocaleDateString('vi-VN') : ''}`
                                        : 'Chưa chọn ngày'}
                                    {/* Chỉ chủ hồ sơ mới thấy chuyến đi đang để quyền gì */}
                                    {isMyProfile && VISIBILITY_INFO[trip.visibility] && (
                                        <span title={`Quyền xem: ${VISIBILITY_INFO[trip.visibility].label}`}>
                                            {' • '}{VISIBILITY_INFO[trip.visibility].icon} {VISIBILITY_INFO[trip.visibility].label}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    ))
                )}
             </div>
          ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {posts.length === 0 ? (
                    <div className="col-span-full py-20 text-center">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">Người dùng chưa có bài viết nào.</p>
                    </div>
                ) : (
                    posts.map(post => (
                        <div 
                          key={post.id} 
                          onClick={() => navigate(`/posts/${post.id}`)} // Giả định bạn có trang chi tiết bài viết
                          className="group cursor-pointer rounded-2xl bg-white overflow-hidden border border-slate-200 hover:shadow-lg transition-all"
                        >
                            <div className="h-64 bg-slate-100 relative overflow-hidden">
                                {post.imageUrls && post.imageUrls.length > 0 ? (
                                    <img 
                                      src={post.imageUrls[0]} 
                                      alt="Post thumbnail" 
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                    />
                                ) : post.videoUrls && post.videoUrls.length > 0 ? (
                                    <video 
                                      src={post.videoUrls[0]} 
                                      className="w-full h-full object-cover" 
                                      muted 
                                      loop 
                                      playsInline
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full w-full bg-slate-200 text-slate-400">
                                        <FileText className="w-10 h-10" />
                                    </div>
                                )}
                                
                                {/* Icon báo hiệu có nhiều ảnh/video */}
                                {((post.imageUrls?.length || 0) + (post.videoUrls?.length || 0)) > 1 && (
                                   <div className="absolute top-3 right-3 bg-black/60 rounded p-1.5 text-white">
                                       <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4h12v12H4zM2 2v16h16V2zM20 6h2v16H6v-2h14z"/></svg>
                                   </div>
                                )}
                            </div>
                            
                            <div className="p-4">
                                <p className="text-sm text-slate-500 mb-1">
                                    {new Date(post.createdAt).toLocaleDateString('vi-VN')}
                                    {/* Chỉ chủ hồ sơ mới thấy bài đang để quyền gì */}
                                    {isMyProfile && VISIBILITY_INFO[post.visibility] && (
                                        <span title={`Quyền xem: ${VISIBILITY_INFO[post.visibility].label}`}>
                                            {' • '}{VISIBILITY_INFO[post.visibility].icon} {VISIBILITY_INFO[post.visibility].label}
                                        </span>
                                    )}
                                </p>
                                <p className="font-medium text-slate-900 line-clamp-2 leading-snug">
                                    {post.caption || "Không có tiêu đề"}
                                </p>
                                {post.locationName && (
                                   <p className="text-xs text-[#FF5645] mt-2 font-bold truncate">
                                      📍 {post.locationName}
                                   </p>
                                )}
                            </div>
                        </div>
                    ))
                )}
             </div>
          )}
        </section>
      </main>

      <FollowListModal 
        isOpen={isFollowModalOpen} 
        onClose={() => setIsFollowModalOpen(false)} 
        title={modalType === 'followers' ? 'Người theo dõi' : 'Đang theo dõi'}
        type={modalType}           // BỔ SUNG DÒNG NÀY
        list={modalType === 'followers' ? followers : following}
        currentUser={currentUser}  // BỔ SUNG DÒNG NÀY
        
        // Bổ sung thêm hàm callback để khi Xóa/Unfollow trong Modal thì bộ đếm ở ngoài cũng giảm
        profileUsername={profileUser.username}
        onListUpdate={(action, targetId, value) => {
          if (action === 'set_follow_state') {
            const patch = (list) => list.map((f) => (f.id === targetId ? { ...f, followedByMe: value } : f));
            setFollowers(patch);
            setFollowing(patch);
          } else if (action === 'remove_follower') {
            // Mình gỡ người này khỏi Followers: họ không còn theo dõi mình nữa
            setFollowerCount((prev) => Math.max(prev - 1, 0));
            setFollowers((prev) => prev.filter((f) => f.id !== targetId));
            setFollowing((prev) => prev.map((f) => (f.id === targetId ? { ...f, followingMe: false } : f)));
          } else if (action === 'toggle_following') {
            // Mình hủy theo dõi người này: họ vẫn có thể nằm trong Followers của mình
            setFollowingCount((prev) => Math.max(prev - 1, 0));
            setFollowing((prev) => prev.filter((f) => f.id !== targetId));
            setFollowers((prev) => prev.map((f) => (f.id === targetId ? { ...f, followedByMe: false } : f)));
          }
        }}
      />
    </div>
  );
};

export default PublicProfile;