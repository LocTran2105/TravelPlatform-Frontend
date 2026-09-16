import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { LogOut, MapPin, Compass, Plus, Navigation } from 'lucide-react';

// Fix lỗi mất icon mặc định của Leaflet trong Vite
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const Home = () => {
  const navigate = useNavigate();
  const [places, setPlaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Tọa độ trung tâm mặc định (VD: TP.HCM)
  const defaultCenter = [10.762622, 106.660172];

  useEffect(() => {
    // Lấy thông tin user từ localStorage
    const savedUser = localStorage.getItem('user');
    if (savedUser) setUser(JSON.parse(savedUser));

    const fetchMyPlaces = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      try {
        // Gọi API lấy danh sách địa điểm của user
        // TẠM THỜI MOCK DATA ĐỂ TEST GIAO DIỆN NẾU BACKEND CHƯA CÓ API NÀY
        /*
        const response = await axios.get('http://localhost:8080/api/map/places', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPlaces(response.data);
        */
        
        // Dữ liệu mẫu để hiển thị lên bản đồ (Bạn có thể xóa phần này khi nối API thật)
        setPlaces([
          { id: 1, name: "Chợ Bến Thành", lat: 10.7725, lng: 106.6980, desc: "Biểu tượng của thành phố" },
          { id: 2, name: "Phố đi bộ Nguyễn Huệ", lat: 10.7733, lng: 106.7027, desc: "Nơi dạo mát buổi tối tuyệt vời" }
        ]);

      } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          localStorage.removeItem('token');
          navigate('/login');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchMyPlaces();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 font-sans text-slate-800">
      {/* HEADER NAVBAR */}
      <header className="h-16 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-2 text-emerald-600">
          <Compass className="w-6 h-6 animate-pulse" />
          <h1 className="text-xl font-bold tracking-tight">TravelPlatform</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-600 hidden sm:block">
            Xin chào, {user?.fullName || 'Nhà thám hiểm'}! 👋
          </span>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" /> Đăng xuất
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* CỘT TRÁI: DANH SÁCH ĐỊA ĐIỂM */}
        <div className="w-full md:w-1/3 lg:w-1/4 bg-white border-r border-slate-200 overflow-y-auto z-10 flex flex-col">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Navigation className="w-4 h-4 text-emerald-500" /> Hành trình của tôi
            </h2>
            <button className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors" title="Thêm địa điểm mới">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          
          <div className="p-4 space-y-3 flex-1 overflow-y-auto">
            {isLoading ? (
              <p className="text-center text-sm text-slate-500 mt-5">Đang tải dữ liệu...</p>
            ) : places.length === 0 ? (
              <p className="text-center text-sm text-slate-500 mt-5">Bạn chưa lưu địa điểm nào.</p>
            ) : (
              places.map((place) => (
                <div key={place.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer group">
                  <h3 className="font-semibold text-slate-800 group-hover:text-emerald-600 flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                    {place.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1.5 ml-6 line-clamp-2">{place.desc}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CỘT PHẢI: BẢN ĐỒ LEAFLET */}
        <div className="flex-1 relative z-0 bg-slate-200">
          <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
           {/* Lớp nền bản đồ xịn sò của Google Maps */}
          <TileLayer
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
          />
            {places.map((place) => (
              <Marker key={place.id} position={[place.lat, place.lng]}>
                <Popup className="custom-popup">
                  <div className="text-sm">
                    <strong className="text-emerald-600 text-base">{place.name}</strong>
                    <p className="text-slate-600 mt-1">{place.desc}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

      </main>
    </div>
  );
};

export default Home;