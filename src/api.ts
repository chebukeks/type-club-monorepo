/**
 * api.ts — HTTP client for type-club.ru API.
 * Works from Electron renderer (fetch is available).
 */

import { config } from "./config";

const BASE = config.apiUrl;

let token: string | null = localStorage.getItem("access_token");

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem("access_token", t);
  else localStorage.removeItem("access_token");
}

export function getToken() {
  return token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    if (typeof detail === "string") throw new Error(detail);
    if (Array.isArray(detail) && detail.length > 0) {
      throw new Error(detail.map((d: any) => d.msg || JSON.stringify(d)).join("; "));
    }
    throw new Error(res.statusText || "Request failed");
  }
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ── Auth ──

export interface User {
  id: number;
  nickname: string;
  email: string;
  email_verified: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export const authApi = {
  register: (data: { nickname: string; email: string; password: string; confirm_password: string }) =>
    api.post<TokenResponse>("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post<TokenResponse>("/auth/login", data),
  me: () => api.get<User>("/auth/me"),
  updateMe: (data: { nickname?: string; password?: string; confirm_password?: string }) =>
    api.patch<User>("/auth/me", data),
};

// ── Articles ──

export interface Article {
  id: number;
  author_id: number;
  title: string;
  content: string;
  access_state: "private" | "link" | "public" | "blocked";
  slug: string;
  created_at: string;
  updated_at: string;
  author_nickname?: string;
}

export interface ArticleListItem {
  id: number;
  title: string;
  access_state: string;
  slug: string;
  author_nickname: string;
  created_at: string;
  updated_at: string;
}

export const articlesApi = {
  listMy: (page = 1, size = 50) => api.get<ArticleListItem[]>(`/articles/my?page=${page}&size=${size}`),
  get: (id: number) => api.get<Article>(`/articles/${id}`),
  create: (data: { title: string; content?: string; slug?: string }) =>
    api.post<Article>("/articles", data),
  update: (id: number, data: { title?: string; content?: string; access_state?: string; slug?: string }) =>
    api.patch<Article>(`/articles/${id}`, data),
  delete: (id: number) => api.delete<void>(`/articles/${id}`),
};
