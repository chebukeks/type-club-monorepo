import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { TypeClubApiClient } from './apiClient.js'
import { CollabClient } from './collabClient.js'
import {
  parseSuggestionsFromMarkdown,
  applySuggestionDecision,
  getCleanMarkdown,
  proposeSuggestionInMarkdown,
} from '@type-club/editor/src/editor/suggestionUtils.js'

export function registerTools(
  server: McpServer,
  api: TypeClubApiClient,
  collab: CollabClient
): void {
  // Helper to fetch current user's nickname for tagging suggestions
  let cachedNickname: string | null = null
  async function getAuthorTag(): Promise<string> {
    if (!cachedNickname) {
      try {
        const me = await api.getMe()
        cachedNickname = me.nickname
      } catch {
        cachedNickname = 'AI Advisor'
      }
    }
    return `${cachedNickname} (AI)`
  }

  // Helper to apply markdown changes either via collab-server or REST
  async function applyArticleContentChange(
    articleId: number,
    modifier: (currentMarkdown: string) => string
  ): Promise<string> {
    const article = await api.getArticleById(articleId)
    const hasCollaborators = (await api.listCollaborators(articleId)).length > 0

    if (hasCollaborators) {
      try {
        return await collab.modifyCollaborativeArticle(articleId, modifier)
      } catch (err: any) {
        // If collab server is unavailable, attempt fallback via REST
        const updatedMarkdown = modifier(article.content || '')
        await api.updateArticle(articleId, { content: updatedMarkdown })
        return updatedMarkdown
      }
    } else {
      const updatedMarkdown = modifier(article.content || '')
      await api.updateArticle(articleId, { content: updatedMarkdown })
      return updatedMarkdown
    }
  }

  // 1. search_articles
  server.tool(
    'search_articles',
    'Search articles in Type Club by title, author, or scope (public vs user articles).',
    {
      query: z.string().optional().describe('Search query text in article titles'),
      author: z.string().optional().describe('Filter by author nickname'),
      scope: z
        .enum(['all', 'public', 'my'])
        .default('public')
        .describe('Search in public catalog or user own/collaborative articles'),
      page: z.number().int().min(1).default(1).describe('Page number'),
      limit: z.number().int().min(1).max(50).default(20).describe('Articles per page'),
    },
    async ({ query, author, scope, page, limit }) => {
      try {
        if (scope === 'my') {
          const articles = await api.getMyArticles({ q: query, page, size: limit })
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(articles, null, 2),
              },
            ],
          }
        } else {
          const articles = await api.searchPublicArticles({
            q: query,
            author,
            page,
            size: limit,
          })
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(articles, null, 2),
              },
            ],
          }
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to search articles: ${err.message}` }],
        }
      }
    }
  )

  // 2. get_article
  server.tool(
    'get_article',
    'Retrieve full article details and content by ID or author/slug path.',
    {
      article_id: z.number().int().optional().describe('Article ID in Type Club'),
      author: z.string().optional().describe('Author nickname (used with slug)'),
      slug: z.string().optional().describe('Article URL slug (used with author)'),
      format: z
        .enum(['markdown', 'markdown_clean', 'with_suggestions'])
        .default('markdown')
        .describe(
          'Format of content: clean text (markdown_clean), original with suggestion HTML (with_suggestions), or standard'
        ),
    },
    async ({ article_id, author, slug, format }) => {
      try {
        let article
        if (article_id) {
          article = await api.getArticleById(article_id)
        } else if (author && slug) {
          article = await api.getArticleByPath(author, slug)
        } else {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: 'Must provide either article_id or both author and slug.',
              },
            ],
          }
        }

        let content = article.content || ''
        if (format === 'markdown_clean') {
          content = getCleanMarkdown(content, 'accepted')
        }

        const suggestions = parseSuggestionsFromMarkdown(article.content || '')

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: article.id,
                  title: article.title,
                  slug: article.slug,
                  author: article.author_nickname,
                  access_state: article.access_state,
                  view_count: article.view_count,
                  like_count: article.like_count,
                  pending_suggestions_count: suggestions.length,
                  content,
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to get article: ${err.message}` }],
        }
      }
    }
  )

  // 3. create_article
  server.tool(
    'create_article',
    'Create a new article draft in Type Club.',
    {
      title: z.string().min(1).describe('Title of the article'),
      content: z.string().default('').describe('Initial Markdown content'),
      slug: z.string().optional().describe('Custom URL slug (alphanumeric, hyphens)'),
      access_state: z
        .enum(['private', 'link', 'public'])
        .default('private')
        .describe('Initial access state'),
    },
    async ({ title, content, slug, access_state }) => {
      try {
        const article = await api.createArticle({ title, content, slug })
        if (access_state && access_state !== 'private') {
          const updated = await api.updateArticle(article.id, { access_state })
          return {
            content: [
              {
                type: 'text',
                text: `Article created successfully:\n${JSON.stringify(updated, null, 2)}`,
              },
            ],
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: `Article created successfully:\n${JSON.stringify(article, null, 2)}`,
            },
          ],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to create article: ${err.message}` }],
        }
      }
    }
  )

  // 4. update_article
  server.tool(
    'update_article',
    'Update article metadata (title, slug, access visibility). Requires confirm=true to publish publicly.',
    {
      article_id: z.number().int().describe('Article ID'),
      title: z.string().optional().describe('New title'),
      slug: z.string().optional().describe('New slug'),
      access_state: z
        .enum(['private', 'link', 'public'])
        .optional()
        .describe('New visibility level'),
      confirm: z
        .boolean()
        .default(false)
        .describe('Explicit confirmation required when publishing publicly'),
    },
    async ({ article_id, title, slug, access_state, confirm }) => {
      try {
        if (access_state === 'public' && !confirm) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: 'GUARD: Making an article publicly visible requires explicit confirmation. Please re-run with confirm: true.',
              },
            ],
          }
        }

        const updated = await api.updateArticle(article_id, {
          title,
          slug,
          access_state,
        })
        return {
          content: [
            {
              type: 'text',
              text: `Article metadata updated:\n${JSON.stringify(updated, null, 2)}`,
            },
          ],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to update article: ${err.message}` }],
        }
      }
    }
  )

  // 5. delete_article
  server.tool(
    'delete_article',
    'Delete an article permanently from Type Club. Requires confirm=true and delete scope.',
    {
      article_id: z.number().int().describe('Article ID to delete'),
      confirm: z
        .boolean()
        .describe('Explicit confirmation required for article deletion'),
    },
    async ({ article_id, confirm }) => {
      try {
        if (!confirm) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: 'GUARD: Deleting an article is irreversible. Please re-run with confirm: true.',
              },
            ],
          }
        }

        await api.deleteArticle(article_id)
        return {
          content: [
            {
              type: 'text',
              text: `Article ${article_id} deleted successfully.`,
            },
          ],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to delete article: ${err.message}` }],
        }
      }
    }
  )

  // 6. edit_content
  server.tool(
    'edit_content',
    'Directly update or patch article Markdown content (for authors and co-authors).',
    {
      article_id: z.number().int().describe('Article ID'),
      content: z
        .string()
        .optional()
        .describe('New full Markdown content (overwrites document)'),
      target_text: z
        .string()
        .optional()
        .describe('Target substring to replace (for targeted patch)'),
      replacement_text: z
        .string()
        .optional()
        .describe('Replacement text for target substring'),
    },
    async ({ article_id, content, target_text, replacement_text }) => {
      try {
        const result = await applyArticleContentChange(article_id, (current) => {
          if (content !== undefined) {
            return content
          }
          if (target_text !== undefined && replacement_text !== undefined) {
            if (!current.includes(target_text)) {
              throw new Error(`Target text "${target_text}" not found in article content.`)
            }
            return current.replace(target_text, replacement_text)
          }
          throw new Error('Must provide either content or target_text + replacement_text.')
        })

        return {
          content: [
            {
              type: 'text',
              text: `Content updated successfully. Length: ${result.length} characters.`,
            },
          ],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to edit content: ${err.message}` }],
        }
      }
    }
  )

  // 7. propose_suggestion (Advisor mode)
  server.tool(
    'propose_suggestion',
    'Propose an edit in advisor mode. Automatically wraps changes in suggestion marks with author attribution.',
    {
      article_id: z.number().int().describe('Article ID'),
      target_text: z
        .string()
        .describe('Existing text in the article proposed to be replaced or deleted'),
      replacement_text: z
        .string()
        .describe('Suggested new replacement text (empty string for proposed deletion)'),
      comment: z
        .string()
        .optional()
        .describe('Explanation/note for the author about this suggestion'),
    },
    async ({ article_id, target_text, replacement_text, comment }) => {
      try {
        const authorTag = await getAuthorTag()
        await applyArticleContentChange(article_id, (current) => {
          return proposeSuggestionInMarkdown(
            current,
            target_text,
            replacement_text,
            authorTag,
            comment
          )
        })

        return {
          content: [
            {
              type: 'text',
              text: `Suggestion proposed successfully by "${authorTag}". Target: "${target_text}" -> "${replacement_text}"`,
            },
          ],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to propose suggestion: ${err.message}` }],
        }
      }
    }
  )

  // 8. list_suggestions
  server.tool(
    'list_suggestions',
    'List all pending suggestions/advisor proposals for an article.',
    {
      article_id: z.number().int().describe('Article ID'),
    },
    async ({ article_id }) => {
      try {
        const article = await api.getArticleById(article_id)
        const suggestions = parseSuggestionsFromMarkdown(article.content || '')
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(suggestions, null, 2),
            },
          ],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to list suggestions: ${err.message}` }],
        }
      }
    }
  )

  // 9. review_suggestion
  server.tool(
    'review_suggestion',
    'Accept or reject an advisor suggestion by its ID (odId).',
    {
      article_id: z.number().int().describe('Article ID'),
      suggestion_id: z.string().describe('The odId of the suggestion to accept or reject'),
      decision: z.enum(['accept', 'reject']).describe('Action to take'),
    },
    async ({ article_id, suggestion_id, decision }) => {
      try {
        await applyArticleContentChange(article_id, (current) => {
          return applySuggestionDecision(current, suggestion_id, decision)
        })

        return {
          content: [
            {
              type: 'text',
              text: `Suggestion "${suggestion_id}" ${decision === 'accept' ? 'accepted' : 'rejected'} successfully.`,
            },
          ],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to review suggestion: ${err.message}` }],
        }
      }
    }
  )

  // 10. list_collaborators
  server.tool(
    'list_collaborators',
    'List all collaborators (co-authors and advisors) for an article.',
    {
      article_id: z.number().int().describe('Article ID'),
    },
    async ({ article_id }) => {
      try {
        const collaborators = await api.listCollaborators(article_id)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(collaborators, null, 2),
            },
          ],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to list collaborators: ${err.message}` }],
        }
      }
    }
  )

  // 11. invite_collaborator
  server.tool(
    'invite_collaborator',
    'Invite a Type Club user to collaborate on an article as a co-author or advisor.',
    {
      article_id: z.number().int().describe('Article ID'),
      nickname: z.string().describe('Nickname of the user to invite'),
      role: z
        .enum(['coauthor', 'editor'])
        .describe('Collaboration role: coauthor (direct edit) or editor (advisor mode)'),
    },
    async ({ article_id, nickname, role }) => {
      try {
        const collab = await api.inviteCollaborator(article_id, nickname, role)
        return {
          content: [
            {
              type: 'text',
              text: `User "${nickname}" invited as ${role} successfully:\n${JSON.stringify(collab, null, 2)}`,
            },
          ],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to invite collaborator: ${err.message}` }],
        }
      }
    }
  )

  // 12. remove_collaborator
  server.tool(
    'remove_collaborator',
    'Remove a collaborator from an article.',
    {
      article_id: z.number().int().describe('Article ID'),
      user_id: z.number().int().describe('User ID of the collaborator to remove'),
    },
    async ({ article_id, user_id }) => {
      try {
        await api.removeCollaborator(article_id, user_id)
        return {
          content: [
            {
              type: 'text',
              text: `Collaborator (ID ${user_id}) removed from article ${article_id}.`,
            },
          ],
        }
      } catch (err: any) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to remove collaborator: ${err.message}` }],
        }
      }
    }
  )
}
