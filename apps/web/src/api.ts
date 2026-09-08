const BASE = "/api";

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
  const res = await rawRequest(path, options);
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function rawRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    if (typeof detail === "string") throw new Error(detail);
    if (Array.isArray(detail) && detail.length > 0) {
      throw new Error(detail.map((d: any) => d.msg || JSON.stringify(d)).join("; "));
    }
    throw new Error(res.statusText || "Request failed");
  }
  return res;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

async function getPaged<T>(path: string): Promise<Paged<T>> {
  const res = await rawRequest(path);
  const items: T[] = await res.json();
  const total = parseInt(res.headers.get("X-Total-Count") ?? "", 10);
  return { items, total: Number.isNaN(total) ? items.length : total };
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
  role: string;
  avatar_url?: string | null;
  bio?: string | null;
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
  updateMe: (data: {
    nickname?: string;
    avatar_url?: string;
    bio?: string;
    password?: string;
    confirm_password?: string;
  }) => api.patch<User>("/auth/me", data),
  verifyEmail: (data: { code?: string; token?: string; email?: string } | string) => {
    const payload = typeof data === "string" ? { code: data } : data;
    return api.post<{ message: string }>("/auth/verify-email", payload);
  },
  resendVerification: (data?: { email?: string }) =>
    api.post<{ message: string }>("/auth/resend-verification", data),
  forgotPassword: (email: string) =>
    api.post<{ message: string }>("/auth/forgot-password", { email }),
  resetPassword: (token: string, password: string, confirm_password: string) =>
    api.post<{ message: string }>("/auth/reset-password", { token, password, confirm_password }),
};

// ── Articles ──
export interface Article {
  id: number;
  author_id: number;
  title: string;
  content: string;
  access_state: "private" | "link" | "public" | "blocked";
  slug: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  liked_by_user: boolean;
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
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  my_roles?: string[] | null;
}

export interface ArticlesQuery {
  page?: number;
  size?: number;
  q?: string;
  author?: string;
  roles?: string[];
}

function buildQuery(params: ArticlesQuery): string {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page ?? 1));
  sp.set("size", String(params.size ?? 20));
  if (params.q) sp.set("q", params.q);
  if (params.author) sp.set("author", params.author);
  if (params.roles) sp.set("roles", params.roles.join(","));
  return sp.toString();
}

export const articlesApi = {
  list: (page = 1, size = 20) => api.get<ArticleListItem[]>(`/articles?page=${page}&size=${size}`),
  myList: (page = 1, size = 20) => api.get<ArticleListItem[]>(`/articles/my?page=${page}&size=${size}`),
  listPaged: (params: ArticlesQuery) =>
    getPaged<ArticleListItem>(`/articles?${buildQuery(params)}`),
  myListPaged: (params: ArticlesQuery) =>
    getPaged<ArticleListItem>(`/articles/my?${buildQuery(params)}`),
  create: (data: { title: string; content?: string; slug?: string }) =>
    api.post<Article>("/articles", data),
  get: (id: number) => api.get<Article>(`/articles/${id}`),
  getByPath: (username: string, slug: string) =>
    api.get<Article>(`/articles/lookup/${username}/${slug}`),
  update: (id: number, data: { title?: string; content?: string; access_state?: string; slug?: string }) =>
    api.patch<Article>(`/articles/${id}`, data),
  delete: (id: number) => api.delete<void>(`/articles/${id}`),
  moderate: (id: number, action: "block" | "unblock") =>
    api.post<{ message: string }>(`/articles/${id}/moderate`, { action }),
};

// ── Comments ──

export interface Comment {
  id: number;
  article_id: number;
  user_id: number;
  author_nickname: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export const commentsApi = {
  list: (articleId: number, sort: "newest" | "oldest" = "newest", page = 1, size = 20) =>
    getPaged<Comment>(`/articles/${articleId}/comments?sort=${sort}&page=${page}&size=${size}`),
  create: (articleId: number, content: string) =>
    api.post<Comment>(`/articles/${articleId}/comments`, { content }),
  update: (commentId: number, content: string) =>
    api.patch<Comment>(`/comments/${commentId}`, { content }),
  delete: (commentId: number) => api.delete<void>(`/comments/${commentId}`),
};

// ── Stats ──

export interface LikeResponse {
  liked: boolean;
  count: number;
}

export interface ViewResponse {
  count: number;
}

export const statsApi = {
  view: (articleId: number) => api.post<ViewResponse>(`/articles/${articleId}/view`),
  getViews: (articleId: number) => api.get<ViewResponse>(`/articles/${articleId}/views`),
  like: (articleId: number) => api.post<LikeResponse>(`/articles/${articleId}/like`),
  getLikes: (articleId: number) => api.get<LikeResponse>(`/articles/${articleId}/likes`),
};

// ── Users ──

export interface UserSuggestion {
  id: number;
  nickname: string;
}

export interface UserProfile {
  id: number;
  nickname: string;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  article_count: number;
  total_views: number;
  total_likes: number;
  created_at: string;
}

export const usersApi = {
  search: (q: string, limit = 10) =>
    api.get<UserSuggestion[]>(`/users?q=${encodeURIComponent(q)}&limit=${limit}`),
  getProfile: (nickname: string) => api.get<UserProfile>(`/users/${nickname}`),
  getProfileArticles: (nickname: string, page = 1, size = 20) =>
    getPaged<ArticleListItem>(`/users/${nickname}/articles?page=${page}&size=${size}`),
  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await rawRequest("/users/avatar", { method: "POST", body: formData });
    return res.json();
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
  getByToken: (token: string) => api.get<Article>(`/articles/shared/${token}`),
  joinByToken: (token: string) =>
    api.post<Collaborator>(`/articles/shared/${token}/join`),
};

// ── Notifications ──

export interface NotificationItem {
  id: number;
  user_id: number;
  sender_id?: number | null;
  sender_nickname?: string | null;
  sender_avatar_url?: string | null;
  article_id?: number | null;
  article_title?: string | null;
  article_slug?: string | null;
  article_author_nickname?: string | null;
  type: "comment" | "collab_invite" | "system" | string;
  title: string;
  message: string;
  link: string | null;
  data?: string | null;
  read?: boolean;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListResponse {
  items: NotificationItem[];
  unread_count: number;
  total: number;
}

export const notificationsApi = {
  list: (params?: { page?: number; size?: number; unread_only?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.size) qs.set("size", String(params.size));
    if (params?.unread_only) qs.set("unread_only", "true");
    const query = qs.toString();
    return api.get<NotificationListResponse>(`/notifications${query ? `?${query}` : ""}`);
  },
  markRead: (id: number) =>
    api.patch<NotificationItem>(`/notifications/${id}/read`),
  markAllRead: () =>
    api.post<{ message: string }>("/notifications/read-all"),
  delete: (id: number) =>
    api.delete<void>(`/notifications/${id}`),
};

export function formatNotificationItem(
  n: NotificationItem,
  t: (key: any, params?: Record<string, any>) => string
): { title: string; message: string; link: string | null } {
  let role = "advisor";
  let snippet = "";
  let articleTitle = n.article_title || "";

  if (n.data) {
    try {
      const parsed = typeof n.data === "string" ? JSON.parse(n.data) : n.data;
      if (parsed.role) role = parsed.role;
      if (parsed.snippet) snippet = parsed.snippet;
      if (parsed.article_title && !articleTitle) articleTitle = parsed.article_title;
    } catch {}
  }

  const user = n.sender_nickname || t("notifications.user");
  const article = articleTitle || t("notifications.article");

  let title = n.title;
  let message = n.message;
  let link = n.link;

  if (n.type === "comment") {
    title = t("notifications.comment", { user, article });
    message = snippet || t("notifications.newComment");
    if (!link) {
      if (n.article_author_nickname && n.article_slug) {
        link = `/${n.article_author_nickname}/${n.article_slug}#comments`;
      } else if (n.article_id) {
        link = `/editor/${n.article_id}`;
      }
    }
  } else if (n.type === "collab_invite") {
    if (role === "coauthor" || role === "co_author") {
      title = t("notifications.collabInviteCoAuthorTitle");
      message = t("notifications.collabInviteCoAuthor", { user, article });
    } else {
      title = t("notifications.collabInviteAdvisorTitle");
      message = t("notifications.collabInviteAdvisor", { user, article });
    }
    if (!link && n.article_id) {
      link = `/editor/${n.article_id}`;
    }
  }

  return { title: title || n.title, message: message || n.message, link };
}
