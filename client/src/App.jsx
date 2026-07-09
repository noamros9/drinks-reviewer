import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import CategoryPage from './pages/CategoryPage';
import AllDrinksPage from './pages/AllDrinksPage';
import CollectionPage from './pages/CollectionPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AdminPage from './pages/AdminPage';
import ComparePage from './pages/ComparePage';
import RecommendPage from './pages/RecommendPage';
import TasteCardPage from './pages/TasteCardPage';

function AdminRoute() {
  const { key } = useLocation();
  return <AdminPage key={key} />;
}

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
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/recommend" element={<RecommendPage />} />
          <Route path="/taste-card" element={<TasteCardPage />} />
          <Route path="/admin" element={<AdminRoute />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
