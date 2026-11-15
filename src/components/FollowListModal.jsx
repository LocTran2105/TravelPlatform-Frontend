import { useState, useMemo } from 'react';
import { X, User, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import FollowButton from './FollowButton'; // Bắt buộc phải import FollowButton

const FollowListModal = ({ isOpen, onClose, title, type, list, currentUser, profileUsername, onListUpdate }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingIds, setLoadingIds] = useState([]); 
  const isMyProfileView = !!currentUser && currentUser.username === profileUsername;
  const filteredList = useMemo(() => {
    if (!searchQuery) return list;
    return list.filter(u => 
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [list, searchQuery]);

  if (!isOpen) return null;

  // Xử lý Xóa người theo dõi (Chỉ mình mới được xóa người theo dõi mình)
  const handleRemoveFollower = async (followerUsername, followerId) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setLoadingIds(prev => [...prev, followerId]);
      await axios.delete(
        `http://localhost:8080/api/social/users/${encodeURIComponent(followerUsername)}/remove-follower`, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (onListUpdate) onListUpdate('remove_follower', followerId);
    } catch (error) {
      console.error("Lỗi xóa người theo dõi:", error);
    } finally {
      setLoadingIds(prev => prev.filter(id => id !== followerId));
    }
  };

  // Xử lý Hủy theo dõi (Chỉ dành cho danh sách Following của chính mình)
  const handleToggleFollowing = async (targetUsername, targetId) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setLoadingIds(prev => [...prev, targetId]);
      await axios.delete(
        `http://localhost:8080/api/social/users/${encodeURIComponent(targetUsername)}/follow`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (onListUpdate) onListUpdate('toggle_following', targetId);
    } catch (error) {
      console.error("Lỗi thay đổi trạng thái theo dõi:", error);
    } finally {
      setLoadingIds(prev => prev.filter(id => id !== targetId));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-[400px] rounded-2xl bg-white shadow-2xl flex flex-col h-[60vh] max-h-[500px] overflow-hidden">
        
        {/* Header */}
        <div className="relative flex items-center justify-center border-b border-slate-200 p-3 shrink-0">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button 
            onClick={() => {
                setSearchQuery('');
                onClose();
            }} 
            className="absolute right-3 rounded-full p-2 text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Thanh tìm kiếm */}
        <div className="p-3 shrink-0 border-b border-slate-100">
          <div className="relative flex items-center w-full h-9 rounded-lg bg-slate-100 px-3">
            <Search className="w-4 h-4 text-slate-500 shrink-0" />
            <input 
              type="text" 
              placeholder="Tìm kiếm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent pl-2 text-sm text-slate-900 outline-none placeholder:text-slate-500 font-medium"
            />
          </div>
        </div>

        {/* Danh sách */}
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200">
          {filteredList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
              <p className="text-sm font-medium">Không tìm thấy người dùng nào.</p>
            </div>
          ) : (
            filteredList.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors mb-1">
                
                {/* Khu vực thông tin (Click để vào trang cá nhân) */}
                <div 
                  className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                  onClick={() => {
                    setSearchQuery('');
                    onClose();
                    navigate(`/profile/${u.username}`);
                  }}
                >
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-500 border border-slate-100">
                     {u.avatar ? <img src={u.avatar} alt={u.fullName} className="h-full w-full object-cover"/> : <User className="h-5 w-5"/>}
                  </div>
                  <div className="flex flex-col truncate pr-2">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{u.fullName}</h4>
                    <p className="text-sm font-medium text-slate-500 truncate">{u.username}</p>
                  </div>
                </div>

                {/* Khu vực Nút bấm hành động */}
                {currentUser && currentUser.username !== u.username && (
                    <div className="shrink-0 ml-2">
                        {type === 'followers' && isMyProfileView ? (
                            // Nút Xóa trong danh sách Người theo dõi 
                            <button 
                                onClick={() => handleRemoveFollower(u.username, u.id)}
                                disabled={loadingIds.includes(u.id)}
                                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                            >
                                {loadingIds.includes(u.id) ? '...' : 'Xóa'}
                            </button>
                        ) : type === 'following' && isMyProfileView ? (
                            // Nút Đang theo dõi trong danh sách Following
                            <button 
                                onClick={() => handleToggleFollowing(u.username, u.id)}
                                disabled={loadingIds.includes(u.id)}
                                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                            >
                                {loadingIds.includes(u.id) ? '...' : 'Đang theo dõi'}
                            </button>
                        ) : (
                            // Tái sử dụng Component FollowButton ĐÃ SỬA:
                            <FollowButton
                              targetUsername={u.username}
                              initialIsFollowing={u.followedByMe}
                              isFollowingMe={u.followingMe}
                              onFollowChange={(state) => onListUpdate?.('set_follow_state', u.id, state)}
                            />
                        )}
                    </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowListModal;