import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import './Header.css';

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
  const [query, setQuery] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { setNavOpen(false); }, [location.pathname]);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/all?q=${encodeURIComponent(q)}` : '/all');
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  return (
    <header className={navOpen ? 'nav-open' : ''}>
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
        <form className="header-search" onSubmit={handleSearch} role="search">
          <input
            type="search"
            placeholder="Search drinks…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search all drinks"
          />
        </form>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          data-testid="theme-toggle"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button
          className="hamburger"
          onClick={() => setNavOpen(o => !o)}
          aria-label="Toggle navigation"
          aria-expanded={navOpen}
          data-testid="hamburger"
        >☰</button>
      </div>
    </header>
  );
}
