import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* THAY BẰNG CLIENT ID THẬT CỦA BẠN */}
    <GoogleOAuthProvider clientId="220247166301-8ski7u2m532jur99pbqbar3kt1n7gige.apps.googleusercontent.com">
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>,
)