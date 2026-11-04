/**
 * api.ts — HTTP client for type-club.ru API.
 * Works from Electron renderer (fetch is available).
 */

import { config } from "./config";

const BASE = config.apiUrl;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// If token was not stored in localStorage (user did not check "Remember me"),
// ensure it does not persist across desktop application restarts.
if (typeof localStorage !== "undefined" && !localStorage.getItem("access_token")) {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem("access_token");
  }
}

let token: string | null =
  (typeof localStorage !== "undefined" ? localStorage.getItem("access_token") : null) ||
  (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("access_token") : null);

export function setToken(t: string | null, remember: boolean = true) {
  token = t;
  if (t) {
    if (remember) {
      localStorage.setItem("access_token", t);
      sessionStorage.removeItem("access_token");
    } else {
      sessionStorage.setItem("access_token", t);
      localStorage.removeItem("access_token");
    }
  } else {
    localStorage.removeItem("access_token");
    sessionStorage.removeItem("access_token");
  }
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
    let msg = res.statusText || "Request failed";
    if (typeof detail === "string") msg = detail;
    else if (Array.isArray(detail) && detail.length > 0) {
      msg = detail.map((d: any) => d.msg || JSON.stringify(d)).join("; ");
    }
    throw new ApiError(msg, res.status);
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
    api.post<TokenResponse>("/auth/register", { ...data, email: data.email.trim().toLowerCase() }),
  login: (data: { email: string; password: string; remember_me?: boolean }) =>
    api.post<TokenResponse>("/auth/login", { ...data, email: data.email.trim().toLowerCase() }),
  initQr: () => api.post<{ session_id: string; url: string; expires_at: string }>("/auth/qr/init"),
  getQrStatus: (sessionId: string) =>
    api.get<{ status: string; access_token?: string }>(`/auth/qr/status/${sessionId}`),
  approveQr: (sessionId: string) =>
    api.post<{ status: string }>("/auth/qr/approve", { session_id: sessionId }),
  rejectQr: (sessionId: string) =>
    api.post<{ status: string }>("/auth/qr/reject", { session_id: sessionId }),
  me: () => api.get<User>("/auth/me"),
  updateMe: (data: { nickname?: string; password?: string; confirm_password?: string }) =>
    api.patch<User>("/auth/me", data),
  verifyEmail: (data: { code: string; email?: string }) =>
    api.post<{ message: string }>("/auth/verify-email", {
      ...data,
      email: data.email ? data.email.trim().toLowerCase() : undefined,
    }),
  resendVerification: (data?: { email?: string }) =>
    api.post<{ message: string }>("/auth/resend-verification", {
      ...data,
      email: data?.email ? data.email.trim().toLowerCase() : undefined,
    }),
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
  my_roles?: string[];
}

export const articlesApi = {
  listMy: (page = 1, size = 50) => api.get<ArticleListItem[]>(`/articles/my?page=${page}&size=${size}`),
  myListPaged: (params: { page?: number; size?: number; q?: string; roles?: string[] }) => {
    const sp = new URLSearchParams();
    if (params.page) sp.set("page", String(params.page));
    if (params.size) sp.set("size", String(params.size));
    if (params.q) sp.set("q", params.q);
    if (params.roles?.length) sp.set("roles", params.roles.join(","));
    return api.get<ArticleListItem[]>(`/articles/my?${sp}`);
  },
  get: (id: number) => api.get<Article>(`/articles/${id}`),
  create: (data: { title: string; content?: string; slug?: string }) =>
    api.post<Article>("/articles", data),
  update: (id: number, data: { title?: string; content?: string; access_state?: string; slug?: string }) =>
    api.patch<Article>(`/articles/${id}`, data),
  delete: (id: number) => api.delete<void>(`/articles/${id}`),
  myRole: (articleId: number) => api.get<{ role: string }>(`/articles/${articleId}/my-role`),
  uploadImage: async (articleId: number, file: File | Blob) => {
    const formData = new FormData();
    formData.append("file", file);
    const headers: Record<string, string> = {};
    const t = getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
    const res = await fetch(`${config.apiUrl}/articles/${articleId}/images`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json() as Promise<{ url: string }>;
  },
};

// ── Collaboration ──

export interface Collaborator {
  id: number;
  user_id: number;
  nickname: string;
  role: "editor" | "co_author";
  source: "invite" | "link";
  invited_at: string;
}

export interface ShareLink {
  token: string;
  url: string;
  role: string;
}

export const collaborationApi = {
  list: (articleId: number) => api.get<Collaborator[]>(`/articles/${articleId}/collaborators`),
  invite: (articleId: number, nickname: string, role: "editor" | "co_author") =>
    api.post<Collaborator>(`/articles/${articleId}/collaborators`, { nickname, role }),
  remove: (articleId: number, userId: number) =>
    api.delete<void>(`/articles/${articleId}/collaborators/${userId}`),
  generateLink: (articleId: number, role: "editor" | "co_author") =>
    api.post<ShareLink>(`/articles/${articleId}/share-link`, { role }),
};

// ── Users ──

export interface UserSearchResult {
  id: number;
  nickname: string;
}

export const usersApi = {
  search: (query: string, limit = 6) =>
    api.get<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(query)}&limit=${limit}`),
};
