export interface UserProfile {
  id: number
  nickname: string
  email: string
  role: string
  avatar_url?: string | null
  bio?: string | null
}

export interface ArticleItem {
  id: number
  title: string
  access_state: string
  slug: string
  author_nickname: string
  view_count: number
  like_count: number
  comment_count: number
  created_at: string
  updated_at: string
  my_roles?: string[]
}

export interface ArticleDetail extends ArticleItem {
  author_id: number
  content: string
  liked_by_user: boolean
}

export interface CollaboratorItem {
  id: number
  user_id: number
  nickname: string
  role: string
  source: string
  invited_at: string
}

export interface CommentItem {
  id: number
  article_id: number
  user_id: number
  author_nickname: string
  content: string
  created_at: string
  updated_at: string
}

export class TypeClubApiClient {
  private apiUrl: string
  private apiKey: string

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl.replace(/\/+$/, '')
    this.apiKey = apiKey
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: string
      body?: any
      query?: Record<string, string | number | boolean | undefined>
    } = {}
  ): Promise<T> {
    const url = new URL(`${this.apiUrl}${endpoint}`)
    if (options.query) {
      for (const [key, val] of Object.entries(options.query)) {
        if (val !== undefined && val !== null && val !== '') {
          url.searchParams.set(key, String(val))
        }
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const res = await fetch(url.toString(), {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })

    if (!res.ok) {
      let errorDetail = res.statusText
      try {
        const json = await res.json()
        errorDetail = json.detail || json.message || JSON.stringify(json)
      } catch {
        // use status text
      }
      throw new Error(`Type Club API error (${res.status}): ${errorDetail}`)
    }

    if (res.status === 204) {
      return null as T
    }

    return (await res.json()) as T
  }

  async getMe(): Promise<UserProfile> {
    return this.request<UserProfile>('/api/auth/me')
  }

  async searchPublicArticles(params: {
    q?: string
    author?: string
    page?: number
    size?: number
  }): Promise<ArticleItem[]> {
    return this.request<ArticleItem[]>('/api/articles', {
      query: {
        q: params.q,
        author: params.author,
        page: params.page || 1,
        size: params.size || 20,
      },
    })
  }

  async getMyArticles(params: {
    q?: string
    roles?: string
    page?: number
    size?: number
  }): Promise<ArticleItem[]> {
    return this.request<ArticleItem[]>('/api/articles/my', {
      query: {
        q: params.q,
        roles: params.roles,
        page: params.page || 1,
        size: params.size || 20,
      },
    })
  }

  async getArticleById(id: number): Promise<ArticleDetail> {
    return this.request<ArticleDetail>(`/api/articles/${id}`)
  }

  async getArticleByPath(username: string, slug: string): Promise<ArticleDetail> {
    return this.request<ArticleDetail>(`/api/articles/lookup/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`)
  }

  async createArticle(data: {
    title: string
    content?: string
    slug?: string
  }): Promise<ArticleDetail> {
    return this.request<ArticleDetail>('/api/articles', {
      method: 'POST',
      body: data,
    })
  }

  async updateArticle(
    id: number,
    data: {
      title?: string
      content?: string
      access_state?: string
      slug?: string
    }
  ): Promise<ArticleDetail> {
    return this.request<ArticleDetail>(`/api/articles/${id}`, {
      method: 'PATCH',
      body: data,
    })
  }

  async deleteArticle(id: number): Promise<void> {
    await this.request<void>(`/api/articles/${id}`, {
      method: 'DELETE',
    })
  }

  async listCollaborators(articleId: number): Promise<CollaboratorItem[]> {
    return this.request<CollaboratorItem[]>(`/api/articles/${articleId}/collaborators`)
  }

  async inviteCollaborator(
    articleId: number,
    nickname: string,
    role: 'coauthor' | 'editor'
  ): Promise<CollaboratorItem> {
    return this.request<CollaboratorItem>(`/api/articles/${articleId}/collaborators`, {
      method: 'POST',
      body: { nickname, role },
    })
  }

  async removeCollaborator(articleId: number, userId: number): Promise<void> {
    await this.request<void>(`/api/articles/${articleId}/collaborators/${userId}`, {
      method: 'DELETE',
    })
  }

  async listComments(
    articleId: number,
    params: { page?: number; size?: number; sort?: 'newest' | 'oldest' } = {}
  ): Promise<CommentItem[]> {
    return this.request<CommentItem[]>(`/api/articles/${articleId}/comments`, {
      query: {
        page: params.page || 1,
        size: params.size || 20,
        sort: params.sort || 'newest',
      },
    })
  }

  async addComment(articleId: number, content: string): Promise<CommentItem> {
    return this.request<CommentItem>(`/api/articles/${articleId}/comments`, {
      method: 'POST',
      body: { content },
    })
  }

  async deleteComment(commentId: number): Promise<void> {
    await this.request<void>(`/api/comments/${commentId}`, {
      method: 'DELETE',
    })
  }
}
