import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { http } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = anon

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await http.get("/auth/me");
      setUser(data);
    } catch (err) {
      // Not authenticated — expected for public visitors
      if (err?.response?.status && err.response.status !== 401) {
        console.warn("auth/me failed:", err);
      }
      setUser(null);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (email, password) => {
    // Backend sets an httpOnly `access_token` cookie on success.
    const { data } = await http.post("/auth/login", { email, password });
    setUser({ id: data.id, email: data.email, role: data.role });
    return data;
  };

  const logout = async () => {
    try {
      await http.post("/auth/logout");
    } catch (err) {
      console.warn("logout request failed:", err);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
