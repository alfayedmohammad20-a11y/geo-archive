import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { http } from "./lib/api";
import MapDetail from "./pages/MapDetail";

// Komponen Form Login Sederhana
function LoginPage({ setUser }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);

      const res = await http.post("/auth/token", formData);
      if (res.data) {
        // Ambil data user setelah token didapat
        const userRes = await http.get("/auth/me");
        setUser(userRes.data);
      }
    } catch (err) {
      setError("Login gagal. Periksa kembali username dan password Anda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "80px auto", padding: "24px", border: "1px solid #e2e8f0", borderRadius: "8px", fontFamily: "sans-serif" }}>
      <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Login Geo Archive</h2>
      {error && <div style={{ color: "red", marginBottom: "12px", fontSize: "14px" }}>{error}</div>}
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>Username / Email</label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: "10px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
        >
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </form>
    </div>
  );
}

// Komponen Utama Aplikasi
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    http
      .get("/auth/me")
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
        {/* Route Login */}
        <Route
          path="/login"
          element={!user ? <LoginPage setUser={setUser} /> : <Navigate to="/maps/1" />}
        />

        {/* Route Detail Peta */}
        <Route
          path="/maps/:id"
          element={user ? <MapDetail user={user} /> : <Navigate to="/login" />}
        />

        {/* Route Fallback (Otomatis Arahkan sesuai Status Login) */}
        <Route path="*" element={<Navigate to={user ? "/maps/1" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}
