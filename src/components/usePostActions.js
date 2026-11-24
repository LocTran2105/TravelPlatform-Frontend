import { useRef, useState } from 'react';
import axios from 'axios';

const API = 'http://localhost:8080/api';

/**
 * Thao tác với bài viết trong danh sách của trang cá nhân: thả / bỏ tim (cập nhật ngay, lỗi thì hoàn lại)
 * và đồng bộ số bình luận. `setPosts` là setter của danh sách bài đang hiển thị.
 */
export default function usePostActions(setPosts) {
  const inFlight = useRef(new Set()); // chặn bấm liên tục khi request trước chưa xong
  const [notice, setNotice] = useState('');

  const patchPost = (postId, changes) =>
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...changes } : p)));

  const toggleLike = async (post) => {
    const token = localStorage.getItem('token');
    if (!token) { setNotice('Vui lòng đăng nhập để thích bài viết.'); return; }
    if (inFlight.current.has(post.id)) return;

    const wasLiked = Boolean(post.isLikedByMe);
    const previous = { isLikedByMe: wasLiked, likeCount: post.likeCount || 0 };
    inFlight.current.add(post.id);
    setNotice('');
    patchPost(post.id, { isLikedByMe: !wasLiked, likeCount: Math.max(0, previous.likeCount + (wasLiked ? -1 : 1)) });

    try {
      const url = `${API}/social/likes/POST/${post.id}`;
      const headers = { Authorization: `Bearer ${token}` };
      const res = wasLiked ? await axios.delete(url, { headers }) : await axios.post(url, {}, { headers });
      // Server trả số tim thật -> đồng bộ lại
      if (typeof res.data?.likeCount === 'number') {
        patchPost(post.id, { likeCount: res.data.likeCount, isLikedByMe: Boolean(res.data.liked) });
      }
    } catch (error) {
      patchPost(post.id, previous);
      const status = error.response?.status;
      if (status === 401) setNotice('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
      else if (status === 404) setNotice('Bài viết không còn khả dụng.');
      else setNotice('Không thể cập nhật lượt thích lúc này. Vui lòng thử lại.');
    } finally {
      inFlight.current.delete(post.id);
    }
  };

  // CommentSection báo lại tổng số bình luận (kể cả khi người khác vừa bình luận / xóa)
  const setCommentCount = (postId, total) =>
    setPosts((prev) => prev.map((p) => (p.id === postId && p.commentCount !== total ? { ...p, commentCount: total } : p)));

  return { toggleLike, setCommentCount, notice, clearNotice: () => setNotice('') };
}
