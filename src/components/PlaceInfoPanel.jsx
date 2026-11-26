import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Search, X, Share2, MoreHorizontal, ChevronLeft, ChevronRight, MessageSquare, Star, Send,
  Play, Image as ImageIcon
} from 'lucide-react';

// Panel chi tiết địa điểm nổi trên bản đồ của TripDetail. Chỉ hiển thị: state và handler nằm ở TripDetail.

// ================= ĐÍNH KÈM ẢNH / VIDEO CHO ĐÁNH GIÁ =================
// Backend (PlaceReviewService) cũng kiểm tra lại các giới hạn này
const MAX_MEDIA_FILES = 5;
const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 50;
const MAX_TOTAL_MB = 100; // khớp spring.servlet.multipart.max-request-size

// Lọc các file hợp lệ trong danh sách vừa chọn; trả về file nhận được + thông báo lỗi (nếu có)
const validateMediaFiles = (current, incoming) => {
  const accepted = [];
  let error = '';
  let total = current.reduce((sum, f) => sum + f.size, 0);
  for (const f of incoming) {
    const isImage = f.type.startsWith('image/');
    const isVideo = f.type.startsWith('video/');
    if (!isImage && !isVideo) { error = `"${f.name}" không phải ảnh hoặc video.`; continue; }
    if (current.length + accepted.length >= MAX_MEDIA_FILES) { error = `Tối đa ${MAX_MEDIA_FILES} tệp cho mỗi đánh giá.`; break; }
    const limitMB = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
    if (f.size > limitMB * 1024 * 1024) { error = `"${f.name}" vượt quá ${limitMB}MB.`; continue; }
    if (total + f.size > MAX_TOTAL_MB * 1024 * 1024) { error = `Tổng dung lượng tối đa ${MAX_TOTAL_MB}MB.`; continue; }
    accepted.push(f);
    total += f.size;
  }
  return { accepted, error };
};

// Ô chọn ảnh/video (dùng ở cả dialog "Đã đi" và form viết đánh giá trong panel)
export const MediaPicker = ({ files, onChange, disabled }) => {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const [previews, setPreviews] = useState([]);

  // Tạo URL xem trước trong effect (không dùng useMemo) để không bị thu hồi nhầm khi StrictMode chạy effect 2 lần
  useEffect(() => {
    const next = files.map(f => ({ file: f, url: URL.createObjectURL(f), isVideo: f.type.startsWith('video/') }));
    setPreviews(next);
    return () => next.forEach(p => URL.revokeObjectURL(p.url));
  }, [files]);

  const handleSelect = (e) => {
    const result = validateMediaFiles(files, Array.from(e.target.files || []));
    setError(result.error);
    if (result.accepted.length > 0) onChange([...files, ...result.accepted]);
    e.target.value = ''; // cho phép chọn lại đúng file vừa xoá
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {previews.map((p) => (
          <div key={p.url} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
            {p.isVideo
              ? <video src={p.url} muted preload="metadata" className="w-full h-full object-cover" />
              : <img src={p.url} alt="" className="w-full h-full object-cover" />}
            {p.isVideo && (
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                <Play className="w-5 h-5 text-white fill-white" />
              </div>
            )}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(files.filter(f => f !== p.file))}
              aria-label="Xoá tệp"
              className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 disabled:opacity-50"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {files.length < MAX_MEDIA_FILES && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="w-20 h-20 rounded-xl border border-dashed border-slate-300 bg-white text-slate-400 hover:text-slate-600 hover:border-slate-400 flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[10px] font-semibold">Ảnh/Video</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleSelect} />
      <p className="text-[11px] text-slate-400 mt-2">Tối đa {MAX_MEDIA_FILES} tệp · ảnh ≤ {MAX_IMAGE_MB}MB · video ≤ {MAX_VIDEO_MB}MB</p>
      {error && <p className="text-xs text-rose-600 font-medium mt-1">{error}</p>}
    </div>
  );
};

// Lưới ảnh/video dưới mỗi đánh giá trong tab Đánh giá.
// Bấm vào ảnh sẽ mở trình xem ảnh (lightbox) ngay trong app; video phát trực tiếp trong lưới.
const ReviewMediaGrid = ({ media }) => {
  const [viewerIndex, setViewerIndex] = useState(null);
  const images = useMemo(() => (media || []).filter(m => m.type !== 'VIDEO'), [media]);
  const isOpen = viewerIndex !== null;

  const closeViewer = () => setViewerIndex(null);
  const step = (delta) => setViewerIndex(i => (i + delta + images.length) % images.length);

  // Phím tắt: Esc để đóng, ← → để chuyển ảnh
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setViewerIndex(null);
      else if (e.key === 'ArrowLeft' && images.length > 1) step(-1);
      else if (e.key === 'ArrowRight' && images.length > 1) step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, images.length]);

  if (!media || media.length === 0) return null;
  const current = isOpen ? images[viewerIndex] : null;

  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {media.map((m, i) => (
          m.type === 'VIDEO' ? (
            <video key={`${i}-${m.url}`} src={m.url} controls preload="metadata" className="w-full aspect-square object-cover rounded-xl bg-black" />
          ) : (
            <button
              key={`${i}-${m.url}`}
              type="button"
              onClick={() => setViewerIndex(images.indexOf(m))}
              className="block aspect-square rounded-xl overflow-hidden bg-slate-100 cursor-zoom-in"
            >
              <img src={m.url} alt="Ảnh đánh giá" loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
            </button>
          )
        ))}
      </div>

      {/* Dùng portal vì panel cha có transform, nếu không thì "fixed" sẽ chỉ phủ trong panel thay vì cả màn hình */}
      {current && createPortal(
        <div
          className="fixed inset-0 z-[4000] bg-black/90 flex items-center justify-center p-4"
          onClick={closeViewer}
        >
          <button
            onClick={closeViewer}
            aria-label="Đóng"
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); step(-1); }}
              aria-label="Ảnh trước"
              className="absolute left-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          <img
            src={current.url}
            alt="Ảnh đánh giá"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
          />

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); step(1); }}
                aria-label="Ảnh sau"
                className="absolute right-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/80 text-sm font-semibold">
                {viewerIndex + 1} / {images.length}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
};

// HÀM AN TOÀN TRÁNH CRASH: Lấy chữ cái đầu của Tên
const getInitial = (name) => {
  if (!name || typeof name !== 'string') return 'U';
  return name.charAt(0).toUpperCase();
};

const PlaceInfoPanel = ({
  activeDestination, isPanelOpen, coverImage, setIsPanelOpen, setInfoTab, infoTab, placeReviews,
  placePosts, placeInfo, reviewStats, showReviewForm, setShowReviewForm, setNewReviewRating,
  newReviewRating, newReviewText, setNewReviewText, newReviewFiles, setNewReviewFiles,
  isSubmittingReview, submitReview, uploadLabel, visibleReviewsCount, toggleLikeReview,
  setVisibleReviewsCount
}) => {
  return (
    <div className={`absolute top-4 left-4 bottom-4 w-[400px] bg-white rounded-3xl shadow-2xl z-[1000] border border-slate-100 flex flex-col overflow-hidden transition-transform duration-500 ease-in-out ${activeDestination && isPanelOpen ? 'translate-x-0 opacity-100 pointer-events-auto' : '-translate-x-[120%] opacity-0 pointer-events-none'}`}>
      {activeDestination && (
        <>
          {/* Ảnh bìa Panel (Lấy động từ Tab Bài đăng) */}
          <div className="relative h-56 bg-slate-800 flex-shrink-0">
                                <img 
                  src={coverImage || `https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?q=80&w=800&auto=format&fit=crop`} 
                  alt="Ảnh bìa" 
                  className="w-full h-full object-cover opacity-90 transition-opacity" 
                  onError={(e) => {
                    // Nếu ảnh hỏng hoặc lỗi mạng, tự động fallback về ảnh mặc định an toàn
                    e.target.src = 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?q=80&w=800&auto=format&fit=crop';
                  }}
                />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <button onClick={() => setIsPanelOpen(false)} className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/40 backdrop-blur transition-colors"><X className="w-4 h-4" /></button>
            <div className="absolute bottom-4 left-5 right-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-[#FF5645] text-white text-xs font-bold px-2.5 py-0.5 rounded-full shadow-sm">{activeDestination.index}</span>
              </div>
              <h3 className="text-2xl font-extrabold text-white text-shadow-md leading-tight">{activeDestination.placeName}</h3>
            </div>
          </div>

          {/* Tabs Menu */}
          <div className="flex border-b border-slate-100 flex-shrink-0 bg-white">
            <button onClick={() => setInfoTab('intro')} className={`flex-1 py-3.5 text-sm font-bold border-b-2 transition-colors ${infoTab === 'intro' ? 'border-[#FF5645] text-[#FF5645]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Giới thiệu</button>
            <button onClick={() => setInfoTab('reviews')} className={`flex-1 py-3.5 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${infoTab === 'reviews' ? 'border-[#FF5645] text-[#FF5645]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              Đánh giá <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md text-[10px]">{placeReviews.length}</span>
            </button>
            <button onClick={() => setInfoTab('posts')} className={`flex-1 py-3.5 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${infoTab === 'posts' ? 'border-[#FF5645] text-[#FF5645]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
              Bài đăng <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md text-[10px]">{placePosts.length}</span>
            </button>
          </div>

          {/* Nội dung Tabs */}
          <div className="flex-1 overflow-y-auto p-5 scroll-smooth bg-slate-50">
            
            {/* --- 1. GIỚI THIỆU TỪ WIKIPEDIA --- */}
            {infoTab === 'intro' && (
              <div className="space-y-4">
                {placeInfo.loading ? (
                  <div className="animate-pulse space-y-3"><div className="h-4 bg-slate-200 rounded w-3/4"></div><div className="h-4 bg-slate-200 rounded w-full"></div></div>
                ) : (
                  <p className="text-slate-600 text-[15px] leading-relaxed font-medium">{placeInfo.extract}</p>
                )}
              </div>
            )}

            {/* --- 2. ĐÁNH GIÁ (RATING & REVIEWS) --- */}
            {infoTab === 'reviews' && (
              <div className="space-y-6">
                
                {/* KHU VỰC 1: TÓM TẮT ĐÁNH GIÁ (Google Maps Style) */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <h4 className="font-bold text-slate-900 mb-4 flex items-center justify-between">
                    Tóm tắt bài đánh giá
                    <div className="h-5 w-5 rounded-full border border-slate-300 text-slate-400 flex items-center justify-center text-[10px]">?</div>
                  </h4>
                  
                  <div className="flex gap-6 items-center mb-6">
                    {/* Cột trái: Thanh tiến trình */}
                    <div className="flex-1 space-y-1.5">
                      {[5, 4, 3, 2, 1].map(star => {
                        const count = reviewStats.distribution[star];
                        const percent = reviewStats.total > 0 ? (count / reviewStats.total) * 100 : 0;
                        return (
                          <div key={star} className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <span className="w-2">{star}</span>
                            <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${percent}%` }}></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    
                    {/* Cột phải: Điểm số trung bình */}
                    <div className="flex flex-col items-center justify-center w-24">
                      <span className="text-4xl font-normal text-slate-900">{reviewStats.avg.toString().replace('.', ',')}</span>
                      <div className="flex gap-0.5 my-1">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`w-3 h-3 ${s <= Math.round(reviewStats.avg) ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-200'}`} />
                        ))}
                      </div>
                      <span className="text-xs font-medium text-sky-700">{reviewStats.total} bài viết</span>
                    </div>
                  </div>

                  {/* Nút bật Form viết đánh giá */}
                  {!showReviewForm && (
                    <div className="flex justify-center border-t border-slate-50 pt-4">
                      <button 
                        onClick={() => setShowReviewForm(true)}
                        className="bg-cyan-50 text-cyan-700 font-medium text-sm px-6 py-2 rounded-full flex items-center gap-2 hover:bg-cyan-100 transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" /> Viết bài đánh giá
                      </button>
                    </div>
                  )}
                </div>

                {/* KHU VỰC 2: FORM ĐÁNH GIÁ (Ẩn/Hiện) */}
                {showReviewForm && (
                  <div className="bg-white p-4 rounded-2xl border border-cyan-100 shadow-sm relative animate-fade-in">
                    <button onClick={() => setShowReviewForm(false)} className="absolute top-2 right-2 p-1 text-slate-400 hover:bg-slate-100 rounded-full"><X className="w-4 h-4"/></button>
                    <h4 className="text-sm font-bold text-slate-800 mb-2 text-center">Trải nghiệm của bạn?</h4>
                    <div className="flex gap-1.5 mb-3 justify-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} onClick={() => setNewReviewRating(star)} className={`w-8 h-8 cursor-pointer transition-colors ${star <= newReviewRating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                      ))}
                    </div>
                    <div className="flex flex-col gap-2">
                      <textarea 
                        value={newReviewText} 
                        onChange={(e) => setNewReviewText(e.target.value)} 
                        placeholder="Chia sẻ thêm chi tiết (không bắt buộc)..." 
                        className="w-full bg-slate-50 rounded-xl px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-cyan-500/20 border border-slate-200 transition-all resize-none h-20" 
                      />
                      <MediaPicker files={newReviewFiles} onChange={setNewReviewFiles} disabled={isSubmittingReview} />
                      <div className="flex justify-end mt-1">
                         <button onClick={submitReview} disabled={isSubmittingReview} className="bg-cyan-600 text-white font-bold text-sm px-5 py-2 rounded-full hover:bg-cyan-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                          {isSubmittingReview ? uploadLabel : <><Send className="w-4 h-4" /> Đăng</>}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* KHU VỰC 3: DANH SÁCH ĐÁNH GIÁ (Có Xem thêm) */}
                <div className="space-y-0">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-slate-900 text-lg">Tất cả các bài đánh giá</h4>
                    <button className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-cyan-600 hover:bg-slate-50">
                      <Search className="w-4 h-4" />
                    </button>
                  </div>

                  {placeReviews.length === 0 ? (
                    <p className="text-center text-sm text-slate-500 py-6">Chưa có đánh giá nào.</p>
                  ) : (
                    <div className="space-y-4">
                      {placeReviews.slice(0, visibleReviewsCount).map(review => (
                        <div key={review.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                          
                          {/* Đã bọc thép hàm lấy chữ cái đầu */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-700 text-sm font-bold flex items-center justify-center">
                                {review.authorAvatar ? <img src={review.authorAvatar} className="w-full h-full rounded-full object-cover"/> : getInitial(review.authorName)}
                              </div>
                              <div>
                                <span className="text-sm font-bold text-slate-900 block leading-none mb-1">{review.authorName}</span>
                                <span className="text-[11px] text-slate-500 flex items-center gap-1">Hướng dẫn viên địa phương • 1 bài đánh giá</span>
                              </div>
                            </div>
                            <button className="text-slate-400 hover:bg-slate-100 p-1 rounded-full"><MoreHorizontal className="w-4 h-4" /></button>
                          </div>

                          {/* Rating & Date */}
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map(s => <Star key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-200'}`} />)}
                            </div>
                            <span className="text-xs text-slate-500">{new Date(review.createdAt).toLocaleDateString('vi-VN')}</span>
                          </div>

                          {/* Content */}
                          {review.content && <p className="text-[14px] text-slate-700 mb-4 leading-relaxed">{review.content}</p>}
                          <ReviewMediaGrid media={review.media} />
                          
                          {/* Actions (Thích / Chia sẻ) */}
                          <div className="flex items-center gap-6 pt-1">
                            <button onClick={() => toggleLikeReview(review.id)} className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${review.likedByMe ? 'text-cyan-600' : 'text-slate-600 hover:text-slate-900'}`}>
                              <svg className={`w-4 h-4 ${review.likedByMe ? 'fill-cyan-600' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                              Thích {review.likesCount > 0 ? `(${review.likesCount})` : ''}
                            </button>
                            <button className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
                              <Share2 className="w-4 h-4" /> Chia sẻ
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Nút Xem thêm */}
                      {visibleReviewsCount < placeReviews.length && (
                        <button 
                          onClick={() => setVisibleReviewsCount(prev => prev + 5)}
                          className="w-full py-3 mt-2 rounded-full border border-slate-200 text-sm font-semibold text-cyan-700 hover:bg-slate-50 transition-colors"
                        >
                          Xem thêm bài đánh giá
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- 3. BÀI ĐĂNG TỪ MẠNG XÃ HỘI (Lấy từ /api/posts) --- */}
            {infoTab === 'posts' && (
              <div>
                {placePosts.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium">Chưa có bài check-in nào.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {placePosts.map(post => {
                      if (!post.imageUrls || post.imageUrls.length === 0) return null;
                      return (
                        <div key={post.id} className="relative aspect-[4/5] rounded-2xl overflow-hidden group cursor-pointer shadow-sm border border-slate-200">
                          <img src={post.imageUrls[0]} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Ảnh check-in" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 text-white">
                            <span className="text-xs font-bold truncate drop-shadow-md">@{post.authorName}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default PlaceInfoPanel;
