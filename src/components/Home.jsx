import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// 1. Import các thành phần của thư viện bản đồ
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // BẮT BUỘC BỎ QUA DÒNG NÀY SẼ BỊ VỠ KHUNG BẢN ĐỒ

// 2. Fix lỗi mất icon mặc định của Leaflet khi dùng với Vite
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function Home() {
  const navigate = useNavigate();
  const [places, setPlaces] = useState([]); 
  // Tạo tọa độ trung tâm mặc định (Ví dụ: Trung tâm Vũng Tàu theo data của bạn)
  const defaultCenter = [10.3831, 107.1352]; 

  useEffect(() => {
    fetchMyPlaces();
  }, []);

  const fetchMyPlaces = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    try {
      const response = await axios.get('http://localhost:8080/api/map/places/my-places', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPlaces(response.data);
    } catch (error) {
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
         localStorage.removeItem('token');
         navigate('/login');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div style={{ padding: '30px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>🗺️ Bản đồ Du lịch của tôi</h2>
        <button onClick={handleLogout} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Đăng xuất
        </button>
      </div>

      <hr style={{ marginBottom: '20px' }} />

      {/* KHU VỰC HIỂN THỊ BẢN ĐỒ */}
      <div style={{ height: '500px', width: '100%', border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
        <MapContainer center={defaultCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
          
          {/* Lớp nền bản đồ của OpenStreetMap */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {/* Vòng lặp rải các điểm Marker lên bản đồ dựa vào data lấy từ Spring Boot */}
          {places.map((place) => (
            <Marker key={place.id} position={[place.latitude, place.longitude]}>
              <Popup>
                <strong>{place.name}</strong> <br />
                {place.description}
              </Popup>
            </Marker>
          ))}
          
        </MapContainer>
      </div>
    </div>
  );
}

export default Home;