import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';

const SWIPE_THRESHOLD = 40; // px

/**
 * Thư viện ảnh/video của một bài: vuốt hoặc bấm mũi tên để chuyển, nhấp đúp để thả tim.
 * Lấp đầy phần tử cha (cha cần có chiều cao). Ảnh hiển thị trọn vẹn (object-contain) trên nền đen.
 */
export default function MediaGallery({ media, showHeart = false, onDoubleClick }) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef(null);

  if (!media || media.length === 0) return null;

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
      className="relative h-full w-full select-none overflow-hidden bg-black outline-none"
    >
      {/* key={current}: đổi mục thì video cũ bị gỡ ra và dừng phát */}
      {item.type === 'VIDEO' ? (
        <video key={current} src={item.url} controls playsInline className="h-full w-full object-contain" />
      ) : (
        <img key={current} src={item.url} alt={`Ảnh ${current + 1} của bài viết`} className="h-full w-full object-contain" />
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
                className={`h-1.5 rounded-full transition-all ${i === current ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`}
              />
            ))}
          </div>
        </>
      )}

      {/* Tim to ở giữa (chỉ hiện khi nhấp đúp) */}
      {showHeart && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/10">
          <Heart className="h-24 w-24 animate-pulse fill-rose-500 text-rose-500 drop-shadow-2xl" />
        </div>
      )}
    </div>
  );
}
