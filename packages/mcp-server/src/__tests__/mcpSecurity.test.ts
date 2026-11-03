import { test, describe } from 'node:test'
import assert from 'node:assert'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerTools } from '../tools.js'
import { TypeClubApiClient } from '../apiClient.js'
import { CollabClient } from '../collabClient.js'

describe('MCP Server Security Guardrails & OWASP Defenses', () => {
  // Mock API client
  const mockApi = {
    getMe: async () => ({ id: 1, nickname: 'tester', email: 'test@example.com', role: 'author' }),
    getArticleById: async (id: number) => ({
      id,
      title: 'Test Article',
      slug: 'test',
      author_nickname: 'tester',
      access_state: 'private',
      view_count: 5,
      like_count: 2,
      content: 'Line 1\n' + 'A'.repeat(50000),
    }),
    listCollaborators: async () => [],
    removeCollaborator: async () => {},
    deleteComment: async () => {},
    updateArticle: async () => {},
  } as unknown as TypeClubApiClient

  const mockCollab = {} as unknown as CollabClient

  const server = new McpServer({ name: 'test-mcp', version: '1.0.0' })
  registerTools(server, mockApi, mockCollab)

  // Retrieve registered tools map
  const tools = (server as any)._registeredTools

  test('remove_collaborator should block deletion when confirm is false', async () => {
    const removeTool = tools['remove_collaborator']
    assert(removeTool, 'remove_collaborator tool must exist')
    const result = await removeTool.handler({ article_id: 1, user_id: 2, confirm: false })
    assert.strictEqual(result.isError, true)
    assert(result.content[0].text.includes('GUARD: Removing a collaborator revokes their access'))
  })

  test('delete_comment should block deletion when confirm is false', async () => {
    const deleteCommentTool = tools['delete_comment']
    assert(deleteCommentTool, 'delete_comment tool must exist')
    const result = await deleteCommentTool.handler({ comment_id: 10, confirm: false })
    assert.strictEqual(result.isError, true)
    assert(result.content[0].text.includes('GUARD: Deleting a comment is permanent'))
  })

  test('edit_content should block completely clearing content when confirm is false', async () => {
    const editTool = tools['edit_content']
    assert(editTool, 'edit_content tool must exist')
    const result = await editTool.handler({ article_id: 1, content: '   ', confirm: false })
    assert.strictEqual(result.isError, true)
    assert(result.content[0].text.includes('GUARD: Completely clearing article content requires confirm: true'))
  })

  test('get_article should enforce max_chars limit and return untrusted content security notice', async () => {
    const getArticleTool = tools['get_article']
    assert(getArticleTool, 'get_article tool must exist')
    const result = await getArticleTool.handler({ article_id: 1, max_chars: 1000, offset: 0 })
    assert.strictEqual(result.isError, undefined)
    const parsed = JSON.parse(result.content[0].text)
    assert.strictEqual(parsed.truncated, true)
    assert.strictEqual(parsed.content.length, 1000)
    assert(parsed._security_note.includes('Untrusted user content'))
  })
})
