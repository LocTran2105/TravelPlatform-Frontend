import { useState, useEffect } from 'react';
import axios from 'axios';
import { Star, AlertCircle, CheckCircle2, User } from 'lucide-react';

const TripReviews = ({ tripId }) => {
  const [reviews, setReviews] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  // Form State
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Lấy thông tin user hiện tại để ẩn/hiện form
  const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchReviews(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const fetchReviews = async (pageNumber) => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:8080/api/trips/${tripId}/reviews?page=${pageNumber}&size=5`);
      const { content, last } = res.data;
      
      if (pageNumber === 0) {
        setReviews(content);
      } else {
        setReviews((prev) => [...prev, ...content]);
      }
      
      setHasMore(!last);
      setPage(pageNumber);
    } catch (error) {
      console.error('Lỗi lấy danh sách đánh giá:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      setMessage({ type: 'error', text: 'Vui lòng chọn số sao đánh giá (từ 1 đến 5).' });
      return;
    }

    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await axios.post(
        `http://localhost:8080/api/trips/${tripId}/reviews`,
        { rating, comment },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage({ type: 'success', text: 'Đã gửi đánh giá thành công!' });
      setRating(0);
      setComment('');
      
      // Load lại trang đầu tiên để thấy review mới nhất
      fetchReviews(0);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data || 'Không thể gửi đánh giá.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hàm render sao tĩnh (cho danh sách review)
  const renderStars = (score) => {
    return [...Array(5)].map((_, index) => (
      <Star
        key={index}
        className={`h-4 w-4 ${index < score ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-200'}`}
      />
    ));
  };

  return (
    <div className="mt-10 border-t border-slate-100 pt-10">
      <h3 className="text-xl font-extrabold text-slate-900 mb-6">Đánh giá từ cộng đồng</h3>

      {/* ================= FORM ĐÁNH GIÁ ================= */}
      {currentUser ? (
        <form onSubmit={handleSubmit} className="mb-10 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <h4 className="font-semibold text-slate-800 mb-3">Trải nghiệm của bạn thế nào?</h4>
          
          {message.text && (
            <div className={`mb-4 flex items-center gap-2 rounded-xl p-3 text-sm font-medium ${message.type === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {message.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {message.text}
            </div>
          )}

          {/* Chọn Sao */}
          <div className="flex gap-1 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="focus:outline-none transition-transform hover:scale-110"
              >
                <Star className={`h-8 w-8 ${star <= (hoverRating || rating) ? 'fill-amber-400 text-amber-400' : 'fill-white text-slate-300'}`} />
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Chia sẻ thêm chi tiết về chuyến đi này (không bắt buộc)..."
            rows={3}
            maxLength={1000}
            className="w-full resize-none rounded-xl border border-slate-200 p-4 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || rating === 0}
              className="rounded-full bg-emerald-600 px-6 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-10 rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500 border border-slate-100">
          Vui lòng <a href="/login" className="font-bold text-emerald-600 hover:underline">đăng nhập</a> để chia sẻ đánh giá của bạn.
        </div>
      )}

      {/* ================= DANH SÁCH ĐÁNH GIÁ ================= */}
      <div className="space-y-6">
        {reviews.length === 0 && !loading ? (
          <p className="text-center text-sm text-slate-500 italic py-5">Chưa có đánh giá nào. Hãy là người đầu tiên!</p>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="flex gap-4 border-b border-slate-100 pb-6 last:border-0">
              {/* Avatar */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                {review.userAvatar ? (
                  <img src={review.userAvatar} alt="avatar" className="h-full w-full rounded-full object-cover" />
                ) : (
                  review.userFullName?.charAt(0).toUpperCase()
                )}
              </div>
              
              {/* Nội dung */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-800">{review.userFullName}</span>
                  <span className="text-xs text-slate-400">
                    {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <div className="flex gap-0.5 mb-2">{renderStars(review.rating)}</div>
                {review.comment && (
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{review.comment}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Nút Load More */}
      {hasMore && reviews.length > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => fetchReviews(page + 1)}
            disabled={loading}
            className="rounded-full border border-slate-200 bg-white px-6 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? 'Đang tải...' : 'Xem thêm đánh giá'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TripReviews;