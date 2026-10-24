# @type-club/mcp-server

Official [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for the **Type Club** writing and publishing platform.

Allows AI assistants (Claude Desktop, Cursor, Antigravity, etc.) to securely read articles, perform searches, manage drafts, invite collaborators, edit content directly, and propose or review edits in **Advisor mode** (советник).

---

## Features

- 🔍 **Search & Filter**: Find public articles and personal drafts by title, author, or role.
- 📖 **Read Articles**: Retrieve raw Markdown or clean content with suggestions stripped/annotated.
- ✍️ **Create & Update**: Draft articles, update titles, visibility (`private`, `link`, `public`), and custom slugs.
- 👥 **Collaborate**: Invite co-authors (direct editing) and advisors (suggestion mode), or remove collaborators.
- 💡 **Advisor Mode (Suggestions)**: High-level `propose_suggestion` tool automatically generates Type Club suggestion marks (`<span class="suggestion-delete">`, `<span class="suggestion-insert">`, `<span class="suggestion-note">`) attributed to the AI assistant.
- ✅ **Review Suggestions**: Inspect pending suggestions and accept or reject them via `review_suggestion`.
- ⚡ **Real-Time Collaboration Sync**: Transparently syncs edits with active collaborators over WebSocket via Yjs CRDT.
- 🛡️ **Strict Security & Scopes**: Personal Access Tokens (PAT, `tc_pat_...`) hashed with SHA-256 in PostgreSQL, with granular scopes (`articles:read`, `articles:write`, `articles:manage`, `articles:delete`) and guardrails (`confirm: true` for destructive operations).

---

## Quick Start

### 1. Generate an API Key (PAT)
1. Open Type Club in your browser: `https://type-club.ru` (or local instance).
2. Go to **Settings** (`/settings?tab=mcp`).
3. Click **Generate API Key**, select the desired scopes and expiration, then copy your secret token.

### 2. Configure Claude Desktop

**Local Monorepo Build:**
```json
{
  "mcpServers": {
    "type-club": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.cjs"],
      "env": {
        "TYPECLUB_API_KEY": "tc_pat_your_token_here",
        "TYPECLUB_API_URL": "http://localhost:5173",
        "TYPECLUB_WS_URL": "ws://localhost:8001"
      }
    }
  }
}
```

**Global / NPM:**
```json
{
  "mcpServers": {
    "type-club": {
      "command": "npx",
      "args": ["-y", "@type-club/mcp-server"],
      "env": {
        "TYPECLUB_API_KEY": "tc_pat_your_token_here",
        "TYPECLUB_API_URL": "https://type-club.ru"
      }
    }
  }
}
```

### 3. Configure Cursor / Antigravity

**Local Monorepo Build:**
```json
{
  "mcpServers": {
    "typeClub": {
      "command": "node packages/mcp-server/dist/index.cjs",
      "env": {
        "TYPECLUB_API_KEY": "tc_pat_your_token_here",
        "TYPECLUB_API_URL": "http://localhost:5173",
        "TYPECLUB_WS_URL": "ws://localhost:8001"
      }
    }
  }
}
```

**Global / NPM:**
```json
{
  "mcpServers": {
    "typeClub": {
      "command": "npx",
      "args": ["-y", "@type-club/mcp-server"],
      "env": {
        "TYPECLUB_API_KEY": "tc_pat_your_token_here",
        "TYPECLUB_API_URL": "https://type-club.ru"
      }
    }
  }
}
```

---

## Tools Reference

| Tool | Scopes Required | Description |
|---|---|---|
| `search_articles` | `articles:read` | Search articles by query, author, and scope (`public` vs `my`) |
| `get_article` | `articles:read` | Fetch article by ID or `author`/`slug`, with format selection |
| `create_article` | `articles:manage` | Create a new article draft |
| `update_article` | `articles:manage` | Update title, slug, or visibility (`confirm: true` required when publishing) |
| `delete_article` | `articles:delete` | Permanently delete an article (`confirm: true` required) |
| `edit_content` | `articles:write` | Direct content rewrite or targeted patch (collaborative articles sync via Yjs) |
| `propose_suggestion` | `articles:write` | Propose an advisor suggestion with diff and note |
| `list_suggestions` | `articles:read` | List all pending advisor suggestions on an article |
| `review_suggestion` | `articles:write` | Accept or reject a suggestion by its `odId` |
| `list_collaborators` | `articles:read` | List co-authors and advisors |
| `invite_collaborator`| `articles:manage` | Invite a collaborator (`coauthor` or `editor`) |
| `remove_collaborator`| `articles:manage` | Remove a collaborator |
| `list_comments` | `articles:read` | List comments for an article |
| `add_comment` | `articles:write` | Add a comment to an article |
| `delete_comment` | `articles:delete` | Delete a comment |

---

## Resources & Prompts

### Resources
- `typeclub://articles/my`: Current user's articles.
- `typeclub://article/{id}`: Article content in markdown.

### Prompts
- `review_article`: Pre-built prompt to proofread an article and generate non-destructive suggestions in advisor mode.
- `brainstorm_article`: Pre-built prompt to search existing articles, brainstorm an outline, and create a draft.

---

## Transports

- **Stdio (default)**: Used when running as a local subprocess via `npx` or `node`.
- **HTTP / SSE**: Run with `--transport sse --port 3005` for remote network deployments.

```bash
node dist/index.js --transport sse --port 3005
```
