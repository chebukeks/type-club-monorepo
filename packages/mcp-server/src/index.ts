#!/usr/bin/env node
import http from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { loadConfig } from './config.js'
import { TypeClubApiClient } from './apiClient.js'
import { CollabClient } from './collabClient.js'
import { registerTools } from './tools.js'
import { registerResources } from './resources.js'
import { registerPrompts } from './prompts.js'

async function main() {
  const config = loadConfig()

  const api = new TypeClubApiClient(config.apiUrl, config.apiKey)
  const collab = new CollabClient(config.wsUrl, config.apiKey)

  function createServerInstance(): McpServer {
    const server = new McpServer(
      {
        name: 'type-club',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    )

    registerTools(server, api, collab)
    registerResources(server, api)
    registerPrompts(server)

    return server
  }

  if (config.transport === 'sse') {
    // Multi-client SSE server
    const transports = new Map<string, SSEServerTransport>()

    const httpServer = http.createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

      if (url.pathname === '/sse' && req.method === 'GET') {
        const server = createServerInstance()
        const transport = new SSEServerTransport('/message', res)
        transports.set(transport.sessionId, transport)

        transport.onclose = () => {
          transports.delete(transport.sessionId)
        }

        await server.connect(transport)
      } else if (url.pathname === '/message' && req.method === 'POST') {
        const sessionId = url.searchParams.get('sessionId')
        const transport = sessionId ? transports.get(sessionId) : undefined

        if (!transport) {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Session not found')
          return
        }

        await transport.handlePostMessage(req, res)
      } else if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok', server: 'type-club-mcp' }))
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not found')
      }
    })

    httpServer.listen(config.port, config.host, () => {
      console.error(
        `[type-club-mcp] SSE server running on http://${config.host}:${config.port}/sse`
      )
    })
  } else {
    // Default: Stdio transport for local clients (Claude Desktop, Cursor, Antigravity)
    const server = createServerInstance()
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error('[type-club-mcp] Server running on stdio')
  }
}

main().catch((err) => {
  console.error('[type-club-mcp] Fatal error:', err)
  process.exit(1)
})
