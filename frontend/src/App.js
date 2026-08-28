import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import Header from "@/components/Header";
import Home from "@/pages/Home";
import MapDetail from "@/pages/MapDetail";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";

function Footer() {
  return (
    <footer className="border-t border-black/10 mt-24">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-[#52525B]">
          GEO/ARCHIVE · Public geospatial repository
        </div>
        <div className="font-mono text-xs text-[#A1A1AA]">
          Built with FastAPI · Leaflet · OpenStreetMap
        </div>
      </div>
    </footer>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/map/:id" element={<MapDetail />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
          </main>
          <Footer />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
