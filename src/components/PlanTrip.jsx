import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar, Users, ChevronDown, X, MapPin, AlertCircle, Wallet, Loader2, ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '../config/api';
import SiteHeader from './site/SiteHeader';
import JourneyScene from './site/JourneyScene';

const VISIBILITY_LABELS = {
  PRIVATE: 'Riêng tư: chỉ bạn và người đi cùng',
  FOLLOWERS: 'Người theo dõi bạn',
  FRIENDS: 'Bạn bè: hai người theo dõi nhau',
  PUBLIC: 'Công khai trong cộng đồng',
};
const fmtDate = (d) => (d ? d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : null);
const fmtMoney = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? `${n.toLocaleString('vi-VN')} ₫` : null;
};
const tripDays = (a, b) => (a && b ? Math.round((b - a) / 86400000) + 1 : null);

/** Bản xem trước chuyến đi, cập nhật theo từng ô người dùng điền. */
function TripPreview({ destination, startDate, endDate, budget, mates, visibility }) {
  const days = tripDays(startDate, endDate);
  const when = startDate
    ? `${fmtDate(startDate)}${endDate ? ` – ${fmtDate(endDate)}` : ''}${days ? `, ${days} ngày` : ''}`
    : 'Chưa chọn ngày';
  const rows = [
    { icon: Calendar, label: 'Thời gian', value: when },
    { icon: Wallet, label: 'Ngân sách', value: fmtMoney(budget) || 'Chưa đặt' },
    { icon: Users, label: 'Đi cùng', value: mates ? `Bạn và ${mates} người được mời` : 'Chỉ mình bạn' },
  ];
  return (
    <JourneyScene className="h-full min-h-[560px] rounded-[1.75rem] border border-slate-200/70" labels={false}>
      <div className="absolute inset-x-5 bottom-5 z-[5] rounded-2xl border border-white/80 bg-white/90 p-5 shadow-[0_24px_50px_-28px_rgba(28,36,33,.6)] backdrop-blur-md">
        <p className="text-sm font-medium text-slate-500">Xem trước chuyến đi</p>
        <motion.p key={destination.trim() || 'empty'} className="mt-1 truncate text-2xl font-bold text-slate-900"
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {destination.trim() || 'Điểm đến của bạn'}
        </motion.p>
        <dl className="mt-4 space-y-2.5">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <dt className="flex w-28 flex-shrink-0 items-center gap-2 text-slate-500"><Icon className="h-4 w-4" />{label}</dt>
              <dd className="min-w-0 truncate font-semibold text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">Ai xem được: {VISIBILITY_LABELS[visibility]}</p>
      </div>
    </JourneyScene>
  );
}



const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_COMPANIONS = 20;

const PlanTrip = () => {
  const navigate = useNavigate();

  // State thông tin form
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [visibility, setVisibility] = useState('FRIENDS');
  const [totalBudget, setTotalBudget] = useState('');

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

  const [companionError, setCompanionError] = useState('');
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

  // Thêm email vào danh sách mời. Email chưa có tài khoản vẫn hợp lệ: họ sẽ nhận thư mời
  // và chỉ tham gia chuyến đi khi bấm "Tham gia" (đăng ký bằng đúng email đó nếu chưa có tài khoản).
  const handleAddCompanion = (e) => {
    e.preventDefault();

    const email = companionInput.trim().toLowerCase();
    if (!email) return;
    setCompanionError('');

    if (!EMAIL_REGEX.test(email)) {
      setCompanionError('Email không hợp lệ.');
      return;
    }
    if (companionEmails.includes(email)) {
      setCompanionError('Email này đã có trong danh sách.');
      return;
    }
    if (companionEmails.length >= MAX_COMPANIONS) {
      setCompanionError(`Chỉ mời được tối đa ${MAX_COMPANIONS} người.`);
      return;
    }
    setCompanionEmails((prev) => [...prev, email]);
    setCompanionInput('');
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

    const budgetValue = totalBudget === '' ? 0 : Number(totalBudget);
    if (!Number.isFinite(budgetValue) || budgetValue < 0 || budgetValue > 1_000_000_000_000) {
      setErrorMsg('Ngân sách không hợp lệ.');
      return;
    }

    // Nếu đã gõ email nhưng chưa nhấn Enter thì vẫn tính vào danh sách
    setCompanionError('');
    const finalCompanionEmails = [...companionEmails];
    const pendingEmail = companionInput.trim().toLowerCase();
    if (pendingEmail) {
      if (!EMAIL_REGEX.test(pendingEmail)) {
        setCompanionError('Email không hợp lệ.');
        return;
      }
      if (!finalCompanionEmails.includes(pendingEmail)) {
        if (finalCompanionEmails.length >= MAX_COMPANIONS) {
          setCompanionError(`Chỉ mời được tối đa ${MAX_COMPANIONS} người.`);
          return;
        }
        finalCompanionEmails.push(pendingEmail);
      }
    }

    setIsLoading(true);

    try {
      const payload = {
        title: `Chuyến đi đến ${destination.trim()}`,
        destination: destination.trim(),
        startDate: startDate ? startDate.toISOString().split('T')[0] : null,
        endDate: endDate ? endDate.toISOString().split('T')[0] : null,
        totalBudget: budgetValue,
        visibility: visibility,
        isPublic: visibility === 'PUBLIC',
        companionEmails: finalCompanionEmails,
      };

      const response = await axios.post(`${API_BASE_URL}/api/trips`, payload, {
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
    <div className="tp-site flex min-h-screen w-full flex-col">
      <SiteHeader search={false} />

      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-[minmax(0,1fr)] gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:px-8 lg:pt-14">
        <div>
        <motion.h1 className="text-4xl font-bold text-slate-900 sm:text-5xl"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          Lên kế hoạch chuyến mới
        </motion.h1>
        <p className="mt-3 mb-8 text-base text-slate-600">Chỉ cần điểm đến là đủ để bắt đầu. Ngày đi, ngân sách và bạn đồng hành có thể thêm sau.</p>

        <form onSubmit={handleStartPlanning} className="w-full space-y-4">
          {errorMsg && (
            <div className="p-3.5 text-sm text-red-600 bg-red-50 rounded-xl border border-red-200 shadow-sm">
              {errorMsg}
            </div>
          )}

          {/* 1. NƠI ĐẾN (Tích hợp Autocomplete Nominatim API) */}
          <div ref={dropdownRef} className="relative z-50">
            <div className="border border-slate-200 rounded-2xl bg-white p-4 sm:p-5 flex items-center bg-white focus-within:border-[#FF5645] focus-within:ring-4 focus-within:ring-[#FF5645]/10 transition-all shadow-sm relative">
              <span className="font-bold text-gray-900 mr-3 whitespace-nowrap text-lg">Đi đâu?</span>
              <input
                type="text"
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => destination.trim().length >= 2 && setShowDropdown(true)}
                placeholder="Ví dụ: Đà Lạt, Hà Nội, Sa Pa"
                aria-label="Điểm đến"
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
          <div className="border border-slate-200 rounded-2xl bg-white p-4 relative focus-within:border-[#FF5645] focus-within:ring-4 focus-within:ring-[#FF5645]/10 transition-all shadow-sm">
            <span className="absolute top-2.5 left-5 text-sm font-bold text-gray-900">
              Ngày đi <span className="font-normal text-slate-400">(không bắt buộc)</span>
            </span>
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
                  placeholderText="Ngày bắt đầu"
                  className="outline-none text-gray-700 w-full text-base font-semibold bg-transparent cursor-pointer"
                  dateFormat="dd/MM/yyyy"
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
                  placeholderText="Ngày kết thúc"
                  className="outline-none text-gray-700 w-full text-base font-semibold bg-transparent cursor-pointer"
                  dateFormat="dd/MM/yyyy"
                />
              </div>
            </div>
          </div>

          {/* 2b. NGÂN SÁCH (không bắt buộc, có thể đặt sau trong tab Budget) */}
          <div className="border border-slate-200 rounded-2xl bg-white p-5 flex items-center focus-within:border-[#FF5645] focus-within:ring-4 focus-within:ring-[#FF5645]/10 transition-all shadow-sm">
            <span className="text-gray-900 font-bold mr-4 whitespace-nowrap text-base">Ngân sách</span>
            <input
              type="number"
              min="0"
              step="100000"
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
              placeholder="Tổng ngân sách (không bắt buộc)"
              aria-label="Tổng ngân sách"
              className="outline-none flex-1 text-gray-700 font-medium placeholder-gray-400 bg-transparent min-w-0"
            />
            <span className="text-gray-400 font-semibold ml-2">₫</span>
          </div>

          {/* 3. BẠN ĐỒNG HÀNH */}
          <div className="border border-slate-200 rounded-2xl bg-white p-5 flex flex-col focus-within:border-[#FF5645] focus-within:ring-4 focus-within:ring-[#FF5645]/10 transition-all shadow-sm">
            <div className="flex items-center">
              <span className="text-gray-900 font-bold mr-4 whitespace-nowrap text-base">Bạn đồng hành</span>
              <input
                type="email"
                value={companionInput}
                onChange={(e) => {
                  setCompanionInput(e.target.value);
                  if (companionError) setCompanionError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCompanion(e)}
                placeholder="Nhập email rồi nhấn Enter"
                aria-label="Email bạn đồng hành"
                className="outline-none flex-1 text-gray-700 font-medium placeholder-gray-400 bg-transparent min-w-0"
              />
            </div>

            <p className="mt-2 text-xs leading-relaxed text-gray-400">
              Mỗi người nhận một email mời. Họ chỉ tham gia chuyến đi khi bấm chấp nhận,
              chưa có tài khoản thì đăng ký bằng đúng email đó.
            </p>

            {companionError && (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{companionError}</span>
              </p>
            )}
            
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
                aria-label="Ai xem được chuyến đi"
              >
                {Object.entries(VISIBILITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 text-gray-400 pointer-events-none" />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="tp-btn-primary w-full px-9 py-3.5 text-base disabled:opacity-70 sm:w-auto"
            >
              {isLoading ? <><Loader2 className="h-5 w-5 animate-spin" /> Đang tạo...</> : <>Bắt đầu lên kế hoạch <ArrowRight className="h-5 w-5" /></>}
            </button>
          </div>
        </form>
        </div>

        <div className="hidden lg:block">
          <TripPreview destination={destination} startDate={startDate} endDate={endDate} budget={totalBudget}
            mates={companionEmails.length} visibility={visibility} />
        </div>
      </main>
    </div>
  );
};

export default PlanTrip;