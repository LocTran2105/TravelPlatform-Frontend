import { useState } from 'react';
import { FileText, Heart, MessageCircle, MapPin, Play, Images } from 'lucide-react';
import { visibilityInfo } from '../utils/trips';
import { cloudinaryResize } from '../utils/cover';
import { getMedia, formatPostDate } from '../utils/posts';
import { formatCount, formatCountFull } from './formatCount';

/**
 * Thẻ bài viết trên trang cá nhân. Cùng kiểu với thẻ chuyến đi (TripCard):
 * ảnh đầu, nội dung ngắn, số tim + bình luận, badge quyền xem (chỉ chủ bài thấy).
 * Bấm vào thẻ -> mở hộp thoại xem bài.
 */
export default function PostCard({ post, canManage = false, onOpen }) {
  const media = getMedia(post);
  const first = media[0] || null;
  const info = visibilityInfo(post.visibility);
  const VisIcon = info.Icon;
  const date = formatPostDate(post.createdAt);
  const likes = Number(post.likeCount) || 0;
  const comments = Number(post.commentCount) || 0;
  // Nhớ URL ảnh đã lỗi để không hiện icon ảnh vỡ
  const [failedUrl, setFailedUrl] = useState(null);
  const showImage = first?.type === 'IMAGE' && failedUrl !== first.url;

  const label = post.caption ? `Mở bài viết: ${post.caption.slice(0, 60)}` : 'Mở bài viết';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-label={label}
      onClick={onOpen}
      onKeyDown={(ev) => {
        if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === ev.currentTarget) { ev.preventDefault(); onOpen(); }
      }}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white outline-none transition-all hover:border-slate-200 hover:shadow-xl hover:shadow-slate-200/50 focus-visible:ring-2 focus-visible:ring-[#FF5645]"
    >
      {/* Ảnh / video đầu tiên */}
      <div className="relative h-36 w-full overflow-hidden bg-slate-200 sm:h-44">
        {showImage ? (
          <img
            src={cloudinaryResize(first.url, 800, 480)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setFailedUrl(first.url)}
          />
        ) : first?.type === 'VIDEO' ? (
          <>
            <video src={first.url} preload="metadata" muted playsInline className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/25">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow">
                <Play className="h-5 w-5 fill-current" />
              </span>
            </span>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 text-slate-400">
            <FileText className="h-10 w-10" />
          </div>
        )}

        {media.length > 1 && (
          <span
            className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] font-bold text-white"
            title={`${media.length} ảnh/video`}
          >
            <Images className="h-3.5 w-3.5" />
            {media.length}
          </span>
        )}
      </div>

      {/* Nội dung */}
      <div className="flex flex-1 flex-col p-4">
        {post.caption ? (
          <h3 className="line-clamp-2 text-base font-extrabold leading-snug text-slate-900 transition-colors group-hover:text-[#FF5645]">
            {post.caption}
          </h3>
        ) : (
          <h3 className="text-base font-bold italic text-slate-400">Bài viết không có nội dung</h3>
        )}

        <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-500">
          {date && <span className="whitespace-nowrap">{date}</span>}
          {date && post.locationName && <span>•</span>}
          {post.locationName && (
            <span className="flex min-w-0 items-center gap-1 text-[#FF5645]">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-bold">{post.locationName}</span>
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3 text-xs font-bold text-slate-500">
          <span
            className={`inline-flex items-center gap-1.5 ${post.isLikedByMe ? 'text-rose-500' : ''}`}
            title={likes > 0 ? `${formatCountFull(likes)} lượt thích` : 'Chưa có lượt thích'}
          >
            <Heart className={`h-4 w-4 ${post.isLikedByMe ? 'fill-rose-500' : ''}`} />
            {formatCount(likes)}
          </span>
          <span
            className="inline-flex items-center gap-1.5"
            title={comments > 0 ? `${formatCountFull(comments)} bình luận` : 'Chưa có bình luận'}
          >
            <MessageCircle className="h-4 w-4" />
            {formatCount(comments)}
          </span>

          {canManage && (
            <span
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600"
              title={`Quyền xem: ${info.label}`}
            >
              <VisIcon className="h-3 w-3" />
              {info.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
