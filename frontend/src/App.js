import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { http } from "./lib/api";
import Login from "./pages/Login";
import MapDetail from "./pages/MapDetail";
import Dashboard from "./pages/Dashboard";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    http.get("/auth/me")
      .then((res) => {
        setUser(res.data);
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "32px", textAlign: "center", fontFamily: "sans-serif" }}>
        Memeriksa sesi login...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Jika belum login, tampilkan form Login. Jika sudah login, lempar ke Dashboard */}
        <Route 
          path="/login" 
          element={!user ? <Login setUser={setUser} /> : <Navigate to="/" />} 
        />
        
        {/* Halaman Dashboard Utama */}
        <Route 
          path="/" 
          element={user ? <Dashboard user={user} setUser={setUser} /> : <Navigate to="/login" />} 
        />
        
        {/* Halaman Detail Peta (dengan Tombol KML Google Earth) */}
        <Route 
          path="/maps/:id" 
          element={user ? <MapDetail user={user} /> : <Navigate to="/login" />} 
        />

        {/* Fallback jika route tidak ditemukan */}
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
