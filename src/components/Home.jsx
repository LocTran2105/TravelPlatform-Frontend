import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Xóa Token khỏi trình duyệt
    localStorage.removeItem('token');
    // Đẩy người dùng về lại trang đăng nhập
    navigate('/login');
  };

  return (
    <div style={{ padding: '50px', textAlign: 'center' }}>
      <h1>Chào mừng đến với Trang chủ! 🌍</h1>
      <p>Bạn đã đăng nhập thành công và Token đang được giữ an toàn.</p>
      
      <button 
        onClick={handleLogout} 
        style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white' }}>
        Đăng xuất
      </button>
    </div>
  );
}

export default Home;