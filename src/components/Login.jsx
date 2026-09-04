import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Login() {
  // useState dùng để lưu trữ dữ liệu người dùng gõ vào (trạng thái nội bộ)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
const navigate = useNavigate();
  // Hàm xử lý khi bấm nút Đăng nhập
  const handleLogin = async (e) => {
    e.preventDefault(); 
    
    try {
        console.log("Đang gọi API Spring Boot...");
        
        // 1. Gửi Email và Password xuống Backend
        const response = await axios.post('http://localhost:8080/api/auth/login', {
            email: email,
            password: password
        });

        // 2. Lấy Token từ kết quả trả về
        const token = response.data.token; // (Tùy thuộc vào JSON backend trả về tên là 'token' hay 'accessToken')
        
        // 3. Cất JWT Token vào "két sắt" của trình duyệt
        localStorage.setItem('token', token);
        
        navigate('/home');
        console.log("Token của bạn là:", token);

        // Bài sau ta sẽ viết code để chuyển hướng (Navigate) sang trang Chủ ở đây

    } catch (error) {
        // Bắt lỗi nếu sai mật khẩu hoặc tài khoản không tồn tại
        alert("Đăng nhập thất bại! Vui lòng kiểm tra lại.");
        console.error("Lỗi từ server:", error.response ? error.response.data : error.message);
    }
  };

  return (
    <div style={{ padding: '50px', maxWidth: '400px', margin: '0 auto' }}>
      <h2>Đăng nhập Hệ thống</h2>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '15px' }}>
          <label>Email:</label> <br />
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)} // Cập nhật state mỗi khi gõ
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>Mật khẩu:</label> <br />
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white' }}>
          Đăng nhập
        </button>
      </form>
    </div>
  );
}

export default Login;