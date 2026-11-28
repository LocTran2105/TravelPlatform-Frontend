import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Compass, Pencil, FileText } from 'lucide-react';
import SiteHeader from './site/SiteHeader';
import FollowButton from './FollowButton';
import FollowListModal from './FollowListModal';
import TripCard from './TripCard';
import useTripActions from './useTripActions';
import PostCard from './PostCard';
import PostDialog from './PostDialog';
import usePostActions from './usePostActions';
import { API_BASE_URL } from '../config/api';

const PublicProfile = () => {
  const [posts, setPosts] = useState([]);
  const [postsError, setPostsError] = useState(false);
  // Bài viết đang mở trong hộp thoại: nhớ cả hồ sơ đang xem để tự đóng khi chuyển sang hồ sơ khác
  const [openPost, setOpenPost] = useState(null); // { id, owner }
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
            const resCurrentUser = await axios.get(`${API_BASE_URL}/api/users/profile`, { headers });
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
            `${API_BASE_URL}/api/users/${encodeURIComponent(targetUsername)}`,
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
        const tripsUrl = `${API_BASE_URL}/api/trips/user/${encodeURIComponent(targetUsername)}`;

        const postsUrl = `${API_BASE_URL}/api/posts/user/${encodeURIComponent(targetUsername)}`; // URL BÀI ĐĂNG

        const [followerRes, followingRes, tripsRes, infoRes, postsRes] = await Promise.allSettled([ // THÊM postsRes
          axios.get(`${API_BASE_URL}/api/social/users/${encodeURIComponent(targetUsername)}/followers`, { headers }),
          axios.get(`${API_BASE_URL}/api/social/users/${encodeURIComponent(targetUsername)}/following`, { headers }),
          axios.get(tripsUrl, { headers }),
          axios.get(`${API_BASE_URL}/api/social/users/${encodeURIComponent(targetUsername)}/follow-info`, { headers }),
          axios.get(postsUrl, { headers }) // GỌI API BÀI ĐĂNG
        ]);

        
        // XỬ LÝ BÀI ĐĂNG (tách riêng, không nằm trong readPage nữa)
        if (postsRes.status === 'fulfilled') {
          const postsData = postsRes.value.data;
          setPosts(Array.isArray(postsData) ? postsData : postsData?.items ?? postsData?.content ?? []);
          setPostsError(false);
        } else {
          console.error('Không tải được bài đăng', postsRes.reason);
          setPosts([]);
          setPostsError(true);
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

  // Chia sẻ / đổi quyền hiển thị / xóa chuyến đi: giống hệt trang chủ (chỉ chủ hồ sơ mới có)
  const tripActions = useTripActions({
    onDeleted: (id) => setTrips((prev) => prev.filter((t) => t.id !== id)),
    onVisibilityChanged: (id, visibility) =>
      setTrips((prev) => prev.map((t) => (t.id === id ? { ...t, visibility } : t))),
  });

  // Thả tim / số bình luận của bài viết (dùng chung cho thẻ và hộp thoại)
  const postActions = usePostActions(setPosts);
  const dialogPost = openPost && profileUser && openPost.owner === profileUser.username
    ? posts.find((p) => p.id === openPost.id) || null
    : null;
  const closePost = useCallback(() => { setOpenPost(null); }, []);

  const reloadPosts = () => {
    if (!profileUser) return;
    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    axios.get(`${API_BASE_URL}/api/posts/user/${encodeURIComponent(profileUser.username)}`, { headers })
      .then((res) => {
        const data = res.data;
        setPosts(Array.isArray(data) ? data : data?.items ?? data?.content ?? []);
        setPostsError(false);
      })
      .catch(() => setPostsError(true));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#FF5645]"></div></div>;
  if (!profileUser) return <div className="text-center mt-20 font-bold text-xl">Không tìm thấy người dùng.</div>;

  return (
    <div className="tp-site min-h-screen !bg-slate-50 text-slate-900">
      <SiteHeader search={false} onLogout={() => { localStorage.clear(); navigate('/login'); }} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex flex-col md:flex-row gap-8">
        
        <aside className="w-full md:w-[280px] shrink-0 h-fit rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-full bg-slate-100 border border-slate-200">
            {profileUser.avatar ? (
              <img src={profileUser.avatar} alt="Ảnh đại diện" className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl font-bold text-slate-400">{profileUser.fullName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <h1 className="mt-4 text-xl font-black">{profileUser.fullName}</h1>
          <p className="text-sm font-medium text-slate-500 mb-6">@{profileUser.username}</p>

          <div className="flex justify-center gap-8 mb-6 border-y border-slate-100 py-4">
            <div className="cursor-pointer group" onClick={() => openFollowModal('followers')}>
              <div className="text-lg font-black group-hover:text-[#FF5645] transition-colors">{followerCount}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Người theo dõi</div>
            </div>
            <div className="cursor-pointer group" onClick={() => openFollowModal('following')}>
              <div className="text-lg font-black group-hover:text-[#FF5645] transition-colors">{followingCount}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Đang theo dõi</div>
            </div>
          </div>

          {isMyProfile ? (
            <Link to="/settings" className="flex items-center justify-center gap-2 w-full rounded-full bg-slate-100 py-3 text-sm font-bold text-slate-800 hover:bg-slate-200 transition-colors">
              <Pencil className="h-4 w-4" /> Chỉnh sửa hồ sơ
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
              <Compass className="h-4.5 w-4.5" /> Kế hoạch chuyến đi
              {activeTab === 'trips' && <div className="absolute -bottom-[2px] left-0 right-0 h-[2px] bg-[#FF5645]" />}
            </button>
            <button 
              className={`flex items-center gap-2 pb-3 font-bold transition-all relative ${activeTab === 'posts' ? 'text-[#FF5645]' : 'text-slate-500 hover:text-slate-800'}`}
              onClick={() => setActiveTab('posts')}
            >
              <FileText className="h-4.5 w-4.5" /> Bài viết
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
                        <TripCard
                            key={trip.id}
                            trip={trip}
                            canManage={Boolean(isMyProfile)}
                            ownerInitial={profileUser.fullName}
                            busy={tripActions.busyOf(trip.id)}
                            onOpen={() => navigate(`/trips/${trip.id}`)}
                            onShare={() => tripActions.openShare(trip)}
                            onChangeVisibility={(value) => tripActions.changeVisibility(trip, value)}
                            onDelete={() => tripActions.askDelete(trip)}
                        />
                    ))
                )}
             </div>
          ) : (
             <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {postsError ? (
                    <div className="col-span-full py-20 text-center">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">Không tải được bài viết.</p>
                        <button
                          type="button"
                          onClick={reloadPosts}
                          className="mt-4 rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800"
                        >
                          Thử lại
                        </button>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="col-span-full py-20 text-center">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">Người dùng chưa có bài viết nào.</p>
                    </div>
                ) : (
                    posts.map(post => (
                        <PostCard
                            key={post.id}
                            post={post}
                            canManage={Boolean(isMyProfile)}
                            onOpen={() => { postActions.clearNotice(); setOpenPost({ id: post.id, owner: profileUser.username }); }}
                        />
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

      {/* Hộp thoại xem bài viết */}
      {dialogPost && (
        <PostDialog
          post={dialogPost}
          currentUser={currentUser}
          showVisibility={Boolean(isMyProfile)}
          notice={postActions.notice}
          onClose={closePost}
          onToggleLike={postActions.toggleLike}
          onCommentCount={postActions.setCommentCount}
        />
      )}

      {/* Hộp thoại xác nhận xóa / báo lỗi và modal chia sẻ chuyến đi */}
      {tripActions.dialogs}
    </div>
  );
};

export default PublicProfile;