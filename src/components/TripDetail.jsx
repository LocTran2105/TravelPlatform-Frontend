import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  ArrowLeft, Calendar, MapPin, Plus, 
  Search, X, Navigation, Users, Receipt, 
  Share2, MoreHorizontal, ChevronLeft, ChevronRight,
  Wand2, Plane, Bed, Car, Train, Paperclip, CheckSquare, Compass
} from 'lucide-react';

// ================= COMPONENT HỖ TRỢ BẢN ĐỒ =================
function MapBounds({ destinations }) {
  const map = useMap();
  useEffect(() => {
    if (destinations && destinations.length > 0) {
      const bounds = L.latLngBounds(destinations.map(d => [d.latitude, d.longitude]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [destinations, map]);
  return null;
}

const createCustomMarker = (number) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: #FF5645; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${number}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

const MOCK_EXPLORE_PLACES = [
  { id: 1, title: 'Best attractions in Hanoi', desc: 'Most often-seen on the web', image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?q=80&w=600&auto=format&fit=crop', provider: 'TravelPlatform' },
  { id: 2, title: 'Best restaurants in Hanoi', desc: 'Highly rated by locals', image: 'https://images.unsplash.com/photo-1583095123995-1718f40776b9?q=80&w=600&auto=format&fit=crop', provider: 'TravelPlatform' },
  { id: 3, title: 'Search hotels with transparent pricing', desc: 'Find the best deals', image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=600&auto=format&fit=crop', provider: 'TravelPlatform' },
];

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

  const [addingDayId, setAddingDayId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // State lưu tọa độ đường đi thực tế từ OSRM
  const [routePositions, setRoutePositions] = useState([]);

  const searchRef = useRef(null);
  const dayRefs = useRef({}); 

  const fetchTripDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { navigate('/login'); return; }
      const response = await axios.get(`http://localhost:8080/api/trips/${tripId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrip(response.data);
    } catch (err) {
      const errorData = err.response?.data;
      setError(typeof errorData === 'string' ? errorData : 'Lỗi máy chủ: Không thể tải dữ liệu chuyến đi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTripDetails();
  }, [tripId]);

  useEffect(() => {
    const fetchPlaces = async () => {
      if (searchQuery.trim().length < 2) { setSuggestions([]); return; }
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
      } catch (err) { console.error(err); } 
      finally { setIsSearching(false); }
    };
    const delayDebounceFn = setTimeout(() => { if (addingDayId) fetchPlaces(); }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, addingDayId]);

  const handleAddDestination = async (place, dayId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:8080/api/trips/days/${dayId}/destinations`, {
        placeName: place.name, latitude: place.lat, longitude: place.lon, note: place.address, estimatedCost: 0
      }, { headers: { Authorization: `Bearer ${token}` }});
      setAddingDayId(null); setSearchQuery(''); setSuggestions([]);
      fetchTripDetails(); 
    } catch (err) { alert("Lỗi: " + (err.response?.data || err.message)); }
  };

  const handleScrollToDay = (dayId) => {
    setActiveSection('itinerary');
    setFocusedDayId(dayId);
    if (dayRefs.current[dayId]) {
      dayRefs.current[dayId].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Tối ưu hóa việc lọc danh sách các điểm bằng useMemo
  const mapDestinations = useMemo(() => {
    if (focusedDayId) {
      const focusedDay = trip?.tripDays?.find(day => day.id === focusedDayId);
      return focusedDay?.destinations || [];
    }
    return trip?.tripDays?.flatMap(day => day.destinations || []) || [];
  }, [trip, focusedDayId]);

  // Gọi API OSRM để lấy đường đi thực tế mỗi khi mapDestinations thay đổi
  useEffect(() => {
    const fetchRealRoute = async () => {
      if (!mapDestinations || mapDestinations.length < 2) {
        setRoutePositions([]);
        return;
      }
      try {
        // OSRM yêu cầu tọa độ dạng: Lng,Lat;Lng,Lat
        const coordsStr = mapDestinations.map(d => `${d.longitude},${d.latitude}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          // GeoJSON trả về Lng, Lat -> Cần đảo lại Lat, Lng cho Leaflet
          const routeCoords = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
          setRoutePositions(routeCoords);
        } else {
          // Fallback: Nối đường thẳng nếu không tìm thấy đường đi bộ/ô tô
          setRoutePositions(mapDestinations.map(d => [d.latitude, d.longitude]));
        }
      } catch (error) {
        console.error("Lỗi vẽ đường đi OSRM:", error);
        setRoutePositions(mapDestinations.map(d => [d.latitude, d.longitude]));
      }
    };

    fetchRealRoute();
  }, [mapDestinations]);

  if (loading) return <div className="h-screen flex items-center justify-center font-bold text-slate-500">Đang tải hành trình...</div>;
  if (error) return <div className="h-screen flex items-center justify-center text-rose-500 font-bold">{String(error)}</div>;
  if (!trip) return null;

  return (
    <div className="h-screen w-full flex bg-slate-50 font-sans overflow-hidden">
      
      {/* ================= 1. SIDEBAR ================= */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col relative z-20 overflow-hidden`}>
        <div className="p-4 flex items-center gap-3 border-b border-slate-100">
          <Link to="/home" className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors text-slate-600">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <span className="font-bold text-slate-800 truncate flex-1">{trip.destination}</span>
        </div>

        <div className="p-4">
          <button className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 hover:shadow-lg transition-all active:scale-95">
            <Wand2 className="w-4 h-4" /> AI Assistant
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div>
            <button 
              onClick={() => { setActiveSection('overview'); setFocusedDayId(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-sm transition-colors ${activeSection === 'overview' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <ChevronDownIcon isOpen={true} /> Overview
            </button>
          </div>

          <div className="pt-2">
            <button 
              onClick={() => { 
                setActiveSection('itinerary'); 
                setIsItineraryExpanded(!isItineraryExpanded);
                setFocusedDayId(null); 
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-sm transition-colors ${activeSection === 'itinerary' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <ChevronDownIcon isOpen={isItineraryExpanded} /> Itinerary
            </button>
            
            {isItineraryExpanded && (
              <div className="pl-9 space-y-1 mt-1">
                {trip.tripDays?.map((day) => (
                  <span 
                    key={day.id}
                    onClick={() => handleScrollToDay(day.id)}
                    className={`block px-3 py-1.5 text-sm cursor-pointer rounded-md transition-colors ${focusedDayId === day.id ? 'font-bold text-[#FF5645] bg-red-50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                  >
                    Day {day.dayNumber} ({day.dayDate})
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button 
              onClick={() => setActiveSection('budget')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold text-sm transition-colors ${activeSection === 'budget' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <ChevronDownIcon isOpen={activeSection === 'budget'} /> Budget
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100">
          <button onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium">
            <ChevronLeft className="w-4 h-4" /> Hide sidebar
          </button>
        </div>
      </div>

      {!isSidebarOpen && (
        <div className="absolute top-4 left-4 z-30">
          <button onClick={() => setIsSidebarOpen(true)} className="h-10 w-10 bg-white shadow-lg border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:text-[#FF5645] transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ================= 2. MAIN CONTENT ================= */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-y-auto scroll-smooth">
        <div className="absolute top-0 right-0 left-0 p-4 flex justify-end gap-3 z-20 pointer-events-none">
          <div className="pointer-events-auto flex gap-2">
            <button className="bg-white/90 backdrop-blur text-slate-800 font-bold text-sm px-4 py-2 rounded-full shadow-sm border border-slate-200 flex items-center gap-2 hover:bg-white transition-colors">
              <Share2 className="w-4 h-4" /> Share
            </button>
            <button className="bg-slate-900 text-white font-bold text-sm px-4 py-2 rounded-full shadow-sm hover:bg-slate-800 transition-colors">
              Plan trip ▼
            </button>
          </div>
        </div>

        {activeSection === 'overview' && (
          <div className="pb-20">
            <div className="h-[300px] w-full relative bg-slate-800">
              <img src={`https://source.unsplash.com/1200x600/?${trip.destination || 'vietnam'}`} alt="Cover" className="w-full h-full object-cover opacity-80" onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1200&auto=format&fit=crop'; }}/>
            </div>
            <div className="relative -mt-16 mx-auto max-w-4xl px-4 sm:px-8">
              <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-slate-100 flex flex-col sm:flex-row sm:items-end justify-between">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">{trip.title}</h1>
                  <div className="flex items-center text-sm font-semibold text-slate-500 gap-2">
                    <Calendar className="w-4 h-4 text-slate-400"/> {trip.startDate} — {trip.endDate || 'No end date'}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4 sm:mt-0">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 border border-slate-200">{trip.user?.fullName?.charAt(0).toUpperCase() || 'U'}</div>
                  <button className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 border border-slate-200 border-dashed"><Users className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            <div className="mx-auto max-w-4xl px-4 sm:px-8 mt-12">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2"><ChevronDownIcon isOpen={true} /> Explore</h2>
                <button className="bg-[#FF5645] hover:bg-[#E04B3B] text-white text-sm font-bold px-4 py-2 rounded-full flex items-center gap-2 transition-colors"><Search className="w-4 h-4" /> Browse all</button>
              </div>

              <div className="flex overflow-x-auto gap-5 pb-6 snap-x">
                {MOCK_EXPLORE_PLACES.map(place => (
                  <div key={place.id} className="min-w-[260px] sm:min-w-[280px] bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow snap-start">
                    <img src={place.image} alt={place.title} className="h-36 w-full object-cover" />
                    <div className="p-4">
                      <h3 className="font-bold text-slate-900 leading-tight mb-1">{place.title}</h3>
                      <p className="text-sm text-slate-500 mb-4">{place.desc}</p>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400"><Compass className="w-3.5 h-3.5 text-[#FF5645]" /> {place.provider}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'itinerary' && (
          <div className="p-6 sm:p-8 max-w-3xl mx-auto w-full pt-16">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-8">Itinerary</h2>
            <div className="space-y-8">
              {trip.tripDays?.map((day) => (
                <div key={day.id} ref={el => dayRefs.current[day.id] = el} className={`bg-white border rounded-3xl p-6 shadow-sm transition-all ${focusedDayId === day.id ? 'border-[#FF5645] ring-4 ring-[#FF5645]/10' : 'border-slate-200'}`}>
                  <h3 className="font-extrabold text-slate-800 text-lg flex items-center gap-3 mb-6">
                    <span className="bg-slate-900 text-white text-xs px-3 py-1 rounded-md uppercase tracking-wider">Day {day.dayNumber}</span>
                    <span className="text-slate-500">{day.dayDate}</span>
                  </h3>
                  <div className="space-y-4 mb-4">
                    {(!day.destinations || day.destinations.length === 0) ? (
                      <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl"><CheckSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p className="text-sm text-slate-400 font-medium">Bạn chưa thêm địa điểm nào.</p></div>
                    ) : (
                      day.destinations.map((dest, idx) => (
                        <div key={dest.id} className="flex gap-4 items-start group">
                          <div className="flex flex-col items-center mt-1">
                            <div className="w-8 h-8 rounded-full bg-[#FF5645] text-white text-sm font-bold flex items-center justify-center shadow-sm">{idx + 1}</div>
                            {idx !== day.destinations.length - 1 && <div className="w-0.5 h-10 bg-slate-200 my-1"></div>}
                          </div>
                          <div className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 group-hover:border-[#FF5645]/50 group-hover:shadow-md transition-all cursor-pointer">
                            <h4 className="font-bold text-base text-slate-900">{dest.placeName}</h4>
                            {dest.note && <p className="text-sm text-slate-500 mt-1 line-clamp-1">{dest.note}</p>}
                          </div>
                        </div>
                      ))
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

        {activeSection === 'budget' && (
          <div className="p-10 text-center max-w-lg mx-auto">
             <Receipt className="w-16 h-16 text-amber-400 mx-auto mb-4" />
             <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Budgeting</h2>
             <p className="text-slate-500">Tính năng chia tiền đang được xây dựng...</p>
          </div>
        )}
      </div>

      {/* ================= 3. BẢN ĐỒ ================= */}
      <div className="hidden md:block w-1/3 lg:w-[35%] relative z-0 border-l border-slate-200">
        <MapContainer center={[16.047079, 108.206230]} zoom={5} style={{ height: '100%', width: '100%' }} zoomControl={true}>
          <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution='&copy; Google Maps' />
          <MapBounds destinations={mapDestinations} />
          
          {/* Vẽ đường đi thực tế từ API OSRM */}
          {routePositions.length > 1 && (
            <Polyline positions={routePositions} color="#FF5645" weight={4} opacity={0.8} />
          )}
          
          {mapDestinations.map((dest, idx) => (
            <Marker key={dest.id} position={[dest.latitude, dest.longitude]} icon={createCustomMarker(idx + 1)}>
              <Popup className="custom-popup rounded-xl">
                <div className="font-sans min-w-[150px]">
                  <h3 className="font-bold text-slate-900 text-sm mb-1">{idx + 1}. {dest.placeName}</h3>
                  {dest.note && <p className="text-xs text-slate-500 line-clamp-2">{dest.note}</p>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

    </div>
  );
};

const ChevronDownIcon = ({ isOpen }) => (
  <svg className={`w-4 h-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const ReservationIcon = ({ icon, label }) => (
  <div className="flex flex-col items-center gap-1.5 cursor-pointer hover:text-slate-900 transition-colors">
    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">{icon}</div>
    <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
  </div>
);

export default TripDetail;