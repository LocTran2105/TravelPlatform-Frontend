import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { X, Heart, MessageCircle, MapPin, Flag, EyeOff } from 'lucide-react';
import { visibilityInfo } from '../utils/trips';
import { getMedia, formatPostDateTime } from '../utils/posts';
import { formatCount, formatCountFull } from './formatCount';
import MediaGallery from './MediaGallery';
import CommentSection from './CommentSection';
import ReportDialog from './ReportDialog';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])';

/**
 * Hộp thoại xem một bài viết ngay trên trang cá nhân: ảnh/video, tác giả, nội dung, địa điểm,
 * thả tim và bình luận (dùng lại CommentSection của trang Cộng đồng).
 *
 * Props:
 *   post          bài đang xem (lấy từ danh sách của trang để số tim/bình luận luôn đồng bộ với thẻ)
 *   currentUser   người đang đăng nhập (null nếu là khách)
 *   showVisibility  hiện badge quyền xem (chỉ chủ bài)
 *   notice        thông báo lỗi khi thả tim (đăng nhập, hết phiên...)
 */
export default function PostDialog({ post, currentUser, showVisibility = false, notice = '', onClose, onToggleLike, onCommentCount }) {
  const media = getMedia(post);
  const info = visibilityInfo(post.visibility);
  const VisIcon = info.Icon;
  const dialogRef = useRef(null);
  const [heartPop, setHeartPop] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reported, setReported] = useState(false);
  const popTimer = useRef(null);
  // Giữ onClose mới nhất trong ref để effect bên dưới chỉ chạy đúng 1 lần (không cướp tiêu điểm khi render lại)
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Khóa cuộn trang nền, trả lại tiêu điểm khi đóng, bẫy phím Tab trong hộp thoại, Esc để đóng
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    const onKey = (ev) => {
      if (ev.key === 'Escape') {
        // Đang gõ dở bình luận thì Esc không được làm mất nội dung
        const t = ev.target;
        const typing = (t?.tagName === 'TEXTAREA' || t?.tagName === 'INPUT') && String(t.value || '').trim() !== '';
        if (!typing) { ev.stopPropagation(); onCloseRef.current(); }
        return;
      }
      if (ev.key !== 'Tab' || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) { ev.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (ev.shiftKey && (active === first || active === dialogRef.current)) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && active === last) { ev.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      clearTimeout(popTimer.current);
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    };
  }, []);

  // Nhấp đúp vào ảnh: hiện tim to; chưa thích thì thích (đã thích rồi chỉ hiện hiệu ứng)
  const handleDoubleClick = () => {
    setHeartPop(true);
    clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => setHeartPop(false), 800);
    if (!post.isLikedByMe) onToggleLike(post);
  };

  const likes = Number(post.likeCount) || 0;
  const comments = Number(post.commentCount) || 0;
  const hasMedia = media.length > 0;
  // Bài của chính mình (relationship = SELF) thì không báo cáo; khách chưa đăng nhập cũng không
  const canReport = Boolean(currentUser) && post.relationship !== 'SELF';
  // Chỉ chủ bài nhận moderationStatus / moderationNote từ backend
  const hiddenByModerator = post.moderationStatus === 'HIDDEN';
  const initial = (post.authorName || post.authorUsername || '?').charAt(0).toUpperCase();

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-0 sm:p-6"
      onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Bài viết của ${post.authorName || post.authorUsername || 'người dùng'}`}
        tabIndex={-1}
        className={`relative flex h-full w-full flex-col overflow-hidden bg-white outline-none sm:h-auto sm:max-h-[90vh] sm:rounded-2xl ${
          hasMedia ? 'max-w-5xl lg:flex-row' : 'max-w-xl'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow transition-colors hover:bg-white"
        >
          <X className="h-5 w-5" />
        </button>

        {hasMedia && (
          <div className="h-72 w-full shrink-0 bg-black sm:h-96 lg:h-auto lg:min-h-[32rem] lg:w-[58%]">
            <MediaGallery key={post.id} media={media} showHeart={heartPop} onDoubleClick={handleDoubleClick} />
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:max-h-[90vh]">
          {/* Tác giả */}
          <div className="flex items-center gap-3 border-b border-slate-100 p-4 pr-14">
            <Link
              to={`/profile/${post.authorUsername}`}
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-500 text-sm font-bold text-white"
              aria-label={`Trang cá nhân của ${post.authorName || post.authorUsername}`}
            >
              {post.authorAvatar ? <img src={post.authorAvatar} alt="" className="h-full w-full object-cover" /> : initial}
            </Link>
            <div className="min-w-0">
              <Link to={`/profile/${post.authorUsername}`} className="block truncate font-bold leading-none text-slate-900 hover:underline">
                {post.authorName || post.authorUsername}
              </Link>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                <span>{formatPostDateTime(post.createdAt)}</span>
                {showVisibility && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600"
                    title={`Quyền xem: ${info.label}`}
                  >
                    <VisIcon className="h-3 w-3" />
                    {info.label}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Nội dung + bình luận (cuộn) */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {hiddenByModerator && (
              <div role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-bold">Bài viết này đã bị kiểm duyệt viên ẩn khỏi cộng đồng.</p>
                  {post.moderationNote && <p className="mt-0.5 break-words">Lý do: {post.moderationNote}</p>}
                  <p className="mt-0.5 text-xs text-red-600/80">Chỉ mình bạn còn thấy bài này. Bạn không thể chỉnh sửa nhưng vẫn có thể xóa.</p>
                </div>
              </div>
            )}

            {post.caption ? (
              <p className="mt-4 whitespace-pre-wrap break-words text-base text-slate-800">{post.caption}</p>
            ) : (
              <p className="mt-4 text-sm italic text-slate-400">Bài viết không có nội dung.</p>
            )}

            {post.locationName && (
              <div className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-bold text-[#FF5645]">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{post.locationName}</span>
              </div>
            )}

            {/* Thanh tương tác */}
            <div className="mt-4 flex items-center gap-6 border-y border-slate-100 py-3">
              <button
                type="button"
                onClick={() => onToggleLike(post)}
                aria-pressed={Boolean(post.isLikedByMe)}
                title={likes > 0 ? `${formatCountFull(likes)} lượt thích` : 'Thích'}
                className={`group flex items-center gap-2 transition-colors ${post.isLikedByMe ? 'text-rose-500' : 'text-slate-500 hover:text-rose-500'}`}
              >
                <Heart className={`h-6 w-6 transition-all duration-300 group-active:scale-75 ${post.isLikedByMe ? 'scale-110 fill-rose-500' : ''}`} />
                <span className="text-sm font-semibold">{likes > 0 ? formatCount(likes) : 'Thích'}</span>
              </button>
              <span
                className="flex items-center gap-2 text-slate-500"
                title={comments > 0 ? `${formatCountFull(comments)} bình luận` : 'Chưa có bình luận'}
              >
                <MessageCircle className="h-6 w-6" />
                <span className="text-sm font-semibold">{comments > 0 ? formatCount(comments) : 'Bình luận'}</span>
              </span>
              {canReport && (
                reported ? (
                  <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                    <Flag className="h-4 w-4" /> Đã báo cáo
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setReportTarget({ type: 'POST', id: post.id, label: 'bài viết này' })}
                    className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-red-600"
                  >
                    <Flag className="h-4 w-4" /> Báo cáo
                  </button>
                )
              )}
            </div>
            {notice && <p role="alert" className="mt-2 text-sm font-medium text-red-600">{notice}</p>}

            <CommentSection
              key={post.id}
              postId={post.id}
              currentUser={currentUser}
              onCountChange={(total) => onCommentCount(post.id, total)}
            />
          </div>
        </div>
      </div>

      <ReportDialog target={reportTarget} onClose={() => setReportTarget(null)} onReported={() => setReported(true)} />
    </div>,
    document.body
  );
}
