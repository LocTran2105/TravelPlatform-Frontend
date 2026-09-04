import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Home from './components/Home';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Nếu người dùng vào /login thì hiện màn hình Login */}
        <Route path="/login" element={<Login />} />
        
        {/* Nếu người dùng vào /home thì hiện màn hình Home */}
        <Route path="/home" element={<Home />} />
        
        {/* Mặc định khi mới vào web sẽ tự động chuyển hướng sang /login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;