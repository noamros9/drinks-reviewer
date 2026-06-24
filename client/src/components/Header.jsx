import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';

const NAV = [
  { path: '/all', label: 'All' },
  { path: '/wine', label: 'Wine' },
  { path: '/beer', label: 'Beer' },
  { path: '/whiskey', label: 'Whiskey' },
  { path: '/others', label: 'Others' },
  { path: '/admin', label: 'Admin' },
];

export default function Header() {
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light'
  );
  const location = useLocation();

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  return (
    <header>
      <div className="header-inner">
        <Link to="/" className="logo">Drinks Reviewer</Link>
        <nav>
          {NAV.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={location.pathname === path ? 'active' : ''}
            >
              {label}
            </Link>
          ))}
        </nav>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          data-testid="theme-toggle"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
