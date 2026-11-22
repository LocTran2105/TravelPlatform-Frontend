import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Send, CornerDownRight } from 'lucide-react';

const API = 'http://localhost:8080/api/posts';
const MAX_LENGTH = 1000; // khớp CommentService.MAX_CONTENT_LENGTH ở backend

// Khách chưa đăng nhập thì KHÔNG gửi header (trước đây gửi "Bearer null").
const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const errorMessage = (error) => {
  const data = error.response?.data;
  if (typeof data === 'string' && data) return data;
  if (data?.message) return data.message;
  return error.message;
};

// "vừa xong", "5 phút trước", "3 giờ trước", "2 ngày trước", sau 7 ngày thì hiện ngày.
const timeAgo = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'vừa xong';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return date.toLocaleDateString('vi-VN');
};

// Tổng bình luận = bình luận gốc + mọi trả lời (khớp commentCount từ backend).
const countAll = (comments) =>
  comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);

// ---------------------------------------------------------------------------
// Một dòng bình luận.
// Phải khai báo Ở NGOÀI CommentSection: trước đây khai báo bên trong nên mỗi
// lần gõ một ký tự là toàn bộ danh sách bị tạo lại từ đầu (mất trạng thái).
// ---------------------------------------------------------------------------
const CommentItem = ({ comment, isReply = false, canInteract, onReply, onEdit, onDelete }) => (
  <div className={`mt-4 flex gap-3 ${isReply ? 'ml-10' : ''}`}>
    <Link
      to={`/profile/${comment.authorUsername}`}
      className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-300"
    >
      {comment.authorAvatar ? (
        <img src={comment.authorAvatar} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-sky-500 text-xs font-bold text-white">
          {comment.authorName?.charAt(0).toUpperCase()}
        </div>
      )}
    </Link>

    <div className="min-w-0 flex-1">
      <div className="inline-block max-w-full rounded-2xl bg-slate-100 px-4 py-2">
        <Link
          to={`/profile/${comment.authorUsername}`}
          className="text-sm font-semibold text-slate-800 hover:underline"
        >
          {comment.authorName}
        </Link>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-700">
          {comment.content}
        </p>
      </div>

      <div className="ml-2 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
        <span title={new Date(comment.createdAt).toLocaleString('vi-VN')}>
          {timeAgo(comment.createdAt)}
          {comment.edited && ' · đã chỉnh sửa'}
        </span>
        {canInteract && (
          <button type="button" onClick={() => onReply(comment)} className="hover:text-slate-800">
            Trả lời
          </button>
        )}
        {comment.isMyComment && (
          <button type="button" onClick={() => onEdit(comment)} className="hover:text-slate-800">
            Sửa
          </button>
        )}
        {comment.canDelete && (
          <button type="button" onClick={() => onDelete(comment)} className="hover:text-red-600">
            Xóa
          </button>
        )}
      </div>

      {comment.replies?.length > 0 && (
        <div className="mt-1 border-l-2 border-slate-100">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              isReply
              canInteract={canInteract}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Khu vực bình luận của một bài viết (2 cấp: bình luận + trả lời)
//   onCountChange(total): báo lại tổng số bình luận để số trên nút cập nhật.
// ---------------------------------------------------------------------------
export default function CommentSection({ postId, currentUser, onCountChange }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [inputValue, setInputValue] = useState('');
  const [replyingTo, setReplyingTo] = useState(null); // { id: id gốc, name }
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');

  const loggedIn = Boolean(localStorage.getItem('token')) && Boolean(currentUser);

  // Giữ hàm callback mới nhất trong ref để không làm effect tải dữ liệu chạy lại.
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  // Tải dữ liệu (không đặt state) và áp dụng kết quả tách riêng để effect bên dưới
  // chỉ gọi setState trong callback bất đồng bộ.
  const loadComments = useCallback(async () => {
    const res = await axios.get(`${API}/${postId}/comments`, { headers: authHeaders() });
    return Array.isArray(res.data) ? res.data : [];
  }, [postId]);

  const applyComments = useCallback((data) => {
    setComments(data);
    setLoadError('');
    onCountChangeRef.current?.(countAll(data));
  }, []);

  const refreshComments = async () => applyComments(await loadComments());

  useEffect(() => {
    // Component được tạo riêng cho từng bài (trạng thái "đang tải" ban đầu là true),
    // nên không cần đặt lại loading ở đây.
    let cancelled = false;
    loadComments()
      .then((data) => {
        if (!cancelled) applyComments(data);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadComments, applyComments]);

  const resetForm = () => {
    setReplyingTo(null);
    setEditingId(null);
    setInputValue('');
    setActionError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const content = inputValue.trim();
    if (!content || submitting) return;

    setSubmitting(true);
    setActionError('');
    try {
      if (editingId) {
        await axios.put(`${API}/comments/${editingId}`, { content }, { headers: authHeaders() });
      } else {
        await axios.post(
          `${API}/${postId}/comments`,
          { content, parentId: replyingTo ? replyingTo.id : null },
          { headers: authHeaders() }
        );
      }
      resetForm();
      await refreshComments();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (comment) => {
    const hasReplies = comment.replies?.length > 0;
    const message = hasReplies
      ? 'Xóa bình luận này? Các trả lời bên dưới cũng sẽ bị xóa.'
      : 'Bạn có chắc muốn xóa bình luận này?';
    if (!window.confirm(message)) return;

    setActionError('');
    try {
      await axios.delete(`${API}/comments/${comment.id}`, { headers: authHeaders() });
      if (editingId === comment.id) resetForm();
      await refreshComments();
    } catch (error) {
      setActionError('Không thể xóa bình luận: ' + errorMessage(error));
    }
  };

  const startReply = (comment) => {
    setEditingId(null);
    setActionError('');
    // Chỉ có 2 cấp: trả lời một trả lời thì vẫn gắn vào bình luận gốc
    // và thêm @username để biết đang nói với ai.
    const rootId = comment.parentId ?? comment.id;
    setReplyingTo({ id: rootId, name: comment.authorName });
    setInputValue(comment.parentId ? `@${comment.authorUsername} ` : '');
  };

  const startEdit = (comment) => {
    setReplyingTo(null);
    setActionError('');
    setEditingId(comment.id);
    setInputValue(comment.content);
  };

  const total = countAll(comments);

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="mb-4 max-h-80 overflow-y-auto pr-2">
        {loading ? (
          <p className="text-center text-sm text-slate-400">Đang tải bình luận...</p>
        ) : loadError ? (
          <p role="alert" className="text-center text-sm text-red-500">{loadError}</p>
        ) : total > 0 ? (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              canInteract={loggedIn}
              onReply={startReply}
              onEdit={startEdit}
              onDelete={handleDelete}
            />
          ))
        ) : (
          <p className="text-center text-sm italic text-slate-400">
            Chưa có bình luận nào. Hãy là người đầu tiên!
          </p>
        )}
      </div>

      {actionError && (
        <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
          {actionError}
        </p>
      )}

      {loggedIn ? (
        <>
          {(replyingTo || editingId) && (
            <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span className="flex items-center gap-1 text-slate-600">
                {replyingTo ? (
                  <>
                    <CornerDownRight size={14} /> Đang trả lời <b>{replyingTo.name}</b>
                  </>
                ) : (
                  'Đang chỉnh sửa bình luận...'
                )}
              </span>
              <button
                type="button"
                onClick={resetForm}
                className="font-semibold text-slate-500 hover:text-slate-800"
              >
                Hủy
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              maxLength={MAX_LENGTH}
              placeholder={replyingTo ? 'Viết câu trả lời...' : 'Thêm bình luận...'}
              className={`flex-1 rounded-full bg-slate-100 px-5 py-2.5 text-sm outline-none transition-all focus:ring-2 focus:ring-sky-100 ${
                replyingTo || editingId ? 'rounded-tl-none rounded-tr-none border border-t-0 border-slate-200' : ''
              }`}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || submitting}
              aria-label={editingId ? 'Lưu chỉnh sửa' : 'Gửi bình luận'}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={16} className="-ml-0.5 mt-0.5" />
            </button>
          </form>
        </>
      ) : (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">
          <Link to="/login" className="font-bold text-[#FF5645] hover:underline">Đăng nhập</Link>
          {' '}để bình luận và trả lời.
        </p>
      )}
    </div>
  );
}