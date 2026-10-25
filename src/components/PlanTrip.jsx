import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar, Users, ChevronDown, X, Compass, MapPin } from 'lucide-react';

const PlanTrip = () => {
  const navigate = useNavigate();

  // State thông tin form
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [visibility, setVisibility] = useState('FRIENDS');

  // State bạn đồng hành
  const [companionInput, setCompanionInput] = useState('');
  const [companionEmails, setCompanionEmails] = useState([]);
  
  // State UI/UX
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // State cho Tìm kiếm địa điểm (Autocomplete)
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Xử lý Debounce gọi API Địa điểm (ĐÃ CHUYỂN SANG DÙNG PHOTON BỀN BỈ HƠN)
  useEffect(() => {
    const fetchPlaces = async () => {
      if (destination.trim().length < 2) {
        setSuggestions([]);
        return;
      }
      setIsSearching(true);
      try {
        const query = encodeURIComponent(destination.trim());
        
        // Dùng API Photon Komoot: Nhanh, không chặn localhost, không lỗi CORS
        // lat=14.0583&lon=108.2772 (Tọa độ trung tâm Việt Nam) & zoom=5 (Ưu tiên kết quả quanh VN)
        const url = `https://photon.komoot.io/api/?q=${query}&lat=14.0583&lon=108.2772&zoom=5&limit=5`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        
        // Chuyển đổi dữ liệu của Photon (GeoJSON) về cấu trúc dễ render
        const formattedPlaces = data.features.map(feature => {
          const prop = feature.properties;
          // Tạo tên chính (Tên địa điểm / Đường / Phường)
          const mainName = prop.name || prop.street || prop.district || prop.city;
          // Tạo tên phụ (Tỉnh thành, Quốc gia)
          const subParts = [prop.city, prop.state, prop.country].filter(Boolean);
          const subName = subParts.length > 0 ? subParts.join(', ') : '';
          
          return {
            place_id: prop.osm_id,
            name: mainName,
            display_name: `${mainName}${subName ? `, ${subName}` : ''}`,
            lat: feature.geometry.coordinates[1],
            lon: feature.geometry.coordinates[0]
          };
        }).filter(place => place.name); // Loại bỏ các kết quả không có tên rõ ràng

        setSuggestions(formattedPlaces);
        setShowDropdown(true);
      } catch (error) {
        console.error('Lỗi khi gọi API địa điểm:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      if (showDropdown) {
        fetchPlaces();
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [destination, showDropdown]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectPlace = (place) => {
    // Ưu tiên lấy tên ngắn gọn
    const mainName = place.name || place.display_name.split(',')[0];
    setDestination(mainName);
    setShowDropdown(false);
  };

  const handleAddCompanion = (e) => {
    e.preventDefault();
    const email = companionInput.trim().toLowerCase();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMsg('Email không hợp lệ.');
      return;
    }
    if (companionEmails.includes(email)) {
      setErrorMsg('Email đã tồn tại.');
      return;
    }
    setCompanionEmails([...companionEmails, email]);
    setCompanionInput('');
    setErrorMsg('');
  };

  const handleRemoveCompanion = (emailToRemove) => {
    setCompanionEmails(companionEmails.filter((item) => item !== emailToRemove));
  };

  const handleStartPlanning = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    if (!destination.trim()) {
      setErrorMsg('Vui lòng nhập điểm đến.');
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        title: `Chuyến đi đến ${destination.trim()}`,
        destination: destination.trim(),
        startDate: startDate ? startDate.toISOString().split('T')[0] : null,
        endDate: endDate ? endDate.toISOString().split('T')[0] : null,
        visibility: visibility,
        isPublic: visibility === 'PUBLIC',
        memberCount: companionEmails.length + 1, 
        companionEmails: companionEmails,
      };

      const response = await axios.post('http://localhost:8080/api/trips', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data?.id) {
        // Chuyển sang trang Detail (Nơi sẽ có giao diện chia đôi màn hình và bản đồ)
        navigate(`/trips/${response.data.id}`);
      } else {
        navigate('/home');
      }
    } catch (error) {
      setErrorMsg(error.response?.data || 'Có lỗi xảy ra khi tạo chuyến đi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white font-sans text-gray-900 flex flex-col">
      <header className="p-5 border-b border-gray-100">
        <Link to="/home" className="inline-flex items-center gap-2 text-gray-900 font-bold text-lg hover:opacity-80 transition-opacity">
          <Compass className="h-7 w-7 text-[#FF5645]" /> TravelPlatform
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-20 pt-10">
        <h1 className="text-4xl sm:text-5xl font-extrabold mb-10 text-center tracking-tight text-slate-800">
          Plan a new trip
        </h1>

        <form onSubmit={handleStartPlanning} className="w-full max-w-[650px] space-y-5">
          {errorMsg && (
            <div className="p-3.5 text-sm text-red-600 bg-red-50 rounded-xl border border-red-200 shadow-sm">
              {errorMsg}
            </div>
          )}

          {/* 1. NƠI ĐẾN (Tích hợp Autocomplete Nominatim API) */}
          <div ref={dropdownRef} className="relative z-50">
            <div className="border border-gray-300 rounded-2xl p-4 sm:p-5 flex items-center bg-white focus-within:border-gray-500 focus-within:ring-2 focus-within:ring-gray-200 transition-all shadow-sm relative">
              <span className="font-bold text-gray-900 mr-3 whitespace-nowrap text-lg">Where to?</span>
              <input
                type="text"
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => destination.trim().length >= 2 && setShowDropdown(true)}
                placeholder="e.g. Da Lat, Ha Noi, Sapa..."
                className="outline-none flex-1 text-gray-700 font-medium placeholder-gray-400 bg-transparent w-full text-lg"
                autoComplete="off"
              />
              {isSearching && (
                <div className="h-5 w-5 rounded-full border-2 border-gray-300 border-t-[#FF5645] animate-spin ml-2"></div>
              )}
            </div>

            {/* Dropdown Gợi ý Địa điểm */}
            {showDropdown && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden">
                {suggestions.map((place) => {
                  const mainName = place.name || place.display_name.split(',')[0];
                  const subName = place.display_name.substring(mainName.length + 1).trim();

                  return (
                    <div
                      key={place.place_id}
                      onClick={() => handleSelectPlace(place)}
                      className="flex items-start px-5 py-3.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors"
                    >
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900 text-base">{mainName}</span>
                        <span className="text-sm text-gray-500 truncate max-w-[500px]">
                          {subName}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. CHỌN NGÀY */}
          <div className="border border-gray-300 rounded-2xl p-4 relative focus-within:border-gray-500 focus-within:ring-2 focus-within:ring-gray-200 transition-all shadow-sm">
            <label className="text-[11px] font-bold text-gray-900 uppercase tracking-wider absolute top-2.5 left-5">
              Dates (optional)
            </label>
            <div className="flex items-center mt-5 px-1">
              <div className="flex items-center flex-1">
                <Calendar className="w-5 h-5 text-gray-400 mr-2.5" />
                <DatePicker
                  selected={startDate}
                  onChange={(date) => setStartDate(date)}
                  selectsStart
                  startDate={startDate}
                  endDate={endDate}
                  monthsShown={1}
                  placeholderText="Start date"
                  className="outline-none text-gray-700 w-full text-base font-semibold bg-transparent cursor-pointer"
                  dateFormat="dd MMM yyyy"
                />
              </div>
              <div className="h-6 w-px bg-gray-200 mx-3"></div>
              <div className="flex items-center flex-1 pl-3">
                <Calendar className="w-5 h-5 text-gray-400 mr-2.5" />
                <DatePicker
                  selected={endDate}
                  onChange={(date) => setEndDate(date)}
                  selectsEnd
                  startDate={startDate}
                  endDate={endDate}
                  minDate={startDate}
                  monthsShown={1}
                  placeholderText="End date"
                  className="outline-none text-gray-700 w-full text-base font-semibold bg-transparent cursor-pointer"
                  dateFormat="dd MMM yyyy"
                />
              </div>
            </div>
          </div>

          {/* 3. BẠN ĐỒNG HÀNH */}
          <div className="border border-gray-300 rounded-2xl p-5 flex flex-col focus-within:border-gray-500 focus-within:ring-2 focus-within:ring-gray-200 transition-all shadow-sm">
            <div className="flex items-center">
              <span className="text-gray-900 font-bold mr-4 whitespace-nowrap text-base">Tripmates</span>
              <input
                type="email"
                value={companionInput}
                onChange={(e) => setCompanionInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCompanion(e)}
                placeholder="Enter email to invite..."
                className="outline-none flex-1 text-gray-700 font-medium placeholder-gray-400 bg-transparent min-w-[200px]"
              />
            </div>
            
            {companionEmails.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2.5 pt-3 border-t border-gray-100">
                {companionEmails.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-1.5 text-sm font-semibold text-slate-700 border border-slate-200"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveCompanion(email)}
                      className="text-slate-400 hover:text-red-500 transition-colors bg-white rounded-full p-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 4. QUYỀN RIÊNG TƯ & NÚT SUBMIT */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-5 gap-4">
            <div className="relative flex items-center text-gray-600 hover:text-gray-900 cursor-pointer transition-colors bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm w-full sm:w-auto">
              <Users className="w-4.5 h-4.5 mr-2.5 text-gray-500" />
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="appearance-none bg-transparent font-bold outline-none cursor-pointer pr-7 text-sm w-full"
              >
                <option value="PRIVATE">Private (Only you & mates)</option>
                <option value="FRIENDS">Friends (Your followers)</option>
                <option value="PUBLIC">Public (Community)</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 text-gray-400 pointer-events-none" />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="bg-[#FF5645] hover:bg-[#E04B3B] text-white font-bold py-3.5 px-10 rounded-full shadow-lg transition-all active:scale-95 disabled:opacity-70 w-full sm:w-auto text-lg"
            >
              {isLoading ? 'Creating...' : 'Start planning'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default PlanTrip;