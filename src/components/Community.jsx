import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Compass, Search, MapPin, Image as ImageIcon, 
  Send, Star, MessageCircle, Heart, Share2, Map, X
} from 'lucide-react';

const Community = () => {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // States cho Form Đăng Bài
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef(null);

  // States cho Vị trí (Photon API)
  const [locationName, setLocationName] = useState('');
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) setUser(JSON.parse(savedUser));
    fetchPosts();
  }, []);

  // Gọi API lấy danh sách bài viết
  const fetchPosts = async () => {
    try {
      const response = await axios.get('http://localhost:8080/api/posts');
      setPosts(response.data);
    } catch (error) {
      console.error("Lỗi lấy bài viết:", error);
    } finally {
      setLoading(false);
    }
  };

  // API TÌM ĐỊA ĐIỂM (PHOTON)
  useEffect(() => {
    const fetchPlaces = async () => {
      if (searchQuery.trim().length < 2) { 
        setSuggestions([]); 
        return; 
      }
      setIsSearching(true);
      try {
        const query = encodeURIComponent(searchQuery.trim());
        const url = `https://photon.komoot.io/api/?q=${query}&limit=5`;
        const response = await fetch(url);
        const data = await response.json();
        const formattedPlaces = data.features.map(feature => {
          const prop = feature.properties;
          return {
            id: prop.osm_id,
            name: prop.name || prop.street || prop.city,
            address: [prop.city, prop.state, prop.country].filter(Boolean).join(', '),
            lat: feature.geometry.coordinates[1],
            lon: feature.geometry.coordinates[0]
          };
        }).filter(place => place.name);
        setSuggestions(formattedPlaces);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    };
    
    const delayDebounceFn = setTimeout(() => {
      if (showDropdown) fetchPlaces();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, showDropdown]);

  // Khi người dùng chọn 1 địa điểm từ menu xổ xuống
  const handleSelectPlace = (place) => {
    setLocationName(place.name);
    setLatitude(place.lat);
    setLongitude(place.lon);
    setSearchQuery('');
    setSuggestions([]);
    setShowDropdown(false);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!caption.trim() && !selectedFile) return;

    const token = localStorage.getItem('token');
    if (!token) {
      alert("Vui lòng đăng nhập để đăng bài!");
      return;
    }

    setIsPosting(true);
    const formData = new FormData();
    formData.append('caption', caption);
    formData.append('rating', '5'); 
    
    // Gửi kèm Tên và Tọa độ thực tế xuống Backend
    if (locationName) formData.append('locationName', locationName);
    if (latitude) formData.append('latitude', latitude);
    if (longitude) formData.append('longitude', longitude);
    
    if (selectedFile) formData.append('files', selectedFile);

    try {
      await axios.post('http://localhost:8080/api/posts', formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      // Reset form
      setCaption('');
      setLocationName('');
      setLatitude(null);
      setLongitude(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchPosts();
    } catch (error) {
      alert("Lỗi khi đăng bài: " + (error.response?.data || error.message));
    } finally {
      setIsPosting(false);
    }
  };

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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
              {user.fullName?.charAt(0).toUpperCase()}
            </div>
          ) : (
            <Link to="/login" className="text-sm font-bold text-[#FF5645]">Đăng nhập</Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        
        {user && (
          <div className="mb-8 rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
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

              {selectedFile && (
                <div className="ml-14 mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  <ImageIcon className="h-4 w-4" /> {selectedFile.name}
                  <button type="button" onClick={() => setSelectedFile(null)} className="ml-2 hover:text-red-500">✕</button>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => fileInputRef.current.click()} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors">
                    <ImageIcon className="h-4 w-4 text-emerald-500" /> Ảnh/Video
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*" />
                  
                  {/* ====== COMPONENT TÌM KIẾM ĐỊA ĐIỂM ====== */}
                  <div className="relative">
                    {locationName ? (
                      // Nếu đã chọn địa điểm -> Hiện Tag màu đỏ cho phép xóa
                      <div className="flex items-center gap-1.5 rounded-full bg-red-50 border border-red-100 px-3 py-1.5 text-sm font-semibold text-[#FF5645]">
                        <MapPin className="h-4 w-4" />
                        <span>{locationName}</span>
                        <button type="button" onClick={() => { setLocationName(''); setLatitude(null); setLongitude(null); }} className="ml-1 hover:text-red-700">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      // Nếu chưa chọn -> Hiện ô Input tìm kiếm
                      <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-600 border border-slate-200 focus-within:border-[#FF5645] focus-within:bg-white transition-colors relative z-10">
                        <MapPin className="h-4 w-4 text-[#FF5645]" />
                        <input 
                          type="text" 
                          placeholder="Check-in..." 
                          value={searchQuery}
                          onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                          onFocus={() => setShowDropdown(true)}
                          className="bg-transparent outline-none w-24 placeholder:font-normal focus:w-48 transition-all duration-300 ease-in-out" 
                        />
                        {isSearching && <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-[#FF5645] ml-1"></div>}
                      </div>
                    )}

                    {/* Menu xổ xuống hiển thị kết quả */}
                    {showDropdown && suggestions.length > 0 && !locationName && (
                      <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                        {suggestions.map((place, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => handleSelectPlace(place)}
                            className="px-4 py-3 hover:bg-orange-50 cursor-pointer border-b border-slate-50 last:border-0 flex items-start gap-3"
                          >
                            <MapPin className="w-4 h-4 text-[#FF5645] mt-0.5 flex-shrink-0" />
                            <div className="flex-1 overflow-hidden">
                              <p className="text-sm font-bold text-slate-800 truncate">{place.name}</p>
                              <p className="text-xs text-slate-500 truncate">{place.address}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isPosting || (!caption.trim() && !selectedFile)}
                  className="flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                >
                  {isPosting ? 'Đang đăng...' : <><Send className="h-4 w-4" /> Đăng bài</>}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ================= DÒNG THỜI GIAN ================= */}
        {loading ? (
          <div className="flex justify-center py-10"><div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-[#FF5645]"></div></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16"><Map className="w-12 h-12 text-slate-300 mx-auto mb-4" /><h3 className="text-lg font-bold text-slate-700">Chưa có bài viết nào</h3><p className="text-slate-500 text-sm">Hãy là người đầu tiên chia sẻ hành trình của bạn.</p></div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <div key={post.id} className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                      {post.authorName?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 leading-none">{post.authorName}</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(post.createdAt).toLocaleDateString('vi-VN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  {post.rating && (
                    <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-md">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      <span className="text-xs font-bold text-amber-700">{post.rating}</span>
                    </div>
                  )}
                </div>

                <p className="text-slate-700 text-base mb-3 whitespace-pre-wrap">{post.caption}</p>

                {post.locationName && (
                  <div className="inline-flex items-center gap-1.5 mb-4 text-sm font-bold text-[#FF5645] bg-red-50 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-red-100 transition-colors">
                    <MapPin className="w-4 h-4" /> {post.locationName}
                  </div>
                )}

                {post.imageUrls?.length > 0 && (
                  <div className="w-full h-80 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 mb-4">
                    <img src={post.imageUrls[0]} alt="Post media" className="w-full h-full object-cover" />
                  </div>
                )}
                {post.videoUrls?.length > 0 && (
                  <div className="w-full h-80 rounded-2xl overflow-hidden bg-black mb-4">
                    <video src={post.videoUrls[0]} controls className="w-full h-full object-contain" />
                  </div>
                )}

                <div className="flex items-center gap-6 pt-2 border-t border-slate-100">
                  <button className="flex items-center gap-2 text-slate-500 hover:text-rose-500 transition-colors group"><Heart className="w-5 h-5 group-active:scale-90 transition-transform" /> <span className="text-sm font-semibold">Thích</span></button>
                  <button className="flex items-center gap-2 text-slate-500 hover:text-sky-500 transition-colors"><MessageCircle className="w-5 h-5" /> <span className="text-sm font-semibold">Bình luận</span></button>
                  <button className="flex items-center gap-2 text-slate-500 hover:text-emerald-500 transition-colors ml-auto"><Share2 className="w-5 h-5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Community;