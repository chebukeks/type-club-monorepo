/**
 * AuthContext.tsx — Auth state management for type-club.ru integration.
 */
import React, { createContext, useContext, useEffect, useState } from "react";
import { authApi, User, setToken, getToken, ApiError } from "../api";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  loginWithToken: (token: string, rememberMe?: boolean) => Promise<void>;
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
      authApi.me()
        .then(setUser)
        .catch((err) => {
          // Only clear token if server explicitly returned 401 Unauthorized
          // If server is deploying (502/503) or offline, do not clear token!
          if ((err instanceof ApiError && err.status === 401) || (err as any)?.status === 401) {
            setToken(null);
            setUser(null);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const refresh = async () => {
    if (!getToken()) return;
    try {
      const u = await authApi.me();
      setUser(u);
    } catch (err: any) {
      if ((err instanceof ApiError && err.status === 401) || (err as any)?.status === 401) {
        setUser(null);
        setToken(null);
      }
    }
  };

  const login = async (email: string, password: string, rememberMe: boolean = true) => {
    const res = await authApi.login({ email: email.trim().toLowerCase(), password, remember_me: rememberMe });
    setToken(res.access_token, rememberMe);
    const u = await authApi.me();
    setUser(u);
  };

  const loginWithToken = async (accessToken: string, rememberMe: boolean = true) => {
    setToken(accessToken, rememberMe);
    const u = await authApi.me();
    setUser(u);
  };

  const register = async (nickname: string, email: string, password: string, confirm: string) => {
    const res = await authApi.register({
      nickname: nickname.trim(),
      email: email.trim().toLowerCase(),
      password,
      confirm_password: confirm,
    });
    setToken(res.access_token, true);
    const u = await authApi.me();
    setUser(u);
  };

  const verifyEmail = async (code: string, email?: string) => {
    await authApi.verifyEmail({ code, email: email ? email.trim().toLowerCase() : undefined });
    await refresh();
  };

  const resendVerification = async (email?: string) => {
    await authApi.resendVerification({ email: email ? email.trim().toLowerCase() : undefined });
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithToken, register, verifyEmail, resendVerification, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
