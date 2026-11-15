import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Compass, MapPin, Image as ImageIcon, Send,
  Heart, MessageCircle, Share2, X, MoreHorizontal, Pencil, Trash2
} from 'lucide-react';
import FollowButton from './FollowButton';
import UserMenu from './UserMenu'; // chỉnh lại đường dẫn cho đúng

const API = 'http://localhost:8080/api';

// ---------------------------------------------------------------------------
// Hằng số & hàm dùng chung
// ---------------------------------------------------------------------------

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', icon: '🌎', label: 'Công khai' },
  { value: 'FOLLOWERS', icon: '👥', label: 'Người theo dõi' },
  { value: 'FRIENDS', icon: '🤝', label: 'Bạn bè' },
  { value: 'PRIVATE', icon: '🔒', label: 'Chỉ mình tôi' },
];

const getVisibility = (value) =>
  VISIBILITY_OPTIONS.find((o) => o.value === value) || VISIBILITY_OPTIONS[0];

const getToken = () => localStorage.getItem('token');

const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem('user'); // dữ liệu hỏng thì bỏ đi, không làm sập trang
    return null;
  }
};

const errorMessage = (error) => {
  const data = error.response?.data;
  if (typeof data === 'string' && data) return data;
  if (data?.message) return data.message;
  return error.message;
};

const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('vi-VN');
};

// ---------------------------------------------------------------------------
// Menu 3 chấm (chỉ hiện với bài của chính mình)
// ---------------------------------------------------------------------------

const PostMenu = ({ onEdit, onDelete }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Tùy chọn bài viết"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onEdit(); }}
            className="flex w-full items-center gap-2.5 border-b border-slate-100 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" /> Chỉnh sửa
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" /> Xóa bài
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Hộp thoại chỉnh sửa bài (nội dung + quyền hiển thị)
// ---------------------------------------------------------------------------

const EditPostModal = ({ post, onClose, onSaved }) => {
  const [caption, setCaption] = useState(post.caption || '');
  const [visibility, setVisibility] = useState(post.visibility || 'PUBLIC');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const hasMedia = (post.imageUrls?.length || 0) + (post.videoUrls?.length || 0) > 0;
  const canSave = !saving && (caption.trim().length > 0 || hasMedia);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [saving, onClose]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await axios.put(
        `${API}/posts/${post.id}`,
        { caption: caption.trim(), visibility },
        { headers: authHeaders() }
      );
      onSaved(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Chỉnh sửa bài viết"
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-slate-900">Chỉnh sửa bài viết</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Đóng"
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={5}
          autoFocus
          placeholder="Bạn đang nghĩ gì về chuyến đi?"
          className="w-full resize-none rounded-2xl border border-slate-200 p-3 text-base outline-none focus:border-[#FF5645]"
        />

        {hasMedia && (
          <p className="mt-2 text-xs text-slate-500">
            Ảnh/video của bài viết được giữ nguyên.
          </p>
        )}

        <label className="mt-4 block text-sm font-semibold text-slate-600">
          Ai có thể xem bài viết này?
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="mt-1.5 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-[#FF5645]"
          >
            {VISIBILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.icon} {o.label}</option>
            ))}
          </select>
        </label>

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Trang Cộng đồng
// ---------------------------------------------------------------------------

const Community = () => {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState(null);

  // Form đăng bài
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [visibility, setVisibility] = useState('PUBLIC');
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef(null);

  // Vị trí (Photon API)
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const locationBoxRef = useRef(null);

  // --- Tải bảng tin ---------------------------------------------------------
  // PHẢI gửi token: không có token thì backend coi là khách → không biết
  // đâu là bài của mình, không tính được quan hệ (Bạn bè / Theo dõi...) và
  // không trả các bài FOLLOWERS / FRIENDS / PRIVATE.
  const fetchPosts = async () => {
    const load = (headers) => axios.get(`${API}/posts`, { headers });
    try {
      let response;
      try {
        response = await load(authHeaders());
      } catch (err) {
        // Token hết hạn → thử lại với tư cách khách thay vì để trang trống
        if (getToken() && [401, 403].includes(err.response?.status)) {
          response = await load({});
        } else {
          throw err;
        }
      }
      const data = response.data;
      setPosts(Array.isArray(data) ? data : data?.content ?? []);
    } catch (error) {
      console.error('Lỗi lấy bài viết:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setUser(readStoredUser());
    fetchPosts();

    // Lấy user thật từ server (localStorage có thể thiếu username)
    if (getToken()) {
      axios
        .get(`${API}/users/profile`, { headers: authHeaders() })
        .then((res) => setUser(res.data))
        .catch(() => { /* giữ user từ localStorage */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Tìm địa điểm (Photon) ------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const fetchPlaces = async () => {
      if (searchQuery.trim().length < 2) {
        setSuggestions([]);
        return;
      }
      setIsSearching(true);
      try {
        const query = encodeURIComponent(searchQuery.trim());
        const response = await fetch(`https://photon.komoot.io/api/?q=${query}&limit=5`);
        const data = await response.json();
        if (cancelled) return; // bỏ kết quả của lần gõ cũ
        const places = (data.features ?? [])
          .map((feature) => {
            const prop = feature.properties;
            return {
              name: prop.name || prop.street || prop.city,
              address: [prop.city, prop.state, prop.country].filter(Boolean).join(', '),
              lat: feature.geometry.coordinates[1],
              lon: feature.geometry.coordinates[0],
            };
          })
          .filter((place) => place.name);
        setSuggestions(places);
      } catch (err) {
        if (!cancelled) console.error(err);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };

    const timer = setTimeout(() => {
      if (showDropdown) fetchPlaces();
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, showDropdown]);

  // Bấm ra ngoài ô địa điểm thì đóng danh sách gợi ý
  useEffect(() => {
    if (!showDropdown) return undefined;
    const handleClickOutside = (e) => {
      if (locationBoxRef.current && !locationBoxRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const handleSelectPlace = (place) => {
    setLocationName(place.name);
    setLatitude(place.lat);
    setLongitude(place.lon);
    setSearchQuery('');
    setSuggestions([]);
    setShowDropdown(false);
  };

  // --- Chọn / bỏ file -------------------------------------------------------
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = ''; // để chọn lại cùng file vẫn nhận
  };

  // Giải phóng URL xem trước khi đổi file / rời trang
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // --- Đăng bài -------------------------------------------------------------
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!caption.trim() && !selectedFile) return;

    if (!getToken()) {
      alert('Vui lòng đăng nhập để đăng bài!');
      return;
    }

    setIsPosting(true);
    const formData = new FormData();
    formData.append('caption', caption);
    formData.append('visibility', visibility);
    if (locationName) formData.append('locationName', locationName);
    if (latitude !== null) formData.append('latitude', latitude);
    if (longitude !== null) formData.append('longitude', longitude);
    if (selectedFile) formData.append('files', selectedFile);

    try {
      // Không tự đặt Content-Type: để trình duyệt thêm boundary cho multipart
      await axios.post(`${API}/posts`, formData, { headers: authHeaders() });

      setCaption('');
      setLocationName('');
      setLatitude(null);
      setLongitude(null);
      setVisibility('PUBLIC');
      handleRemoveFile();
      fetchPosts();
    } catch (error) {
      alert('Lỗi khi đăng bài: ' + errorMessage(error));
    } finally {
      setIsPosting(false);
    }
  };

  // --- Sửa / xóa bài --------------------------------------------------------
  const handlePostSaved = (updated) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    setEditingPost(null);
    fetchPosts(); // quyền mới có thể làm bài ẩn/hiện với người khác → đồng bộ lại
  };

  const handleDeletePost = async (post) => {
    if (!window.confirm('Xóa bài viết này? Bài viết sẽ biến mất khỏi bảng tin và trang cá nhân.')) return;
    try {
      await axios.delete(`${API}/posts/${post.id}`, { headers: authHeaders() });
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (error) {
      alert('Không thể xóa bài viết: ' + errorMessage(error));
    }
  };

  // --- Theo dõi / hủy theo dõi từ bài viết ---------------------------------
  // Cập nhật mọi bài của cùng tác giả để badge đổi ngay, rồi đồng bộ lại
  // (theo dõi/hủy theo dõi có thể làm hiện/ẩn bài FOLLOWERS / FRIENDS).
  const handleFollowChange = (authorUsername, isNowFollowing) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.authorUsername === authorUsername ? { ...p, followedByMe: isNowFollowing } : p
      )
    );
    fetchPosts();
  };

  const isOwnPost = (post) =>
    post.relationship === 'SELF' ||
    Boolean(user?.username && user.username === post.authorUsername);

  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans text-slate-900 antialiased">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF5645] text-white shadow-sm">
                <Compass className="h-5 w-5" />
              </div>
              <span className="text-lg font-extrabold tracking-tight">TravelPlatform</span>
            </Link>
            <nav className="hidden items-center gap-2 md:flex">
              <Link to="/home" className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Home</Link>
              <span className="rounded-lg bg-red-50 px-3.5 py-2 text-sm font-semibold text-[#FF5645]">Community</span>
            </nav>
          </div>
          {user ? (
            <UserMenu user={user} />
          ) : (
            <Link to="/login" className="text-sm font-bold text-[#FF5645]">Đăng nhập</Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

        {/* ================= FORM ĐĂNG BÀI ================= */}
        {user && (
          <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <form onSubmit={handleCreatePost}>
              <div className="flex gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
                  {user.fullName?.charAt(0).toUpperCase()}
                </div>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Chia sẻ trải nghiệm du lịch của bạn..."
                  className="w-full resize-none bg-transparent pt-2 text-base outline-none placeholder:text-slate-400"
                  rows="2"
                />
              </div>

              {/* Xem trước ảnh/video */}
              {previewUrl && selectedFile && (
                <div className="relative ml-14 mt-3 h-32 w-32 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                  {selectedFile.type.startsWith('video/') ? (
                    <video src={previewUrl} className="h-full w-full object-cover" muted />
                  ) : (
                    <img src={previewUrl} alt="Xem trước" className="h-full w-full object-cover" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 truncate bg-black/60 p-1 text-center text-[10px] text-white backdrop-blur-sm">
                    {selectedFile.name.length > 20
                      ? selectedFile.name.substring(0, 15) + '...' + selectedFile.name.substring(selectedFile.name.lastIndexOf('.'))
                      : selectedFile.name}
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    aria-label="Bỏ file đã chọn"
                    className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white transition-colors hover:bg-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Thanh công cụ (chỉ MỘT khối, trước đây bị lặp 2 lần) */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100"
                  >
                    <ImageIcon className="h-4 w-4 text-emerald-500" /> Ảnh/Video
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*,video/*"
                  />

                  {/* Tìm địa điểm */}
                  <div className="relative" ref={locationBoxRef}>
                    {locationName ? (
                      <div className="flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-sm font-semibold text-[#FF5645]">
                        <MapPin className="h-4 w-4" />
                        <span>{locationName}</span>
                        <button
                          type="button"
                          aria-label="Bỏ địa điểm"
                          onClick={() => { setLocationName(''); setLatitude(null); setLongitude(null); }}
                          className="ml-1 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative z-10 flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-600 transition-colors focus-within:border-[#FF5645] focus-within:bg-white">
                        <MapPin className="h-4 w-4 text-[#FF5645]" />
                        <input
                          type="text"
                          placeholder="Check-in..."
                          value={searchQuery}
                          onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                          onFocus={() => setShowDropdown(true)}
                          className="w-24 bg-transparent outline-none transition-all duration-300 ease-in-out placeholder:font-normal focus:w-48"
                        />
                        {isSearching && (
                          <div className="ml-1 h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-[#FF5645]" />
                        )}
                      </div>
                    )}

                    {showDropdown && suggestions.length > 0 && !locationName && (
                      <div className="absolute left-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                        {suggestions.map((place, idx) => (
                          <div
                            key={`${place.lat}-${place.lon}-${idx}`}
                            onClick={() => handleSelectPlace(place)}
                            className="flex cursor-pointer items-start gap-3 border-b border-slate-50 px-4 py-3 last:border-0 hover:bg-orange-50"
                          >
                            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#FF5645]" />
                            <div className="flex-1 overflow-hidden">
                              <p className="truncate text-sm font-bold text-slate-800">{place.name}</p>
                              <p className="truncate text-xs text-slate-500">{place.address}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Quyền hiển thị */}
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                    aria-label="Quyền hiển thị bài viết"
                    className="cursor-pointer rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 outline-none transition-colors hover:bg-slate-200"
                  >
                    {VISIBILITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.icon} {o.label}</option>
                    ))}
                  </select>

                  <button
                    type="submit"
                    disabled={isPosting || (!caption.trim() && !selectedFile)}
                    className="flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isPosting ? 'Đang đăng...' : <><Send className="h-4 w-4" /> Đăng bài</>}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ================= DÒNG THỜI GIAN ================= */}
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#FF5645]" />
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 text-center">
            <h3 className="text-lg font-bold text-slate-700">Chưa có bài viết nào</h3>
            <p className="text-sm text-slate-500">Hãy là người đầu tiên chia sẻ hành trình của bạn.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => {
              const own = isOwnPost(post);
              const vis = getVisibility(post.visibility);

              return (
                <div key={post.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

                  {/* --- Header bài đăng --- */}
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Link
                        to={`/profile/${post.authorUsername}`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-bold text-slate-700"
                      >
                        {post.authorAvatar ? (
                          <img src={post.authorAvatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          post.authorName?.charAt(0).toUpperCase()
                        )}
                      </Link>

                      <div className="min-w-0">
                        <Link
                          to={`/profile/${post.authorUsername}`}
                          className="block truncate font-bold leading-none text-slate-900 hover:underline"
                        >
                          {post.authorName}
                        </Link>
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span className="font-semibold">@{post.authorUsername}</span>
                          <span>•</span>
                          <span>{formatDate(post.createdAt)}</span>
                          <span>•</span>
                          <span title={`Quyền xem: ${vis.label}`}>{vis.icon} {vis.label}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {/* Badge quan hệ: dùng chính FollowButton như trang cá nhân
                          (Theo dõi / Theo dõi lại / Đang theo dõi / Bạn bè) */}
                      {user && !own && (
                        <div className="w-32 [&_button]:!w-full [&_button]:!px-3 [&_button]:!py-1.5 [&_button]:!text-xs">
                          <FollowButton
                            key={`${post.authorUsername}-${post.followedByMe}-${post.followingMe}`}
                            targetUsername={post.authorUsername}
                            initialIsFollowing={Boolean(post.followedByMe)}
                            isFollowingMe={Boolean(post.followingMe)}
                            onFollowChange={(isNowFollowing) =>
                              handleFollowChange(post.authorUsername, isNowFollowing)
                            }
                          />
                        </div>
                      )}

                      {/* Menu 3 chấm: chỉ chủ bài mới có Sửa / Xóa */}
                      {own && (
                        <PostMenu
                          onEdit={() => setEditingPost(post)}
                          onDelete={() => handleDeletePost(post)}
                        />
                      )}
                    </div>
                  </div>

                  {post.caption && (
                    <p className="mb-3 whitespace-pre-wrap text-base text-slate-700">{post.caption}</p>
                  )}

                  {post.locationName && (
                    <div className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-bold text-[#FF5645]">
                      <MapPin className="h-4 w-4" /> {post.locationName}
                    </div>
                  )}

                  {post.imageUrls?.length > 0 && (
                    <div className="mb-4 h-80 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                      <img src={post.imageUrls[0]} alt="Ảnh bài viết" className="h-full w-full object-cover" />
                    </div>
                  )}
                  {post.videoUrls?.length > 0 && (
                    <div className="mb-4 h-80 w-full overflow-hidden rounded-2xl bg-black">
                      <video src={post.videoUrls[0]} controls className="h-full w-full object-contain" />
                    </div>
                  )}

                  <div className="flex items-center gap-6 border-t border-slate-100 pt-2">
                    <button type="button" className="group flex items-center gap-2 text-slate-500 transition-colors hover:text-rose-500">
                      <Heart className="h-5 w-5 transition-transform group-active:scale-90" />
                      <span className="text-sm font-semibold">Thích</span>
                    </button>
                    <button type="button" className="flex items-center gap-2 text-slate-500 transition-colors hover:text-sky-500">
                      <MessageCircle className="h-5 w-5" />
                      <span className="text-sm font-semibold">Bình luận</span>
                    </button>
                    <button type="button" aria-label="Chia sẻ" className="ml-auto flex items-center gap-2 text-slate-500 transition-colors hover:text-emerald-500">
                      <Share2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {editingPost && (
        <EditPostModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSaved={handlePostSaved}
        />
      )}
    </div>
  );
};

export default Community;