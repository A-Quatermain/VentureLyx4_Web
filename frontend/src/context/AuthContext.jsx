import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiError, setToken, clearToken } from "@/lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined=loading, null=logged out
  const [business, setBusiness] = useState(null);

  const loadMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setBusiness(data.business);
    } catch {
      setUser(null);
      setBusiness(null);
    }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setToken(data.access_token);
      await loadMe();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) };
    }
  };

  const register = async (name, email, password) => {
    try {
      const { data } = await api.post("/auth/register", { name, email, password });
      setToken(data.access_token);
      await loadMe();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) };
    }
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    clearToken();
    setUser(null);
    setBusiness(null);
  };

  const refreshBusiness = loadMe;

  return (
    <AuthContext.Provider value={{ user, business, login, register, logout, refreshBusiness, setBusiness }}>
      {children}
    </AuthContext.Provider>
  );
}
