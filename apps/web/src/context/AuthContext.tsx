import React, { createContext, useContext, useEffect, useState } from "react";
import { authApi, User, setToken, getToken } from "../api";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (nickname: string, email: string, password: string, confirm: string) => Promise<void>;
  verifyEmail: (code: string, email?: string) => Promise<void>;
  resendVerification: (email?: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (getToken()) {
      authApi.me().then(setUser).catch(() => setToken(null)).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const refresh = async () => {
    if (!getToken()) return;
    try {
      const u = await authApi.me();
      setUser(u);
    } catch {
      setUser(null);
      setToken(null);
    }
  };

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    setToken(res.access_token);
    const u = await authApi.me();
    setUser(u);
  };

  const register = async (nickname: string, email: string, password: string, confirm: string) => {
    const res = await authApi.register({ nickname, email, password, confirm_password: confirm });
    setToken(res.access_token);
    const u = await authApi.me();
    setUser(u);
  };

  const verifyEmail = async (code: string, email?: string) => {
    await authApi.verifyEmail({ code, email });
    await refresh();
  };

  const resendVerification = async (email?: string) => {
    await authApi.resendVerification({ email });
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, verifyEmail, resendVerification, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
