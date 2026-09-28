import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { http } from "./lib/api";
import MapDetail from "./pages/MapDetail";
// Import komponen halaman lain milikmu jika ada (misal: Login, Dashboard)

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
        // Jika 401 Unauthorized / belum login, set user null tanpa bikin error
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
        {/* Arahkan ke halaman MapDetail atau halaman utama */}
        <Route path="/maps/:id" element={<MapDetail />} />
        
        {/* Route fallback sederhana jika belum ada halaman login khusus */}
        <Route
          path="*"
          element={
            <div style={{ padding: "32px", textAlign: "center", fontFamily: "sans-serif" }}>
              <h2>Geo Archive Portal</h2>
              {user ? (
                <p>Selamat datang, {user.name || user.email || "User"}!</p>
              ) : (
                <p>Sesi login belum aktif atau tidak ditemukan.</p>
              )}
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
