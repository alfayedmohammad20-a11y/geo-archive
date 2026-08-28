import { createContext, useContext, useEffect, useState } from "react";
import { http } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = anon

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await http.get("/auth/me");
        if (mounted) setUser(data);
      } catch {
        if (mounted) setUser(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email, password) => {
    const { data } = await http.post("/auth/login", { email, password });
    if (data.token) localStorage.setItem("token", data.token);
    setUser({ id: data.id, email: data.email, role: data.role });
    return data;
  };

  const logout = async () => {
    try {
      await http.post("/auth/logout");
    } catch {}
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
