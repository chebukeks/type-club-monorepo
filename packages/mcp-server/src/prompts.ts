import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

export function registerPrompts(server: McpServer): void {
  // 1. review_article
  server.prompt(
    'review_article',
    'Review an article and propose edits as an advisor.',
    {
      article_id: z.string().describe('ID of the article to review'),
      focus: z
        .string()
        .optional()
        .describe('Specific review focus (e.g. grammar, tone, technical accuracy)'),
    },
    async ({ article_id, focus }) => {
      const focusText = focus
        ? `Focus primarily on: ${focus}.`
        : 'Check grammar, readability, tone, and logical clarity.'

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please review article with ID ${article_id} in Type Club.
1. Use the "get_article" tool to fetch its content.
2. ${focusText}
3. For each proposed improvement, do NOT rewrite the entire article directly. Instead, use the "propose_suggestion" tool so the author can review, accept, or reject each edit individually.
4. Provide a polite summary of your findings after submitting the suggestions.`,
            },
          },
        ],
      }
    }
  )

  // 2. brainstorm_article
  server.prompt(
    'brainstorm_article',
    'Brainstorm structure, outline, and initial draft for a new article in Type Club.',
    {
      topic: z.string().describe('Topic or idea for the article'),
      target_audience: z.string().optional().describe('Target audience for the article'),
    },
    async ({ topic, target_audience }) => {
      const audienceText = target_audience ? ` for ${target_audience}` : ''
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `I want to create a new article about "${topic}"${audienceText} in Type Club.
1. Search Type Club for related existing articles using "search_articles" to see what has already been published.
2. Propose a compelling title, URL slug, and detailed outline.
3. Once approved, offer to create the initial draft using "create_article".`,
            },
          },
        ],
      }
    }
  )
}
