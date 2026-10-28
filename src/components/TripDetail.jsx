import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import TripReviews from './TripReviews'; 
import { 
  ArrowLeft, Calendar, MapPin, Plus, 
  Search, X, Users, Receipt, 
  Share2, MoreHorizontal, ChevronLeft, ChevronRight,
  Wand2, Plane, Bed, Car, Train, Paperclip, CheckSquare, Compass,
  MessageSquare, Star, Heart, Send, Image as ImageIcon
} from 'lucide-react';

// ================= COMPONENT HỖ TRỢ BẢN ĐỒ =================
function MapBounds({ destinations, activeDestinationId }) {
  const map = useMap();
  useEffect(() => {
    if (activeDestinationId) {
      const activeDest = destinations.find(d => d.id === activeDestinationId);
      if (activeDest) {
        map.flyTo([activeDest.latitude, activeDest.longitude], 16, { animate: true, duration: 1.5 });
      }
    } else if (destinations && destinations.length > 0) {
      const bounds = L.latLngBounds(destinations.map(d => [d.latitude, d.longitude]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true });
    }
  }, [destinations, activeDestinationId, map]);
  return null;
}

const createCustomMarker = (number, isActive) => {
  const size = isActive ? 36 : 24;
  const shadow = isActive ? '0 4px 10px rgba(255, 86, 69, 0.6)' : '0 2px 5px rgba(0,0,0,0.3)';
  const border = isActive ? '3px solid white' : '2px solid white';
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: #FF5645; color: white; width: ${size}px; height: ${size}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: ${isActive ? '16px' : '12px'}; border: ${border}; box-shadow: ${shadow}; transition: all 0.3s ease;">${number}</div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
};

const TripDetail = () => {
  const { tripId } = useParams();
  const navigate = useNavigate();
  
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');
  const [isItineraryExpanded, setIsItineraryExpanded] = useState(false);
  
  const [focusedDayId, setFocusedDayId] = useState(null);
  const [activeDestination, setActiveDestination] = useState(null);
  const [routePositions, setRoutePositions] = useState([]);

  const [addingDayId, setAddingDayId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  
  // ================= STATES CHO PANEL TRƯỢT =================
  const [coverImage, setCoverImage] = useState('');
  const [placeInfo, setPlaceInfo] = useState({ extract: '', loading: false });
  const [placeReviews, setPlaceReviews] = useState([]); 
  const [placePosts, setPlacePosts] = useState([]); 
  const [infoTab, setInfoTab] = useState('intro');

  // ================= STATES CHO FORM ĐÁNH GIÁ ĐỊA ĐIỂM =================
  const [newReviewText, setNewReviewText] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [visibleReviewsCount, setVisibleReviewsCount] = useState(3);

  // ================= STATES CHO KHỐI MỞ RỘNG (OVERVIEW) =================
  const [tripNote, setTripNote] = useState('');
  const [isNoteExpanded, setIsNoteExpanded] = useState(true);
  const [customSections, setCustomSections] = useState([]); 
  const [activeMenuId, setActiveMenuId] = useState(null); 

  const searchRef = useRef(null);
  const dayRefs = useRef({}); 

  const fetchTripDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { navigate('/login'); return; }
      const response = await axios.get(`http://localhost:8080/api/trips/${tripId}`, { headers: { Authorization: `Bearer ${token}` } });
      setTrip(response.data);
    } catch (err) { setError('Lỗi máy chủ'); } finally { setLoading(false); }
  };

  useEffect(() => { fetchTripDetails(); }, [tripId]);

  useEffect(() => {
    const fetchPlaces = async () => {
      if (searchQuery.trim().length < 2) { setSuggestions([]); return; }
      try {
        const query = encodeURIComponent(searchQuery.trim());
        const response = await fetch(`https://photon.komoot.io/api/?q=${query}&limit=5`);
        const data = await response.json();
        const formatted = data.features.map(f => {
          const p = f.properties;
          return { id: p.osm_id, name: p.name || p.street || p.city, address: [p.city, p.country].filter(Boolean).join(', '), lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
        }).filter(p => p.name);
        setSuggestions(formatted);
      } catch (err) { console.error(err); }
    };
    const delay = setTimeout(() => { if (addingDayId) fetchPlaces(); }, 500);
    return () => clearTimeout(delay);
  }, [searchQuery, addingDayId]);

  const handleAddDestination = async (place, dayId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:8080/api/trips/days/${dayId}/destinations`, {
        placeName: place.name, latitude: place.lat, longitude: place.lon, note: place.address, estimatedCost: 0
      }, { headers: { Authorization: `Bearer ${token}` }});
      setAddingDayId(null); setSearchQuery(''); setSuggestions([]); fetchTripDetails(); 
    } catch (err) { alert("Lỗi: " + (err.response?.data || err.message)); }
  };

  const handleDestinationClick = async (dest, idx) => {
    setActiveDestination({ ...dest, index: idx + 1 });
    setInfoTab('intro');
    setPlaceInfo({ extract: '', loading: true });
    
    const fallbackImage = `https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?q=80&w=800&auto=format&fit=crop`; 
    setCoverImage(fallbackImage);

    try {
      const wikiUrl = `https://vi.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(dest.placeName)}&format=json&origin=*`;
      const wikiRes = await fetch(wikiUrl);
      const wikiData = await wikiRes.json();
      const pages = wikiData.query.pages;
      const pageId = Object.keys(pages)[0];
      if (pageId !== "-1" && pages[pageId].extract) setPlaceInfo({ extract: pages[pageId].extract, loading: false });
      else setPlaceInfo({ extract: `Không tìm thấy thông tin trên Wikipedia.`, loading: false });
    } catch (e) { setPlaceInfo({ extract: 'Không thể tải thông tin lúc này.', loading: false }); }

    try {
      const postsRes = await axios.get('http://localhost:8080/api/posts');
      const relatedPosts = postsRes.data.filter(p => p.locationName && p.locationName.toLowerCase().includes(dest.placeName.toLowerCase()));
      setPlacePosts(relatedPosts);
      
      const firstPostWithImg = relatedPosts.find(p => p.imageUrls && p.imageUrls.length > 0);
      if (firstPostWithImg) setCoverImage(firstPostWithImg.imageUrls[0]);
    } catch (e) { console.error(e); }

    fetchReviews(dest.placeName);
  };

  // LOGIC CUSTOM SECTIONS
  const handleAddCustomSection = () => {
    setCustomSections([...customSections, { id: Date.now(), title: '', isExpanded: true, places: [] }]);
  };
  const handleUpdateSectionTitle = (id, newTitle) => {
    setCustomSections(customSections.map(sec => sec.id === id ? { ...sec, title: newTitle } : sec));
  };
  const handleDeleteSection = (id) => {
    setCustomSections(customSections.filter(sec => sec.id !== id));
    setActiveMenuId(null);
  };
  
  // LOGIC ĐÁNH GIÁ ĐỊA ĐIỂM
  const fetchReviews = async (locName) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:8080/api/place-reviews?locationName=${encodeURIComponent(locName)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setPlaceReviews(res.data);
    } catch (e) { console.error(e); }
  };

  const submitReview = async () => {
    if (!newReviewText.trim()) return;
    try {
      setIsSubmittingReview(true);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('locationName', activeDestination.placeName);
      formData.append('rating', newReviewRating);
      formData.append('content', newReviewText);
      
      await axios.post('http://localhost:8080/api/place-reviews', formData, {
        headers: { Authorization: `Bearer ${token}` } 
      });
      setNewReviewText('');
      setNewReviewRating(5);
      fetchReviews(activeDestination.placeName); 
    } catch (e) { 
      alert(e.response?.data || "Lỗi kết nối đến máy chủ. Vui lòng thử lại!"); 
    } finally { 
      setIsSubmittingReview(false); 
    }
  };

  const toggleLikeReview = async (reviewId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:8080/api/place-reviews/${reviewId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchReviews(activeDestination.placeName); 
    } catch (e) { alert("Bạn cần đăng nhập để thả tim."); }
  };

  const handleScrollToDay = (dayId) => {
    setActiveSection('itinerary'); setFocusedDayId(dayId); setActiveDestination(null);
    if (dayRefs.current[dayId]) dayRefs.current[dayId].scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const mapDestinations = useMemo(() => {
    if (focusedDayId) return trip?.tripDays?.find(day => day.id === focusedDayId)?.destinations || [];
    return trip?.tripDays?.flatMap(day => day.destinations || []) || [];
  }, [trip, focusedDayId]);

  // THỐNG KÊ ĐÁNH GIÁ (Google Maps Style)
  const reviewStats = useMemo(() => {
    if (!placeReviews || placeReviews.length === 0) return { avg: 0, total: 0, distribution: {5:0, 4:0, 3:0, 2:0, 1:0} };
    const stats = { total: placeReviews.length, sum: 0, distribution: {5:0, 4:0, 3:0, 2:0, 1:0} };
    placeReviews.forEach(r => {
      stats.sum += r.rating;
      stats.distribution[r.rating] = (stats.distribution[r.rating] || 0) + 1;
    });
    stats.avg = (stats.sum / stats.total).toFixed(1);
    return stats;
  }, [placeReviews]);

  useEffect(() => {
    const fetchRealRoute = async () => {
      if (!mapDestinations || mapDestinations.length < 2) { setRoutePositions([]); return; }
      try {
        const coordsStr = mapDestinations.map(d => `${d.longitude},${d.latitude}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          setRoutePositions(data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]));
        } else setRoutePositions(mapDestinations.map(d => [d.latitude, d.longitude]));
      } catch (error) { setRoutePositions(mapDestinations.map(d => [d.latitude, d.longitude])); }
    };
    fetchRealRoute();
  }, [mapDestinations]);

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-slate-500">Đang tải hành trình...</div>;
  if (!trip) return null;

  // HÀM AN TOÀN TRÁNH CRASH: Lấy chữ cái đầu của Tên
  const getInitial = (name) => {
    if (!name || typeof name !== 'string') return 'U';
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="h-screen w-full flex bg-slate-50 font-sans overflow-hidden">
      
      {/* 1. SIDEBAR */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col relative z-20 overflow-hidden`}>
        <div className="p-4 flex items-center gap-3 border-b border-slate-100">
          <Link to="/home" className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 text-slate-600"><ArrowLeft className="w-4 h-4" /></Link>
          <span className="font-bold text-slate-800 truncate flex-1">{trip.destination}</span>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <button onClick={() => { setActiveSection('overview'); setFocusedDayId(null); setActiveDestination(null); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-sm transition-colors ${activeSection === 'overview' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}><ChevronDownIcon isOpen={activeSection === 'overview'} /> Overview</button>
          <div className="pt-2">
            <button onClick={() => { setActiveSection('itinerary'); setIsItineraryExpanded(!isItineraryExpanded); setFocusedDayId(null); setActiveDestination(null); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-sm transition-colors ${activeSection === 'itinerary' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}><ChevronDownIcon isOpen={isItineraryExpanded} /> Itinerary</button>
            {isItineraryExpanded && (
              <div className="pl-9 space-y-1 mt-1">
                {trip.tripDays?.map((day) => (
                  <span key={day.id} onClick={() => handleScrollToDay(day.id)} className={`block px-3 py-1.5 text-sm cursor-pointer rounded-md transition-colors ${focusedDayId === day.id ? 'font-bold text-[#FF5645] bg-red-50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>Day {day.dayNumber}</span>
                ))}
              </div>
            )}
          </div>
          <div className="pt-2">
            <button onClick={() => setActiveSection('budget')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-sm transition-colors ${activeSection === 'budget' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}><ChevronDownIcon isOpen={activeSection === 'budget'} /> Budget</button>
          </div>
        </div>
      </div>

      {/* 2. MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-y-auto scroll-smooth">
        
        {/* --- TAB 1: OVERVIEW --- */}
        {activeSection === 'overview' && (
          <div className="pb-20">
            <div className="h-[300px] w-full relative bg-slate-800">
              <img src={`https://source.unsplash.com/1200x600/?${encodeURIComponent(trip.destination || 'vietnam')}`} alt="Cover" className="w-full h-full object-cover opacity-80" />
            </div>
            <div className="relative -mt-16 mx-auto max-w-4xl px-4 sm:px-8">
              <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-slate-100 flex flex-col sm:flex-row sm:items-end justify-between">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">{trip.title}</h1>
                  <div className="flex items-center text-sm font-semibold text-slate-500 gap-2"><Calendar className="w-4 h-4 text-slate-400"/> {trip.startDate} — {trip.endDate || 'No end date'}</div>
                </div>
                {/* Đã bọc thép hàm lấy chữ cái đầu */}
                <div className="flex items-center gap-2 mt-4 sm:mt-0">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200">
                    {getInitial(trip.user?.fullName)}
                  </div>
                  <button className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 border border-slate-200 border-dashed"><Users className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            <div className="mx-auto max-w-4xl px-4 sm:px-8 mt-12">
              
              {/* === PHẦN 1: GHI CHÚ (NOTES) === */}
              <div className="mb-10">
                <div className="flex items-center justify-between mb-3 group cursor-pointer" onClick={() => setIsNoteExpanded(!isNoteExpanded)}>
                  <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                    <ChevronDownIcon isOpen={isNoteExpanded} /> Notes
                  </h3>
                  <button className="p-1 rounded hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MoreHorizontal className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                
                {isNoteExpanded && (
                  <div className="pl-6">
                    <textarea 
                      value={tripNote}
                      onChange={(e) => setTripNote(e.target.value)}
                      placeholder="Write or paste anything here: how to get around, tips and tricks"
                      className="w-full bg-slate-100/50 hover:bg-slate-100 rounded-xl p-4 text-sm text-slate-700 outline-none border border-transparent focus:border-slate-300 focus:bg-white transition-all resize-none min-h-[100px]"
                    />
                  </div>
                )}
              </div>

              <hr className="border-slate-100 mb-10" />

              {/* === PHẦN 2: CÁC KHỐI CUSTOM SECTIONS === */}
              {customSections.map((section) => (
                <div key={section.id} className="mb-10">
                  <div className="flex items-center justify-between mb-3 relative group">
                    <div className="flex items-center gap-2 flex-1">
                      <button 
                        onClick={() => setCustomSections(customSections.map(s => s.id === section.id ? {...s, isExpanded: !s.isExpanded} : s))} 
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        <ChevronDownIcon isOpen={section.isExpanded} />
                      </button>
                      <input 
                        type="text"
                        value={section.title}
                        onChange={(e) => handleUpdateSectionTitle(section.id, e.target.value)}
                        placeholder='Thêm tiêu đề (VD: "Nhà hàng cần thử")'
                        className="text-xl font-extrabold text-slate-800 focus:text-slate-900 placeholder:text-slate-300 bg-transparent outline-none flex-1 border-b border-transparent focus:border-slate-300 transition-colors"
                      />
                    </div>
                    
                    {/* Nút 3 chấm mở Menu xóa (Tự động hiện khi hover vào vùng section) */}
                    <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => setActiveMenuId(activeMenuId === section.id ? null : section.id)}
                        className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                      
                      {activeMenuId === section.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 animate-fade-in overflow-hidden">
                          <button 
                            onClick={() => handleDeleteSection(section.id)}
                            className="w-full text-left px-4 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            Xóa danh sách này
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {section.isExpanded && (
                    <div className="pl-7">
                      {/* Ô thêm địa điểm (Đã bỏ 2 nút và đổi màu sáng hơn) */}
                      <div className="flex items-center gap-3 bg-white hover:bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 shadow-sm transition-all cursor-text focus-within:ring-2 focus-within:ring-cyan-500/20 focus-within:border-cyan-500">
                        <MapPin className="w-5 h-5 text-slate-400" />
                        <input 
                          type="text" 
                          placeholder="Thêm địa điểm vào danh sách..." 
                          className="bg-transparent text-sm text-slate-800 outline-none flex-1 font-medium placeholder:font-normal placeholder:text-slate-400" 
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* === NÚT TẠO SECTION MỚI === */}
              <div className="flex items-center gap-4 mb-12 group">
                <hr className="flex-1 border-slate-200" />
                <button 
                  onClick={(e) => {
                    e.preventDefault(); // Chống reload trang ngoài ý muốn
                    handleAddCustomSection();
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-bold">Thêm tiêu đề mới</span>
                </button>
                <hr className="flex-1 border-slate-200" />
              </div>

              {/* === PHẦN 3: WIDGET ĐẶT PHÒNG & ĐÁNH GIÁ CHUYẾN ĐI === */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-4 mb-10">
                <div className="sm:col-span-2 bg-slate-100/50 rounded-2xl p-5 border border-slate-200/60">
                  <h3 className="font-bold text-slate-900 mb-4">Reservations and attachments</h3>
                  <div className="flex gap-4 overflow-x-auto pb-2 text-slate-500">
                    <ReservationIcon icon={<Plane/>} label="Flight" />
                    <ReservationIcon icon={<Bed/>} label="Lodging" />
                    <ReservationIcon icon={<Car/>} label="Rental car" />
                    <ReservationIcon icon={<Train/>} label="Train" />
                    <ReservationIcon icon={<Paperclip/>} label="Attachment" />
                    <ReservationIcon icon={<MoreHorizontal/>} label="Other" />
                  </div>
                </div>
                <div className="bg-slate-100/50 rounded-2xl p-5 border border-slate-200/60 flex flex-col justify-between">
                  <h3 className="font-bold text-slate-900">Budgeting</h3>
                  <div>
                    <p className="text-2xl font-bold text-slate-400">0 ₫</p>
                    <button onClick={() => setActiveSection('budget')} className="text-sm font-bold text-slate-600 hover:text-slate-900 mt-1">View details</button>
                  </div>
                </div>
              </div>

              {trip.id && <TripReviews tripId={trip.id} />}
            </div>
          </div>
        )}

        {/* --- TAB 2: ITINERARY --- */}
        {activeSection === 'itinerary' && (
          <div className="p-6 sm:p-8 max-w-3xl mx-auto w-full pt-16">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-8">Itinerary</h2>
            <div className="space-y-8">
              {trip.tripDays?.map((day) => (
                <div key={day.id} ref={el => dayRefs.current[day.id] = el} className={`bg-white border rounded-3xl p-6 shadow-sm transition-all ${focusedDayId === day.id ? 'border-[#FF5645] ring-4 ring-[#FF5645]/10' : 'border-slate-200'}`}>
                  <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-3 mb-6"><span className="bg-slate-900 text-white text-xs px-3 py-1 rounded-md uppercase tracking-wider">Day {day.dayNumber}</span><span className="text-slate-500">{day.dayDate}</span></h3>
                  
                  <div className="space-y-4 mb-4">
                    {(!day.destinations || day.destinations.length === 0) ? (
                      <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl">
                        <CheckSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-400 font-medium">Bạn chưa thêm địa điểm nào.</p>
                      </div>
                    ) : (
                      day.destinations.map((dest, idx) => {
                        const isActive = activeDestination?.id === dest.id;
                        return (
                          <div 
                            key={dest.id} 
                            onClick={() => handleDestinationClick(dest, idx)} 
                            className={`flex gap-4 items-start group cursor-pointer p-2 -ml-2 rounded-xl transition-colors ${isActive ? 'bg-orange-50' : 'hover:bg-slate-50'}`}
                          >
                            <div className="flex flex-col items-center mt-1">
                              <div className={`w-8 h-8 rounded-full text-white text-sm font-bold flex items-center justify-center shadow-sm transition-all ${isActive ? 'bg-slate-900 ring-4 ring-[#FF5645]/20 scale-110' : 'bg-[#FF5645]'}`}>{idx + 1}</div>
                              {idx !== day.destinations.length - 1 && <div className="w-0.5 h-10 bg-slate-200 my-1"></div>}
                            </div>
                            <div className={`flex-1 p-4 rounded-2xl border transition-all ${isActive ? 'bg-white border-[#FF5645] shadow-md' : 'bg-white border-slate-200 group-hover:border-[#FF5645]/50'}`}>
                              <h4 className={`font-bold text-base transition-colors ${isActive ? 'text-[#FF5645]' : 'text-slate-900'}`}>{dest.placeName}</h4>
                              {dest.note && <p className="text-sm text-slate-500 mt-1 line-clamp-1">{dest.note}</p>}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {addingDayId === day.id ? (
                    <div ref={searchRef} className="relative mt-4 pl-12">
                      <div className="flex items-center border border-[#FF5645] rounded-xl px-4 py-3 bg-white shadow-sm ring-4 ring-[#FF5645]/10">
                        <Search className="w-5 h-5 text-[#FF5645] mr-3" />
                        <input type="text" autoFocus placeholder="Tìm quán ăn, khách sạn..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 outline-none text-base bg-transparent font-medium" />
                        <button onClick={() => { setAddingDayId(null); setSearchQuery(''); }} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
                      </div>
                      
                      {suggestions.length > 0 && (
                        <div className="absolute top-full left-12 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden">
                          {suggestions.map((place, idx) => (
                            <div key={idx} onClick={() => handleAddDestination(place, day.id)} className="px-5 py-4 hover:bg-orange-50 cursor-pointer border-b border-slate-50 last:border-0 flex items-start gap-3">
                              <MapPin className="w-5 h-5 text-[#FF5645] mt-0.5 flex-shrink-0" />
                              <div><p className="text-base font-bold text-slate-800">{place.name}</p><p className="text-sm text-slate-500 truncate max-w-[300px]">{place.address}</p></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="pl-12 mt-2">
                      <button onClick={() => setAddingDayId(day.id)} className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 text-sm font-bold hover:border-[#FF5645] hover:text-[#FF5645] hover:bg-orange-50/50 transition-colors flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> Add place to Day {day.dayNumber}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- TAB 3: BUDGET --- */}
        {activeSection === 'budget' && (
          <div className="p-10 text-center max-w-lg mx-auto pt-24">
             <Receipt className="w-16 h-16 text-amber-400 mx-auto mb-4" />
             <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Budgeting</h2>
             <p className="text-slate-500">Tính năng chia tiền đang được xây dựng...</p>
          </div>
        )}
      </div>

      {/* ================= CỘT 3. BẢN ĐỒ VÀ PANEL CHI TIẾT ĐỊA ĐIỂM ================= */}
      <div className="hidden md:block w-1/3 lg:w-[45%] relative z-0 border-l border-slate-200">
        
        {/* PANEL TRƯỢT (NỔI TRÊN BẢN ĐỒ) */}
        <div className={`absolute top-4 left-4 bottom-4 w-[400px] bg-white rounded-3xl shadow-2xl z-[1000] border border-slate-100 flex flex-col overflow-hidden transition-transform duration-500 ease-in-out ${activeDestination ? 'translate-x-0 opacity-100' : '-translate-x-[120%] opacity-0'}`}>
          {activeDestination && (
            <>
              {/* Ảnh bìa Panel (Lấy động từ Tab Bài đăng) */}
              <div className="relative h-56 bg-slate-800 flex-shrink-0">
                {coverImage && <img src={coverImage} alt="Cover" className="w-full h-full object-cover opacity-90 transition-opacity" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <button onClick={() => setActiveDestination(null)} className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/40 backdrop-blur transition-colors"><X className="w-4 h-4" /></button>
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
                          <div className="flex justify-end mt-1">
                             <button onClick={() => { submitReview(); setShowReviewForm(false); }} disabled={isSubmittingReview} className="bg-cyan-600 text-white font-bold text-sm px-5 py-2 rounded-full hover:bg-cyan-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                              {isSubmittingReview ? 'Đang gửi...' : <><Send className="w-4 h-4" /> Đăng</>}
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
                                    <span className="text-[11px] text-slate-500 flex items-center gap-1">Local Guide • 1 bài đánh giá</span>
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
                              <p className="text-[14px] text-slate-700 mb-4 leading-relaxed">{review.content}</p>
                              
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
                              <img src={post.imageUrls[0]} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Checkin" />
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

        {/* BẢN ĐỒ LEAFLET CHÍNH */}
        <MapContainer center={[16.047079, 108.206230]} zoom={5} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution='&copy; Google Maps' />
          
          <MapBounds destinations={mapDestinations} activeDestinationId={activeDestination?.id} />
          
          {/* Đường vẽ thực tế (OSRM) */}
          {routePositions.length > 1 && (
            <Polyline positions={routePositions} color="#FF5645" weight={4} opacity={0.8} />
          )}
          
          {/* Cắm cờ các điểm đến */}
          {mapDestinations.map((dest, idx) => (
            <Marker 
              key={dest.id} 
              position={[dest.latitude, dest.longitude]} 
              icon={createCustomMarker(idx + 1, activeDestination?.id === dest.id)}
              eventHandlers={{ click: () => handleDestinationClick(dest, idx) }}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

const ChevronDownIcon = ({ isOpen }) => (
  <svg className={`w-4 h-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
);

const ReservationIcon = ({ icon, label }) => (
  <div className="flex flex-col items-center gap-1.5 cursor-pointer hover:text-slate-900 transition-colors">
    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 text-slate-500">{icon}</div>
    <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
  </div>
);

export default TripDetail;