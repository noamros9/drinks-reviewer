import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import CategoryPage from './pages/CategoryPage';
import AllDrinksPage from './pages/AllDrinksPage';
import CollectionPage from './pages/CollectionPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/all" element={<AllDrinksPage />} />
          <Route path="/collection" element={<CollectionPage />} />
          <Route path="/wine" element={<CategoryPage category="wine" />} />
          <Route path="/beer" element={<CategoryPage category="beer" />} />
          <Route path="/whiskey" element={<CategoryPage category="whiskey" />} />
          <Route path="/others" element={<CategoryPage category="others" />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
