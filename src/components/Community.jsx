import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Compass, MapPin, Image as ImageIcon, Send,
  Heart, MessageCircle, Share2, X, MoreHorizontal, Pencil, Trash2, Flag,
  ChevronLeft, ChevronRight, Play
} from 'lucide-react';
import FollowButton from './FollowButton';
import UserMenu from './UserMenu';
import CommentSection from './CommentSection';
import ReportDialog from './ReportDialog';
import { formatCount, formatCountFull } from './formatCount';

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

// Giới hạn khi đăng bài. Backend cũng chặn MAX_FILES; tổng dung lượng khớp
// spring.servlet.multipart.max-request-size (đang là 50MB).
// Số bài tải mỗi lần cuộn (backend giới hạn tối đa 30).
const PAGE_SIZE = 10;

// Hai kiểu bảng tin: xếp hạng theo điểm (backend: sort=ranked) hoặc mới nhất.
const FEED_SORTS = [
  { value: 'ranked', icon: '✨', label: 'Dành cho bạn' },
  { value: 'latest', icon: '🕒', label: 'Mới nhất' },
];

const readStoredSort = () => {
  try {
    const saved = localStorage.getItem('feedSort');
    return FEED_SORTS.some((s) => s.value === saved) ? saved : 'ranked';
  } catch {
    return 'ranked';
  }
};
const MAX_FILES = 10;
const MAX_TOTAL_MB = 50;
const MAX_TOTAL_BYTES = MAX_TOTAL_MB * 1024 * 1024;

// Danh sách ảnh/video của bài theo đúng thứ tự đăng. Bản backend cũ chưa có
// "media" thì ghép từ imageUrls + videoUrls để vẫn hiển thị được.
const getMedia = (post) => {
  if (Array.isArray(post.media) && post.media.length > 0) return post.media;
  return [
    ...(post.imageUrls || []).map((url) => ({ url, type: 'IMAGE' })),
    ...(post.videoUrls || []).map((url) => ({ url, type: 'VIDEO' })),
  ];
};

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

// Chủ bài: onEdit + onDelete. Người khác (đã đăng nhập): chỉ onReport.
const PostMenu = ({ onEdit, onDelete, onReport, reported = false }) => {
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
          {onEdit && (
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onEdit(); }}
              className="flex w-full items-center gap-2.5 border-b border-slate-100 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" /> Chỉnh sửa
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onDelete(); }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" /> Xóa bài
            </button>
          )}
          {onReport && (
            <button
              type="button"
              role="menuitem"
              disabled={reported}
              onClick={() => { setOpen(false); onReport(); }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-default disabled:text-slate-400 disabled:hover:bg-white"
            >
              <Flag className="h-4 w-4" /> {reported ? 'Đã báo cáo' : 'Báo cáo bài viết'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Thư viện ảnh/video của một bài: vuốt hoặc bấm mũi tên để chuyển, nhấp đúp để thả tim
// ---------------------------------------------------------------------------

const SWIPE_THRESHOLD = 40; // px

const MediaGallery = ({ media, showHeart, onDoubleClick }) => {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef(null);

  if (media.length === 0) return null;

  const current = Math.min(index, media.length - 1);
  const item = media[current];
  const multiple = media.length > 1;

  const go = (delta) => setIndex((current + delta + media.length) % media.length);
  const stop = (e) => e.stopPropagation(); // bấm mũi tên liên tục không được tính là nhấp đúp thả tim

  const handleKeyDown = (e) => {
    if (!multiple) return;
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null || !multiple) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) >= SWIPE_THRESHOLD) go(dx < 0 ? 1 : -1);
  };

  return (
    <div
      tabIndex={multiple ? 0 : undefined}
      onKeyDown={handleKeyDown}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={onDoubleClick}
      className={`relative mb-4 h-96 w-full select-none overflow-hidden rounded-2xl border border-slate-200 outline-none ${
        item.type === 'VIDEO' ? 'bg-black' : 'cursor-pointer bg-slate-100'
      }`}
    >
      {/* key={current}: đổi mục thì video cũ bị gỡ ra và dừng phát */}
      {item.type === 'VIDEO' ? (
        <video key={current} src={item.url} controls className="h-full w-full object-contain" />
      ) : (
        <img key={current} src={item.url} alt={`Ảnh ${current + 1}`} className="h-full w-full object-cover" />
      )}

      {multiple && (
        <>
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold text-white">
            {current + 1}/{media.length}
          </span>

          <button
            type="button"
            onClick={() => go(-1)}
            onDoubleClick={stop}
            aria-label="Ảnh trước"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 text-slate-800 shadow transition-colors hover:bg-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            onDoubleClick={stop}
            aria-label="Ảnh sau"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 text-slate-800 shadow transition-colors hover:bg-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {media.map((m, i) => (
              <span
                key={`${m.url}-${i}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === current ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
                }`}
              />
            ))}
          </div>
        </>
      )}

      {/* Tim to ở giữa (chỉ hiện khi nhấp đúp) */}
      {showHeart && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/10">
          <Heart className="animate-heart-pop h-24 w-24 fill-rose-500 text-rose-500 drop-shadow-2xl" />
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Ô xem trước một ảnh/video đã chọn trong form đăng bài
// ---------------------------------------------------------------------------

const AttachmentTile = ({ attachment, onRemove }) => {
  const isVideo = attachment.file.type.startsWith('video/');
  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      {isVideo ? (
        <>
          <video src={attachment.url} className="h-full w-full object-cover" muted />
          <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[10px] font-bold text-white">
            <Play className="h-2.5 w-2.5 fill-white" /> Video
          </span>
        </>
      ) : (
        <img src={attachment.url} alt="Xem trước" className="h-full w-full object-cover" />
      )}
      <button
        type="button"
        onClick={() => onRemove(attachment.id)}
        aria-label={`Bỏ ${attachment.file.name}`}
        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white transition-colors hover:bg-red-500"
      >
        <X className="h-3 w-3" />
      </button>
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

  const hasMedia = getMedia(post).length > 0;
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
  const [user, setUser] = useState(readStoredUser);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);          // { type, id, label } đang báo cáo
  const [reportedPostIds, setReportedPostIds] = useState(() => new Set());

  // Phân trang: nextCursor = id bài cuối của trang đã tải, gửi lại làm "before"
  const [feedSort, setFeedSort] = useState(readStoredSort);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const feedVersion = useRef(0);   // tăng mỗi lần tải lại từ đầu -> bỏ kết quả "trang thêm" của lần cũ
  const sentinelRef = useRef(null);
  const loadMoreRef = useRef(() => {});

  // Form đăng bài
  const [caption, setCaption] = useState('');
  // Nhiều ảnh/video: mỗi phần tử { id, file, url xem trước }
  const [attachments, setAttachments] = useState([]);
  const [fileError, setFileError] = useState('');
  const attachmentsRef = useRef([]);
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

  // Lưu trạng thái xem bài viết nào đang mở bảng bình luận
  const [openComments, setOpenComments] = useState({}); 

  const toggleCommentSection = (postId) => {
    setOpenComments(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  // --- Tải bảng tin (phân trang) ----------------------------------------------
  // PHẢI gửi token: không có token thì backend coi là khách → không biết
  // đâu là bài của mình, không tính được quan hệ (Bạn bè / Theo dõi...) và
  // không trả các bài FOLLOWERS / FRIENDS / PRIVATE.
  // cursor: chuỗi nextCursor của trang trước, gửi lại NGUYÊN VĂN (không tự đọc / ghép).
  const requestPage = async (sort, cursor) => {
    const params = { size: PAGE_SIZE, sort, ...(cursor ? { cursor } : {}) };
    const load = (headers) => axios.get(`${API}/posts`, { headers, params });
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
    // Backend cũ (chưa phân trang) trả mảng: coi như một trang duy nhất.
    if (Array.isArray(data)) return { items: data, hasMore: false, nextCursor: null };
    return {
      items: data?.items ?? data?.content ?? [],
      hasMore: Boolean(data?.hasMore),
      nextCursor: data?.nextCursor ?? null,
    };
  };

  // Tải lại từ trang đầu (lần vào trang, sau khi đăng bài...)
  const fetchPosts = async (sort = feedSort) => {
    const version = ++feedVersion.current;
    try {
      const page = await requestPage(sort, null);
      if (version !== feedVersion.current) return; // đã có lần tải mới hơn
      setPosts(page.items);
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
      setLoadMoreError(false);
    } catch (error) {
      console.error('Lỗi lấy bài viết:', error);
    } finally {
      if (version === feedVersion.current) setLoading(false);
    }
  };

  // Tải trang kế tiếp và NỐI vào cuối danh sách
  const loadMore = async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    const version = feedVersion.current;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const page = await requestPage(feedSort, nextCursor);
      if (version !== feedVersion.current) return; // feed vừa được tải lại, bỏ trang cũ
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))]; // chống trùng bài
      });
      setHasMore(page.hasMore);
      setNextCursor(page.nextCursor);
    } catch (error) {
      console.error('Lỗi tải thêm bài viết:', error);
      if (version === feedVersion.current) setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadMoreRef.current = loadMore;
  });

  // Cuộn gần cuối danh sách thì tự tải trang kế (cách đáy 400px).
  // Tạo lại observer sau mỗi trang để trường hợp trang ngắn, phần tử mốc vẫn
  // đang hiện trên màn hình thì vẫn tiếp tục tải.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!hasMore || loadMoreError || !node || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreRef.current();
      },
      { rootMargin: '400px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMoreError, posts.length]);

  // Đổi tab "Dành cho bạn" / "Mới nhất": tải lại từ đầu theo kiểu mới.
  const changeSort = (next) => {
    if (next === feedSort) return;
    try {
      localStorage.setItem('feedSort', next);
    } catch {
      /* không lưu được thì thôi, chỉ mất lựa chọn ở lần sau */
    }
    setFeedSort(next);
    setPosts([]);
    setHasMore(false);
    setNextCursor(null);
    setLoadMoreError(false);
    setLoading(true);
    fetchPosts(next);
  };

  // Đồng bộ lại feed từ đầu sau thao tác theo dõi / sửa bài. Nếu người dùng
  // đã cuộn qua nhiều trang thì chỉ cập nhật tại chỗ (đã làm ở nơi gọi), tránh
  // làm danh sách đang đọc bị co lại.
  const resyncFeed = () => {
    if (posts.length <= PAGE_SIZE) fetchPosts();
  };

  useEffect(() => {
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
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  // Rời trang thì giải phóng toàn bộ URL xem trước
  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.url));
    };
  }, []);

  const handleFilesChange = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = ''; // để chọn lại đúng file vừa bỏ vẫn nhận
    if (picked.length === 0) return;

    let message = '';
    const next = [...attachments];
    let totalBytes = next.reduce((sum, a) => sum + a.file.size, 0);

    for (const file of picked) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        message = 'Chỉ hỗ trợ ảnh và video.';
        continue;
      }
      const duplicated = next.some(
        (a) => a.file.name === file.name && a.file.size === file.size && a.file.lastModified === file.lastModified
      );
      if (duplicated) continue;
      if (next.length >= MAX_FILES) {
        message = `Mỗi bài tối đa ${MAX_FILES} ảnh/video.`;
        break;
      }
      if (totalBytes + file.size > MAX_TOTAL_BYTES) {
        message = `Tổng dung lượng mỗi bài tối đa ${MAX_TOTAL_MB}MB.`;
        continue;
      }
      totalBytes += file.size;
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        url: URL.createObjectURL(file),
      });
    }

    setAttachments(next);
    setFileError(message);
  };

  const handleRemoveFile = (id) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((a) => a.id !== id);
    });
    setFileError('');
  };

  const clearAttachments = () => {
    attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.url));
    setAttachments([]);
    setFileError('');
  };

  // --- Đăng bài -------------------------------------------------------------
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!caption.trim() && attachments.length === 0) return;

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
    // Cùng một khóa 'files' cho từng file: backend nhận List<MultipartFile>, giữ đúng thứ tự chọn.
    attachments.forEach((a) => formData.append('files', a.file));

    try {
      // Không tự đặt Content-Type: để trình duyệt thêm boundary cho multipart
      await axios.post(`${API}/posts`, formData, { headers: authHeaders() });

      setCaption('');
      setLocationName('');
      setLatitude(null);
      setLongitude(null);
      setVisibility('PUBLIC');
      clearAttachments();
      fetchPosts();
    } catch (error) {
      alert('Lỗi khi đăng bài: ' + errorMessage(error));
    } finally {
      setIsPosting(false);
    }
  };

  // --- Thích / bỏ thích -------------------------------------------------------
  const [heartAnimations, setHeartAnimations] = useState({});
  const likeInFlight = useRef(new Set()); // chặn bấm liên tục khi request trước chưa xong

  const patchPost = (postId, changes) =>
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...changes } : p)));

  const handleToggleLike = async (postId, currentIsLiked) => {
    if (!getToken()) {
      alert('Vui lòng đăng nhập để thao tác!');
      return;
    }
    if (likeInFlight.current.has(postId)) return;

    const snapshot = posts.find((p) => p.id === postId);
    if (!snapshot) return;
    const previous = { isLikedByMe: Boolean(snapshot.isLikedByMe), likeCount: snapshot.likeCount || 0 };

    likeInFlight.current.add(postId);

    // Cập nhật giao diện ngay cho mượt
    patchPost(postId, {
      isLikedByMe: !currentIsLiked,
      likeCount: Math.max(0, previous.likeCount + (currentIsLiked ? -1 : 1)),
    });

    try {
      const url = `${API}/social/likes/POST/${postId}`;
      const res = currentIsLiked
        ? await axios.delete(url, { headers: authHeaders() })
        : await axios.post(url, {}, { headers: authHeaders() });

      // Server trả số tim thật -> đồng bộ lại (có người khác vừa thích / bỏ thích cũng đúng)
      if (typeof res.data?.likeCount === 'number') {
        patchPost(postId, { likeCount: res.data.likeCount, isLikedByMe: Boolean(res.data.liked) });
      }
    } catch (error) {
      console.error('Lỗi khi tương tác:', error);
      patchPost(postId, previous); // hoàn lại đúng trạng thái trước đó
      const status = error.response?.status;
      if (status === 401) {
        alert('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
      } else if (status === 404) {
        alert('Bài viết không còn khả dụng.');
        fetchPosts();
      }
    } finally {
      likeInFlight.current.delete(postId);
    }
  };

  // Nhấp đúp vào ảnh: hiện tim to; chưa thích thì thích (đã thích rồi chỉ hiện hiệu ứng)
  const handleDoubleClickLike = (postId, currentIsLiked) => {
    if (!getToken()) {
      alert('Vui lòng đăng nhập để thao tác!');
      return;
    }
    setHeartAnimations((prev) => ({ ...prev, [postId]: true }));
    setTimeout(() => {
      setHeartAnimations((prev) => ({ ...prev, [postId]: false }));
    }, 800);

    if (!currentIsLiked) {
      handleToggleLike(postId, false);
    }
  };

  // Khu vực bình luận báo lại tổng số -> cập nhật số trên nút (kể cả khi
  // người khác vừa bình luận / xóa).
  const handleCommentCountChange = (postId, total) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId && p.commentCount !== total ? { ...p, commentCount: total } : p))
    );
  };

  // --- Sửa / xóa bài --------------------------------------------------------
  const handlePostSaved = (updated) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
    setEditingPost(null);
    resyncFeed(); // quyền mới có thể làm bài ẩn/hiện với người khác → đồng bộ lại
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
    resyncFeed();
  };

  const isOwnPost = (post) =>
    post.relationship === 'SELF' ||
    Boolean(user?.username && user.username === post.authorUsername);

  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans text-slate-900 antialiased">
      <style>{`
          @keyframes heart-pop {
            0% { transform: scale(0); opacity: 0; }
            15% { transform: scale(1.2); opacity: 0.9; }
            30% { transform: scale(0.95); opacity: 1; }
            45% { transform: scale(1); opacity: 1; }
            80% { transform: scale(1); opacity: 1; }
            100% { transform: scale(1.5); opacity: 0; }
          }
          .animate-heart-pop {
            animation: heart-pop 0.8s ease-in-out forwards;
          }
        `}</style>

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

              {/* Xem trước ảnh/video (nhiều file) */}
              {attachments.length > 0 && (
                <div className="ml-14 mt-3">
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((a) => (
                      <AttachmentTile key={a.id} attachment={a} onRemove={handleRemoveFile} />
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {attachments.length}/{MAX_FILES} ảnh/video
                  </p>
                </div>
              )}
              {fileError && (
                <p role="alert" className="ml-14 mt-2 text-xs font-semibold text-red-600">{fileError}</p>
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
                    onChange={handleFilesChange}
                    className="hidden"
                    accept="image/*,video/*"
                    multiple
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
                    disabled={isPosting || (!caption.trim() && attachments.length === 0)}
                    className="flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                  >
                    {isPosting ? 'Đang đăng...' : <><Send className="h-4 w-4" /> Đăng bài</>}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ================= CHỌN KIỂU BẢNG TIN ================= */}
        <div role="tablist" aria-label="Kiểu bảng tin" className="mb-5 flex gap-2">
          {FEED_SORTS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={feedSort === tab.value}
              onClick={() => changeSort(tab.value)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                feedSort === tab.value
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

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

                      {/* Menu 3 chấm: chủ bài có Sửa / Xóa, người khác (đã đăng nhập) có Báo cáo */}
                      {own && (
                        <PostMenu
                          onEdit={() => setEditingPost(post)}
                          onDelete={() => handleDeletePost(post)}
                        />
                      )}
                      {user && !own && (
                        <PostMenu
                          reported={reportedPostIds.has(post.id)}
                          onReport={() => setReportTarget({ type: 'POST', id: post.id, label: 'bài viết này' })}
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

                  {/* --- MEDIA BÀI VIẾT (NHIỀU ẢNH/VIDEO) --- */}
                  <MediaGallery
                    media={getMedia(post)}
                    showHeart={Boolean(heartAnimations[post.id])}
                    onDoubleClick={() => handleDoubleClickLike(post.id, post.isLikedByMe)}
                  />

                  {/* --- THANH TƯƠNG TÁC --- */}
                  <div className="flex items-center gap-6 border-t border-slate-100 pt-3">

                    {/* Nút tim: số lớn rút gọn (1N, 1,5Tr...), rê chuột xem số đầy đủ */}
                    <button
                      type="button"
                      onClick={() => handleToggleLike(post.id, post.isLikedByMe)}
                      aria-pressed={Boolean(post.isLikedByMe)}
                      title={post.likeCount > 0 ? `${formatCountFull(post.likeCount)} lượt thích` : 'Thích'}
                      className={`group flex items-center gap-2 transition-colors ${post.isLikedByMe ? 'text-rose-500' : 'text-slate-500 hover:text-rose-500'}`}
                    >
                      <Heart
                        className={`h-6 w-6 transition-all duration-300 group-active:scale-75 ${post.isLikedByMe ? 'scale-110 fill-rose-500' : 'scale-100'}`}
                      />
                      <span className="text-sm font-semibold">
                        {post.likeCount > 0 ? formatCount(post.likeCount) : 'Thích'}
                      </span>
                    </button>

                    {/* Nút bình luận: hiện số bình luận giống số tim */}
                    <button
                      type="button"
                      onClick={() => toggleCommentSection(post.id)}
                      aria-expanded={Boolean(openComments[post.id])}
                      title={post.commentCount > 0 ? `${formatCountFull(post.commentCount)} bình luận` : 'Bình luận'}
                      className={`flex items-center gap-2 transition-colors ${openComments[post.id] ? 'text-sky-500' : 'text-slate-500 hover:text-sky-500'}`}
                    >
                      <MessageCircle className="h-6 w-6" />
                      <span className="text-sm font-semibold">
                        {post.commentCount > 0 ? formatCount(post.commentCount) : 'Bình luận'}
                      </span>
                    </button>

                    <button type="button" className="ml-auto flex items-center gap-2 text-slate-500 transition-colors hover:text-emerald-500">
                      <Share2 className="h-6 w-6" />
                    </button>
                  </div>
                {/* --- KHU VỰC BÌNH LUẬN ĐA CẤP (Chỉ hiện khi openComments[post.id] là true) --- */}
                  {openComments[post.id] && (
                    <CommentSection
                      postId={post.id}
                      currentUser={user}
                      onCountChange={(total) => handleCommentCountChange(post.id, total)}
                    />
                  )}
                </div>
              );
            })}

            {/* Phần tử mốc: lọt vào màn hình thì tải trang kế */}
            {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}

            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-slate-200 border-t-[#FF5645]" />
              </div>
            )}

            {hasMore && !loadingMore && loadMoreError && (
              <div className="py-4 text-center">
                <p className="mb-2 text-sm text-red-500">Không tải thêm được bài viết.</p>
                <button
                  type="button"
                  onClick={loadMore}
                  className="rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800"
                >
                  Thử lại
                </button>
              </div>
            )}

            {!hasMore && posts.length > PAGE_SIZE && (
              <p className="py-4 text-center text-sm text-slate-400">Bạn đã xem hết bài viết.</p>
            )}
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

      <ReportDialog
        target={reportTarget}
        onClose={() => setReportTarget(null)}
        onReported={(target) => setReportedPostIds((prev) => new Set(prev).add(target.id))}
      />
    </div>
  );
};

export default Community;