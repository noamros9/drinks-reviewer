import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

// Only /api/* — /auth/me legitimately 401s pre-login and handles its own state (see Header.jsx).
const nativeFetch = window.fetch;
window.fetch = async (url, ...rest) => {
  const res = await nativeFetch(url, ...rest);
  if (res.status === 401 && typeof url === 'string' && url.startsWith('/api')) {
    window.location.href = '/auth/google';
  }
  return res;
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}

const savedTheme =
  localStorage.getItem('theme') ||
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', savedTheme);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
